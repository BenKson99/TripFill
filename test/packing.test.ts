import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./fixtures.js";
import { addPackingItem, applyEssentials, filterPacking, makeEssentials, mergeSuggestions, migratePacking, movePackingItem, packingItems, packingProgress, parseEssentials, removePackingItem, suggestPacking, tripDays, undoPackingRemoval, updatePackingItem, TEMPLATE_KEY } from "../shared/packing.js";
import { decodePlan, encodePlan, exportPlan, parsePlan, readSaved, savePlan } from "../shared/portable.js";
const item = (p: any, name: string) => packingItems(p).find(i => i.item === name)!;
const short = () => { const p = fixture(); p.input.end = "2026-11-11"; return p; };

test("quantities use inclusive days, per-person scope and one spare, not travelers or 14-day weather cap", () => {
  const p = short(); p.input.travelers = 12;
  const a = suggestPacking(p); assert.equal(tripDays(p.input), 2); assert.equal(item(a, "Tops").quantity, 2); assert.equal(item(a, "Underwear").quantity, 3);
  p.input.end = "2026-12-09"; const b = suggestPacking(p); assert.equal(tripDays(p.input), 30);
  assert.equal(item(b, "Underwear").quantity, 31); assert.equal(item(b, "Tops").quantity, 14); assert.equal(item(b, "Bottoms").quantity, 7);
  assert.equal(b.settings.laundryEvery, null); assert.match(item(b, "Tops").reason, /30 inclusive days.*no laundry assumed/);
  assert.equal(tripDays({ start: "2028-02-28", end: "2028-03-01" }), 3);
});
test("laundry is explicit and bounded, with no assumed facilities or silent clothing reset", () => {
  const p = fixture(); p.input.end = "2026-12-20";
  const a = suggestPacking(p, { laundryEvery: 7, luggage: "carry-on" });
  assert.equal(item(a, "Tops").quantity, 7); assert.equal(item(a, "Underwear").quantity, 8); assert.equal(item(a, "Socks").quantity, 8); assert.equal(item(a, "Bottoms").quantity, 3);
  assert.ok(packingItems(a).every(i => i.bag !== "checked")); assert.match(item(a, "Tops").reason, /only if arranged/);
  assert.equal(item(suggestPacking(short(), { laundryEvery: 7, luggage: "all" }), "Underwear").quantity, 3);
});
test("mixed climate uses extreme days AND departure-leg extrema, with honest reasons", () => {
  const p = fixture(); p.weather.source = "mixed";
  p.weather.days[0] = { ...p.weather.days[0], tmax: 34, tmin: 28, summary: "Clear" };
  // The departure city's cold/rain data could be overwritten on a travel day.
  p.weather.legs = [{ name: "Cold leg", stats: { minLow: -12, maxHigh: 2, avgLow: -5, avgHigh: 0, rainyDays: 2 } }];
  const a = suggestPacking(p);
  assert.ok(item(a, "Insulated winter coat")); assert.ok(item(a, "Sun hat")); assert.ok(item(a, "Thermal base layers")); assert.ok(item(a, "Packable waterproof shell"));
  assert.match(item(a, "Insulated winter coat").reason, /unknown weather basis.*-12/);
  p.weather.source = "typical"; assert.match(item(suggestPacking(p), "Sun hat").reason, /not a forecast/);
});
test("selected activities and purpose create real suggestions, deterministic unique IDs", () => {
  const p = fixture(); p.input.presets = ["beach", "hiking", "ski", "business", "roadtrip", "kids"]; p.input.interests = "photography hiking";
  const a = suggestPacking(p), b = suggestPacking(p), names = packingItems(a).map(i => i.item);
  for (const name of ["Swimwear", "Hiking shoes / trail layers", "Ski jacket & pants", "Laptop & charger", "Car charger / phone mount", "Camera, battery & memory card"]) assert.ok(names.includes(name));
  assert.deepEqual(a, b); const ids = packingItems(a).map(i => i.id); assert.equal(new Set(ids).size, ids.length);
  assert.equal(names.filter(n => n === "Swimwear").length, 1);
});
test("refresh merges only untouched suggestions and preserves all edits, checks, skipped and custom items", () => {
  const plan = fixture(); let p = suggestPacking(plan);
  const tops = item(p, "Tops"), underwear = item(p, "Underwear"), socks = item(p, "Socks");
  p = updatePackingItem(p, tops.id, { item: "My linen tops", quantity: 9, bag: "checked" });
  p = updatePackingItem(p, underwear.id, { checked: true }); p = updatePackingItem(p, socks.id, { skipped: true });
  const custom = { ...tops, id: "custom1", suggestionId: undefined, item: "My journal", quantity: 1, edited: true };
  p = addPackingItem(p, "Comfort & Extras", custom); p.settings.laundryEvery = 2;
  const q = mergeSuggestions(p, suggestPacking(plan, p.settings));
  assert.equal(item(q, "My linen tops").quantity, 9); assert.equal(item(q, "My linen tops").bag, "checked");
  assert.equal(item(q, "Underwear").quantity, 3); assert.equal(item(q, "Underwear").checked, true); assert.equal(item(q, "Socks").skipped, true); assert.ok(item(q, "My journal"));
  assert.equal(packingItems(q).filter(i => i.suggestionId === tops.suggestionId).length, 1);
  assert.equal(item(p, "Underwear").quantity, 8); // no mutation of old state
  const moved = movePackingItem(q, tops.id, "Activities"); assert.equal(moved.groups.find(g => g.group === "Activities")!.items[0].id, tops.id);
});
test("removals are not resurrected by refresh; undo preserves placement/status and survives reload", () => {
  const plan = fixture(); let p = updatePackingItem(plan.packing, packingItems(plan.packing)[0].id, { checked: true }); const first = packingItems(p)[0];
  p = removePackingItem(p, first.id); assert.ok(p.lastRemoved); assert.ok(p.dismissed.includes(first.suggestionId!));
  p = mergeSuggestions(p, suggestPacking(plan)); assert.ok(!packingItems(p).some(i => i.id === first.id));
  const restored = undoPackingRemoval(parsePlan(JSON.stringify({ ...plan, packing: p })).packing);
  assert.deepEqual(packingItems(restored)[0], first); assert.equal(restored.lastRemoved, undefined);
  assert.ok(!restored.dismissed.includes(first.suggestionId!));
});
test("legacy packing migrates quantity, duplicate IDs and missing reasons without losing edited names or ticks", () => {
  const plan = fixture(); plan.packing = { groups: [{ group: "Clothing", items: [{ id: "old", item: "Tops ×6", checked: true }, { id: "old", item: "Custom keepsake", checked: false }] }], leaveAtHome: [] };
  const a = parsePlan(JSON.stringify(plan)).packing; assert.equal(a.modelVersion, 2); assert.equal(item(a, "Tops").quantity, 6); assert.equal(item(a, "Tops").checked, true); assert.equal(item(a, "Tops").bag, "unassigned");
  assert.equal(new Set(packingItems(a).map(i => i.id)).size, 2); assert.deepEqual(migratePacking(a), a);
  const b = mergeSuggestions(a, suggestPacking(plan)); assert.equal(item(b, "Tops").quantity, 6); assert.equal(packingItems(b).filter(i => i.item === "Tops").length, 1);
  const removed = removePackingItem(a, item(a, "Tops").id);
  assert.ok(!packingItems(mergeSuggestions(removed, suggestPacking(plan))).some(i => i.item === "Tops"));
  const combined = structuredClone(a); combined.groups[0].items.push({ ...item(a, "Tops"), id: "combined", item: "Underwear & socks", quantity: 8 });
  const merged = mergeSuggestions(combined, suggestPacking(plan)); assert.ok(!item(merged, "Underwear")); assert.ok(!item(merged, "Socks"));
  const removedCombined = removePackingItem(combined, "combined"); const after = mergeSuggestions(removedCombined, suggestPacking(plan));
  assert.ok(!item(after, "Underwear")); assert.ok(!item(after, "Socks"));
});
test("validation rejects hostile/new-field data, unknown versions and duplicate modern IDs", () => {
  const mutations = [(p: any) => p.packing.modelVersion = 42, (p: any) => p.packing.groups[0].items[1].suggestionId = p.packing.groups[0].items[0].suggestionId, (p: any) => p.packing.groups.push(structuredClone(p.packing.groups[0])), (p: any) => p.packing.settings.laundryEvery = 0, (p: any) => p.packing.settings.luggage = "private-jet", (p: any) => p.packing.groups[0].items[0].quantity = 0, (p: any) => p.packing.groups[0].items[0].quantity = 100, (p: any) => p.packing.groups[0].items[0].quantity = "2", (p: any) => p.packing.groups[0].items[0].bag = "roof", (p: any) => p.packing.groups[0].items[0].essential = "yes", (p: any) => p.packing.dismissed = {}, (p: any) => p.packing.lastRemoved = { group: "x", index: -1, item: {} }, (p: any) => p.packing.groups[0].items[1].id = p.packing.groups[0].items[0].id];
  for (const mutate of mutations) { const p = fixture(); mutate(p); assert.throws(() => parsePlan(JSON.stringify(p)), /Invalid packing/); }
});
test("all edits/settings persist; portable share and exports preserve state but exclude deleted undo content", () => {
  const p = fixture(); const first = packingItems(p.packing)[0]; p.packing = updatePackingItem(p.packing, first.id, { quantity: 4, checked: true, bag: "personal", lastMinute: true }); p.packing.settings.laundryEvery = 3;
  const storageMap = new Map<string, string>(), storage = { getItem: (k: string) => storageMap.get(k) || null, setItem: (k: string, v: string) => { storageMap.set(k, v); } };
  savePlan(storage as any, p.input, p); assert.deepEqual(readSaved(storage as any)!.plan.packing, p.packing);
  const q = decodePlan(encodePlan(p)); assert.deepEqual(q.packing, p.packing); assert.deepEqual(q.budget, p.budget); assert.deepEqual(q.itinerary, p.itinerary);
  p.packing = removePackingItem(p.packing, first.id); assert.ok(p.packing.lastRemoved);
  assert.equal(parsePlan(exportPlan(p)).packing.lastRemoved, undefined); assert.equal(decodePlan(encodePlan(p)).packing.lastRemoved, undefined);
  assert.ok(!packingItems(decodePlan(encodePlan(p)).packing).some(i => i.id === first.id));
  const custom = { ...first, id: "custom-removed", suggestionId: undefined, item: "Private discarded keepsake name", edited: true };
  p.packing = addPackingItem(p.packing, "Clothing", custom); p.packing = removePackingItem(p.packing, custom.id);
  assert.ok(!exportPlan(p).includes("Private discarded keepsake name")); assert.ok(!exportPlan(p).includes("private-discarded-keepsake-name"));
});
test("separate trips do not share item objects/settings or checked status; read-only reducer calls are no-ops", () => {
  const plan = fixture(), a = suggestPacking(plan), b = suggestPacking(plan), first = packingItems(a)[0];
  const changed = updatePackingItem(a, first.id, { checked: true, quantity: 4 }); changed.settings.laundryEvery = 2;
  assert.equal(packingItems(b)[0].checked, false); assert.equal(b.settings.laundryEvery, null);
  assert.deepEqual(updatePackingItem(a, first.id, { checked: true }, true), a); assert.deepEqual(removePackingItem(a, first.id, true), a);
});
test("progress excludes not-needed rows, counts rows not quantities, and filter combinations are meaningful", () => {
  let p = suggestPacking(short()); const first = packingItems(p)[0], second = packingItems(p)[1];
  p = updatePackingItem(p, first.id, { quantity: 99, checked: true }); p = updatePackingItem(p, second.id, { skipped: true });
  const all = packingItems(p), prog = packingProgress(all); assert.equal(prog.packed, 1); assert.equal(prog.total, all.length - 1);
  assert.equal(filterPacking(all, "", "unpacked").length, all.length - 2);
  assert.equal(filterPacking(all, second.item, "skipped").length, 1); assert.equal(filterPacking(all, "PASSPORT", "essential", "personal").length, 1);
  assert.equal(filterPacking(all, "no-match-at-all").length, 0); assert.deepEqual(packingProgress([]), { total: 0, packed: 0, percent: 0 });
  assert.equal(packingProgress(all.map(i => ({ ...i, skipped: true }))).total, 0);
});
test("personal template strips checks/undo/source text and only intentionally applied items join snapshots", () => {
  const plan = fixture(); let a = suggestPacking(plan); const first = packingItems(a)[0];
  a = updatePackingItem(a, first.id, { checked: true, reason: "trip-private reason" });
  const custom = { ...first, id: "j1", item: "Travel journal", reason: "My old trip", essential: true, suggestionId: undefined, checked: true, edited: true };
  a = addPackingItem(a, "Comfort & Extras", custom);
  const t = parseEssentials(JSON.stringify(makeEssentials(a))); assert.ok(!JSON.stringify(t).includes("trip-private")); assert.ok(!JSON.stringify(t).includes('"checked"'));
  const b = suggestPacking(short()); assert.ok(!packingItems(b).some(i => i.item === "Travel journal"));
  const c = applyEssentials(b, t); assert.equal(item(c, "Travel journal").checked, false); assert.equal(item(c, "Travel journal").quantity, 1);
  assert.equal(packingItems(applyEssentials(c, t)).length, packingItems(c).length); assert.equal(packingItems(b).length, packingItems(suggestPacking(short())).length);
  assert.ok(!exportPlan({ ...plan, packing: b }).includes("Travel journal")); assert.ok(exportPlan({ ...plan, packing: c }).includes("Travel journal"));
  assert.equal(TEMPLATE_KEY, "tripfill:packing-essentials:v1");
  assert.throws(() => parseEssentials('{"version":1,"items":[{"item":"x","quantity":0}]}'), /could not be read/);
});
