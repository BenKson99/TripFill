import type { TripInput, ItinDay } from "./plan.js";
import type { WeatherResult } from "./weather.js";
import { isRainy } from "./weather.js";
import { driveLabel } from "./plan.js";
import { isBroadRegion } from "../shared/region.js";
import { cleanVenueName, isAdminOrReligiousOrg, isRestDayFriendly, isSeriousPeak, isSkiSector } from "../shared/activities.js";

export const PRESETS = ["beach", "hiking", "ski", "city", "business", "kids", "roadtrip"] as const;
export type Preset = typeof PRESETS[number];
export const PRESET_LABELS: Record<Preset, string> = { beach: "🏖 Beach", hiking: "🥾 Hiking", ski: "⛷ Ski", city: "🏙 City", business: "💼 Business", kids: "🧒 With kids", roadtrip: "🚗 Road trip" };

export const presetsOf = (inp: TripInput): Preset[] => ((inp as any).presets || []).filter((p: string) => (PRESETS as readonly string[]).includes(p));

/** Itinerary tweaks driven by presets. Mutates days. */
export function presetItinerary(days: ItinDay[], ps: Preset[], w: WeatherResult, hl: { name: string; ski?: boolean; distanceKm?: number; driveMin?: number; driveSrc?: string; type?: string; description?: string; indoor?: boolean; setting?: string }[] = []) {
  if (!ps.length || days.length < 2) return;
  const mid = days.slice(1, days.length - 1); // full days (not arrive/depart)
  const wx = (d: ItinDay) => w.days.find(x => x.date === d.date);
  const dry = mid.filter(d => { const x = wx(d); return x && !isRainy(x); });
  const tag = (d: ItinDay, t: string) => { d.notes = d.notes ? `${d.notes} · ${t}` : t; };
  const used = new Set<ItinDay>();
  if (ps.includes("business") && ps.includes("ski")) { for (const d of mid) { d.morning = "💼 Meetings / work block"; d.afternoon = "⛷ Afternoon skiing (lifts usually close ~4 pm), then après-ski"; tag(d, "business + ski"); } return; }
  if (ps.includes("business")) for (const d of mid) { d.morning = "💼 Meetings / work block"; d.afternoon = d.afternoon.startsWith("💼") ? d.afternoon : `💼 Work, then if time: ${d.afternoon}`; tag(d, "business"); }
  const fields = [...hl.filter(h => h.ski), ...hl.filter(h => !h.ski && isSkiSector(h))]
    .map(h => ({ ...h, name: cleanVenueName(h.name) }))
    .filter(h => h.name && h.name.length > 2)
    .filter((h, i, a) => a.findIndex(x => x.name === h.name) === i);
  const sameSector = (text: string | undefined, sector?: string) => {
    if (!text) return false;
    if (sector && text.toLowerCase().includes(sector.toLowerCase())) return true;
    return isSkiSector({ name: text });
  };
  const labelRest = (h: { name: string; dayTrip?: boolean; driveMin?: number; driveSrc?: string; type?: string; description?: string }) => {
    if (isSeriousPeak(h)) return `views of ${h.name}`;
    if (/gornergrat/i.test(h.name)) return `${h.name} railway ride`;
    return (h as any).dayTrip ? `🚐 Day trip: ${h.name} (${driveLabel(h)} each way)` : h.name;
  };
  const restDay = (sector?: string) => {
    const skip = (h: { name: string; type?: string; description?: string }) => {
      if (spareUsed.has(h.name) || isAdminOrReligiousOrg(h) || isBroadRegion(h)) return true;
      if (sector && (h.name.toLowerCase().includes(sector.toLowerCase()) || sector.toLowerCase().includes(h.name.toLowerCase()))) return true;
      return false;
    };
    const pool = hl.map(h => ({ ...h, name: cleanVenueName(h.name) })).filter(h => h.name);
    const museum = pool.find(h => !skip(h) && /\b(museum|gallery)\b/i.test(`${h.name} ${h.type || ""} ${h.description || ""}`));
    if (museum) { spareUsed.add(museum.name); return labelRest(museum as any); }
    const easy = pool.find(h => !skip(h) && !h.ski && isRestDayFriendly(h) && !isSkiSector(h));
    if (easy) { spareUsed.add(easy.name); return labelRest(easy as any); }
    // A railway / viewpoint sector (e.g. Gornergrat) is a fine rest outing when it is not this morning's ski sector.
    const ride = pool.find(h => !skip(h) && /gornergrat/i.test(h.name));
    if (ride) { spareUsed.add(ride.name); return labelRest(ride as any); }
    const peak = pool.find(h => !skip(h) && isSeriousPeak(h));
    if (peak) { spareUsed.add(peak.name); return `views of ${peak.name}`; }
    const s2 = pool.find(h => !skip(h) && !h.ski && !isSkiSector(h));
    if (s2) { spareUsed.add(s2.name); return labelRest(s2 as any); }
  };
  const spareUsed = new Set<string>();
  const skiMorning = (name: string | undefined, j: number, lone: boolean) => {
    if (!name) return "⛷ On the slopes (first lifts are quietest)";
    const drive = "";
    const variants = [
      `⛷ Ski ${name}${drive} — first lifts are quietest`,
      `⛷ Morning on the ${name} slopes`,
      `⛷ Back at ${name} — try a different run or sector`,
      `⛷ Ski day at ${name}`,
      `⛷ Another day on the ${name} slopes`,
    ];
    return lone ? variants[j % variants.length] : `⛷ Ski ${name}${drive} — first lifts are quietest`;
  };
  if (ps.includes("ski")) for (const [j, d] of mid.entries()) {
    const f = fields[j % Math.max(1, fields.length)];
    const sector = f?.name;
    const m0 = d.morning;
    d.morning = skiMorning(sector, j, fields.length <= 1);
    const unusable = (s?: string) => !s || /^(Explore a market|Long lunch|Free morning)/.test(s) || isSeriousPeak({ name: s }) || isAdminOrReligiousOrg({ name: s }) || sameSector(s, sector) || spareUsed.has(s);
    // Prefer museums, lakes, villages and railway rides over whatever highlight the morning slot happened to hold.
    let alt = restDay(sector) || (m0 && !unusable(m0) ? m0 : undefined) || (!unusable(d.afternoon) ? d.afternoon : undefined);
    if (alt && !/^views of /i.test(alt) && isSeriousPeak({ name: alt })) alt = `views of ${alt}`;
    alt = (alt || "").replace(/^(?:views of )+/i, "views of ") || alt;
    if (alt && (sameSector(alt, sector) || isAdminOrReligiousOrg({ name: alt }))) alt = restDay(sector);
    d.afternoon = `⛷ Skiing until ~3:30 pm, then après-ski${alt ? `; or a rest day: ${alt}` : ""}`; tag(d, "ski");
  }
  if (ps.includes("hiking")) {
    const noTrip = (l: ItinDay[]): ItinDay[] => { const f = l.filter(d => !d.morning.startsWith("🚐")); return f.length ? f : l; };
    const best = [...noTrip(dry.length ? dry : mid)].sort((a, b) => (wx(a)?.precipProb ?? 0) - (wx(b)?.precipProb ?? 0))[0];
    if (best) { used.add(best); best.morning = `🥾 Day hike (start early; driest day in the forecast)`; best.afternoon = `🥾 Hike continues — back by late afternoon; then ${best.afternoon}`; tag(best, "hiking"); }
  }
  if (ps.includes("beach")) {
    const free = (dry.length ? dry : mid).filter(d => !used.has(d) && !d.morning.startsWith("🚐")); // not the hike day
    const warm = free.filter(d => (wx(d)?.tmax ?? 0) >= 18);
    // Only schedule on genuinely warm days; real beach names are applied in scheduleActivities.
    // One preset beach afternoon only; scheduleActivities balances remaining slots across activities.
    if (warm[0]) { warm[0].afternoon = "🏖 Beach time at a nearby beach"; tag(warm[0], "beach"); used.add(warm[0]); }
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
