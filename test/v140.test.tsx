import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { fixture, weather } from "./fixtures.js";
import { ACTIVITIES, ACTIVITY_IDS, detectActivities, resolveActivities, syncActivityInput, packingItemsForActivity, activityFit, weatherAllows, isRealisticDayTrip, type ActivityId } from "../shared/activities.js";
import { activityPrepItems, activityTimelineTasks } from "../shared/activityPrep.js";
import { applyActivities } from "../shared/applyActivities.js";
import { packingItems, suggestPacking, mergeSuggestions, updatePackingItem } from "../shared/packing.js";
import { encodePlan, decodePlan, exportPlan, parsePlan } from "../shared/portable.js";
import { ActivityPicker } from "../src/Activities.js";
import { itinerary } from "../server/plan.js";
import { scheduleActivities } from "../server/activityItinerary.js";
import { stats } from "../server/weather.js";

test("v1.14.0: each of the 25 activities yields packing kit and prep entries", () => {
  assert.equal(ACTIVITIES.length, 25);
  assert.equal(ACTIVITY_IDS.length, 25);
  for (const def of ACTIVITIES) {
    const pack = packingItemsForActivity(def, { driving: true, snow: true, warm: true, cycle: 5 });
    assert.ok(pack.length >= 1, `${def.id} should have a packing kit`);
    assert.ok((def.prep || []).length >= 1, `${def.id} should have prep`);
    const prep = activityPrepItems({ activities: [def.id] });
    assert.ok(prep.length >= 1 && prep.every(t => t.task), `${def.id} prep tasks`);
  }
});

test("v1.14.0: interest auto-detect ticks skiing from beginner lessons and tasting from wine", () => {
  assert.deepEqual(detectActivities("beginner ski lessons"), ["ski"]);
  assert.ok(detectActivities("wine").includes("tasting"));
  assert.ok(detectActivities("snorkelling and a food tour").includes("dive"));
  assert.ok(detectActivities("snorkelling and a food tour").includes("food"));
  const html = renderToStaticMarkup(<ActivityPicker value={[]} onChange={() => {}} interests="" onInterests={() => {}} />);
  assert.ok(html.includes("What do you want to do?"));
  assert.ok(html.includes("Show all 25"));
  assert.ok(html.includes("Skiing &amp; snowboarding") || html.includes("Skiing & snowboarding"));
  // Popular eight first: compact picker lists popular (and selected) only.
  const popular = ACTIVITIES.filter(a => a.popular);
  assert.equal(popular.length, 8);
  for (const a of popular) assert.ok(html.includes(a.label) || html.includes(a.label.replace("&", "&amp;")), a.id);
  assert.ok(!html.includes("Rock climbing"), "climbing stays behind Show all");
});

test("v1.14.0: legacy Ski trip type still resolves, packs and preps without input.activities", () => {
  const input = { destination: "Zermatt", purpose: "Ski", interests: "skiing", presets: ["ski"] };
  assert.deepEqual(resolveActivities(input), ["ski"]);
  const synced = syncActivityInput(input);
  assert.deepEqual(synced.activities, ["ski"]);
  assert.ok(synced.presets.includes("ski"));
  const p = fixture();
  const snowDays = [3, 4, 5, 6, 7, 8, 9].map(d => ({ date: `2027-01-0${d}`, tmax: 1, tmin: -7, precipMm: 4, precipProb: 60, typical: true, summary: "Often snowy" }));
  p.input = { ...input, start: "2027-01-03", end: "2027-01-09", travelers: 2, style: "Mix" };
  p.weather = { source: "typical", note: "", days: snowDays, stats: stats(snowDays as any) };
  const items = packingItems(suggestPacking(p));
  assert.ok(items.some(i => /ski jacket|goggles|ski socks/i.test(i.item)), "ski kit from legacy presets");
  const tl = activityTimelineTasks(p.input, p.input.start, "2027-01-01", p.weather, "Zermatt");
  assert.ok(tl.some((t: any) => /lift pass/i.test(t.task)));
  assert.ok(tl.some((t: any) => /rental|lesson/i.test(t.task)));
});

test("v1.14.0: weather gating skips beach on cold or rainy days and notes unfit ski in a warm city", () => {
  assert.equal(activityFit("ski", { avgHigh: 28, minLow: 18, placeName: "Lisbon" }).ok, false);
  assert.ok(/Lisbon/.test(activityFit("ski", { avgHigh: 28, minLow: 18, placeName: "Lisbon" }).note || ""));
  assert.equal(activityFit("beach", { avgHigh: 12, placeName: "Zermatt" }).ok, false);
  assert.equal(activityFit("surf", { avgHigh: 12, placeName: "Zermatt" }).ok, false);
  const coldRain = { tmax: 8, tmin: 2, precipProb: 80, precipMm: 8, summary: "Rain" };
  assert.equal(weatherAllows("beach", coldRain, "rain"), false);
  assert.equal(weatherAllows("hiking", coldRain, "rain"), false);
  assert.equal(weatherAllows("museums", coldRain, "rain"), true);
  const days = [
    { date: "2026-07-01", label: "Day 1", weather: "", morning: "Travel & check in", afternoon: "Easy walk", evening: "Dinner", notes: "" },
    { date: "2026-07-02", label: "Day 2", weather: "", morning: "Free morning", afternoon: "Explore a market or local street", evening: "Dinner: Cafe", notes: "" },
    { date: "2026-07-03", label: "Day 3", weather: "", morning: "Pack & check out", afternoon: "Travel", evening: "Travel home", notes: "" },
  ];
  const w = { source: "forecast", note: "", days: [
    { date: "2026-07-01", tmax: 22, tmin: 14, precipMm: 0, precipProb: 10, typical: false, summary: "Clear" },
    { date: "2026-07-02", tmax: 10, tmin: 6, precipMm: 12, precipProb: 90, typical: false, summary: "Rain" },
    { date: "2026-07-03", tmax: 11, tmin: 6, precipMm: 8, precipProb: 80, typical: false, summary: "Rain" },
  ], stats: stats([{ date: "2026-07-01", tmax: 22, tmin: 14, precipMm: 0 }, { date: "2026-07-02", tmax: 10, tmin: 6, precipMm: 12 }, { date: "2026-07-03", tmax: 11, tmin: 6, precipMm: 8 }] as any) };
  scheduleActivities(days as any, { destination: "Porto", start: "2026-07-01", end: "2026-07-03", activities: ["beach"] }, w as any, [], "Porto");
  const mid = `${days[1].morning} ${days[1].afternoon} ${days[1].evening}`;
  assert.ok(!/Beach/.test(mid), `beach should not be scheduled on a cold rainy mid-day, got: ${mid}`);
});

test("v1.14.0: share and JSON import keep the activity selection; old ski presets migrate", () => {
  const p = fixture();
  p.input = syncActivityInput({ ...p.input, interests: "wine and museums", activities: ["tasting", "museums"] });
  const text = exportPlan(p);
  const back = parsePlan(text);
  assert.deepEqual(back.input.activities, ["tasting", "museums"]);
  const link = encodePlan(p);
  const fromLink = decodePlan(link);
  assert.deepEqual(fromLink.input.activities, ["tasting", "museums"]);
  const legacy = parsePlan(JSON.stringify({ ...p, input: { ...p.input, activities: undefined, presets: ["ski"], interests: "skiing" } }));
  assert.ok(legacy.input.activities.includes("ski"));
  assert.ok(legacy.input.presets.includes("ski"));
});

test("v1.14.0: refresh is idempotent and keeps edits and ticks when activities stay the same", () => {
  const p = fixture();
  p.input = syncActivityInput({ ...p.input, activities: ["hiking", "food"] });
  p.packing = suggestPacking(p);
  const boots = packingItems(p.packing).find(i => /hiking shoes|daypack|blister/i.test(i.item));
  assert.ok(boots, "hiking kit present");
  p.packing = updatePackingItem(p.packing, boots!.id, { checked: true });
  const customName = packingItems(p.packing)[0];
  p.packing = updatePackingItem(p.packing, customName.id, { item: "Renamed by me" });
  const once = applyActivities(p, ["hiking", "food"]);
  const twice = applyActivities(once, ["hiking", "food"]);
  const a = packingItems(once.packing);
  const b = packingItems(twice.packing);
  assert.equal(a.length, b.length);
  const ticked = b.find(i => i.id === boots!.id);
  assert.ok(ticked?.checked, "tick kept across refresh");
  assert.ok(b.some(i => i.id === customName.id && i.item === "Renamed by me"), "edit kept");
  assert.deepEqual(twice.input.activities, ["hiking", "food"]);
});

test("v1.14.0: flying and car-free destinations drop long drive day trips", () => {
  assert.equal(isRealisticDayTrip({ dayTrip: true, driveMin: 120, name: "Jungfrau" }, { travelMode: "flying" }, { name: "Zermatt" }), false);
  assert.equal(isRealisticDayTrip({ dayTrip: true, driveMin: 120, name: "Jungfrau" }, { travelMode: "driving" }, { name: "Zermatt" }), false);
  assert.equal(isRealisticDayTrip({ dayTrip: true, driveMin: 15, name: "Local trail" }, { travelMode: "flying" }, { name: "Zermatt" }), true);
  const hl = [
    { name: "Jungfrau", description: "Peak", source: "Fixture", indoor: false, setting: "outdoor" as const, dayTrip: true, driveMin: 120, distanceKm: 80, type: "mountain" },
    { name: "Art Museum", description: "Museum", source: "Fixture", indoor: true, setting: "indoor" as const, type: "museum" },
  ];
  const inp: any = { destination: "Zermatt", start: "2026-11-10", end: "2026-11-16", travelers: 2, style: "Mix", travelMode: "flying", activities: ["sightseeing"] };
  const days = itinerary(inp, weather, hl as any, []);
  const blob = days.map(d => `${d.morning} ${d.afternoon}`).join(" ");
  assert.ok(!/Jungfrau/.test(blob), `long drive should not appear, got ${blob}`);
});
