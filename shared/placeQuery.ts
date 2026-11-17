/** Normalize typed destinations like "London, UK", "NYC", "Paris, FR" before geocoding. */

const COUNTRY: Record<string, string> = {
  UK: "United Kingdom", GB: "United Kingdom", "GREAT BRITAIN": "United Kingdom", BRITAIN: "United Kingdom",
  USA: "United States", US: "United States", "U.S": "United States", "U.S.A": "United States", "UNITED STATES OF AMERICA": "United States",
  UAE: "United Arab Emirates", FR: "France", DE: "Germany", IT: "Italy", ES: "Spain", PT: "Portugal",
  NL: "Netherlands", BE: "Belgium", IE: "Ireland", CH: "Switzerland", AT: "Austria", GR: "Greece",
  PL: "Poland", CZ: "Czechia", SE: "Sweden", NO: "Norway", DK: "Denmark", FI: "Finland",
  AU: "Australia", NZ: "New Zealand", JP: "Japan", CN: "China", IN: "India", MX: "Mexico",
  BR: "Brazil", ZA: "South Africa", KR: "South Korea", SG: "Singapore", HK: "Hong Kong",
  CA: "Canada", AR: "Argentina", CL: "Chile", PE: "Peru", EG: "Egypt", TR: "Turkey",
  TH: "Thailand", VN: "Vietnam", MY: "Malaysia", PH: "Philippines", ID: "Indonesia",
};

const CITY: Record<string, string> = {
  NYC: "New York", "NEW YORK CITY": "New York", "N.Y.C": "New York", "NY, NY": "New York",
  LA: "Los Angeles", "L.A": "Los Angeles", "LAX": "Los Angeles",
  SF: "San Francisco", "S.F": "San Francisco",
  DC: "Washington", "D.C": "Washington", "WASHINGTON DC": "Washington", "WASHINGTON D.C": "Washington",
  CHI: "Chicago",
};

function keyOf(s: string) {
  return s.trim().toUpperCase().replace(/\./g, "").replace(/\s+/g, " ");
}

function expandCity(s: string) {
  return CITY[keyOf(s)] || s.trim();
}

function expandCountry(s: string) {
  const k = keyOf(s);
  return COUNTRY[k] || COUNTRY[k.replace(/\s/g, "")] || s.trim();
}

/** Canonical query: expand city aliases and country abbreviations after a comma. */
export function normalizePlaceQuery(q: string): string {
  const s = (q || "").trim().replace(/\s+/g, " ");
  if (!s) return s;
  const parts = s.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    parts[0] = expandCity(parts[0]);
    parts[parts.length - 1] = expandCountry(parts[parts.length - 1]);
    return parts.join(", ");
  }
  return expandCity(s);
}

/** Ordered lookups: normalized query, original, then the city with the country stripped. */
export function placeQueryFallbacks(q: string): string[] {
  const raw = (q || "").trim();
  const norm = normalizePlaceQuery(raw);
  const out: string[] = [];
  const add = (s: string) => { const t = (s || "").trim(); if (t && !out.some(x => x.toLowerCase() === t.toLowerCase())) out.push(t); };
  add(norm);
  add(raw);
  add(norm.split(",")[0] || "");
  add(expandCity((raw.split(",")[0] || "").trim()));
  return out;
}

export type PlaceLike = { id?: number; name?: string; admin1?: string; country?: string; countryCode?: string; population?: number; featureCode?: string };

export function placeKindLabel(p: PlaceLike): string {
  const name = p.name || "";
  const code = p.featureCode || "";
  if (/^AIRP/i.test(code) || /\b(airport|aerodrome)\b/i.test(name)) return "airport";
  if (/national park/i.test(name) || (/^PRK/i.test(code) && /national/i.test(name))) return "national park";
  if (/game preserve|wildlife refuge|wildlife preserve/i.test(name)) return "wildlife preserve";
  if (/caverns?|caves?/i.test(name)) return "caverns";
  if (/village/i.test(name) || /^PPL$/i.test(code) && /village/i.test(name)) return "village";
  if (/^PPL/i.test(code) || (p.population || 0) >= 1000) return p.admin1 ? `city in ${p.admin1}` : "city";
  if (/monument|forest|recreation area|wilderness/i.test(name)) return "nature area";
  return p.admin1 || p.country || "place";
}

/** Higher is better: national parks and real cities beat airports, bars and minor namesakes. */
export function placeChoiceScore(p: PlaceLike): number {
  const name = p.name || "";
  const code = p.featureCode || "";
  const pop = p.population || 0;
  if (/^AIRP/i.test(code) || /\b(airport|aerodrome)\b/i.test(name)) return -200 + Math.min(pop, 500) / 100;
  if (/\bbar \d+\b/i.test(name)) return -150;
  if (/national park/i.test(name) || (/^PRK/i.test(code) && /park/i.test(name))) return 500 + Math.min(pop, 50000) / 1000;
  if (/game preserve|wildlife/i.test(name)) return 120;
  if (/caverns?|caves?/i.test(name) && !/national park/i.test(name)) return 40;
  if (/^PPL/i.test(code) && pop >= 10000) return 320 + Math.log10(pop + 1) * 20;
  if (/^PPL/i.test(code) && pop >= 1000) return 260 + pop / 200;
  if (/^PPL/i.test(code)) return 200 + pop / 50;
  if (/monument|forest|recreation area|wilderness|nature/i.test(name)) return 220;
  if (/village/i.test(name)) return 180 + pop / 50;
  return 50 + Math.min(pop, 20000) / 200;
}

export function rankPlaceMatches<T extends PlaceLike>(matches: T[], limit = 4): T[] {
  return [...(matches || [])].sort((a, b) => placeChoiceScore(b) - placeChoiceScore(a) || (b.population || 0) - (a.population || 0) || (a.name || "").localeCompare(b.name || "")).slice(0, Math.max(1, limit));
}
