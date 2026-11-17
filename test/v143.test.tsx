import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { fixture } from "./fixtures.js";
import { isNightlifeVenue, isRestaurantLike, syncActivityInput } from "../shared/activities.js";
import { packingItems, packingMembers, suggestPacking, groupSimpleRows, simpleLists } from "../shared/packing.js";
import { runActivitySchedule } from "../server/activityItinerary.js";
import { itinerary } from "../server/plan.js";
import { stats } from "../server/weather.js";
import { PackingWorkspace, SimpleLists } from "../src/Packing.js";

const capeDays = [20, 21, 22, 23, 24, 25].map(d => ({ date: `2026-11-${d}`, tmax: 26, tmin: 16, precipMm: 0, precipProb: 10, typical: false, summary: "Sunny" }));
const capeWx = { source: "forecast" as const, note: "", days: capeDays, stats: stats(capeDays as any) };

test("v1.14.3: nightlife venues are bars and pubs, not restaurants or cafes", () => {
  assert.equal(isNightlifeVenue({ name: "Foresters Arms", type: "bar", activity: "nightlife" }), true);
  assert.equal(isNightlifeVenue({ name: "Perseverance Tavern", type: "pub" }), true);
  assert.equal(isNightlifeVenue({ name: "Mavericks Cape Town", type: "nightclub", activity: "nightlife" }), true);
  assert.equal(isRestaurantLike({ name: "Randy Warthog Bar & Grill", type: "grill" }), true);
  assert.equal(isNightlifeVenue({ name: "Randy Warthog Bar & Grill", type: "grill", description: "A restaurant" }), false);
  assert.equal(isNightlifeVenue({ name: "Truth Coffee", type: "pub" }), false);
  assert.equal(isNightlifeVenue({ name: "Eastern Food Bazaar", type: "restaurant" }), false);
});

test("v1.14.3: nightlife slot names a real bar and skips restaurants already used that day", () => {
  const inp: any = syncActivityInput({
    destination: "Cape Town", start: "2026-11-20", end: "2026-11-25", travelers: 2, purpose: "Leisure", style: "Mix", travelMode: "flying",
    activities: ["beach", "food", "hiking", "dive", "museums", "tasting", "nightlife", "sightseeing"],
  });
  const hl: any[] = [
    { name: "Camps Bay Beach", type: "beach", activity: "beach", description: "beach", source: "Wikidata", indoor: false, setting: "outdoor" },
    { name: "District Six Museum", type: "museum", activity: "museums", description: "museum", source: "Wikidata", indoor: true, setting: "indoor" },
    { name: "Groot Constantia", type: "winery", activity: "tasting", description: "winery", source: "Wikidata", indoor: false, setting: "outdoor" },
    { name: "Randy Warthog Bar & Grill", type: "grill", description: "A restaurant", source: "Fixture", indoor: true, setting: "indoor" },
    { name: "Foresters Arms", type: "bar", activity: "nightlife", description: "bar (Wikidata)", source: "Wikidata", indoor: true, setting: "indoor" },
  ];
  const food = [{ name: "Eastern Food Bazaar", tag: "food court" }] as any;
  const days = itinerary(inp, capeWx as any, hl, food);
  runActivitySchedule(days, inp, capeWx as any, hl, ["beach", "hiking", "city"] as any, "Cape Town");
  const mid = days.slice(1, -1);
  const blob = mid.map(d => `${d.morning} / ${d.afternoon} / ${d.evening}`).join("\n");
  assert.match(blob, /🍸 Foresters Arms/, blob);
  assert.doesNotMatch(blob, /🍸 Nightlife & bars/, blob);
  assert.doesNotMatch(blob, /🍸 Randy Warthog/, blob);
  assert.ok(mid.some(d => /🍸 Foresters Arms/.test(d.evening)), blob);
});

test("v1.14.3: first Simple toggle pre-mounts lists during idle and does not remount later", () => {
  const src = readFileSync(new URL("../src/Packing.tsx", import.meta.url), "utf8");
  assert.match(src, /requestIdleCallback/);
  assert.match(src, /packing-simple-preload/);
  assert.match(src, /typeof window === "undefined"/);
  const p = fixture();
  p.input = syncActivityInput({ ...p.input, travelers: 16, activities: ["hiking", "beach", "food", "museums", "tasting", "nightlife", "sightseeing", "dive"] });
  const members = packingMembers({ members: Array.from({ length: 16 }, (_, i) => ({ id: `traveler-${i + 1}`, name: `Sister ${i + 1}`, profile: "woman" })) }, 16);
  p.packing = suggestPacking(p, { laundryEvery: null, luggage: "all", members } as any);
  assert.ok(packingItems(p.packing).length >= 250);
  const t0 = performance.now();
  const grouped = groupSimpleRows(simpleLists(p.packing).adults);
  const groupMs = performance.now() - t0;
  assert.ok(groupMs < 50, `grouping ${groupMs.toFixed(1)}ms`);
  assert.ok(grouped.entries.length > 0);
  const detailed = renderToStaticMarkup(<PackingWorkspace plan={p} readOnly={false} onChange={() => {}} T={s => s} />);
  assert.ok(detailed.includes('data-testid="packing-detailed-pane"'));
  assert.ok(!detailed.includes('data-testid="packing-simple-pane"'), "SSR detailed still defers the simple tree");
  const simple = renderToStaticMarkup(<PackingWorkspace plan={p} readOnly={false} simple onChange={() => {}} T={s => s} />);
  assert.ok(simple.includes('data-testid="packing-simple-pane"'));
  const lists = renderToStaticMarkup(<SimpleLists p={p.packing} readOnly={false} onCheck={() => {}} onCheckMany={() => {}} />);
  assert.ok(lists.includes("simple-print"), "SSR keeps the print copy");
});
