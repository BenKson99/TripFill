import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { fixture, weather, porto } from "./fixtures.js";
import { packing } from "../server/plan.js";
import { packingItems, simpleLists, syncPackingMembers, updatePackingItem } from "../shared/packing.js";
import { exportPlan, parsePlan } from "../shared/portable.js";
import { TravelerFields, travelerRows, editTraveler } from "../src/Travelers.js";

const g = globalThis as any; g.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const own = (l: any, id: string) => packingItems(l).filter((i: any) => i.owner === id).map((i: any) => i.item);

test("questionnaire rows follow the count; shrinking hides but keeps names/types, growing restores them", () => {
  let m = editTraveler([], 3, "traveler-3", { name: "Zoe" }); m = editTraveler(m, 3, "traveler-3", { type: "infant" });
  assert.deepEqual(travelerRows(m, 3).map(r => r.name), ["Traveler 1", "Traveler 2", "Zoe"]);
  assert.equal(travelerRows(m, 1).length, 1);
  const shrunk = editTraveler(m, 1, "traveler-1", { name: "Ben" });
  assert.deepEqual(travelerRows(shrunk, 3)[2], { id: "traveler-3", name: "Zoe", child: true, profile: "infant" });
  assert.deepEqual(travelerRows(shrunk, 3)[0].name, "Ben");
  assert.deepEqual(editTraveler(shrunk, 3, "traveler-3", { type: "" })[2], { id: "traveler-3", name: "Zoe" });
  assert.equal(travelerRows(undefined, "abc").length, 1); assert.equal(travelerRows(undefined, 99).length, 20);
});
test("Who's traveling editor renders accessible name + exact type choices per row, disabled when read-only", () => {
  const rows = travelerRows([{ id: "traveler-2", name: "Mia", profile: "girl", child: true }], 2);
  const html = renderToStaticMarkup(<TravelerFields idPrefix="form-traveler" members={rows} onEdit={() => {}} />);
  assert.ok(html.includes('aria-label="Name for traveler 1"') && html.includes('aria-label="Traveler type for traveler 2"'));
  const sel = html.slice(html.indexOf('aria-label="Traveler type for traveler 2"'));
  assert.deepEqual([...sel.slice(0, sel.indexOf("</select>")).matchAll(/<option[^>]*>([^<]+)</g)].map(x => x[1]), ["Not set (general)", "Man", "Woman", "Girl", "Boy", "Infant"]);
  assert.match(sel, /value="girl" selected=""/);
  const ro = renderToStaticMarkup(<TravelerFields idPrefix="x" members={rows} disabled onEdit={() => { throw new Error("no"); }} />);
  assert.equal((ro.match(/disabled=""/g) || []).length, 4);
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.ok(app.indexOf("Who’s traveling?") > app.indexOf(">Travelers<input") && app.indexOf("Who’s traveling?") < app.indexOf("Offline — connect to generate"));
});
test("mixed family from the questionnaire: the first generated lists already use names and types (server path)", () => {
  const members = [{ id: "traveler-1", name: "Ben", profile: "man" }, { id: "traveler-2", name: "Ana", profile: "woman" }, { id: "traveler-3", name: "Ivy", profile: "girl", child: true }, { id: "traveler-4", name: "Tom", profile: "boy", child: true }, { id: "traveler-5", name: "Bo", profile: "infant", child: true }];
  const inp: any = { ...fixture().input, travelers: 5, members };
  const pk = packing(inp, weather, porto, 6);
  assert.deepEqual(pk.settings.members, members);
  assert.ok(own(pk, "traveler-5").includes("Diapers / nappies") && !own(pk, "traveler-5").includes("Tops"));
  assert.ok(own(pk, "traveler-3").includes("Tops") && !own(pk, "traveler-3").includes("Payment card + backup / local cash"));
  assert.deepEqual([...new Set(simpleLists(pk).kids!.filter(r => !r.shared).map(r => r.item.owner))].sort(), ["traveler-3", "traveler-4", "traveler-5"]);
  const hostile: any = { ...inp, members: [{ id: "evil", name: "<x>" }, { id: "traveler-1", name: "A", profile: "robot" }] };
  assert.deepEqual(packing(hostile, weather, porto, 6).settings.members.slice(0, 1), [{ id: "traveler-1", name: "A" }], "invalid rows sanitised");
  assert.match(readFileSync(new URL("../server/index.ts", import.meta.url), "utf8"), /members: undefined/, "settings stay the single source; input does not keep a copy");
});
test("old plans and imports prefill the questionnaire from packing settings; Settings edits sync back; shares do not mutate", async () => {
  const { withMembers, syncFormMembers } = await import("../src/Travelers.js");
  const p = fixture(); p.packing.settings.members = [{ id: "traveler-1", name: "Ben", profile: "man" }, { id: "traveler-2", name: "Kay", profile: "woman" }];
  const back = parsePlan(exportPlan(p));
  assert.deepEqual(withMembers({ ...back.input }, back).members, back.packing.settings.members, "legacy form without members");
  assert.deepEqual(withMembers({ members: [{ id: "traveler-1", name: "Draft" }] }, back).members[0].name, "Draft", "unsubmitted saved form kept on reload");
  assert.equal(withMembers({ members: [{ id: "traveler-1", name: "Draft" }] }, back, true).members[0].name, "Ben", "import prefers the plan");
  assert.deepEqual(withMembers({}, null).members, []);
  const synced = syncFormMembers({ members: [{ id: "traveler-1", name: "Old" }, { id: "traveler-3", name: "Hidden" }] }, back.packing.settings.members);
  assert.deepEqual(synced.members.map((m: any) => m.name), ["Ben", "Kay", "Hidden"]);
  const before = JSON.stringify(back); withMembers({}, back); syncFormMembers({}, back.packing.settings.members); assert.equal(JSON.stringify(back), before);
});
test("shrinking traveler count on an existing plan never deletes items or checks", () => {
  const p = fixture(); p.input.travelers = 3; const l0 = parsePlan(JSON.stringify(p)).packing;
  const t3 = packingItems(l0).find((i: any) => i.owner === "traveler-3")!;
  const l1 = updatePackingItem(l0, t3.id, { checked: true });
  const l2 = syncPackingMembers(l1, 2);
  assert.equal(packingItems(l2).length, packingItems(l1).length);
  assert.ok(packingItems(l2).find((i: any) => i.id === t3.id)!.checked);
});
