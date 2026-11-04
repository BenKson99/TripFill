import type { TripInput, PackGroup, ItinDay } from "./plan.js";
import type { WeatherResult } from "./weather.js";
import { isRainy } from "./weather.js";

export const PRESETS = ["beach", "hiking", "ski", "city", "business", "kids", "roadtrip"] as const;
export type Preset = typeof PRESETS[number];
export const PRESET_LABELS: Record<Preset, string> = { beach: "🏖 Beach", hiking: "🥾 Hiking", ski: "⛷ Ski", city: "🏙 City", business: "💼 Business", kids: "🧒 With kids", roadtrip: "🚗 Road trip" };

let n = 0; const id = () => `p${++n}`;
export const presetsOf = (inp: TripInput): Preset[] => ((inp as any).presets || []).filter((p: string) => (PRESETS as readonly string[]).includes(p));

/** Adds preset-driven items (with reasons) into existing groups; dedupes by item name. */
export function presetPacking(groups: PackGroup[], ps: Preset[], w: WeatherResult, leaveAtHome?: { item: string }[]) {
  // Preset items supersede the generic ones they overlap with
  const drop: RegExp[] = [];
  if (ps.includes("beach")) drop.push(/^Swimwear$/);
  if (ps.includes("hiking")) drop.push(/^Hiking shoes/);
  if (ps.includes("business")) drop.push(/^Business outfit\(s\)$/, /^Laptop \+ charger$/);
  if (ps.includes("kids")) drop.push(/^Kids' meds, wipes/);
  for (const g of groups) g.items = g.items.filter(i => !drop.some(r => r.test(i.item)));
  if (leaveAtHome && ps.includes("business")) { const i = leaveAtHome.findIndex(x => x.item === "Laptop"); if (i >= 0) leaveAtHome.splice(i, 1); }
  if (leaveAtHome && (ps.includes("ski") || ps.includes("hiking"))) { const i = leaveAtHome.findIndex(x => x.item === "Heavy coat"); if (i >= 0 && ps.includes("ski")) leaveAtHome.splice(i, 1); }
  const s = w.stats; const G = (name: string) => { let g = groups.find(x => x.group === name); if (!g) { g = { group: name, items: [] }; groups.push(g); } return g; };
  const have = new Set(groups.flatMap(g => g.items.map(i => i.item.toLowerCase())));
  const add = (grp: string, item: string, reason: string) => { if (have.has(item.toLowerCase())) return; have.add(item.toLowerCase()); G(grp).items.push({ id: id(), item, reason, checked: false }); };
  const C = "Clothing", T = "Toiletries & Health", E = "Electronics", X = "Comfort & Extras", D = "Documents & Money", K = "Kids", R = "Car & Road";
  if (ps.includes("beach")) {
    add(C, "Swimwear ×2", "beach trip — one dries while you wear the other");
    add(X, "Beach towel / sarong", "beach trip");
    add(C, "Sandals / flip-flops", "beach trip");
    add(T, "Reef-safe sunscreen SPF 50 + after-sun", `beach trip, highs ~{t:${s.maxHigh}}`);
    add(X, "Sunglasses", "glare off sand and water");
    add(E, "Waterproof phone pouch", "beach trip");
    if (s.avgHigh < 22) add(C, "Light layer for the beach", `beach trip but highs only ~{t:${s.avgHigh}} — sea likely cool`);
  }
  if (ps.includes("hiking")) {
    add(C, "Broken-in hiking boots / trail shoes", "hiking — avoid blisters with new shoes");
    add(C, "Moisture-wicking layers + spare socks", "hiking");
    add(C, "Waterproof shell", (w.stats.rainyDays ? `hiking, ~${w.stats.rainyDays} wet day(s)` : "hiking — mountain weather changes fast"));
    add(X, "Daypack 20–30 L + 1.5 L water capacity", "hiking");
    add(T, "Blister kit & small first-aid kit", "hiking");
    add(E, "Offline trail map (app) + headlamp", "hiking — no signal / late finishes");
    add(X, "Trail snacks", "hiking");
  }
  if (ps.includes("ski")) {
    add(C, "Ski jacket & pants (waterproof)", `ski trip, lows ~{t:${s.minLow}}`);
    add(C, "Thermal base layers ×2 + mid-layer fleece", "ski trip");
    add(C, "Ski socks ×3", "ski trip — thin, not cotton");
    add(C, "Gloves/mittens, neck gaiter, beanie", "ski trip");
    add(X, "Goggles + helmet (or plan to rent)", "ski trip");
    add(T, "High-SPF sunscreen & lip balm with SPF", "UV is strong at altitude and off snow");
    add(D, "Lift pass / rental booking confirmations", "ski trip");
    add(C, "Après-ski boots with grip", "icy resort streets");
  }
  if (ps.includes("city")) {
    add(C, "Second pair of comfortable walking shoes", "city trip — 15k+ steps/day is common");
    add(X, "Anti-theft crossbody bag", "city trip — crowded transit & sights");
    add(E, "Transit card / app set up", "city trip");
    add(C, "One smart-casual outfit", "city trip — nicer restaurants/bars");
  }
  if (ps.includes("business")) {
    add(C, "Business outfit(s) + wrinkle-free shirt", "business trip");
    add(E, "Laptop + charger, HDMI/USB-C adapter", "business trip — presentations");
    add(D, "Business cards / meeting docs", "business trip");
    add(X, "Garment folder or steamer", "business trip");
    add(D, "Receipts envelope / expense app", "business trip — reimbursement");
  }
  if (ps.includes("kids")) {
    add(K, "Kids' meds (fever reducer), plasters, thermometer", "travelling with kids");
    add(K, "Snacks & refillable bottles", "with kids — hunger waits for no one");
    add(K, "Entertainment: tablet + headphones, books, small toys", "with kids — transit & restaurants");
    add(K, "Wipes & spare outfit in day bag", "with kids");
    add(K, "Child ID / consent letter if travelling with one parent", "with kids — some borders ask");
    add(K, "Stroller or carrier", "with kids — long walking days");
  }
  if (ps.includes("roadtrip")) {
    add(R, "Driver's licence (+ International Driving Permit if needed)", "road trip");
    add(R, "Car charger / phone mount", "road trip — navigation");
    add(R, "Offline maps + playlist/podcasts downloaded", "road trip — patchy signal");
    add(R, "Cooler bag & snacks, water", "road trip");
    add(R, "Sunglasses for driving", "road trip");
    add(R, "Roadside assistance / rental insurance details", "road trip");
  }
}

/** Itinerary tweaks driven by presets. Mutates days. */
export function presetItinerary(days: ItinDay[], ps: Preset[], w: WeatherResult, hl: { name: string; ski?: boolean; distanceKm?: number }[] = []) {
  if (!ps.length || days.length < 2) return;
  const mid = days.slice(1, days.length - 1); // full days (not arrive/depart)
  const wx = (d: ItinDay) => w.days.find(x => x.date === d.date);
  const dry = mid.filter(d => { const x = wx(d); return x && !isRainy(x); });
  const tag = (d: ItinDay, t: string) => { d.notes = d.notes ? `${d.notes} · ${t}` : t; };
  const used = new Set<ItinDay>();
  if (ps.includes("business") && ps.includes("ski")) { for (const d of mid) { d.morning = "💼 Meetings / work block"; d.afternoon = "⛷ Afternoon skiing (lifts usually close ~4 pm), then après-ski"; tag(d, "business + ski"); } return; }
  if (ps.includes("business")) for (const d of mid) { d.morning = "💼 Meetings / work block"; d.afternoon = d.afternoon.startsWith("💼") ? d.afternoon : `💼 Work, then if time: ${d.afternoon}`; tag(d, "business"); }
  const fields = hl.filter(h => h.ski);
  if (ps.includes("ski")) for (const [j, d] of mid.entries()) { const f = fields[j % Math.max(1, fields.length)]; const m0 = d.morning; d.morning = f ? `⛷ Ski ${f.name}${f.distanceKm ? ` (~${f.distanceKm} km away)` : ""} — first lifts are quietest` : "⛷ On the slopes (first lifts are quietest)"; const alt = m0 && !/^Free morning/.test(m0) ? m0 : d.afternoon; d.afternoon = `⛷ Skiing until ~3:30 pm, then après-ski${alt ? `; or a rest day: ${alt}` : ""}`; tag(d, "ski"); }
  if (ps.includes("hiking")) {
    const best = [...(dry.length ? dry : mid)].sort((a, b) => (wx(a)?.precipProb ?? 0) - (wx(b)?.precipProb ?? 0))[0];
    if (best) { used.add(best); best.morning = `🥾 Day hike (start early; driest day in the forecast)`; best.afternoon = `🥾 Hike continues — back by late afternoon; then ${best.afternoon}`; tag(best, "hiking"); }
  }
  if (ps.includes("beach")) {
    const free = (dry.length ? dry : mid).filter(d => !used.has(d)); // not the hike day
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
