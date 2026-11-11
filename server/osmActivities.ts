import { UA, cached } from "./fetchy.js";
import type { Place } from "./weather.js";
import type { Highlight } from "./places.js";
import type { ActivityId } from "../shared/activities.js";
import { cleanVenueName, isAdminOrReligiousOrg } from "../shared/activities.js";

/** One combined Overpass query for activity venues. Cached; never more than one new call per place. */
const KIND_TO_ACTIVITY: Record<string, ActivityId> = {
  viewpoint: "sightseeing", beach: "beach", winery: "tasting", brewery: "tasting", distillery: "tasting", vineyard: "tasting",
  golf_course: "golf", theme_park: "parks", water_park: "parks", zoo: "family", aquarium: "family",
  spa: "spa", public_bath: "spa", hot_spring: "spa", scuba_diving: "dive", marina: "boat",
  boat_rental: "boat", bicycle_rental: "cycling", camp_site: "camping", nightclub: "nightlife",
  bar: "nightlife", pub: "nightlife", marketplace: "shopping", trailhead: "hiking", peak: "hiking",
  nature_reserve: "wildlife", national_park: "wildlife", climbing: "climbing", fishing: "fishing",
  theatre: "shows", arts_centre: "shows", museum: "museums", gallery: "museums",
  castle: "heritage", ruins: "heritage", archaeological_site: "heritage", monument: "heritage",
};

const OVERPASS_HOSTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export function beachPreferRank(name: string) {
  const n = (name || "").toLowerCase();
  if (/camps bay/.test(n)) return 3;
  if (/clifton/.test(n)) return 2;
  if (/muizenberg/.test(n)) return 1;
  return 0;
}

export function osmActivities(p: Place, ids: ActivityId[]): Promise<Highlight[]> {
  if (!ids.length) return Promise.resolve([]);
  return cached(`activityVenues|v4|${p.lat.toFixed(3)},${p.lon.toFixed(3)}`, async () => {
    const [osm, wd] = await Promise.all([osmActivities0(p), wikidataActivities(p)]);
    return mergeActivityPlaces(osm, wd, 80);
  }).then(all => {
    const want = new Set(ids);
    return all.filter(h => {
      if (!h.name || /^Q\d+$/i.test(h.name)) return false;
      const act = (h as any).activity as ActivityId | undefined;
      if (act && want.has(act)) return true;
      const mapped = KIND_TO_ACTIVITY[(h.type || "").replace(/ /g, "_")] as ActivityId | undefined;
      return !h.type || (mapped ? want.has(mapped) : false);
    });
  }).catch(() => []);
}

function asHighlight(name: string, kind: string, activity: ActivityId, source: string, lat?: number, lon?: number, url?: string): Highlight | null {
  const clean = cleanVenueName(name);
  if (!clean || clean.length < 3 || /^Q\d+$/i.test(clean)) return null;
  if (isAdminOrReligiousOrg({ name: clean, type: kind })) return null;
  if (activity === "nightlife" && /coffee|caf[eé]/i.test(clean) && !/\b(bar|club|pub|tavern)\b/i.test(clean)) return null;
  if (activity === "dive" && /aquarium|zoo|oceanarium/i.test(`${clean} ${kind}`)) return null;
  return {
    name: clean,
    description: `${kind.replace(/_/g, " ")} (${source})`,
    setting: /nightclub|bar|pub|theatre|spa|museum|gallery|aquarium|arts/.test(kind) ? "indoor" as const : "outdoor" as const,
    indoor: /nightclub|bar|pub|theatre|spa|museum|gallery|aquarium/.test(kind),
    type: String(kind).replace(/_/g, " "),
    source,
    activity,
    lat, lon, ...(url ? { url } : {}),
  } as Highlight;
}

async function osmActivities0(p: Place): Promise<Highlight[]> {
  const a = (r: number, sel: string, n: number) => `nwr(around:${r},${p.lat},${p.lon})${sel}["name"];out center ${n};`;
  // Per-kind `out` reserves slots so beaches, bars, wineries and museums are not dropped by a single global cap.
  const q = `[out:json][timeout:8];${[
    a(35000, '["natural"="beach"]', 25),
    a(20000, '["tourism"="viewpoint"]', 12),
    a(30000, '["tourism"="winery"]', 12), a(30000, '["craft"="winery"]', 8), a(20000, '["craft"="brewery"]', 8), a(20000, '["craft"="distillery"]', 6),
    a(25000, '["leisure"="golf_course"]', 6), a(20000, '["tourism"="theme_park"]', 6), a(20000, '["leisure"="water_park"]', 4),
    a(15000, '["tourism"="zoo"]', 4), a(15000, '["tourism"="aquarium"]', 4),
    a(15000, '["leisure"="spa"]', 6), a(15000, '["amenity"="public_bath"]', 4), a(15000, '["natural"="hot_spring"]', 4),
    a(25000, '["shop"="scuba_diving"]', 8), a(25000, '["sport"="scuba_diving"]', 8),
    a(20000, '["leisure"="marina"]', 6), a(15000, '["amenity"="boat_rental"]', 4), a(15000, '["amenity"="bicycle_rental"]', 4),
    a(20000, '["tourism"="camp_site"]', 6), a(12000, '["amenity"="nightclub"]', 10), a(12000, '["amenity"="bar"]', 15), a(12000, '["amenity"="pub"]', 8),
    a(10000, '["amenity"="marketplace"]', 6), a(20000, '["highway"="trailhead"]', 8), a(20000, '["natural"="peak"]', 10),
    a(20000, '["leisure"="nature_reserve"]', 6), a(20000, '["boundary"="national_park"]', 4),
    a(20000, '["sport"="climbing"]', 6), a(15000, '["leisure"="fishing"]', 4),
    a(15000, '["amenity"="theatre"]', 6),
    a(20000, '["tourism"="museum"]', 15), a(20000, '["tourism"="gallery"]', 8),
    a(20000, '["historic"="castle"]', 6), a(20000, '["historic"="ruins"]', 6), a(20000, '["historic"="archaeological_site"]', 4),
  ].join("")}`;
  const one = async (host: string): Promise<Highlight[]> => {
    try {
    const r = await fetch(host, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(q),
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return [];
    const d: any = await r.json();
    const seen = new Set<string>();
    const out: Highlight[] = [];
    for (const e of d.elements || []) {
      const tags = e.tags || {};
      const kind = (["museum", "gallery", "theme_park", "zoo", "aquarium", "viewpoint", "winery", "beach"].includes(tags.tourism) ? tags.tourism : null)
        || tags.leisure || tags.amenity || tags.craft || tags.shop || tags.historic || tags.natural || tags.sport || tags.highway || tags.boundary || tags.tourism || "";
      const activity = KIND_TO_ACTIVITY[kind];
      const name = tags["name:en"] || tags.name;
      if (!activity || !name) continue;
      const key = String(name).toLowerCase();
      if (seen.has(key)) continue;
      const h = asHighlight(name, kind, activity, "OpenStreetMap", e.lat ?? e.center?.lat, e.lon ?? e.center?.lon);
      if (!h) continue;
      seen.add(key);
      out.push(h);
    }
    return out;
    } catch {
      return [];
    }
  };
  return Promise.any(OVERPASS_HOSTS.map(async host => {
    const r = await one(host);
    if (!r.length) throw new Error("empty");
    return r;
  })).catch(() => []);
}

/** Wikidata SPARQL fallback (and complement) so beaches, museums, bars and wineries still arrive when Overpass times out. */
export async function wikidataActivities(p: Place): Promise<Highlight[]> {
  return cached(`wdActivities|v3|${p.lat.toFixed(3)},${p.lon.toFixed(3)}`, () => wikidataActivities0(p)).catch(() => []);
}

async function wikidataActivities0(p: Place): Promise<Highlight[]> {
  const header = `SERVICE wikibase:around { ?item wdt:P625 ?coord . bd:serviceParam wikibase:center "Point(${p.lon} ${p.lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "RADIUS" . }`;
  const beachQ = `SELECT DISTINCT ?item ?itemLabel ?coord WHERE { ${header.replace("RADIUS", "40")} ?item wdt:P31/wdt:P279* wd:Q40080 . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 50`;
  const venueQ = `SELECT DISTINCT ?item ?itemLabel ?coord ?k WHERE { ${header.replace("RADIUS", "30")} ?item wdt:P31/wdt:P279? ?cls . VALUES (?cls ?k) { (wd:Q33506 "museum") (wd:Q207694 "museum") (wd:Q1007870 "gallery") (wd:Q187456 "bar") (wd:Q212198 "pub") (wd:Q30022 "pub") (wd:Q622425 "nightclub") (wd:Q156362 "winery") (wd:Q22715 "vineyard") (wd:Q131734 "brewery") } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 80`;
  const run = async (query: string): Promise<any[]> => {
    try {
      const r = await fetch("https://query.wikidata.org/sparql", {
        method: "POST",
        headers: { "User-Agent": UA, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
        body: "format=json&query=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) return [];
      const j: any = await r.json();
      return j.results?.bindings || [];
    } catch {
      return [];
    }
  };
  // Run after getPlaces (see index.ts) so these two can safely go in parallel.
  const [beaches, venues] = await Promise.all([run(beachQ), run(venueQ)]);
  const seen = new Set<string>();
  const out: Highlight[] = [];
  const add = (name: string, kind: string, activity: ActivityId, coord?: string, url?: string) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(coord || "");
    const h = asHighlight(name, kind, activity, "Wikidata", m ? +m[2] : undefined, m ? +m[1] : undefined, url);
    if (!h) return;
    seen.add(key);
    out.push(h);
  };
  const beachRows = beaches
    .map((b: any) => ({ name: b.itemLabel?.value, coord: b.coord?.value, url: b.item?.value }))
    .filter((b: any) => b.name)
    .sort((a: any, b: any) => beachPreferRank(b.name) - beachPreferRank(a.name));
  for (const b of beachRows) add(b.name, "beach", "beach", b.coord, b.url);
  const kindToAct: Record<string, ActivityId> = { museum: "museums", gallery: "museums", bar: "nightlife", pub: "nightlife", nightclub: "nightlife", winery: "tasting", vineyard: "tasting", brewery: "tasting" };
  for (const b of venues) {
    const name = b.itemLabel?.value;
    const k = b.k?.value;
    const act = kindToAct[k];
    if (name && act) add(name, k, act, b.coord?.value, b.item?.value);
  }
  return out;
}

export function mergeActivityPlaces(highlights: Highlight[], extra: Highlight[], cap = 24): Highlight[] {
  const have = new Set(highlights.map(h => h.name.toLowerCase()));
  const added: Highlight[] = [];
  const per = new Map<string, number>();
  const tryAdd = (h: Highlight, limit: number) => {
    if (isAdminOrReligiousOrg(h)) return;
    const k = (h as any).activity || h.type || "";
    const n = per.get(k) || 0;
    if (n >= limit || have.has(h.name.toLowerCase()) || added.length >= cap) return;
    have.add(h.name.toLowerCase());
    per.set(k, n + 1);
    added.push(h);
  };
  const prefer = (a: Highlight, b: Highlight) => beachPreferRank(b.name) - beachPreferRank(a.name);
  const extraSorted = [...extra].sort(prefer);
  // First pass: at least one place per activity/kind so tasting, nightlife, beaches and dive shops are not crowded out.
  for (const h of extraSorted) tryAdd(h, 1);
  for (const h of extraSorted) tryAdd(h, 3);
  return [...highlights, ...added];
}
