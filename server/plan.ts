import { suggestPacking } from "../shared/packing.js";
import type { WeatherResult, DayWeather, Place } from "./weather.js";
import { isRainy, todayIn } from "./weather.js";
import type { Highlight } from "./places.js";
import { preferredHighlights } from "./preferences.js";
import type { Eat } from "./eats.js";

export interface TripInput { destination: string; start: string; end: string; travelers?: number; purpose?: string; style?: "Slow" | "Packed" | "Mix"; interests?: string; dietaryNeeds?: string; walkingTolerance?: string; home?: Place }
export type { PackingItem as PackItem, PackingGroup as PackGroup } from "../shared/packing.js";
export interface ItinDay { date: string; label: string; weather: string; morning: string; afternoon: string; evening: string; rainyBackup?: string; notes: string }
export interface Task { id: string; due: string; task: string; done: boolean }
export interface BudgetLine { category: string; perDay: number; total: number; basis: string }

let n = 0; const id = () => `i${++n}`;
const fmt = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const addDays = (iso: string, k: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };

/** Shared deterministic packing engine also powers explicit client-side refresh. */
export function packing(inp: TripInput, w: WeatherResult, place: Place, nights: number, domestic = false) {
  return suggestPacking({ input: inp, weather: w, place, trip: { domestic } });
}

const dist = (a: { lat?: number; lon?: number }, b: { lat?: number; lon?: number }) => { const r = (x: number) => x * Math.PI / 180; const h = Math.sin(r(b.lat! - a.lat!) / 2) ** 2 + Math.cos(r(a.lat!)) * Math.cos(r(b.lat!)) * Math.sin(r(b.lon! - a.lon!) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
/** "~1h 20m drive" from OSRM, or "~1h 30m drive est." from the straight-line fallback */
export const driveLabel = (h: { driveMin?: number; driveSrc?: string; distanceKm?: number }) => { const m = h.driveMin ?? (h.distanceKm != null ? Math.round(h.distanceKm * 1.4) : undefined); if (m == null) return ""; const r5 = Math.round(m / 5) * 5, H = Math.floor(r5 / 60), M = r5 % 60; return `~${H ? `${H}h${M ? ` ${M}m` : ""}` : `${M || 5}m`} drive (${h.driveSrc === "osrm" ? "OSRM road route; no live traffic" : h.driveSrc === "estimate" || h.distanceKm != null ? "straight-line × road factor, 60 km/h; not routed" : "method unknown"})`; };
export function itinerary(inp: TripInput, w: WeatherResult, hl: Highlight[], food: Eat[], extraIndoor: Highlight[] = []): ItinDay[] {
  hl = preferredHighlights(hl, inp);
  const style = inp.walkingTolerance === "low" ? "Slow" : inp.style || "Mix"; const perDay = style === "Slow" ? 1 : style === "Packed" ? (inp.walkingTolerance === "high" ? 4 : 3) : 2;
  const outdoor = hl.filter(h => h.setting !== "indoor"), indoor = [...hl.filter(h => h.setting === "indoor"), ...hl.filter(h => h.setting === "mixed")];
  hl = hl.filter(h => !h.ski); // ski areas are scheduled by the ski preset
  const outdoorF = outdoor.filter(h => !h.ski);
  const queue = [...hl]; const days = w.days.slice(0, 14); const usedBackup = new Set<string>();
  const label = (h: Highlight) => h.dayTrip ? `🚐 Day trip: ${h.name} (${driveLabel(h)} each way)` : h.name;
  return days.map((d, i) => {
    const rain = isRainy(d); const wx = `${d.typical ? "Seasonal estimate (not forecast)" : "Open-Meteo forecast"} · ${d.summary || ""} {t:${d.tmin}}–{t:${d.tmax}}${d.precipProb != null ? (d.typical ? `, wet in ${d.precipProb}% of past years` : `, ${d.precipProb}% rain`) : ""}`.trim();
    if (i === 0) return { date: d.date, label: `Day 1 · ${fmt(d.date)} · Arrive`, weather: wx, morning: "Travel & check in", afternoon: "Easy walk around your neighbourhood; get local currency/SIM", evening: food[0] ? `Dinner nearby: ${food[0].name}` : "Relaxed dinner near your stay", notes: "" };
    if (i === days.length - 1 && days.length > 1) return { date: d.date, label: `Day ${i + 1} · ${fmt(d.date)} · Depart`, weather: wx, morning: "Pack & check out", afternoon: "Last souvenir/coffee stop, then head to the airport/station", evening: "Travel home", notes: "" };
    const pick = (pool: Highlight[], noTrip = false) => { const h = pool.find(x => queue.includes(x) && !(noTrip && x.dayTrip)) || queue.find(x => !(noTrip && x.dayTrip)); if (h) queue.splice(queue.indexOf(h), 1); return h; };
    const slots: string[] = [];
    // A day trip fills the day on dry days; never on rainy days
    const trip = !rain && style !== "Slow" ? queue.find(x => x.dayTrip) : undefined;
    const fullDays = days.length - 2;
    const cityLeft = queue.filter(x => !x.dayTrip).length;
    if (trip && ((i % 3 === 2 && fullDays >= 3) || cityLeft < Math.min(perDay, 2))) { queue.splice(queue.indexOf(trip), 1); const near = trip.lat != null ? queue.find(x => x !== trip && x.lat != null && dist(x, trip) < 15) : undefined;
      if (near) queue.splice(queue.indexOf(near), 1);
      const back = driveLabel(trip) ? ` (${driveLabel(trip)} back)` : "";
      slots.push(label(trip), near ? `Also nearby: ${near.name}, then head back${back}` : `${/beach|bay|coast|lake/i.test(trip.type || trip.name) ? "Swim or walk the shore" : /park|mountain|peak|glacier|waterfall|arch/i.test(trip.type || trip.name) ? "Short walk or viewpoint stop" : /winery|vineyard|estate/i.test(trip.type || trip.name) ? "Tasting & long lunch" : "Lunch locally"} at ${trip.name}, then head back${back}`); }
    else for (let k = 0; k < perDay; k++) { const h = rain ? pick(indoor.length ? indoor : hl, true) : pick(inp.interests?.trim() ? hl : outdoorF.length ? outdoorF : hl, true); if (h) slots.push(h.name); }
    const f = food.length ? food[i % food.length] : undefined;
    // Each backup is a distinct venue, and is taken out of the queue so it is never scheduled again
    // Prefer extra indoor venues (not on the highlight list), then unscheduled indoor highlights
    const bh = rain ? undefined : extraIndoor.find(h => !usedBackup.has(h.name)) || indoor.find(h => queue.includes(h) && !h.dayTrip && !h.ski && !usedBackup.has(h.name));
    if (bh) { usedBackup.add(bh.name); if (queue.includes(bh)) queue.splice(queue.indexOf(bh), 1); }
    const backup = bh?.name;
    return {
      date: d.date, label: `Day ${i + 1} · ${fmt(d.date)}`, weather: wx,
      morning: slots[0] || "Free morning — wander a new neighbourhood",
      afternoon: slots.slice(1).join(" → ") || (style === "Slow" ? "Long lunch & downtime" : "Explore a market or local street"),
      evening: f ? `Dinner: ${f.name}${f.tag && f.tag !== "restaurant" ? ` (${f.tag})` : ""}` : "Dinner somewhere local",
      rainyBackup: rain ? "Rain likely — indoor / partly-covered sights first" : backup ? `If it rains: ${backup}` : "If it rains: café, museum or covered market",
      notes: "",
    };
  });
}

export function timeline(start: string, international: boolean, todayIso?: string): Task[] {
  const t = (k: number, task: string): Task => ({ id: id(), due: addDays(start, -k), task, done: false });
  const today = todayIso || todayIn();
  const list = [
    t(60, international ? "Check passport validity & visa/entry rules" : "Confirm ID is valid"),
    t(45, "Book flights/transport and accommodation"),
    t(30, international ? "Buy travel insurance; check vaccinations/health advice" : "Consider travel insurance"),
    t(21, "Book must-do tickets & any restaurant reservations"),
    t(14, international ? "Tell your bank you're travelling; order some local currency" : "Tell your bank you're travelling"),
    t(7, "Check the forecast & finalise packing list"),
    t(3, international ? "Download offline maps, tickets and translation pack" : "Download offline maps and tickets"),
    t(2, "Arrange pet/plant care, hold mail"),
    t(1, "Online check-in; charge devices; pack"),
    t(0, international ? "Departure day — passport, phone, wallet, keys" : "Departure day — ID, phone, wallet, keys"),
  ];
  return list.map(x => x.due < today ? { ...x, due: today, task: x.task + " (overdue — do now)" } : x);
}

