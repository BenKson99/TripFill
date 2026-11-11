import type { TripInput, ItinDay } from "./plan.js";
import type { WeatherResult } from "./weather.js";
import { isRainy } from "./weather.js";
import { driveLabel } from "./plan.js";
import { isBroadRegion } from "../shared/region.js";

export const PRESETS = ["beach", "hiking", "ski", "city", "business", "kids", "roadtrip"] as const;
export type Preset = typeof PRESETS[number];
export const PRESET_LABELS: Record<Preset, string> = { beach: "🏖 Beach", hiking: "🥾 Hiking", ski: "⛷ Ski", city: "🏙 City", business: "💼 Business", kids: "🧒 With kids", roadtrip: "🚗 Road trip" };

export const presetsOf = (inp: TripInput): Preset[] => ((inp as any).presets || []).filter((p: string) => (PRESETS as readonly string[]).includes(p));

/** Itinerary tweaks driven by presets. Mutates days. */
export function presetItinerary(days: ItinDay[], ps: Preset[], w: WeatherResult, hl: { name: string; ski?: boolean; distanceKm?: number; driveMin?: number; driveSrc?: string }[] = []) {
  if (!ps.length || days.length < 2) return;
  const mid = days.slice(1, days.length - 1); // full days (not arrive/depart)
  const wx = (d: ItinDay) => w.days.find(x => x.date === d.date);
  const dry = mid.filter(d => { const x = wx(d); return x && !isRainy(x); });
  const tag = (d: ItinDay, t: string) => { d.notes = d.notes ? `${d.notes} · ${t}` : t; };
  const used = new Set<ItinDay>();
  if (ps.includes("business") && ps.includes("ski")) { for (const d of mid) { d.morning = "💼 Meetings / work block"; d.afternoon = "⛷ Afternoon skiing (lifts usually close ~4 pm), then après-ski"; tag(d, "business + ski"); } return; }
  if (ps.includes("business")) for (const d of mid) { d.morning = "💼 Meetings / work block"; d.afternoon = d.afternoon.startsWith("💼") ? d.afternoon : `💼 Work, then if time: ${d.afternoon}`; tag(d, "business"); }
  const fields = hl.filter(h => h.ski);
  const mentioned = (n: string) => days.some(x => (x.morning + x.afternoon + (x.rainyBackup || "")).includes(n));
  const spare = hl.filter(h => !h.ski && !mentioned(h.name) && !isBroadRegion(h)); const spareUsed = new Set<string>();
  if (ps.includes("ski")) for (const [j, d] of mid.entries()) { const f = fields[j % Math.max(1, fields.length)]; const m0 = d.morning; d.morning = f ? `⛷ Ski ${f.name}${f.distanceKm ? ` (${driveLabel(f)})` : ""} — first lifts are quietest` : "⛷ On the slopes (first lifts are quietest)"; let alt = m0 && !/^Free morning/.test(m0) ? m0 : d.afternoon;
    if (!alt || /^(Explore a market|Long lunch)/.test(alt)) { const s2 = spare.find(h => !spareUsed.has(h.name)); if (s2) { spareUsed.add(s2.name); alt = (s2 as any).dayTrip ? `🚐 Day trip: ${s2.name} (${driveLabel(s2)} each way)` : s2.name; } } d.afternoon = `⛷ Skiing until ~3:30 pm, then après-ski${alt ? `; or a rest day: ${alt}` : ""}`; tag(d, "ski"); }
  if (ps.includes("hiking")) {
    const noTrip = (l: ItinDay[]): ItinDay[] => { const f = l.filter(d => !d.morning.startsWith("🚐")); return f.length ? f : l; };
    const best = [...noTrip(dry.length ? dry : mid)].sort((a, b) => (wx(a)?.precipProb ?? 0) - (wx(b)?.precipProb ?? 0))[0];
    if (best) { used.add(best); best.morning = `🥾 Day hike (start early; driest day in the forecast)`; best.afternoon = `🥾 Hike continues — back by late afternoon; then ${best.afternoon}`; tag(best, "hiking"); }
  }
  if (ps.includes("beach")) {
    const free = (dry.length ? dry : mid).filter(d => !used.has(d) && !d.morning.startsWith("🚐")); // not the hike day
    const warm = free.filter(d => (wx(d)?.tmax ?? 0) >= 22);
    for (const d of (warm.length ? warm : free).slice(0, Math.max(1, Math.ceil(mid.length / 2)))) { d.afternoon = `🏖 Beach time (avoid 12–3 pm sun)${warm.length ? "" : " — may be cool for swimming"}; ${d.afternoon}`; tag(d, "beach"); }
  }
  if (ps.includes("roadtrip") && mid.length) {
    const pool = (dry.length ? dry : mid).filter(x => !used.has(x)); const d = pool[Math.min(1, pool.length - 1)] || mid.find(x => !used.has(x));
    if (d) { used.add(d);
    d.morning = "🚗 Scenic drive / day trip out of town"; tag(d, "road trip"); }
    days[0].afternoon = `Pick up car; ${days[0].afternoon}`;
  }
  if (ps.includes("city") && mid[0] && !used.has(mid[0]) && !ps.includes("business") && !ps.includes("ski")) { mid[0].morning = `🏙 Free walking tour to get oriented, then ${mid[0].morning}`; tag(mid[0], "city"); }
  if (ps.includes("kids")) for (const d of mid) { d.afternoon = `${d.afternoon.split(" → ")[0]} · 🧒 rest / playground break`; d.evening = d.evening.replace("Dinner:", "Early dinner:"); tag(d, "with kids — one main sight per day"); }
}
