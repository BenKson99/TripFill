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
