import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { fixture, weather } from "./fixtures.js";
import { activityFit, fitTemp, isRealBeach, isSeriousPeak, isRestDayFriendly, packingItemsForActivity, suitableActivities, syncActivityInput, ACTIVITY_BY_ID } from "../shared/activities.js";
import { activityPrepItems, activityTimelineTasks, dedupePrepAgainstTimeline, mergeActivityTimeline } from "../shared/activityPrep.js";
import { defaultPrep } from "../src/Prep.js";
import { packingItems, suggestPacking, packingMembers } from "../shared/packing.js";
import { runActivitySchedule } from "../server/activityItinerary.js";
import { presetItinerary } from "../server/presets.js";
import { itinerary, timeline } from "../server/plan.js";
import { stats } from "../server/weather.js";
import { mergeActivityPlaces } from "../server/osmActivities.js";
import { PackingWorkspace, SimpleLists } from "../src/Packing.js";

const snowDays = [3, 4, 5, 6, 7, 8, 9].map(d => ({ date: `2027-01-0${d}`, tmax: 1, tmin: -7, precipMm: 4, precipProb: 60, typical: true, summary: "Often snowy" }));
const snowWx = { source: "typical" as const, note: "", days: snowDays, stats: stats(snowDays as any) };

const capeDays = [10, 11, 12, 13, 14, 15].map(d => ({ date: `2026-11-${d}`, tmax: 26, tmin: 16, precipMm: 0, precipProb: 10, typical: false, summary: "Sunny" }));
const capeWx = { source: "forecast" as const, note: "", days: capeDays, stats: stats(capeDays as any) };

const T = (s: string, unit: "C" | "F") => (s || "").replace(/\{t:(-?[\d.]+)\}/g, (_m, v) => unit === "F" ? `${Math.round(Number(v) * 9 / 5 + 32)}°F` : `${Math.round(Number(v))}°C`);

test("v1.14.1: unsuitable activities are left off the itinerary, packing and prep", () => {
  const inp: any = syncActivityInput({ destination: "Zermatt", start: "2027-01-03", end: "2027-01-09", travelers: 2, purpose: "Leisure", style: "Mix", travelMode: "flying", activities: ["ski", "beach"] });
  const days = itinerary(inp, snowWx as any, [], []);
  runActivitySchedule(days, inp, snowWx as any, [], ["ski", "beach"] as any, "Zermatt");
  const blob = days.map(d => `${d.morning} ${d.afternoon} ${d.evening}`).join(" | ");
  assert.doesNotMatch(blob, /🏖|Beach time|beach/i);
  assert.match(blob, /⛷|Ski/);
  const p = fixture();
  p.input = inp; p.weather = snowWx; p.place = { ...p.place, name: "Zermatt" };
  const items = packingItems(suggestPacking(p));
  assert.ok(!items.some(i => /swimwear|reef-safe|beach towel/i.test(i.item)), "no beach kit in a 1° ski town");
  assert.ok(items.some(i => /ski jacket|goggles|ski socks/i.test(i.item)));
  const prep = activityPrepItems(inp, snowWx, "Zermatt");
  assert.ok(!prep.some(t => /beach or pool/i.test(t.task)));
  assert.ok(activityPrepItems(inp).some(t => /beach or pool/i.test(t.task)) || ACTIVITY_BY_ID.beach.prep.some(x => /beach|pool/i.test(x.task)));
  const note = activityFit("beach", { avgHigh: 1, minLow: -7, placeName: "Zermatt" }).note || "";
  assert.match(note, /\{t:1\}/);
  assert.equal(T(note, "F").includes("34°F"), true);
  assert.equal(T(note, "C").includes("1°C"), true);
  assert.ok(!T(note, "F").includes("{t:"));
});

test("v1.14.1: beach slots use real beaches, never a waterfront fallback", () => {
  assert.equal(isRealBeach({ name: "Camps Bay", type: "beach", activity: "beach" }), true);
  assert.equal(isRealBeach({ name: "Clifton", type: "beach" }), true);
  assert.equal(isRealBeach({ name: "V&A Waterfront", type: "attraction", description: "A harbour waterfront" }), false);
  assert.equal(isRealBeach({ name: "V&A Waterfront", type: "harbour" }), false);
  const inp: any = syncActivityInput({ destination: "Cape Town", start: "2026-11-10", end: "2026-11-15", travelers: 2, purpose: "Leisure", style: "Mix", travelMode: "flying", activities: ["beach", "sightseeing"] });
  const hl: any[] = [
    { name: "V&A Waterfront", description: "Harbour shops", source: "Fixture", indoor: false, setting: "outdoor", type: "attraction" },
    { name: "Camps Bay", description: "Atlantic beach (OpenStreetMap)", source: "OpenStreetMap", indoor: false, setting: "outdoor", type: "beach", activity: "beach" },
  ];
  const days = itinerary(inp, capeWx as any, hl, []);
  runActivitySchedule(days, inp, capeWx as any, hl, ["beach"] as any, "Cape Town");
  const aft = days.map(d => d.afternoon).join(" | ");
  assert.match(aft, /Camps Bay/);
  assert.doesNotMatch(aft, /V&A Waterfront/);
  const noBeachHl = [{ name: "V&A Waterfront", description: "Harbour shops", source: "Fixture", indoor: false, setting: "outdoor", type: "attraction" }] as any;
  const days2 = itinerary(inp, capeWx as any, noBeachHl, []);
  runActivitySchedule(days2, inp, capeWx as any, noBeachHl, ["beach"] as any, "Cape Town");
  const aft2 = days2.map(d => d.afternoon).join(" | ");
  assert.match(aft2, /Beach time at a nearby beach/);
  assert.doesNotMatch(aft2, /V&A Waterfront/);
});

test("v1.14.1: every suitable activity gets a slot, in its preferred time of day", () => {
  const inp: any = syncActivityInput({
    destination: "Cape Town", start: "2026-11-10", end: "2026-11-15", travelers: 2, purpose: "Leisure", style: "Mix", travelMode: "flying",
    activities: ["sightseeing", "food", "beach", "hiking", "museums", "tasting", "nightlife", "dive"],
  });
  const hl: any[] = [
    { name: "Camps Bay", description: "Beach", source: "OSM", indoor: false, setting: "outdoor", type: "beach", activity: "beach" },
    { name: "Klein Constantia", description: "Winery", source: "OSM", indoor: false, setting: "outdoor", type: "winery", activity: "tasting" },
    { name: "The Waiting Room", description: "Bar", source: "OSM", indoor: true, setting: "indoor", type: "bar", activity: "nightlife" },
    { name: "Table Bay Diving", description: "Dive centre", source: "OSM", indoor: false, setting: "outdoor", type: "scuba diving", activity: "dive" },
    { name: "Iziko Museum", description: "Museum", source: "OSM", indoor: true, setting: "indoor", type: "museum", activity: "museums" },
  ];
  const days = itinerary(inp, capeWx as any, hl, []);
  runActivitySchedule(days, inp, capeWx as any, hl, ["beach", "hiking", "city"] as any, "Cape Town");
  const mid = days.slice(1, -1);
  const blob = mid.map(d => `${d.morning} || ${d.afternoon} || ${d.evening}`).join("\n");
  assert.match(blob, /🤿|Snorkeling|Table Bay Diving/, blob);
  assert.match(blob, /🍷|Klein Constantia|tasting/i, blob);
  assert.match(blob, /🌃|The Waiting Room|Nightlife/i, blob);
  assert.ok(mid.some(d => /🤿|Snorkeling|Table Bay Diving/.test(d.morning)), `snorkeling should be a morning: ${blob}`);
  assert.ok(mid.some(d => /🍷|Klein Constantia|Wine, beer/.test(d.afternoon)), `tasting should be an afternoon: ${blob}`);
  assert.ok(mid.some(d => /🌃|The Waiting Room|Nightlife/.test(d.evening)), `nightlife should be an evening: ${blob}`);
});

test("v1.14.1: activity prep appears once, on the dated timeline, not also in the checklist", () => {
  const p = fixture();
  p.input = syncActivityInput({ ...p.input, activities: ["ski", "food"] });
  p.weather = snowWx;
  p.place = { ...p.place, name: "Zermatt" };
  p.timeline = mergeActivityTimeline(timeline(p.input.start, true, "2026-12-01"), p, "2026-12-01");
  const prep = defaultPrep(p);
  const lift = p.timeline.filter((t: any) => /lift pass/i.test(t.task));
  assert.ok(lift.length === 1, "lift pass once on the timeline");
  assert.ok(!prep.some((t: any) => /lift pass/i.test(t.task)));
  const both = [...prep.map((t: any) => t.task), ...p.timeline.map((t: any) => t.task)];
  const extras = [...prep, { id: "x", task: "Buy lift passes online", done: false }];
  const deduped = dedupePrepAgainstTimeline(extras, p.timeline);
  assert.ok(!deduped.some(t => /lift pass/i.test(t.task)));
  assert.ok(p.timeline.some((t: any) => /overdue|lift pass/i.test(t.task)));
});

test("v1.14.1: ski days rotate between sectors and rest days stay easy", () => {
  assert.equal(isSeriousPeak({ name: "Matterhorn", type: "mountain" }), true);
  assert.equal(isSeriousPeak({ name: "Breithorn", type: "mountain" }), true);
  assert.equal(isSeriousPeak({ name: "Monte Rosa Hut", type: "hut" }), true);
  assert.equal(isSeriousPeak({ name: "Zinalrothorn", type: "peak" }), true);
  assert.equal(isRestDayFriendly({ name: "Alpine Museum", type: "museum", indoor: true, setting: "indoor" }), true);
  const inp: any = syncActivityInput({ destination: "Zermatt", start: "2027-01-03", end: "2027-01-09", travelers: 2, purpose: "Ski", style: "Mix", travelMode: "flying", activities: ["ski"] });
  const hl: any[] = [
    { name: "Sunnegga Paradise ski area", ski: true, description: "Ski area", source: "Fixture", indoor: false, setting: "outdoor", type: "ski resort" },
    { name: "Matterhorn Glacier Paradise", ski: true, description: "High ski area", source: "Fixture", indoor: false, setting: "outdoor", type: "ski resort" },
    { name: "Gornergrat", description: "Railway and viewpoint", source: "Fixture", indoor: false, setting: "outdoor", type: "viewpoint" },
    { name: "Matterhorn", type: "mountain", description: "A famous peak", indoor: false, setting: "outdoor", source: "Fixture" },
    { name: "Breithorn", type: "mountain", description: "A peak", indoor: false, setting: "outdoor", source: "Fixture" },
    { name: "Alpine Museum", type: "museum", description: "In-town museum", indoor: true, setting: "indoor", source: "Fixture" },
  ];
  const days = itinerary(inp, snowWx as any, hl, []);
  runActivitySchedule(days, inp, snowWx as any, hl, ["ski"] as any, "Zermatt");
  const mornings = days.slice(1, -1).map(d => d.morning);
  const uniqueSki = new Set(mornings.map(m => (m.match(/Sunnegga|Glacier Paradise|Gornergrat/) || [m])[0]));
  assert.ok(uniqueSki.size >= 2, `expected rotating ski sectors, got ${mornings.join(" | ")}`);
  const rest = days.slice(1, -1).map(d => d.afternoon).join(" | ");
  assert.match(rest, /Alpine Museum|views of Matterhorn|views of Breithorn/);
  assert.doesNotMatch(rest, /rest day: Matterhorn(?:\s|;|$)/);
  assert.doesNotMatch(rest, /rest day: Breithorn/);
  // Single sector: wording still varies
  const one = itinerary(inp, snowWx as any, [hl[0]], []);
  presetItinerary(one, ["ski"], snowWx as any, [hl[0]]);
  const oneM = one.slice(1, -1).map(d => d.morning);
  assert.ok(new Set(oneM).size >= 2, `single sector should vary wording, got ${oneM.join(" | ")}`);
});

test("v1.14.1: mergeActivityPlaces keeps at least one venue per activity under the cap", () => {
  const extra = [
    ...Array.from({ length: 5 }, (_, i) => ({ name: `Viewpoint ${i}`, type: "viewpoint", activity: "sightseeing", description: "", source: "OSM", indoor: false, setting: "outdoor" as const })),
    { name: "Camps Bay", type: "beach", activity: "beach", description: "", source: "OSM", indoor: false, setting: "outdoor" as const },
    { name: "Klein Constantia", type: "winery", activity: "tasting", description: "", source: "OSM", indoor: false, setting: "outdoor" as const },
    { name: "The Waiting Room", type: "bar", activity: "nightlife", description: "", source: "OSM", indoor: true, setting: "indoor" as const },
  ] as any;
  const merged = mergeActivityPlaces([], extra, 8);
  const names = merged.map((h: any) => h.name).join(" ");
  assert.match(names, /Camps Bay/);
  assert.match(names, /Klein Constantia/);
  assert.match(names, /The Waiting Room/);
});

test("v1.14.1: Simple mode toggle stays under 300ms for 16 travelers and several activities, without rebuilding the hidden detailed list", () => {
  const src = readFileSync(new URL("../src/Packing.tsx", import.meta.url), "utf8");
  assert.match(src, /const DetailedPane = memo/);
  assert.match(src, /function LazySelect/);
  assert.ok(!/DetailedPane[^\n]*simple/.test(src.split("const DetailedPane")[1].slice(0, 500)), "DetailedPane is not passed the simple flag");
  const p = fixture();
  p.input = syncActivityInput({ ...p.input, travelers: 16, activities: ["hiking", "beach", "food", "museums", "tasting", "nightlife", "sightseeing", "dive"] });
  const members = packingMembers({ members: Array.from({ length: 16 }, (_, i) => ({ id: `traveler-${i + 1}`, name: `Sister ${i + 1}`, profile: "woman" })) }, 16);
  p.packing = suggestPacking(p, { laundryEvery: null, luggage: "all", members } as any);
  assert.ok(packingItems(p.packing).length >= 250);
  const simple = () => renderToStaticMarkup(<SimpleLists p={p.packing} readOnly={false} onCheck={() => {}} onCheckMany={() => {}} />);
  simple();
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    simple();
    samples.push(performance.now() - t0);
  }
  const mid = samples.sort((a, b) => a - b)[2];
  assert.ok(mid < 300, `SimpleLists median ${mid.toFixed(1)}ms, samples ${samples.map(x => x.toFixed(1)).join(", ")}`);
  const firstDetailed = renderToStaticMarkup(<PackingWorkspace plan={p} readOnly={false} onChange={() => {}} T={s => s} />);
  assert.ok(firstDetailed.includes('data-testid="packing-detailed-pane"'));
  const simpleFirst = renderToStaticMarkup(<PackingWorkspace plan={p} readOnly={false} simple onChange={() => {}} T={s => s} />);
  assert.ok(simpleFirst.includes('data-testid="packing-simple-pane"'));
  assert.ok(!simpleFirst.includes('data-testid="packing-detailed-pane"'), "simple-first still defers the detailed tree");
});
