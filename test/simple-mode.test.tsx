import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { fixture } from "./fixtures.js";
import { packingItems, simpleLists, suggestPacking, updatePackingItem, validatePacking, packingMembers, migratePacking } from "../shared/packing.js";
import { SimpleLists, PackingWorkspace, readPackMode, writePackMode, PACK_MODE_KEY } from "../src/Packing.js";

const family = () => {
  const p = fixture(); p.input.travelers = 4; p.input.presets = ["kids"];
  p.packing = suggestPacking(p, { laundryEvery: null, luggage: "all", members: [
    { id: "traveler-1", name: "Ben" }, { id: "traveler-2", name: "Sam" },
    { id: "traveler-3", name: "Mia", child: true }, { id: "traveler-4", name: "Leo", child: true }] } as any);
  return p;
};
const ids = (rows: { item: { id: string } }[]) => rows.map(r => r.item.id);

test("adult-only trip: Adults list holds personal and shared items, no Kids list", () => {
  const p = fixture(); p.packing = suggestPacking(p, { laundryEvery: null, luggage: "all", activityKits: [] });
  const { adults, kids } = simpleLists(p.packing);
  assert.equal(kids, null);
  assert.equal(adults.length, packingItems(p.packing).length, "nothing dropped");
  assert.ok(adults.some(r => r.item.item === "House keys" && r.shared));
  assert.ok(adults.some(r => /Passport/.test(r.item.item) && !r.shared));
});
test("family: two children get a Kids list by explicit Child flag; each item appears exactly once with its own owner", () => {
  const p = family(), all = packingItems(p.packing), { adults, kids } = simpleLists(p.packing);
  assert.ok(kids);
  assert.equal(adults.length + kids!.length, all.length);
  assert.equal(new Set([...ids(adults), ...ids(kids!)]).size, all.length, "no duplication");
  assert.deepEqual([...new Set(kids!.filter(r => !r.shared).map(r => r.item.owner))].sort(), ["traveler-3", "traveler-4"]);
  assert.ok(!adults.some(r => ["traveler-3", "traveler-4"].includes(r.item.owner)));
  assert.ok(kids!.some(r => r.shared && /Children's/.test(r.item.item)), "shared kids-kit item under Kids");
  assert.ok(adults.some(r => r.shared && r.item.item === "House keys"), "other shared items stay under Adults");
  const kidTops = kids!.filter(r => r.item.item === "Tops");
  assert.equal(kidTops.length, 2); assert.deepEqual(kidTops.map(r => r.ownerName).sort(), ["Leo", "Mia"]);
});
test("legacy/no-profile family plan: no ages guessed from names; personal items stay under Adults", () => {
  const p = fixture(); p.input.travelers = 3;
  p.packing = suggestPacking(p, { laundryEvery: null, luggage: "all", activityKits: [], members: [{ id: "traveler-1", name: "Kid" }, { id: "traveler-2", name: "Baby Leo" }, { id: "traveler-3", name: "Child" }] } as any);
  const { adults, kids } = simpleLists(p.packing);
  assert.equal(kids, null); assert.equal(adults.length, packingItems(p.packing).length);
});
test("Child flag survives normalisation, export validation, and rejects non-boolean", () => {
  assert.deepEqual(packingMembers({ members: [{ id: "traveler-1", name: "A", child: true }, { id: "traveler-2", name: "B", child: "yes" }] }, 2), [{ id: "traveler-1", name: "A", child: true }, { id: "traveler-2", name: "B" }]);
  const p = family(); assert.doesNotThrow(() => validatePacking(JSON.parse(JSON.stringify(p.packing))));
  const bad = JSON.parse(JSON.stringify(p.packing)); bad.settings.members[0].child = "yes";
  assert.throws(() => validatePacking(bad));
  assert.deepEqual(migratePacking(JSON.parse(JSON.stringify(p.packing))).settings.members, p.packing.settings.members);
});
test("simple view is read-only of data: rendering/toggling never mutates; a simple-mode check is the same item in detailed", () => {
  const p = family(); p.packing = updatePackingItem(p.packing, packingItems(p.packing)[3].id, { skipped: true });
  const before = JSON.stringify(p.packing);
  renderToStaticMarkup(<PackingWorkspace plan={p} readOnly={false} simple onChange={() => { throw new Error("no mutation on render"); }} T={s => s} />);
  renderToStaticMarkup(<PackingWorkspace plan={p} readOnly={false} simple={false} onChange={() => { throw new Error("no mutation on render"); }} T={s => s} />);
  assert.equal(JSON.stringify(p.packing), before);
  const kidTop = simpleLists(p.packing).kids!.find(r => r.item.item === "Tops")!.item;
  const next = updatePackingItem(p.packing, kidTop.id, { checked: true });
  const same = packingItems(next).find(i => i.id === kidTop.id)!;
  assert.equal(same.checked, true); assert.equal(same.stage, "packed"); assert.equal(same.owner, kidTop.owner);
  assert.equal(packingItems(next).filter(i => i.checked).length, 1, "other travelers' Tops untouched");
  const html = renderToStaticMarkup(<PackingWorkspace plan={{ ...p, packing: next }} readOnly={false} onChange={() => {}} T={s => s} />);
  assert.ok(html.includes(`data-item-id="${kidTop.id}"`) && /packing-item packed/.test(html), "detailed mode shows it packed");
});
test("not-needed rows stay visible, marked and their checkbox disabled (cannot unskip from simple mode)", () => {
  const p = family(), target = packingItems(p.packing)[0];
  p.packing = updatePackingItem(p.packing, target.id, { skipped: true });
  const html = renderToStaticMarkup(<SimpleLists p={p.packing} readOnly={false} onCheck={() => {}} />);
  const row = html.slice(html.indexOf(`data-item-id="${target.id}"`), html.indexOf("</li>", html.indexOf(`data-item-id="${target.id}"`)));
  assert.match(row, /disabled=""/); assert.match(row, /Not needed/);
  assert.ok(simpleLists(p.packing).adults.find(r => r.item.id === target.id)!.item.skipped);
});
test("shared read-only: simple checkboxes all disabled, no settings mutation path", () => {
  const p = family();
  const html = renderToStaticMarkup(<PackingWorkspace plan={p} readOnly simple onChange={() => { throw new Error("Must not mutate"); }} T={s => s} />);
  const boxes = html.match(/<input type="checkbox"[^>]*>/g) || [];
  assert.ok(boxes.length > 10); assert.ok(boxes.every(b => b.includes('disabled=""')));
  assert.ok(html.includes('role="switch"'), "appearance toggle still offered");
});
test("simple print lists every item grouped Adults/Kids with quantities and status markers; detailed print unchanged", () => {
  const p = family(), first = simpleLists(p.packing).adults[0].item;
  p.packing = updatePackingItem(p.packing, first.id, { checked: true, quantity: 3 });
  const html = renderToStaticMarkup(<PackingWorkspace plan={p} readOnly={false} simple onChange={() => {}} T={s => s} />);
  const print = html.slice(html.indexOf('class="packing-print simple-print"'));
  assert.ok(print.includes('aria-label="Adults packing list"') && print.includes('aria-label="Kids packing list"'));
  assert.ok(print.includes(`[x]</span><span class="simple-qty">3 ×</span><span class="simple-name">${first.item.replace(/&/g, "&amp;")}`));
  assert.equal((print.match(/<li /g) || []).length, packingItems(p.packing).length);
  assert.ok(!print.includes("<input"));
  const detailed = renderToStaticMarkup(<PackingWorkspace plan={p} readOnly={false} onChange={() => {}} T={s => s} />);
  assert.ok(detailed.includes('<div class="packing-print">') && !detailed.includes("simple-print"));
});
test("mode preference persists in browser storage only, defaults to detailed, survives storage errors", () => {
  const m = new Map<string, string>(); const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  assert.equal(readPackMode(store), false);
  writePackMode(store, true); assert.equal(m.get(PACK_MODE_KEY), "simple"); assert.equal(readPackMode(store), true);
  writePackMode(store, false); assert.equal(readPackMode(store), false);
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(readPackMode(broken), false); assert.doesNotThrow(() => writePackMode(broken, true));
  assert.ok(!JSON.stringify(fixture().packing).includes("packingMode"), "not stored in the trip");
});
