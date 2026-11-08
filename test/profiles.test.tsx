import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { fixture } from "./fixtures.js";
import { exportPlan, parsePlan } from "../shared/portable.js";
import { packingItems, suggestPacking, mergeSuggestions, simpleLists, updatePackingItem, removePackingItem, validatePacking, packingMembers, fillEmptyTravelers, memberKind, type PackingList } from "../shared/packing.js";
import { PackingSettingsPanel, PackingWorkspace } from "../src/Packing.js";

const names = ["Passport / accepted travel ID & entry documents", "Payment card + backup / local cash", "Tops", "Underwear", "Socks", "Bottoms", "Comfortable walking shoes", "Sleepwear", "Toothbrush & toothpaste", "Phone & charger", "House keys", "Day bag / tote", "My lucky scarf"];
/** Screenshot-shaped legacy (pre-1.8) data: 3 travelers, every personal row migrates to traveler-1, a few shared. */
export function legacyPlan() {
  const p = fixture(); p.input.travelers = 3;
  p.packing = { groups: [{ group: "Essentials", items: names.map((n, i) => ({ id: `old-${i}`, item: n === "Tops" ? "Tops ×5" : n, checked: n === "Tops" || n === "My lucky scarf" })) }], leaveAtHome: [] };
  return p;
}
const own = (l: PackingList, id: string) => packingItems(l).filter(i => i.owner === id);
const kids5 = [{ id: "traveler-1", name: "Dad", profile: "man" }, { id: "traveler-2", name: "Mum", profile: "woman" }, { id: "traveler-3", name: "Ava", profile: "girl" }, { id: "traveler-4", name: "Max", profile: "boy" }, { id: "traveler-5", name: "Baby", profile: "infant" }];
const family5 = () => { const p = fixture(); p.input.travelers = 5; p.packing = suggestPacking(p, { laundryEvery: null, luggage: "all", members: kids5 } as any); return p; };

test("root cause repair: legacy list with only Traveler 1 populated gets lists for Travelers 2 and 3 on load", () => {
  const raw = legacyPlan();
  const before = JSON.parse(JSON.stringify(raw.packing));
  const a = parsePlan(JSON.stringify(raw)).packing as PackingList;
  assert.equal(own(a, "traveler-1").length, names.length - 2, "legacy rows unchanged on traveler 1");
  assert.ok(own(a, "traveler-2").length > 15 && own(a, "traveler-3").length > 15);
  assert.equal(own(a, "traveler-2").length, own(a, "traveler-3").length);
  for (const t of ["traveler-2", "traveler-3"]) { assert.ok(own(a, t).some(i => i.item === "Tops")); assert.ok(own(a, t).every(i => !i.checked && !i.edited)); }
  assert.equal(packingItems(a).filter(i => i.item === "House keys").length, 1, "shared supplies not duplicated");
  const t1 = own(a, "traveler-1"); assert.equal(t1.find(i => i.item === "Tops")!.quantity, 5); assert.ok(t1.find(i => i.item === "Tops")!.checked && t1.find(i => i.item === "My lucky scarf")!.checked);
  assert.ok(t1.every(i => i.edited), "legacy content stays protected from refresh");
  assert.deepEqual(raw.packing, before, "input object not mutated");
});
test("repair is idempotent across reload and export/import", () => {
  const once = parsePlan(JSON.stringify(legacyPlan()));
  const twice = parsePlan(exportPlan(once)), thrice = parsePlan(JSON.stringify(twice));
  assert.deepEqual(twice.packing, once.packing); assert.deepEqual(thrice.packing, once.packing);
});
test("repair respects progress: a traveler with any item or removal is not refilled", () => {
  let a = parsePlan(JSON.stringify(legacyPlan())).packing as PackingList;
  for (const i of own(a, "traveler-3")) a = removePackingItem(a, i.id);
  const p = fixture(); p.input.travelers = 3;
  const again = fillEmptyTravelers(a, p);
  assert.equal(own(again, "traveler-3").length, 0, "removed items never resurrect");
  const t2 = own(a, "traveler-2")[0]; a = updatePackingItem(a, t2.id, { stage: "need-to-buy" });
  assert.equal(own(fillEmptyTravelers(a, p), "traveler-2").find(i => i.id === t2.id)!.stage, "need-to-buy");
});
test("new mixed five-profile family: every traveler gets a real list, shared once, sensible infant defaults", () => {
  const p = family5(), l = p.packing as PackingList;
  for (const m of kids5) assert.ok(own(l, m.id).length >= 8, m.name);
  const baby = own(l, "traveler-5").map(i => i.item);
  for (const x of ["Diapers / nappies", "Wipes, changing mat & diaper cream", "Feeding supplies (as you feed)", "Baby outfits / bodysuits", "Passport / accepted travel ID & entry documents"]) assert.ok(baby.includes(x), x);
  for (const x of ["Tops", "Bottoms", "Payment card + backup / local cash", "Phone & charger", "Deodorant & personal care", "Comfortable walking shoes"]) assert.ok(!baby.includes(x), x);
  const feed = own(l, "traveler-5").find(i => i.item.startsWith("Feeding"))!.reason; assert.match(feed, /bottles, pump, formula or food/);
  for (const k of ["traveler-3", "traveler-4"]) { const c = own(l, k).map(i => i.item); assert.ok(c.includes("Tops") && c.includes("Toothbrush & toothpaste") && c.includes("Entertainment / comfort item for transit")); assert.ok(!c.includes("Payment card + backup / local cash")); }
  const dad = own(l, "traveler-1").map(i => i.item).sort(), mum = own(l, "traveler-2").map(i => i.item).sort();
  assert.deepEqual(dad, mum, "gender does not change the list");
  assert.equal(packingItems(l).filter(i => i.item === "House keys").length, 1);
  assert.equal(new Set(packingItems(l).map(i => i.id)).size, packingItems(l).length);
});
test("Simple mode: Girl/Boy/Infant under Kids, Man/Woman/unset under Adults; legacy child flag still works", () => {
  const { adults, kids } = simpleLists(family5().packing);
  assert.deepEqual([...new Set(kids!.filter(r => !r.shared).map(r => r.item.owner))].sort(), ["traveler-3", "traveler-4", "traveler-5"]);
  assert.deepEqual([...new Set(adults.filter(r => !r.shared).map(r => r.item.owner))].sort(), ["traveler-1", "traveler-2"]);
  assert.equal(memberKind({ id: "traveler-1", name: "Kid" }), "adult", "no inference from names");
  assert.equal(memberKind({ id: "traveler-1", name: "A", child: true }), "child");
  assert.equal(memberKind({ id: "traveler-1", name: "A", child: true, profile: "man" }), "adult", "explicit profile wins");
});
test("setting a profile after generation: Refresh adds profile items, keeps progress, removes nothing", () => {
  const p = fixture(); p.input.travelers = 2;
  let l = suggestPacking(p, { laundryEvery: null, luggage: "all" });
  const top = own(l, "traveler-2").find(i => i.item === "Tops")!; l = updatePackingItem(l, top.id, { checked: true });
  const custom = own(l, "traveler-2").find(i => i.item === "Sleepwear")!; l = updatePackingItem(l, custom.id, { item: "Silk PJs" });
  const settings = { ...l.settings, members: [l.settings.members[0], { id: "traveler-2", name: "Baby", profile: "infant" as const, child: true }] };
  l = { ...l, settings };
  assert.ok(!own(l, "traveler-2").some(i => i.item.startsWith("Diapers")), "nothing changes until Refresh");
  const r = mergeSuggestions(l, suggestPacking({ ...p, packing: l }, l.settings));
  const t2 = own(r, "traveler-2");
  assert.ok(t2.some(i => i.item === "Diapers / nappies"));
  assert.ok(t2.find(i => i.id === top.id)!.checked, "check kept"); assert.equal(t2.find(i => i.id === custom.id)!.item, "Silk PJs");
  assert.ok(own(l, "traveler-2").every(o => t2.some(i => i.id === o.id)), "nothing deleted");
  const again = mergeSuggestions(r, suggestPacking({ ...p, packing: r }, r.settings));
  assert.equal(packingItems(again).length, packingItems(r).length, "refresh is idempotent");
});
test("profile validation: exact five options, import/share/export roundtrip; bad values rejected", () => {
  assert.deepEqual(packingMembers({ members: [{ id: "traveler-1", name: "A", profile: "woman" }, { id: "traveler-2", name: "B", profile: "robot" }] }, 2), [{ id: "traveler-1", name: "A", profile: "woman" }, { id: "traveler-2", name: "B" }]);
  const p = family5(); const back = parsePlan(exportPlan(p)); assert.deepEqual(back.packing.settings.members, p.packing.settings.members);
  const bad = JSON.parse(JSON.stringify(p.packing)); bad.settings.members[0].profile = "robot"; assert.throws(() => validatePacking(bad));
});
test("settings UI: Traveler type select offers Man, Woman, Girl, Boy, Infant; read-only disables it", () => {
  const p = family5();
  const html = renderToStaticMarkup(<PackingSettingsPanel plan={p} p={p.packing} readOnly={false} change={() => {}} setMessage={() => {}} />);
  const sel = html.slice(html.indexOf('aria-label="Traveler type for traveler 1"'), html.indexOf("</select>", html.indexOf('aria-label="Traveler type for traveler 1"')));
  assert.deepEqual([...sel.matchAll(/<option value="([^"]*)"[^>]*>([^<]+)</g)].map(m => m[2]), ["Not set (general)", "Man", "Woman", "Girl", "Boy", "Infant"]);
  assert.match(sel, /value="man" selected=""/);
  const ro = renderToStaticMarkup(<PackingSettingsPanel plan={p} p={p.packing} readOnly change={() => { throw new Error("no"); }} setMessage={() => {}} />);
  assert.ok(ro.includes('<fieldset disabled="" class="packing-edit">'));
  assert.doesNotThrow(() => renderToStaticMarkup(<PackingWorkspace plan={p} readOnly simple onChange={() => { throw new Error("no"); }} T={s => s} />));
});
