/** Data-only packing model shared by generation, migration, UI and tests. No personal template state here. */
export const BAGS = ["unassigned", "personal", "carry-on", "checked"] as const;
export type Bag = typeof BAGS[number];
export interface PackingSettings { laundryEvery: number | null; luggage: "all" | "carry-on" }
export interface PackingItem {
  id: string; item: string; quantity: number; reason: string; checked: boolean; bag: Bag;
  essential: boolean; lastMinute: boolean; skipped: boolean; edited: boolean; suggestionId?: string;
}
export interface PackingGroup { group: string; items: PackingItem[] }
export interface PackingList {
  modelVersion: 2; settings: PackingSettings; groups: PackingGroup[];
  leaveAtHome: { id: string; item: string; reason?: string; checked: boolean }[];
  dismissed: string[]; lastRemoved?: { group: string; index: number; item: PackingItem };
}
const key = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const identity = (s: string) => key(s.replace(/\s*×\s*\d+\b/, ""));
// A legacy combined row already covers both suggestions. Never duplicate it on refresh.
const itemNames = (name: string) => identity(name) === "underwear-socks" ? ["underwear-socks", "underwear", "socks"] : [identity(name)];
// Deterministic 64-bit tombstones keep removed custom labels out of distributed snapshots.
const nameKey = (name: string) => { let hash = 14695981039346656037n; for (const c of name) { hash ^= BigInt(c.codePointAt(0)!); hash = BigInt.asUintN(64, hash * 1099511628211n); } return `name-${hash.toString(16)}`; };
const removalKeys = (i: PackingItem) => [...(i.suggestionId ? [i.suggestionId] : []), ...itemNames(i.item).map(nameKey)];
export const quantity = (n: number) => Math.max(1, Math.min(99, Math.round(Number(n) || 1)));
export const packingItems = (p: PackingList) => p.groups.flatMap(g => g.items);
export const packingProgress = (items: PackingItem[]) => { const eligible = items.filter(i => !i.skipped); const packed = eligible.filter(i => i.checked).length; return { total: eligible.length, packed, percent: eligible.length ? Math.round(packed / eligible.length * 100) : 0 }; };
export function filterPacking(items: PackingItem[], search = "", status = "all", bag = "all") {
  const q = search.trim().toLocaleLowerCase();
  return items.filter(i => (!q || `${i.item} ${i.reason}`.toLocaleLowerCase().includes(q)) && (bag === "all" || i.bag === bag) &&
    (status === "all" || status === "unpacked" && !i.checked && !i.skipped || status === "essential" && i.essential && !i.skipped || status === "last-minute" && i.lastMinute && !i.skipped || status === "skipped" && i.skipped));
}
export function tripDays(input: any): number {
  const n = Math.round((Date.parse(input.end + "T00:00:00Z") - Date.parse(input.start + "T00:00:00Z")) / 86400000) + 1;
  return Number.isFinite(n) ? Math.max(1, n) : 1;
}
export function packingSettings(raw: any = {}): PackingSettings {
  return { laundryEvery: Number.isInteger(raw.laundryEvery) && raw.laundryEvery >= 1 && raw.laundryEvery <= 30 ? raw.laundryEvery : null, luggage: raw.luggage === "carry-on" ? "carry-on" : "all" };
}
/** Legacy names/checks/IDs stay intact, except a single unambiguous trailing ×quantity is separated. */
export function migratePacking(raw: any): PackingList {
  const p = structuredClone(raw), modern = p.modelVersion === 2, seen = new Set<string>();
  p.settings = packingSettings(p.settings); p.modelVersion = 2; p.dismissed ||= [];
  if (!modern) {
    const groups: PackingGroup[] = [];
    for (const g of p.groups) { const existing = groups.find(x => x.group === g.group); if (existing) existing.items.push(...g.items); else groups.push(g); }
    p.groups = groups;
  }
  for (const g of p.groups) for (const it of g.items) {
    if (!modern) {
      const match = it.item.match(/\s*×\s*(\d+)\s*$/);
      if (match) { it.quantity = quantity(Number(match[1])); it.item = it.item.slice(0, match.index).trim(); }
      it.quantity ??= 1; it.bag ??= "unassigned"; it.essential ??= false; it.lastMinute ??= false; it.skipped ??= false;
      // Legacy content is user-owned; refresh must never overwrite it.
      it.edited = true; it.reason ||= "";
    }
    if (!it.id || seen.has(it.id)) { const base = `legacy-${identity(g.group + " " + it.item)}`; let id = base, n = 2; while (seen.has(id)) id = `${base}-${n++}`; it.id = id; }
    seen.add(it.id);
  }
  return p;
}
/** Reject malformed new fields rather than quietly converting malicious/invalid imports. */
export function validatePacking(raw: any) {
  const fail = () => { throw new Error("Invalid packing data. Use a complete TripFill export (quantities 1–99, valid bag and settings)."); };
  if (raw.modelVersion !== undefined && raw.modelVersion !== 2) fail();
  if (raw.settings !== undefined) {
    const s = raw.settings; if (!s || !["all", "carry-on"].includes(s.luggage) || !(s.laundryEvery === null || Number.isInteger(s.laundryEvery) && s.laundryEvery >= 1 && s.laundryEvery <= 30)) fail();
  }
  if (raw.modelVersion === 2 && !raw.settings) fail();
  const checkItem = (i: any) => {
    if (!i || typeof i.id !== "string" || typeof i.item !== "string" || typeof i.checked !== "boolean") fail();
    if (i.quantity !== undefined && (!Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 99)) fail();
    if (i.bag !== undefined && !BAGS.includes(i.bag)) fail();
    for (const k of ["essential", "lastMinute", "skipped", "edited"]) if (i[k] !== undefined && typeof i[k] !== "boolean") fail();
    if (i.suggestionId !== undefined && (typeof i.suggestionId !== "string" || !i.suggestionId.startsWith("suggest-"))) fail();
    if (i.reason !== undefined && typeof i.reason !== "string") fail();
    if (raw.modelVersion === 2 && ["quantity", "bag", "essential", "lastMinute", "skipped", "edited", "reason"].some(k => i[k] === undefined)) fail();
  };
  const ids = new Set<string>(), suggestionIds = new Set<string>();
  if (raw.modelVersion === 2 && new Set(raw.groups.map((g: any) => g.group)).size !== raw.groups.length) fail();
  for (const g of raw.groups) for (const i of g.items) {
    checkItem(i);
    if (raw.modelVersion === 2 && (!i.id || ids.has(i.id))) fail();
    ids.add(i.id);
    if (raw.modelVersion === 2 && i.suggestionId) { if (suggestionIds.has(i.suggestionId)) fail(); suggestionIds.add(i.suggestionId); }
  }
  if (raw.dismissed !== undefined && (!Array.isArray(raw.dismissed) || raw.dismissed.length > 1000 || raw.dismissed.some((x: any) => typeof x !== "string"))) fail();
  if (raw.lastRemoved !== undefined) { if (raw.modelVersion !== 2) fail(); const r = raw.lastRemoved; if (!r || typeof r.group !== "string" || !Number.isInteger(r.index) || r.index < 0) fail(); checkItem(r.item); }
}
export function suggestPacking(plan: any, settings = packingSettings(plan.packing?.settings)): PackingList {
  const input = plan.input, w = plan.weather, days = tripDays(input), cycle = Math.min(days, settings.laundryEvery ?? days);
  const clothingNote = `${days} inclusive days · ${settings.laundryEvery ? `wash every ${settings.laundryEvery} days only if arranged` : "no laundry assumed"} · per person`;
  const usable = (w?.days || []).filter((d: any) => Number.isFinite(d.tmin) && Number.isFinite(d.tmax));
  // Leg stats retain departure-city extremes even if stitched weather uses arrival city that day.
  const lows = [...usable.map((d: any) => d.tmin), w?.stats?.minLow, ...(w?.legs || []).map((l: any) => l.stats?.minLow)].filter(Number.isFinite);
  const highs = [...usable.map((d: any) => d.tmax), w?.stats?.maxHigh, ...(w?.legs || []).map((l: any) => l.stats?.maxHigh)].filter(Number.isFinite);
  const lo = lows.length ? Math.min(...lows) : null, hi = highs.length ? Math.max(...highs) : null;
  const rain = usable.some((d: any) => d.precipProb >= 40 || d.precipMm >= 1 || /rain|snow|shower|sleet|drizzle|storm/i.test(d.summary || "")) || w?.stats?.rainyDays > 0 || w?.legs?.some((l: any) => l.stats?.rainyDays > 0);
  const basis = w?.source === "forecast" ? "available forecast (not a guarantee)" : w?.source === "typical" ? "seasonal estimates, not a forecast" : "mixed/unknown weather basis — verify forecast";
  const coldReason = `${basis} · lowest available low {t:${lo}} across available legs`, hotReason = `${basis} · highest available high {t:${hi}} across available legs`;
  const text = `${input.interests || ""} ${input.purpose || ""} ${(input.presets || []).join(" ")}`.toLowerCase();
  const hiking = /hik|trek|outdoor|adventure|mountain/.test(text), beach = /beach|swim|pool|surf|snorkel|spa/.test(text), ski = /ski|snowboard/.test(text), business = /business/.test(text);
  const groups: PackingGroup[] = [], used = new Set<string>();
  const add = (group: string, item: string, reason: string, qty = 1, opts: Partial<PackingItem> = {}) => {
    const id = `suggest-${identity(item)}`; if (used.has(id)) return; used.add(id);
    let g = groups.find(g => g.group === group); if (!g) { g = { group, items: [] }; groups.push(g); }
    g.items.push({ id, suggestionId: id, item, reason, quantity: quantity(qty), checked: false, skipped: false, bag: settings.luggage === "carry-on" ? "carry-on" : "unassigned", essential: false, lastMinute: false, edited: false, ...opts });
  };
  const D = "Documents & Money", C = "Clothing", H = "Toiletries & Health", E = "Electronics", X = "Comfort & Extras", A = "Activities";
  add(D, plan.trip?.domestic ? "Government photo ID" : "Passport / accepted travel ID & entry documents", "Check official entry and carrier rules for every destination and transit; requirements vary", 1, { essential: true, bag: "personal", lastMinute: true });
  add(D, "Bookings & tickets (offline copies)", "Keep arrival details available without a connection", 1, { essential: true, bag: "personal" });
  add(D, "Payment card + backup / local cash", "Choose payment options for your route; separate backups", 1, { essential: true, bag: "personal", lastMinute: true });
  add(D, "Travel insurance / emergency contact details", "Check coverage and keep a non-sensitive offline copy", 1, { bag: "personal" });
  add(D, "House keys", "Keep accessible for your return", 1, { essential: true, bag: "personal", lastMinute: true });
  add(C, "Tops", clothingNote + " · rewear if comfortable; capped at 14", Math.min(cycle, 14));
  add(C, "Underwear", clothingNote + " · one spare; capped at 31", Math.min(cycle + 1, 31));
  add(C, "Socks", clothingNote + " · one spare; capped at 31", Math.min(cycle + 1, 31));
  add(C, "Bottoms", clothingNote + " · rewear roughly three days; capped at 7", Math.min(Math.max(1, Math.ceil(cycle / 3)), 7));
  add(C, "Comfortable walking shoes", "One pair including the pair worn in transit; adjust for your mobility needs");
  add(C, "Sleepwear", "Reuse between washes", days > 7 ? 2 : 1);
  if (lo !== null && lo <= 8) add(C, lo <= 0 ? "Insulated winter coat" : "Warm jacket", coldReason);
  if (lo !== null && lo < 15) add(C, "Light sweater / fleece", coldReason);
  if (lo !== null && lo <= 0) { add(C, "Hat, gloves & scarf", coldReason); add(C, "Thermal base layers", coldReason, 2); }
  if (hi !== null && hi >= 27) { add(C, "Sun hat", hotReason); add(C, "Lightweight shorts / warm-weather layer", hotReason, Math.min(2, cycle)); }
  if (rain || hiking) add(C, "Packable waterproof shell", hiking ? "Hiking — exposed conditions can change; check route-specific weather" : `${basis} · wet conditions appear in available data`);
  if (lo !== null && lo <= 0 && rain) add(C, "Waterproof boots with grip", `${coldReason} · wet/snow conditions possible; verify locally`);
  add(H, "Toothbrush & toothpaste", "Daily essentials"); add(H, "Deodorant & personal care", "Adjust to your routine; travel sizes if useful");
  add(H, "Usual medicines / personal health supplies (if needed)", "Bring your own required supplies; check official transport/import rules. No medical advice or details needed", 1, { essential: true, bag: "personal", lastMinute: true });
  add(H, "Small first-aid / blister kit", "Choose supplies appropriate to your needs", 1, { bag: "personal" });
  if (hi !== null && hi >= 18 || hiking || ski || beach) add(H, "Sunscreen & sunglasses", "Sun protection can matter even in cool weather; follow product guidance");
  if (lo !== null && lo <= 8) add(H, "Lip balm & moisturiser", coldReason);
  add(E, "Phone & charger", "Daily navigation and communication", 1, { essential: true, bag: "personal", lastMinute: true });
  add(E, "Power bank (if needed)", "Verify carrier/security battery rules, ratings and permitted bag; assignment is not clearance", 1, { bag: "personal" });
  if (!plan.trip?.domestic) add(E, "Plug adapter(s) & voltage check", "Check official socket information for all stops and your devices' voltage compatibility; adapters do not convert voltage");
  if (/photo|camera/.test(text)) add(E, "Camera, battery & memory card", "Photography interest — verify spare battery transport rules");
  if (business) { add(C, "Business outfit", "Business plans — adjust to meetings and dress code", Math.min(3, cycle)); add(E, "Laptop & charger", "Business plans; check security and carrier rules", 1, { bag: "personal" }); }
  if (/celebration/.test(text)) add(C, "Dressy outfit", "Celebration plans — check dress code");
  add(X, "Reusable water bottle", "Refill where drinking water is safe; empty before security if required");
  add(X, "Day bag / tote", "Daily essentials"); add(X, "Laundry / worn-clothes bag", settings.laundryEvery ? "Laundry planned — confirm facilities and drying time" : "Separate worn clothing; no washing facilities assumed");
  if (settings.laundryEvery) add(X, "Laundry supplies (if needed)", `Wash every ${settings.laundryEvery} days — arrange facilities; check product transport rules`);
  if (beach) { add(A, "Swimwear", "Beach / swimming activity selected", Math.min(2, days)); add(A, "Beach towel / sarong", "Check whether accommodation provides one"); add(A, "Sandals", "Beach / swimming activity selected"); }
  if (hiking) { add(A, "Hiking shoes / trail layers", "Hiking activity — choose gear for the actual route and check conditions"); add(A, "Daypack, trail snacks & water capacity", "Hiking activity — tailor water and supplies to the route, not a fixed universal amount"); add(A, "Offline trail map & headlamp", "Hiking activity — know your route and daylight limits"); }
  if (ski) { add(A, "Ski jacket & pants", "Ski activity — weather-appropriate layers"); add(A, "Ski socks", "Ski activity — dry spare pairs", Math.min(3, cycle + 1)); add(A, "Goggles & helmet / rental booking", "Ski activity — confirm fit and rentals"); }
  if (/kids|family/.test(text)) { add(A, "Children's spare outfit, wipes & snacks", "Family plans — tailor to age and individual needs"); add(A, "Children's entertainment / comfort item", "Family plans — transit and downtime"); }
  if (/roadtrip/.test(text)) { add(A, "Driving licence & rental documents", "Road-trip activity — check official licence/permit and insurance rules", 1, { bag: "personal", essential: true }); add(A, "Car charger / phone mount", "Road-trip activity — navigation"); }
  if (input.walkingTolerance === "low") add(X, "Usual mobility aids & accessibility notes", "Adjust to your own needs; verify route access, not medical advice");
  if (input.walkingTolerance === "high") add(H, "Spare walking socks / foot care", "Longer outings selected — adjust to your needs");
  if (input.dietaryNeeds && input.dietaryNeeds !== "none") add(X, "Dietary translation card & backup snacks", "Confirm ingredients and cross-contact directly; not an allergy-safety guarantee");
  return { modelVersion: 2, settings: { ...settings }, groups, dismissed: [], leaveAtHome: [] };
}
/** Explicit refresh: update unedited suggestions only, preserve checks/skips; never delete or resurrect removals. */
export function mergeSuggestions(current: PackingList, suggestions: PackingList): PackingList {
  const out = structuredClone(current), items = packingItems(out);
  for (const g of suggestions.groups) for (const next of g.items) {
    if (removalKeys(next).some(k => out.dismissed.includes(k))) continue;
    const found = items.find(i => i.suggestionId === next.suggestionId || itemNames(i.item).includes(identity(next.item)));
    if (found) { if (!found.edited && found.suggestionId) Object.assign(found, next, { id: found.id, checked: found.checked, skipped: found.skipped }); }
    else { let target = out.groups.find(x => x.group === g.group); if (!target) { target = { group: g.group, items: [] }; out.groups.push(target); } const copy = structuredClone(next); target.items.push(copy); items.push(copy); }
  }
  return out;
}
export function updatePackingItem(list: PackingList, id: string, patch: Partial<PackingItem>, readOnly = false): PackingList {
  const out = structuredClone(list); if (readOnly) return out;
  const i = packingItems(out).find(i => i.id === id); if (!i) return out;
  Object.assign(i, patch); if (patch.quantity !== undefined) i.quantity = quantity(patch.quantity);
  if (Object.keys(patch).some(k => !["checked", "skipped"].includes(k))) i.edited = true;
  return out;
}
export function removePackingItem(list: PackingList, id: string, readOnly = false): PackingList {
  const out = structuredClone(list); if (readOnly) return out;
  for (const g of out.groups) { const index = g.items.findIndex(i => i.id === id); if (index < 0) continue;
    const [item] = g.items.splice(index, 1); out.lastRemoved = { group: g.group, index, item };
    for (const k of removalKeys(item)) if (!out.dismissed.includes(k)) out.dismissed.push(k); break;
  } return out;
}
export function undoPackingRemoval(list: PackingList): PackingList {
  const out = structuredClone(list), r = out.lastRemoved; if (!r) return out;
  if (!packingItems(out).some(i => i.id === r.item.id)) { let g = out.groups.find(g => g.group === r.group); if (!g) { g = { group: r.group, items: [] }; out.groups.push(g); } g.items.splice(Math.min(r.index, g.items.length), 0, r.item); }
  out.dismissed = out.dismissed.filter(id => !removalKeys(r.item).includes(id)); delete out.lastRemoved; return out;
}
export function addPackingItem(list: PackingList, group: string, item: PackingItem): PackingList {
  const out = structuredClone(list); if (packingItems(out).some(i => i.id === item.id)) return out;
  let g = out.groups.find(g => g.group === group); if (!g) { g = { group, items: [] }; out.groups.push(g); } g.items.push(structuredClone(item)); return out;
}
export function movePackingItem(list: PackingList, id: string, category: string): PackingList {
  const out = structuredClone(list), item = packingItems(out).find(i => i.id === id); if (!item) return out;
  for (const g of out.groups) g.items = g.items.filter(i => i.id !== id);
  item.edited = true;
  return addPackingItem(out, category, item);
}
export const TEMPLATE_KEY = "tripfill:packing-essentials:v1";
export function makeEssentials(list: PackingList) {
  return { version: 1, items: list.groups.flatMap(g => g.items.filter(i => i.essential && !i.skipped).map(i => ({ item: i.item, quantity: i.quantity, group: g.group, bag: i.bag, essential: true, lastMinute: i.lastMinute }))) };
}
export function parseEssentials(text: string): ReturnType<typeof makeEssentials> {
  if (text.length > 100000) throw new Error("Essentials template too large.");
  const t = JSON.parse(text);
  if (t?.version !== 1 || !Array.isArray(t.items) || t.items.length > 200 || t.items.some((i: any) => !i || typeof i.item !== "string" || !i.item.trim() || i.item.length > 300 || typeof i.group !== "string" || !i.group.trim() || i.group.length > 100 || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 99 || !BAGS.includes(i.bag) || i.essential !== true || typeof i.lastMinute !== "boolean")) throw new Error("Personal essentials could not be read. Save a new template to replace it.");
  return { version: 1, items: t.items.map((i: any) => ({ item: i.item, quantity: i.quantity, group: i.group, bag: i.bag, essential: true, lastMinute: i.lastMinute })) };
}
export function applyEssentials(list: PackingList, template: ReturnType<typeof makeEssentials>): PackingList {
  let out = structuredClone(list);
  for (const i of template.items) { const found = packingItems(out).find(x => identity(x.item) === identity(i.item));
    if (found) { found.essential = true; continue; }
    out = addPackingItem(out, i.group, { ...i, id: `personal-${identity(i.item)}`, reason: "Applied from your personal essentials", checked: false, skipped: false, edited: true });
  } return out;
}
