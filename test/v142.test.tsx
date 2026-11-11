import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./fixtures.js";
import { cleanVenueName, isAdminOrReligiousOrg, isRealBeach, isSeriousPeak, isSkiSector, syncActivityInput } from "../shared/activities.js";
import { mergeActivityTimeline, tasksOverlap } from "../shared/activityPrep.js";
import { runActivitySchedule } from "../server/activityItinerary.js";
import { presetItinerary } from "../server/presets.js";
import { itinerary, timeline } from "../server/plan.js";
import { stats } from "../server/weather.js";
import { mergeActivityPlaces } from "../server/osmActivities.js";

const capeDays = [20, 21, 22, 23, 24, 25].map(d => ({ date: `2026-11-${d}`, tmax: 26, tmin: 16, precipMm: 0, precipProb: 10, typical: false, summary: "Sunny" }));
const capeWx = { source: "forecast" as const, note: "", days: capeDays, stats: stats(capeDays as any) };
const snowDays = [3, 4, 5, 6, 7, 8, 9].map(d => ({ date: `2027-01-0${d}`, tmax: 1, tmin: -7, precipMm: 4, precipProb: 60, typical: true, summary: "Often snowy" }));
const snowWx = { source: "typical" as const, note: "", days: snowDays, stats: stats(snowDays as any) };

const capeHl: any[] = [
  { name: "V&A Waterfront", description: "Harbour shops and artisanal stalls", source: "Wikipedia/Wikidata", indoor: false, setting: "outdoor", type: "attraction" },
  { name: "Two Oceans Aquarium", description: "Aquarium at the waterfront", source: "Wikipedia/Wikidata", indoor: true, setting: "indoor", type: "aquarium" },
  { name: "Camps Bay Beach", description: "beach (Wikidata)", source: "Wikidata", indoor: false, setting: "outdoor", type: "beach", activity: "beach" },
  { name: "Clifton Beach", description: "beach (Wikidata)", source: "Wikidata", indoor: false, setting: "outdoor", type: "beach", activity: "beach" },
  { name: "Muizenberg Beach", description: "beach (Wikidata)", source: "Wikidata", indoor: false, setting: "outdoor", type: "beach", activity: "beach" },
  { name: "Zeitz Museum of Contemporary Art Africa", description: "museum (Wikidata)", source: "Wikidata", indoor: true, setting: "indoor", type: "museum", activity: "museums" },
  { name: "Iziko Museums of South Africa", description: "museum (Wikidata)", source: "Wikidata", indoor: true, setting: "indoor", type: "museum", activity: "museums" },
  { name: "Groot Constantia", description: "winery (Wikidata)", source: "Wikidata", indoor: false, setting: "outdoor", type: "winery", activity: "tasting" },
  { name: "Foresters Arms", description: "bar (Wikidata)", source: "Wikidata", indoor: true, setting: "indoor", type: "bar", activity: "nightlife" },
  { name: "Lion's Head", description: "peak", source: "Wikipedia/Wikidata", indoor: false, setting: "outdoor", type: "peak", activity: "hiking" },
];

test("v1.14.2: Waterfront is not a museum; aquarium is not a snorkel spot", () => {
  const inp: any = syncActivityInput({
    destination: "Cape Town", start: "2026-11-20", end: "2026-11-25", travelers: 2, purpose: "Leisure", style: "Mix", travelMode: "flying",
    activities: ["beach", "food", "hiking", "dive", "museums", "tasting", "nightlife", "sightseeing"],
  });
  const food = [{ name: "Greek Fisherman", tag: "seafood" }] as any;
  const days = itinerary(inp, capeWx as any, capeHl, food);
  runActivitySchedule(days, inp, capeWx as any, capeHl, ["beach", "hiking", "city"] as any, "Cape Town");
  const mid = days.slice(1, -1);
  const blob = mid.map(d => `${d.morning} / ${d.afternoon} / ${d.evening}`).join("\n");
  assert.match(blob, /🖼 (Zeitz|Iziko)/, blob);
  assert.doesNotMatch(blob, /🖼 V&A Waterfront/, blob);
  assert.doesNotMatch(blob, /🤿 Two Oceans Aquarium/, blob);
  assert.match(blob, /🤿 Guided snorkel or dive trip \(book an operator\)/, blob);
  assert.match(blob, /🏖 (Camps Bay Beach|Clifton Beach|Muizenberg Beach)/, blob);
  assert.doesNotMatch(blob, /Beach time at a nearby beach/, blob);
  assert.ok(mid.some(d => /🍷 Groot Constantia/.test(d.afternoon)), `tasting should stay in the afternoon:\n${blob}`);
  assert.ok(mid.some(d => /🍸 Foresters Arms/.test(d.evening)), `nightlife should name a bar:\n${blob}`);
  const beachDays = mid.filter(d => /🏖/.test(`${d.morning} ${d.afternoon} ${d.evening}`)).length;
  const tasteDays = mid.filter(d => /🍷/.test(`${d.morning} ${d.afternoon} ${d.evening}`)).length;
  const nightDays = mid.filter(d => /🍸/.test(`${d.morning} ${d.afternoon} ${d.evening}`)).length;
  assert.ok(beachDays <= tasteDays + 1 && beachDays <= 2, `beach ${beachDays} vs tasting ${tasteDays} nightlife ${nightDays}\n${blob}`);
  for (const d of mid) {
    const bits = [d.morning, d.afternoon, d.evening];
    const places = bits.flatMap(s => [...s.matchAll(/(?:🖼|🏖|🍷|🍸|🥾|🚶|🍽|🤿)\s+([^/;]+)/g)].map(m => m[1].trim().toLowerCase()));
    assert.equal(new Set(places).size, places.length, `same place twice on ${d.date}: ${bits.join(" | ")}`);
  }
});

test("v1.14.2: dioceses and raw ski names are filtered or cleaned; rest day is not that morning's sector", () => {
  assert.equal(isAdminOrReligiousOrg({ name: "Roman Catholic Diocese of Sion", type: "diocese", description: "Catholic diocese in Valais" }), true);
  assert.equal(isAdminOrReligiousOrg({ name: "Sion Cathedral", type: "cathedral" }), false);
  assert.equal(isSeriousPeak({ name: "Riffelhorn", type: "mountain" }), true);
  assert.equal(isSeriousPeak({ name: "Matterhorn Museum", type: "museum" }), false);
  assert.equal(cleanVenueName("Riffelalp decauville"), "Riffelalp");
  assert.equal(isSkiSector({ name: "Riffelalp" }), true);

  const inp: any = syncActivityInput({ destination: "Zermatt", start: "2027-01-03", end: "2027-01-09", travelers: 2, purpose: "Ski", style: "Mix", travelMode: "flying", activities: ["ski"] });
  const hl: any[] = [
    { name: "Riffelalp decauville", ski: true, description: "Ski lift", source: "OSM", indoor: false, setting: "outdoor", type: "ski resort" },
    { name: "Gornergrat", description: "Railway and viewpoint", source: "Fixture", indoor: false, setting: "outdoor", type: "viewpoint" },
    { name: "Theodul Pass", ski: true, description: "Ski sector", source: "Fixture", indoor: false, setting: "outdoor", type: "ski resort" },
    { name: "Roman Catholic Diocese of Sion", type: "diocese", description: "Catholic diocese", indoor: false, setting: "outdoor", source: "Fixture" },
    { name: "Riffelhorn", type: "mountain", description: "A climbing peak", indoor: false, setting: "outdoor", source: "Fixture" },
    { name: "Riffelsee", type: "lake", description: "Alpine lake", indoor: false, setting: "outdoor", source: "Fixture" },
    { name: "Matterhorn Museum", type: "museum", description: "In-town museum", indoor: true, setting: "indoor", source: "Fixture" },
  ];
  const days = itinerary(inp, snowWx as any, hl, []);
  runActivitySchedule(days, inp, snowWx as any, hl, ["ski"] as any, "Zermatt");
  const mid = days.slice(1, -1);
  const blob = mid.map(d => `${d.morning} / ${d.afternoon}`).join("\n");
  assert.doesNotMatch(blob, /decauville/i, blob);
  assert.match(blob, /Riffelalp/, blob);
  assert.doesNotMatch(blob, /Diocese of Sion/i, blob);
  assert.doesNotMatch(blob, /rest day: Riffelhorn/, blob);
  assert.match(blob, /Matterhorn Museum|Riffelsee|views of Riffelhorn|Gornergrat railway ride/, blob);
  for (const d of mid) {
    const sector = (d.morning.match(/Ski ([^—]+?)(?:\s+—|\s+slopes|$)/) || d.morning.match(/on the (.+?) slopes/i) || [])[1]?.trim();
    if (!sector) continue;
    const rest = (d.afternoon.split("rest day:")[1] || "").trim();
    if (rest) assert.ok(!rest.toLowerCase().includes(sector.toLowerCase()), `rest day repeats morning sector on ${d.date}: ${d.morning} / ${d.afternoon}`);
  }
});

test("v1.14.2: food prep is merged into the tickets timeline task", () => {
  const p = fixture();
  p.input = syncActivityInput({ ...p.input, activities: ["food", "museums"] });
  p.timeline = mergeActivityTimeline(timeline(p.input.start, true, "2026-11-01"), p, "2026-11-01");
  const tasks = p.timeline.map((t: any) => t.task).join("\n");
  assert.match(tasks, /Book must-do tickets and reserve popular restaurants/);
  assert.equal(p.timeline.filter((t: any) => /restaurant/i.test(t.task)).length, 1, tasks);
  assert.equal(tasksOverlap("Book must-do tickets & any restaurant reservations", "Reserve popular restaurants"), true);
});

test("v1.14.2: merge still keeps famous beaches when many other venues arrive", () => {
  const extra = [
    ...Array.from({ length: 10 }, (_, i) => ({ name: `Viewpoint ${i}`, type: "viewpoint", activity: "sightseeing", description: "", source: "OSM", indoor: false, setting: "outdoor" as const })),
    { name: "Camps Bay Beach", type: "beach", activity: "beach", description: "", source: "Wikidata", indoor: false, setting: "outdoor" as const },
    { name: "Clifton Beach", type: "beach", activity: "beach", description: "", source: "Wikidata", indoor: false, setting: "outdoor" as const },
    { name: "Muizenberg Beach", type: "beach", activity: "beach", description: "", source: "Wikidata", indoor: false, setting: "outdoor" as const },
    { name: "Foresters Arms", type: "bar", activity: "nightlife", description: "", source: "Wikidata", indoor: true, setting: "indoor" as const },
  ] as any;
  const merged = mergeActivityPlaces([], extra, 10);
  const names = merged.map((h: any) => h.name).join(" ");
  assert.match(names, /Camps Bay Beach/);
  assert.match(names, /Foresters Arms/);
  assert.equal(isRealBeach(merged.find((h: any) => h.name === "Camps Bay Beach")!), true);
});

test("v1.14.2: beach merge prefers Camps Bay, Clifton and Muizenberg; rest days do not say views of views", () => {
  const extra = [
    { name: "Boulders Beach", type: "beach", activity: "beach", description: "", source: "Wikidata", indoor: false, setting: "outdoor" as const },
    { name: "Long Beach", type: "beach", activity: "beach", description: "", source: "Wikidata", indoor: false, setting: "outdoor" as const },
    { name: "Muizenberg Beach", type: "beach", activity: "beach", description: "", source: "Wikidata", indoor: false, setting: "outdoor" as const },
    { name: "Clifton Beach", type: "beach", activity: "beach", description: "", source: "Wikidata", indoor: false, setting: "outdoor" as const },
    { name: "Camps Bay Beach", type: "beach", activity: "beach", description: "", source: "Wikidata", indoor: false, setting: "outdoor" as const },
  ] as any;
  const merged = mergeActivityPlaces([], extra, 3).map((h: any) => h.name);
  assert.deepEqual(merged, ["Camps Bay Beach", "Clifton Beach", "Muizenberg Beach"]);
  const inp: any = syncActivityInput({ destination: "Zermatt", start: "2027-01-03", end: "2027-01-09", travelers: 2, purpose: "Ski", style: "Mix", travelMode: "flying", activities: ["ski"] });
  const hl: any[] = [
    { name: "Sunnegga Paradise ski area", ski: true, description: "Ski area", source: "Fixture", indoor: false, setting: "outdoor", type: "ski resort" },
    { name: "Breithorn", type: "mountain", description: "A peak", indoor: false, setting: "outdoor", source: "Fixture" },
  ];
  const days = itinerary(inp, snowWx as any, hl, []);
  runActivitySchedule(days, inp, snowWx as any, hl, ["ski"] as any, "Zermatt");
  const rest = days.map(d => d.afternoon).join(" | ");
  assert.doesNotMatch(rest, /views of views of/);
});
