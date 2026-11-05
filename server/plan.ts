import type { WeatherResult, DayWeather, Place } from "./weather.js";
import { isRainy } from "./weather.js";
import type { Highlight } from "./places.js";
import type { Eat } from "./eats.js";

export interface TripInput { destination: string; start: string; end: string; travelers?: number; purpose?: string; style?: "Slow" | "Packed" | "Mix"; interests?: string; home?: Place }
export interface PackItem { id: string; item: string; reason: string; checked: boolean }
export interface PackGroup { group: string; items: PackItem[] }
export interface ItinDay { date: string; label: string; weather: string; morning: string; afternoon: string; evening: string; rainyBackup?: string; notes: string }
export interface Task { id: string; due: string; task: string; done: boolean }
export interface BudgetLine { category: string; perDay: number; total: number; basis: string }

let n = 0; const id = () => `i${++n}`;
const dow = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
const fmt = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const addDays = (iso: string, k: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };

export function packing(inp: TripInput, w: WeatherResult, place: Place, nights: number, domestic = false): { groups: PackGroup[]; leaveAtHome: PackItem[] } {
  const s = w.stats; const days = w.days; const purpose = (inp.purpose || "Leisure").toLowerCase();
  const interests = (inp.interests || "").toLowerCase();
  const rainy = days.filter(isRainy); const rainLabel = rainy.length ? (w.source !== "typical" ? `rain likely ${rainy.slice(0, 3).map(d => dow(d.date)).join(", ")}` : `wet on ~${rainy.length} of ${days.length} days in a typical year`) : "";
  const hot = s.maxHigh >= 27, warm = s.avgHigh >= 20, cold = s.minLow <= 8, freezing = s.minLow <= 0;
  const snow = days.some(d => d.code != null && [71, 73, 75, 77, 85, 86].includes(d.code)) || (freezing && s.rainyDays > 0);
  const laundry = nights > 7; const clothesDays = Math.min(nights + 1, 7);
  const g: Record<string, PackItem[]> = { "Documents & Money": [], Clothing: [], "Toiletries & Health": [], Electronics: [], "Comfort & Extras": [] };
  const add = (grp: string, item: string, reason: string) => g[grp].push({ id: id(), item, reason, checked: false });
  const D = "Documents & Money", C = "Clothing", T = "Toiletries & Health", E = "Electronics", X = "Comfort & Extras";

  if (domestic) add(D, "Government photo ID", "domestic trip — no passport needed");
  else add(D, "Passport (check expiry ≥ 6 months) + any visa/entry docs", `international trip to ${place.country}`);
  add(D, "Bookings & tickets (offline copies)", "no signal on arrival is common");
  add(D, "Travel insurance details", "medical & cancellations");
  add(D, "Payment card + backup card", "keep them in separate bags");
  if (!domestic) add(D, "Some local cash", `small purchases in ${place.country}`);
  if (purpose === "business") add(D, "Business cards / meeting docs", "business trip");

  add(C, `Tops ×${clothesDays}`, laundry ? `${nights} nights — plan one laundry stop` : `${nights} nights`);
  add(C, `Underwear & socks ×${clothesDays + 1}`, "one spare");
  add(C, `Bottoms ×${Math.max(2, Math.ceil(clothesDays / 3))}`, "rewear between washes");
  add(C, "Comfortable walking shoes", "most sightseeing is on foot");
  add(C, "Sleepwear", "");
  if (cold) add(C, freezing ? "Insulated winter coat" : "Warm jacket", `lows ~{t:${s.minLow}}`);
  if (freezing) { add(C, "Hat, gloves, scarf", `lows ~{t:${s.minLow}}`); add(C, "Thermal base layer", "below-freezing nights"); }
  else if (s.avgLow < 15) add(C, "Light sweater / fleece", `evenings ~{t:${s.avgLow}}`);
  if (warm) add(C, "Breathable T-shirts / shorts", `highs ~{t:${s.avgHigh}}`);
  if (hot) add(C, "Sun hat", `peaks ~{t:${s.maxHigh}}`);
  if (rainy.length) { add(C, "Packable rain jacket", rainLabel); add(C, "Water-resistant shoes or quick-dry socks", rainLabel); }
  if (snow) add(C, "Waterproof boots with grip", "snow/ice possible");
  if (purpose === "business") add(C, "Business outfit(s)", "meetings");
  if (purpose === "celebration") add(C, "One dressy outfit + shoes", "celebration dinner/event");
  if (/swim|beach|pool|surf|snorkel|spa|onsen/.test(interests) || s.avgHigh >= 25) add(C, "Swimwear", /swim|beach|pool|surf|snorkel|spa|onsen/.test(interests) ? "matches your interests" : `warm (~{t:${s.avgHigh}})`);
  if (/hik|trek|outdoor|mountain|nature/.test(interests) || purpose === "adventure") add(C, "Hiking shoes / trail layers", "outdoor activities");

  add(T, "Toothbrush, toothpaste, deodorant", "");
  add(T, "Prescription meds (+ a few extra days)", "delays happen");
  add(T, "Basic first-aid: plasters, painkillers, antihistamine", "");
  if (s.maxHigh >= 18 || purpose === "adventure") add(T, "Sunscreen SPF 30+", `highs ~{t:${s.maxHigh}}`);
  if (cold) add(T, "Lip balm & moisturiser", "cold/dry air");
  if (/hik|nature|outdoor|camp|jungle|safari/.test(interests)) add(T, "Insect repellent", "outdoor plans");
  if (purpose === "family") add(T, "Kids' meds, wipes, snacks", "family trip");

  add(E, "Phone + charger", "");
  add(E, "Power bank", "long sightseeing days");
  if (!domestic) add(E, `Plug adapter for ${place.country}`, "check socket type before you go");
  if (/photo|camera/.test(interests)) add(E, "Camera, spare battery & memory card", "photography interest");
  if (purpose === "business") add(E, "Laptop + charger", "work");
  if (nights >= 3) add(E, "Headphones", "transit time");

  add(X, "Reusable water bottle", warm ? "staying hydrated in the heat" : "saves money");
  add(X, "Day bag / tote", "daily essentials");
  if (rainy.length) add(X, "Compact umbrella", rainLabel);
  if (nights >= 4) add(X, "Small laundry bag", "separate worn clothes");
  if (nights >= 5) add(X, "Travel pillow / eye mask", "long travel days");
  if (/food|culin|eat/.test(interests)) add(X, "Stretchy pants (seriously)", "food-focused trip");

  const leaveAtHome: PackItem[] = [
    { id: id(), item: "Every 'just in case' outfit", reason: laundry ? "you'll do laundry" : "you won't wear it", checked: false },
    { id: id(), item: "Valuables & sentimental jewellery", reason: "theft/loss risk", checked: false },
    { id: id(), item: "Full-size toiletries", reason: "buy locally or use travel sizes", checked: false },
    { id: id(), item: "Unneeded cards & loyalty cards", reason: "less to lose", checked: false },
  ];
  if (!cold) leaveAtHome.push({ id: id(), item: "Heavy coat", reason: `lows ~{t:${s.minLow}}`, checked: false });
  if (!rainy.length) leaveAtHome.push({ id: id(), item: "Bulky umbrella", reason: "little rain expected", checked: false });
  if (purpose !== "business") leaveAtHome.push({ id: id(), item: "Laptop", reason: "unless you need it — it's a break", checked: false });
  return { groups: Object.entries(g).map(([group, items]) => ({ group, items })), leaveAtHome };
}

const dist = (a: { lat?: number; lon?: number }, b: { lat?: number; lon?: number }) => { const r = (x: number) => x * Math.PI / 180; const h = Math.sin(r(b.lat! - a.lat!) / 2) ** 2 + Math.cos(r(a.lat!)) * Math.cos(r(b.lat!)) * Math.sin(r(b.lon! - a.lon!) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
/** "~1h 20m drive" from OSRM, or "~1h 30m drive est." from the straight-line fallback */
export const driveLabel = (h: { driveMin?: number; driveSrc?: string; distanceKm?: number }) => { const m = h.driveMin ?? (h.distanceKm != null ? Math.round(h.distanceKm * 1.4) : undefined); if (m == null) return ""; const r5 = Math.round(m / 5) * 5, H = Math.floor(r5 / 60), M = r5 % 60; return `~${H ? `${H}h${M ? ` ${M}m` : ""}` : `${M || 5}m`} drive${h.driveSrc === "osrm" ? "" : " est."}`; };
export function itinerary(inp: TripInput, w: WeatherResult, hl: Highlight[], food: Eat[], extraIndoor: Highlight[] = []): ItinDay[] {
  const style = inp.style || "Mix"; const perDay = style === "Slow" ? 1 : style === "Packed" ? 3 : 2;
  const outdoor = hl.filter(h => h.setting !== "indoor"), indoor = [...hl.filter(h => h.setting === "indoor"), ...hl.filter(h => h.setting === "mixed")];
  hl = hl.filter(h => !h.ski); // ski areas are scheduled by the ski preset
  const outdoorF = outdoor.filter(h => !h.ski);
  const queue = [...hl]; const days = w.days.slice(0, 14); const usedBackup = new Set<string>();
  const label = (h: Highlight) => h.dayTrip ? `🚐 Day trip: ${h.name} (${driveLabel(h)} each way)` : h.name;
  return days.map((d, i) => {
    const rain = isRainy(d); const wx = `${d.summary || ""} {t:${d.tmin}}–{t:${d.tmax}}${d.precipProb != null ? (d.typical ? `, wet in ${d.precipProb}% of past years` : `, ${d.precipProb}% rain`) : ""}`.trim();
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
    else for (let k = 0; k < perDay; k++) { const h = rain ? pick(indoor.length ? indoor : hl, true) : pick(outdoorF.length ? outdoorF : hl, true); if (h) slots.push(h.name); }
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

export function timeline(start: string, international: boolean): Task[] {
  const t = (k: number, task: string): Task => ({ id: id(), due: addDays(start, -k), task, done: false });
  const today = new Date().toISOString().slice(0, 10);
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

