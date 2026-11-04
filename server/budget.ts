import { getFx } from "./fx.js";
import { countryInfo, COST_SOURCE } from "./countries.js";

export interface BudgetLine { category: string; basis: string; lowUsd: number; highUsd: number; low: number; high: number; total: number }
export interface Budget { lines: BudgetLine[]; currency: string; localCurrency: string; usdRate: number | null; fxNote: string; note: string; pli: number }

// US-baseline (PLI 100) daily costs in USD: [low, high]
const BASE: Record<string, { lo: number; hi: number; per: "room" | "person"; basis: string }> = {
  Accommodation: { lo: 110, hi: 200, per: "room", basis: "mid-range double room / night, 2 people per room" },
  "Food & drink": { lo: 40, hi: 80, per: "person", basis: "per person / day, mix of casual & sit-down" },
  "Local transport": { lo: 8, hi: 20, per: "person", basis: "per person / day, public transport + occasional taxi" },
  "Activities & entry fees": { lo: 15, hi: 40, per: "person", basis: "per person / day" },
  "Shopping & extras": { lo: 10, hi: 30, per: "person", basis: "per person / day" },
};
const STYLE: Record<string, Record<string, number>> = {
  Slow: { "Activities & entry fees": 0.6, "Local transport": 0.7 },
  Mix: {},
  Packed: { "Activities & entry fees": 1.5, "Local transport": 1.4 },
};

// Rough economy fare per person (USD) by great-circle distance; ground travel under 300 km
function fareUsd(km: number, roundTrip: boolean): [number, number] {
  const b: [number, number, number][] = [[300, 30, 80], [800, 150, 350], [2000, 250, 550], [5000, 450, 900], [9000, 800, 1500], [Infinity, 1100, 2000]];
  const [, lo, hi] = b.find(x => km < x[0])!; const f = roundTrip ? 1 : 0.6;
  return [lo * f, hi * f];
}
export interface TravelLeg { km: number; roundTrip: boolean; from: string }
export async function budget(countryCode: string, nights: number, travelers: number, style: string, fxForce?: string, travel?: TravelLeg): Promise<Budget> {
  const ci = countryInfo(countryCode); const days = nights + 1; const P = Math.max(1, travelers);
  const scale = ci.pli / 100; const rooms = Math.ceil(P / 2);
  const fx = await getFx({ force: fxForce }); const rate = fx.ok ? (fx.rates[ci.cur] ?? null) : null;
  const currency = rate ? ci.cur : "USD"; const k = rate ?? 1;
  const round = (n: number) => { const m = n >= 10000 ? 1000 : n >= 1000 ? 50 : 5; return Math.round(n / m) * m; };
  const lines: BudgetLine[] = Object.entries(BASE).map(([category, b]) => {
    const f = (STYLE[style] || {})[category] ?? 1;
    const units = b.per === "room" ? nights * rooms : days * P;
    const lowUsd = round(b.lo * scale * f * units), highUsd = round(b.hi * scale * f * units);
    const low = round(lowUsd * k), high = round(highUsd * k);
    return { category, basis: b.basis + (f !== 1 ? ` (×${f} for ${style} pace)` : ""), lowUsd, highUsd, low, high, total: round((low + high) / 2) };
  });
  if (travel && travel.km > 0) {
    const [lo, hi] = fareUsd(travel.km, travel.roundTrip); const lowUsd = round(lo * P), highUsd = round(hi * P);
    const low = round(lowUsd * k), high = round(highUsd * k);
    const mode = travel.km < 300 ? "bus/train/car" : "economy flight";
    lines.push({ category: "Flights / long-distance travel", basis: `rough estimate, editable — ${travel.roundTrip ? "round-trip" : "one-way"} ${mode} from ${travel.from} (~${travel.km.toLocaleString("en-US")} km), ${P} traveler(s); check real fares`, lowUsd, highUsd, low, high, total: round((low + high) / 2) });
  } else lines.push({ category: "Flights / long-distance travel", basis: "add a home city for a rough estimate, or enter your actual fare", lowUsd: 0, highUsd: 0, low: 0, high: 0, total: 0 });
  return {
    lines, currency, localCurrency: ci.cur, usdRate: rate, pli: ci.pli,
    fxNote: rate ? `Converted from a USD baseline at 1 USD ≈ ${Number(rate.toPrecision(4))} ${ci.cur} (${fx.source})` : (ci.cur === "USD" ? "Prices in USD" : `Exchange rate unavailable — shown in USD instead of ${ci.cur}`),
    note: `Estimate only, not a quote. Ranges scale a US mid-range baseline by this country's price level (${ci.known ? ci.pli : "unknown, assumed 60"}/100 vs USA; source: ${COST_SOURCE}), for ${nights} night(s), ${P} traveler(s), ${style} pace. Big cities and peak season usually cost more.`,
  };
}
