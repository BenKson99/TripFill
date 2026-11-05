// Local restaurants & coffee shops near the destination (v1.4.0, replaces dish lists).
// Primary: OpenStreetMap via Overpass (free, no key). Curated boost/fallback: Wikivoyage "Eat"/"Drink" listings.
import { UA, cached } from "./fetchy.js";
import type { Place } from "./weather.js";

export interface Eat { name: string; kind: "restaurant" | "cafe"; tag?: string; km?: number; area?: string; description?: string; source: string; url?: string; lat?: number; lon?: number; leg?: string }
export interface Eats { restaurants: Eat[]; cafes: Eat[] }

export const eatsKey = (p: { name: string; lat: number; lon: number }) => `eats|v4|${p.name.toLowerCase()}|${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;

const R = 6371, rad = (x: number) => x * Math.PI / 180;
export const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2));
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^(the|o|a|el|la|le|il)\s+/, "").replace(/[^\p{L}\p{N}]+/gu, "");
// Chains: OSM brand tags catch most; this list catches untagged ones
export const CHAIN = /mcdonald|burger king|kfc|subway|starbucks|domino|pizza hut|costa coffee|dunkin|tim hortons|wendy|taco bell|telepizza|five guys|nando|pret a manger|caffe nero|doutor|tully|komeda|excelsior caff|yoshinoya|sukiya|matsuya|saizeriya|gusto\b|coco ?ichi|mos burger|lotteria|h3\b|vitaminas|padaria portuguesa|honolulu coffee|blue bottle|% arabica|tribeca|juan valdez|havanna|café martínez|cafe martinez|mugg & bean|vida e caff|chicken licken|wimpy|spur\b|ocean basket|hudsons|joe & the juice|segafredo|pronto\b|veloce|renoir|ueshima/i;

// Local-cuisine ranking (v1.5.2): which tags count as the destination's own food
const LOCAL: Record<string, RegExp> = {
  PT: /portug|regional|local|tasca|tavern|seafood|fish|grill|francesinha|petisc|bacalhau|small plates/i,
  ES: /spanish|tapas|basque|catal|galic|andalu|regional|local|seafood|tavern/i,
  IT: /italian|pizza|pasta|trattoria|osteria|regional|local|seafood/i,
  FR: /french|bistro|brasserie|crepe|regional|local|seafood/i,
  JP: /japanese|sushi|ramen|udon|soba|noodle|izakaya|tempura|yakitori|tonkatsu|okonomiyaki|kaiseki|wagashi|unagi|teppan|yakiniku|donburi|regional|local/i,
  US: /american|burger|bbq|barbecue|steak|diner|tex.?mex|mexican|southern|cajun|regional|local|grill/i,
  MX: /mexican|taco|regional|local|seafood/i, AR: /argentin|parrilla|grill|steak|empanada|regional|local/i,
  ZA: /south african|braai|african|cape malay|grill|regional|local|seafood/i, NZ: /new zealand|kiwi|seafood|lamb|regional|local|grill/i,
  NO: /norweg|nordic|scandinav|seafood|fish|regional|local/i, GB: /british|english|pub|fish|regional|local/i,
  DE: /german|bavarian|regional|local/i, GR: /greek|taverna|regional|local|seafood/i, TH: /thai|regional|local/i,
  CN: /chinese|cantonese|sichuan|dim sum|regional|local|noodle/i, KR: /korean|regional|local/i, VN: /vietnam|pho|regional|local/i,
  IN: /indian|regional|local|curry/i, PE: /peruv|ceviche|regional|local/i, CL: /chile|regional|local|seafood/i, BR: /brazil|churrasc|regional|local/i,
};
const NEUTRAL = /^(restaurant|café|cafe|bakery|bakery café|historic café|international|vegetarian|vegan|fine dining|breakfast|brunch)$/i;
export const cuisineClass = (tag: string | undefined, cc?: string): "local" | "neutral" | "foreign" => {
  const t = (tag || "restaurant").toLowerCase(); const re = LOCAL[(cc || "").toUpperCase()];
  if (re?.test(t)) return "local"; if (NEUTRAL.test(t) || !re) return "neutral"; return "foreign";
};
// Non-café venues that OSM sometimes tags amenity=cafe or that Wikidata lumps in
export const NOT_CAFE = /cinema|cine(?:ma|plex|teatro)?\b|theat(?:er|re)|teatro|movie|kino|nightclub|disco|casino|karaoke|hostel|hotel|museum|gallery|bowling|arcade|internet caf|cyber|gaming|hookah|shisha|cat caf|manga caf/i;

const tagOf = (t: Record<string, string>) => {
  if (t.amenity === "cafe") return t.cuisine && !/coffee_shop|coffee/.test(t.cuisine) ? t.cuisine.split(";")[0].replace(/_/g, " ") : (t.shop === "bakery" || /bakery|pastry|cake/.test(t.cuisine || "") ? "bakery café" : "café");
  if (t.shop === "bakery") return "bakery";
  const c = (t.cuisine || "").split(";")[0].replace(/_/g, " ");
  return c && c !== "regional" ? c : t.cuisine === "regional" ? "local cuisine" : "restaurant";
};

async function overpass(p: Place, radius = 2500): Promise<Eat[]> {
  const a = `around:${radius},${p.lat},${p.lon}`;
  const q = `[out:json][timeout:6];(nwr(${a})["amenity"="restaurant"]["name"];nwr(${a})["amenity"="cafe"]["name"];);out center tags 700;`;
  const one = async (host: string): Promise<Eat[]> => {
    const r = await fetch(host, { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(7000) });
    if (!r.ok) throw new Error("overpass " + r.status);
    const d: any = await r.json(); if (!d.elements?.length) throw new Error("empty");
    return d.elements.map((e: any) => {
      const t = e.tags || {}; const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
      if (t.amenity === "cafe" && (NOT_CAFE.test(t.name) || t.amenity === "cinema" || t.cinema || t.leisure)) return null;
      if (t.brand || t["brand:wikidata"] || CHAIN.test(t.name) || /\b(store|supermarket|grocery|minimarket)\b/i.test(t.name)) return null;
      if (/fast_food|kebab|burger|pizza|chicken|sandwich/.test(t.cuisine || "") && !t.wikidata) return null;
      const score = (t.wikidata ? 4 : 0) + (t.wikipedia ? 2 : 0) + (t.website || t["contact:website"] ? 1 : 0) + (t.opening_hours ? 0.5 : 0) + (t.cuisine ? 0.5 : 0) + (t["name:en"] ? 0.5 : 0) + (t.cuisine === "regional" || /portuguese|japanese|local|traditional/.test(t.cuisine || "") ? 0.5 : 0) + (t.tourism ? 1 : 0);
      const k = lat != null ? km(p, { lat, lon }) : 3;
      return { name: (t["name:en"] && /[^\x00-\x7f]/.test(t.name) ? `${t["name:en"]}` : t.name) as string, kind: t.amenity === "cafe" ? "cafe" : "restaurant", tag: tagOf(t), km: Math.round(k * 10) / 10, area: t["addr:suburb"] || t["addr:quarter"] || t["addr:neighbourhood"] || t["addr:street"], source: "OpenStreetMap", url: t.website || t["contact:website"] || (t.wikipedia ? `https://${t.wikipedia.split(":")[0]}.wikipedia.org/wiki/${encodeURIComponent(t.wikipedia.split(":").slice(1).join(":"))}` : undefined), lat, lon, _s: score - k * 0.6 } as any;
    }).filter(Boolean);
  };
  return Promise.any(["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"].map(one)).catch(() => []);
}

const GUESS: [RegExp, string][] = [[/sushi/i, "sushi"], [/ramen/i, "ramen"], [/udon|soba/i, "noodles"], [/izakaya/i, "izakaya"], [/tempura/i, "tempura"], [/yakitori/i, "yakitori"], [/tasca|taberna|tavern/i, "tavern"], [/marisq|seafood|fish|peixe/i, "seafood"], [/steak|churrasc|grill|parrilla/i, "grill"], [/francesinha/i, "francesinha"], [/petisc|tapas/i, "small plates"], [/vegan|vegetarian/i, "vegetarian"], [/thai/i, "thai"], [/italian|pasta|pizz/i, "italian"]];
const guessTag = (s: string) => GUESS.find(([r]) => r.test(s))?.[1];
/** Wikivoyage {{eat}} / {{drink}} listings (already-fetched city wikitext), coffee-ish drinks only. */
export function wvListings(list: Record<string, string>[], p: Place, clean: (s: string) => string): Eat[] {
  return list.map(f => {
    const name = clean(f.name || ""); if (!name || name.length < 2 || CHAIN.test(name) || /\b(store|supermarket|grocery|minimarket)\b/i.test(name)) return null;
    const blob = `${name} ${f.content || ""} ${f.alt || ""}`;
    const cafe = f._kind === "drink" ? /caf[eé]|coffee|kissa|tea ?house|espresso|roast|pastel|bakery|patisserie|confeitaria/i.test(blob) : /caf[eé](?![a-z])|coffee|kissaten|bakery|patisserie|confeitaria|pastelaria|past[eé]is|padaria/i.test(name);
    if (f._kind === "drink" && !cafe) return null;
    const lat = Number(f.lat), lon = Number(f.long ?? f.lon);
    const has = Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0;
    const k = has ? km(p, { lat, lon }) : undefined;
    if (k != null && k > 25) return null;
    const c0 = clean(f.content || ""); const desc = c0.length > 160 ? c0.slice(0, 160).replace(/\s+\S*$/, "") + "…" : c0;
    return { name, kind: cafe ? "cafe" : "restaurant", tag: cafe ? (/bakery|past[eé]|patisser|confeitaria|padaria/i.test(blob) ? "bakery café" : "café") : guessTag(name) || guessTag(clean(f.content || "").slice(0, 80)), km: k != null ? Math.round(k * 10) / 10 : undefined, area: clean(f.address || "").split(",")[0] || undefined, description: desc || undefined, source: "Wikivoyage", url: f.url || undefined, lat: has ? lat : undefined, lon: has ? lon : undefined, _s: 5 - (k ?? 2) * 0.4 } as any;
  }).filter(Boolean) as Eat[];
}

/** Wikidata (free SPARQL): notable cafés/coffeehouses, bakeries and restaurants within 4 km, ranked by sitelinks. */
async function wikidata(p: Place, radiusKm = 4): Promise<Eat[]> {
  const q = `SELECT ?i ?l ?c ?sl ?k ?t WHERE { SERVICE wikibase:around { ?i wdt:P625 ?c. bd:serviceParam wikibase:center "Point(${p.lon} ${p.lat})"^^geo:wktLiteral; wikibase:radius "${radiusKm}"; wikibase:distance ?k. } ?i wdt:P31 ?t. VALUES ?t { wd:Q30022 wd:Q11707 wd:Q274393 wd:Q1415899 wd:Q5307737 }. ?i wikibase:sitelinks ?sl. ?i rdfs:label ?l. FILTER(lang(?l)="en" || lang(?l)="${(p.countryCode || "en").toLowerCase()}") } LIMIT 150`;
  try {
    const r = await fetch("https://query.wikidata.org/sparql?query=" + encodeURIComponent(q), { headers: { "User-Agent": UA, Accept: "application/sparql-results+json" }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const d: any = await r.json(); const seen = new Set<string>();
    return d.results.bindings.filter((b: any) => !seen.has(b.i.value) && seen.add(b.i.value)).map((b: any) => {
      const t = b.t.value.split("/").pop(); const [lon, lat] = b.c.value.replace(/Point\(|\)/g, "").split(" ").map(Number); const k = Number(b.k.value); const sl = Number(b.sl.value);
      const name = b.l.value as string; if (CHAIN.test(name) || /club|discot|pavil|armaz|hotel|\b(store|supermarket|grocery|minimarket)\b/i.test(name)) return null;
      const cafe = t === "Q30022" || t === "Q274393" || t === "Q1415899" || /caf[eé](?![a-z])|coffee/i.test(name);
      return { name, kind: cafe ? "cafe" : "restaurant", tag: t === "Q274393" ? "bakery" : cafe ? (sl >= 3 ? "historic café" : "café") : (guessTag(name) || "restaurant"), km: Math.round(k * 10) / 10, source: "Wikidata", url: `https://www.wikidata.org/wiki/${b.i.value.split("/").pop()}`, lat, lon, _s: 3 + Math.log2(sl + 1) * 1.5 - k * 0.5 } as any;
    }).filter(Boolean);
  } catch { return []; }
}

/** Merge, de-dupe (same name, or same normalised name within 150 m), rank and cap. */
export function rankEats(all: Eat[], caps = { restaurants: 8, cafes: 6 }, cc?: string, maxForeign = 2): Eats {
  all = all.filter(e => !/\b(store|supermarket|grocery|minimarket|mercearia)\b/i.test(e.name) && !(e.kind === "cafe" && NOT_CAFE.test(`${e.name} ${e.tag || ""}`)));
  if (cc) all = all.map((e: any) => e.kind !== "restaurant" ? e : { ...e, _s: (e._s ?? 0) + ({ local: 2.5, neutral: 0, foreign: -2 } as const)[cuisineClass(e.tag, cc)] });
  const sorted = [...all].sort((a: any, b: any) => (b._s ?? 0) - (a._s ?? 0));
  const kept: Eat[] = [];
  for (const e of sorted) {
    const vs = (s: string) => s.split("/").map(x => norm(x.replace(/\b(caf[eé]|restaurante?|coffee)\b/gi, ""))).filter(Boolean);
    const N = vs(e.name); if (!N.length) continue;
    const dup = kept.find(k => vs(k.name).some(m => N.some(n => (m === n || (m.length > 5 && n.length > 5 && (m.includes(n) || n.includes(m)))) && (k.lat == null || e.lat == null || km(k as any, e as any) < 0.4 || m === n))));
    if (dup) { if (!dup.description && e.description) dup.description = e.description; if (dup.km == null && e.km != null) Object.assign(dup, { km: e.km, lat: e.lat, lon: e.lon }); continue; }
    kept.push({ ...e });
  }
  // Spread out: avoid a list that's all from one street
  const pick = (kind: Eat["kind"], n: number) => { const out: Eat[] = []; const streets = new Map<string, number>(); let foreign = 0;
    for (const e of kept.filter(x => x.kind === kind)) { const s = (e.area || "").toLowerCase(); if (s && (streets.get(s) || 0) >= 2) continue;
      if (kind === "restaurant" && cc && cuisineClass(e.tag, cc) === "foreign") { if (foreign >= maxForeign) continue; foreign++; } streets.set(s, (streets.get(s) || 0) + 1); out.push(e); if (out.length >= n) break; }
    return out.map(({ _s, ...e }: any) => e as Eat); };
  return { restaurants: pick("restaurant", caps.restaurants), cafes: pick("cafe", caps.cafes) };
}

export const EAT_FLOOR = { restaurants: 5, cafes: 3 };
const RADII = [2500, 6000, 15000];
export function getEats(p: Place, wv: Eat[]): Promise<Eats> {
  const cc = p.countryCode;
  return cached(eatsKey(p), async () => {
    let pool: Eat[] = [...wv]; let r: Eats = { restaurants: [], cafes: [] }; let anyOsm = false;
    // Small towns: widen the search until the lists reach a sensible floor, or the max radius
    for (const rad of RADII) {
      const [osm, wd] = await Promise.all([overpass(p, rad), wikidata(p, Math.max(4, rad / 1000))]);
      anyOsm ||= osm.length > 0; pool = [...pool, ...wd, ...osm];
      r = rankEats(pool, undefined, cc);
      if (r.restaurants.length >= EAT_FLOOR.restaurants && r.cafes.length >= EAT_FLOOR.cafes) break;
    }
    return anyOsm && r.restaurants.length >= 3 ? r : (null as any); // don't cache failed lookups
  }).then(async r => r ?? rankEats([...wv, ...await wikidata(p, 15)], undefined, cc));
}

/** Old saved plans (<1.4.0) carried `food` dish arrays; map to the new shape without crashing. */
export function migrateEats(plan: any): Eats {
  if (plan?.eats && Array.isArray(plan.eats.restaurants)) return { restaurants: plan.eats.restaurants, cafes: plan.eats.cafes || [] };
  return { restaurants: [], cafes: [] };
}
