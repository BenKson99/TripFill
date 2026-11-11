import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { fixture, weather, highlights } from "./fixtures.js";
import { isBroadRegion } from "../shared/region.js";
import { backupSlotLabel, precipKind } from "../shared/precip.js";
import { packingItems, suggestPacking, mergeSuggestions, packingMembers, updatePackingItem, simpleLists, groupSimpleRows } from "../shared/packing.js";
import { itinerary } from "../server/plan.js";
import { presetItinerary } from "../server/presets.js";
import { stats } from "../server/weather.js";
import { PackingWorkspace, SimpleLists } from "../src/Packing.js";

const rainDays = () => [13, 14, 15, 16, 17].map((d, i) => ({
  date: `2026-11-${d}`, tmax: i < 2 ? 12 : 15, tmin: i < 2 ? 7 : 9, precipMm: i < 2 ? 1.2 : 0,
  precipProb: i < 2 ? 70 : 20, code: i < 2 ? 51 : 2, typical: false, summary: i < 2 ? "Light rain and drizzle" : "Partly cloudy",
}));

test("v1.13.1: snow and mixed itinerary slots use a snow label, not the umbrella backup icon", () => {
  assert.equal(backupSlotLabel("snow"), "❄️ snow");
  assert.equal(backupSlotLabel("mixed"), "❄️ mixed");
  assert.equal(backupSlotLabel("rain"), "☔ backup");
  assert.equal(backupSlotLabel("none"), "☔ backup");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.ok(app.includes("backupSlotLabel"));
  assert.ok(!app.includes(">☔ backup<"), "itinerary no longer hard-codes the umbrella label");
});

test("v1.13.1: snow trips suggest Insulated snow boots; refresh keeps ticks when renaming from the old boots item", () => {
  const p = fixture();
  const wetDays = [
    { date: "2026-11-10", tmax: 10, tmin: 0, precipMm: 5, precipProb: 70, code: 61, typical: false, summary: "Rain" },
    { date: "2026-11-11", tmax: 11, tmin: 1, precipMm: 4, precipProb: 60, code: 61, typical: false, summary: "Rain" },
  ];
  p.weather = { source: "forecast", note: "", days: wetDays, stats: stats(wetDays as any) };
  const wet = suggestPacking(p);
  const oldBoots = packingItems(wet).find(i => i.item === "Waterproof boots with grip")!;
  assert.ok(oldBoots); assert.ok(!packingItems(wet).some(i => i.item === "Insulated snow boots"));
  const ticked = updatePackingItem(wet, oldBoots.id, { checked: true });
  const snowDays = [3, 4, 5, 6, 7].map(d => ({ date: `2027-01-0${d}`, tmax: 1, tmin: -7, precipMm: 4, precipProb: 60, code: null, typical: true, summary: "Often snowy" }));
  p.weather = { source: "typical", note: "", days: snowDays, stats: stats(snowDays as any) };
  p.input = { ...p.input, destination: "Zermatt", purpose: "Ski", interests: "skiing", presets: ["ski"] };
  const merged = mergeSuggestions(ticked, suggestPacking({ ...p, packing: { ...ticked, settings: ticked.settings } }, ticked.settings));
  const boots = packingItems(merged).filter(i => /boots/i.test(i.item));
  assert.ok(boots.some(i => i.item === "Insulated snow boots" && i.id === oldBoots.id && i.checked && i.owner === oldBoots.owner));
  assert.ok(!boots.some(i => i.item === "Waterproof boots with grip"), "unedited suggestion is renamed, not duplicated");
});

test("v1.13.1: Compact umbrella returns for rainy, non-snow trips (it was last in pre-1.7 packing, not a 1.13 regression); snow trips still have none", () => {
  // History: Compact umbrella was suggested in v1.1–v1.6 (server/plan.ts). The 1.7.0 packing studio
  // replaced packing wholesale with a waterproof shell and did not carry the umbrella forward. v1.12.1 had no umbrella.
  const p = fixture();
  const days = rainDays();
  p.weather = { source: "forecast", note: "Open-Meteo forecast", days, stats: stats(days as any) };
  p.input = { ...p.input, destination: "London", start: "2026-11-13", end: "2026-11-17" };
  const list = suggestPacking(p);
  const items = packingItems(list);
  const umbrella = items.find(i => i.item === "Compact umbrella")!;
  assert.ok(umbrella, "optional compact umbrella for rain/drizzle");
  assert.equal(umbrella.owner, "shared");
  assert.equal(umbrella.essential, false);
  assert.ok(items.some(i => i.item === "Packable waterproof shell"));
  assert.ok(!items.some(i => /snow boots|Waterproof boots with grip/i.test(i.item)));
  const snowP = fixture();
  const snowDays = [3, 4, 5, 6, 7].map(d => ({ date: `2027-01-0${d}`, tmax: 1, tmin: -7, precipMm: 4, precipProb: 60, typical: true, summary: "Often snowy" }));
  snowP.weather = { source: "typical", note: "", days: snowDays, stats: stats(snowDays as any) };
  snowP.input = { ...snowP.input, purpose: "Ski", interests: "skiing", presets: ["ski"] };
  const snowList = packingItems(suggestPacking(snowP, { activityKits: ["ski"] } as any));
  assert.ok(!snowList.some(i => /umbrella/i.test(i.item)));
  assert.ok(snowList.some(i => i.item === "Insulated snow boots"));
});

test("v1.13.1: broad ranges like Swiss Alps are not day trips or highlights; real sights stay", () => {
  assert.equal(isBroadRegion({ name: "Swiss Alps", type: "mountain range" }), true);
  assert.equal(isBroadRegion({ name: "The Alps", type: "mountain range" }), true);
  assert.equal(isBroadRegion({ name: "Pennine Alps", classes: ["massif"] }), true);
  assert.equal(isBroadRegion({ name: "Switzerland", type: "country" }), true);
  assert.equal(isBroadRegion({ name: "Matterhorn", type: "mountain, tourist attraction" }), false);
  assert.equal(isBroadRegion({ name: "Alpine Museum", type: "museum" }), false);
  assert.equal(isBroadRegion({ name: "Mountain hike", type: "mountain trail" }), false);
  const alps: any = { name: "Swiss Alps", type: "mountain range", description: "A major mountain range", indoor: false, setting: "outdoor", source: "Fixture", dayTrip: true, distanceKm: 40, driveMin: 115, driveSrc: "osrm" };
  const matterhorn: any = { name: "Matterhorn", type: "mountain", description: "A famous peak", indoor: false, setting: "outdoor", source: "Fixture" };
  const museum: any = { name: "Alpine Museum", type: "museum", description: "A museum in town", indoor: true, setting: "indoor", source: "Fixture" };
  const inp: any = { destination: "Zermatt", start: "2027-01-03", end: "2027-01-09", travelers: 16, purpose: "Ski", style: "Mix", interests: "skiing", presets: ["ski"], travelMode: "flying" };
  const snowDays = [3, 4, 5, 6, 7, 8, 9].map(d => ({ date: `2027-01-0${d}`, tmax: 1, tmin: -7, precipMm: 4, precipProb: 60, typical: true, summary: "Often snowy" }));
  const w = { source: "typical" as const, note: "", days: snowDays, stats: stats(snowDays as any) };
  const days = itinerary(inp, w as any, [alps, matterhorn, museum, ...highlights], []);
  const text = days.map(d => `${d.morning} ${d.afternoon} ${d.evening} ${d.rainyBackup || ""}`).join(" | ");
  assert.doesNotMatch(text, /Swiss Alps/);
  assert.doesNotMatch(text, /🚐 Day trip: Swiss Alps/);
  const skiDays = itinerary(inp, w as any, [alps, matterhorn, museum], []);
  presetItinerary(skiDays, ["ski"], w as any, [alps, matterhorn, museum]);
  const skiText = skiDays.map(d => `${d.morning} ${d.afternoon}`).join(" | ");
  assert.doesNotMatch(skiText, /Swiss Alps/);
  assert.match(skiText, /Matterhorn|Alpine Museum|Skiing/);
});

test("v1.13.1: Simple mode for 16 travelers renders quickly and does not build the detailed list until it is opened", () => {
  const p = fixture();
  p.input.travelers = 16; p.input.purpose = "Ski"; p.input.interests = "skiing"; p.input.presets = ["ski"];
  const members = packingMembers({ members: Array.from({ length: 16 }, (_, i) => ({ id: `traveler-${i + 1}`, name: `Sister ${i + 1}`, profile: "woman" })) }, 16);
  p.packing = suggestPacking(p, { laundryEvery: null, luggage: "all", members, activityKits: ["ski"] } as any);
  const n = packingItems(p.packing).length;
  assert.ok(n >= 250, `got ${n} items`);
  const t0 = performance.now();
  const html = renderToStaticMarkup(<SimpleLists p={p.packing} readOnly={false} onCheck={() => {}} onCheckMany={() => {}} />);
  const ms = performance.now() - t0;
  assert.ok(ms < 250, `SimpleLists render took ${ms.toFixed(1)}ms`);
  const t1 = performance.now();
  const simple = renderToStaticMarkup(<PackingWorkspace plan={p} readOnly={false} simple onChange={() => {}} T={s => s} />);
  const ws = performance.now() - t1;
  assert.ok(ws < 400, `Simple PackingWorkspace render took ${ws.toFixed(1)}ms`);
  assert.ok(simple.includes('data-testid="packing-simple-pane"'));
  assert.ok(!simple.includes('data-testid="packing-detailed-pane"'), "detailed tree is not mounted on a Simple-first render");
  assert.ok(!simple.includes('data-testid="packing-item"'));
  const detailed = renderToStaticMarkup(<PackingWorkspace plan={p} readOnly={false} onChange={() => {}} T={s => s} />);
  assert.ok(detailed.includes('data-testid="packing-detailed-pane"') && !detailed.includes('data-testid="packing-simple-pane"'));
  const src = readFileSync(new URL("../src/Packing.tsx", import.meta.url), "utf8");
  assert.ok(src.includes("mountedSimple") && src.includes("mountedDetailed") && src.includes("hidden={!simple}"), "toggle hides the other pane instead of unmounting it");
  const { adults } = simpleLists(p.packing);
  const grouped = groupSimpleRows(adults);
  assert.ok(grouped.groups.some(g => g.rows.length === 16));
});
