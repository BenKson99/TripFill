import { UA, cached } from "./fetchy.js";
import type { Place } from "./weather.js";
import type { Highlight } from "./places.js";
import type { ActivityId } from "../shared/activities.js";

/** One combined Overpass query for activity venues. Cached; never more than one new call per place. */
const KIND_TO_ACTIVITY: Record<string, ActivityId> = {
  viewpoint: "sightseeing", beach: "beach", winery: "tasting", brewery: "tasting", distillery: "tasting",
  golf_course: "golf", theme_park: "parks", water_park: "parks", zoo: "family", aquarium: "family",
  spa: "spa", public_bath: "spa", hot_spring: "spa", scuba_diving: "dive", marina: "boat",
  boat_rental: "boat", bicycle_rental: "cycling", camp_site: "camping", nightclub: "nightlife",
  bar: "nightlife", marketplace: "shopping", trailhead: "hiking", peak: "hiking",
  nature_reserve: "wildlife", national_park: "wildlife", climbing: "climbing", fishing: "fishing",
  theatre: "shows", arts_centre: "shows", museum: "museums", gallery: "museums",
  castle: "heritage", ruins: "heritage", archaeological_site: "heritage", monument: "heritage",
};

export function osmActivities(p: Place, ids: ActivityId[]): Promise<Highlight[]> {
  if (!ids.length) return Promise.resolve([]);
  return cached(`osmActivities|v1|${p.lat.toFixed(3)},${p.lon.toFixed(3)}`, () => osmActivities0(p)).then(all => {
    const want = new Set(ids);
    return all.filter(h => !h.type || want.has(KIND_TO_ACTIVITY[(h.type || "").replace(/ /g, "_")] as ActivityId) || want.has((h as any).activity));
  }).catch(() => []);
}

async function osmActivities0(p: Place): Promise<Highlight[]> {
  const a = (r: number, sel: string) => `nwr(around:${r},${p.lat},${p.lon})${sel}["name"];`;
  const q = `[out:json][timeout:6];(${[
    a(20000, '["tourism"="viewpoint"]'), a(20000, '["natural"="beach"]'),
    a(25000, '["tourism"="winery"]'), a(25000, '["craft"="winery"]'), a(20000, '["craft"="brewery"]'), a(20000, '["craft"="distillery"]'),
    a(25000, '["leisure"="golf_course"]'), a(20000, '["tourism"="theme_park"]'), a(20000, '["leisure"="water_park"]'),
    a(15000, '["tourism"="zoo"]'), a(15000, '["tourism"="aquarium"]'),
    a(15000, '["leisure"="spa"]'), a(15000, '["amenity"="public_bath"]'), a(15000, '["natural"="hot_spring"]'),
    a(20000, '["shop"="scuba_diving"]'), a(20000, '["sport"="scuba_diving"]'),
    a(20000, '["leisure"="marina"]'), a(15000, '["amenity"="boat_rental"]'), a(15000, '["amenity"="bicycle_rental"]'),
    a(20000, '["tourism"="camp_site"]'), a(8000, '["amenity"="nightclub"]'), a(8000, '["amenity"="bar"]'),
    a(10000, '["amenity"="marketplace"]'), a(20000, '["highway"="trailhead"]'), a(20000, '["natural"="peak"]'),
    a(20000, '["leisure"="nature_reserve"]'), a(20000, '["boundary"="national_park"]'),
    a(20000, '["sport"="climbing"]'), a(15000, '["leisure"="fishing"]'),
    a(15000, '["amenity"="theatre"]'),
    a(15000, '["tourism"="museum"]'), a(15000, '["tourism"="gallery"]'),
    a(20000, '["historic"="castle"]'), a(20000, '["historic"="ruins"]'), a(20000, '["historic"="archaeological_site"]'),
  ].join("")});out center 80;`;
  const one = async (host: string): Promise<Highlight[]> => {
    const r = await fetch(host, { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error("overpass " + r.status);
    const d: any = await r.json();
    const seen = new Set<string>();
    return (d.elements || []).map((e: any) => {
      const tags = e.tags || {};
      const kind = (["museum","gallery","theme_park","zoo","aquarium","viewpoint","winery","beach"].includes(tags.tourism) ? tags.tourism : null) || tags.leisure || tags.amenity || tags.craft || tags.shop || tags.historic || tags.natural || tags.sport || tags.highway || tags.boundary || tags.tourism || "";
      const name = tags["name:en"] || tags.name;
      const activity = KIND_TO_ACTIVITY[kind];
      return { e, kind, name, activity };
    }).filter((x: any) => x.name && x.name.length > 2 && x.activity && !seen.has(x.name.toLowerCase()) && seen.add(x.name.toLowerCase()))
      .slice(0, 80)
      .map((x: any) => ({
        name: x.name as string,
        description: `${x.kind.replace(/_/g, " ")} (OpenStreetMap)`,
        setting: /nightclub|bar|theatre|spa|museum|aquarium|arts/.test(x.kind) ? "indoor" as const : "outdoor" as const,
        indoor: /nightclub|bar|theatre|spa|aquarium/.test(x.kind),
        type: String(x.kind).replace(/_/g, " "),
        source: "OpenStreetMap",
        activity: x.activity,
        lat: x.e.lat ?? x.e.center?.lat,
        lon: x.e.lon ?? x.e.center?.lon,
      }));
  };
  return Promise.any(["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"].map(one)).catch(() => []);
}

export function mergeActivityPlaces(highlights: Highlight[], extra: Highlight[], cap = 8): Highlight[] {
  const have = new Set(highlights.map(h => h.name.toLowerCase()));
  const added: Highlight[] = [];
  const per = new Map<string, number>();
  for (const h of extra) {
    const k = (h as any).activity || h.type || "";
    const n = per.get(k) || 0;
    if (n >= 3 || have.has(h.name.toLowerCase())) continue;
    have.add(h.name.toLowerCase());
    per.set(k, n + 1);
    added.push(h);
    if (added.length >= cap) break;
  }
  return [...highlights, ...added];
}
