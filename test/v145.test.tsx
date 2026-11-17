import test from "node:test";
import assert from "node:assert/strict";
import { isSkiSector, syncActivityInput } from "../shared/activities.js";
import { runActivitySchedule } from "../server/activityItinerary.js";
import { itinerary } from "../server/plan.js";
import { stats } from "../server/weather.js";
import { namesInText, itineraryPlaceNames } from "../server/itineraryPlaces.js";

const capeDays = [20, 21, 22, 23, 24, 25].map(d => ({ date: `2026-11-${d}`, tmax: 26, tmin: 16, precipMm: 0, precipProb: 10, typical: false, summary: "Sunny" }));
const capeWx = { source: "forecast" as const, note: "", days: capeDays, stats: stats(capeDays as any) };
const snowDays = [3, 4, 5, 6, 7, 8, 9].map(d => ({ date: `2027-01-0${d}`, tmax: 1, tmin: -7, precipMm: 4, precipProb: 60, typical: true, summary: "Often snowy" }));
const snowWx = { source: "typical" as const, note: "", days: snowDays, stats: stats(snowDays as any) };

const venues: any[] = [
  { name: "Camps Bay Beach", type: "beach", activity: "beach", description: "beach", source: "Wikidata", indoor: false, setting: "outdoor" },
  { name: "District Six Museum", type: "museum", activity: "museums", description: "museum", source: "Wikidata", indoor: true, setting: "indoor" },
  { name: "Groot Constantia", type: "winery", activity: "tasting", description: "winery", source: "Wikidata", indoor: false, setting: "outdoor" },
  { name: "Foresters Arms", type: "bar", activity: "nightlife", description: "bar", source: "Wikidata", indoor: true, setting: "indoor" },
];

function midBlob(days: { morning: string; afternoon: string; evening: string; rainyBackup?: string }[]) {
  return days.slice(1, -1).map(d => `${d.morning} / ${d.afternoon} / ${d.evening} / ${d.rainyBackup || ""}`).join("\n");
}

function assertNoRepeat(days: any[], hl: any[], placeName = "Cape Town") {
  const names = itineraryPlaceNames(hl);
  const seen = new Map<string, string>();
  for (const d of days.slice(1, -1)) {
    for (const n of namesInText(`${d.morning} ${d.afternoon} ${d.evening} ${d.rainyBackup || ""}`, names)) {
      if (n.toLowerCase() === placeName.toLowerCase()) continue;
      const prev = seen.get(n.toLowerCase());
      assert.equal(prev, undefined, `${n} repeats on ${prev} and ${d.date}:\n${midBlob(days)}`);
      seen.set(n.toLowerCase(), d.date);
    }
  }
}

test("v1.14.5: a named beach is used even when itinerary already put that beach on the same morning", () => {
  const inp: any = syncActivityInput({
    destination: "Cape Town", start: "2026-11-20", end: "2026-11-25", travelers: 2, purpose: "Leisure", style: "Mix", travelMode: "flying",
    activities: ["beach", "food", "museums", "tasting", "nightlife", "sightseeing"],
  });
  const days = itinerary(inp, capeWx as any, venues, [{ name: "Eastern Food Bazaar", tag: "food court" }] as any);
  // This is the live v1.14.4 failure: first warm day's morning is already the only beach,
  // and the beach preset overwrites the afternoon with generic wording.
  assert.match(days[1].morning, /Camps Bay Beach/);
  runActivitySchedule(days, inp, capeWx as any, venues, ["beach", "city"] as any, "Cape Town");
  const blob = midBlob(days);
  assert.match(blob, /🏖 Camps Bay Beach/, blob);
  assert.doesNotMatch(blob, /🏖 Beach time at a nearby beach/, blob);
  const beachDay = days.slice(1, -1).find(d => /🏖/.test(d.afternoon))!;
  assert.ok(beachDay, blob);
  assert.doesNotMatch(beachDay.morning, /Camps Bay Beach/, `same-day leftover:\n${blob}`);
  assertNoRepeat(days, venues);
});

test("v1.14.5: museum, tasting and nightlife slots still name a real venue if the only one was already used as a highlight", () => {
  const inp: any = syncActivityInput({
    destination: "Cape Town", start: "2026-11-20", end: "2026-11-25", travelers: 2, purpose: "Leisure", style: "Mix", travelMode: "flying",
    activities: ["museums", "tasting", "nightlife", "sightseeing"],
  });
  const days = itinerary(inp, capeWx as any, venues, [{ name: "Eastern Food Bazaar", tag: "food court" }] as any);
  runActivitySchedule(days, inp, capeWx as any, venues, ["city"] as any, "Cape Town");
  const blob = midBlob(days);
  assert.match(blob, /🖼 District Six Museum/, blob);
  assert.match(blob, /🍷 Groot Constantia/, blob);
  assert.match(blob, /🍸 Foresters Arms/, blob);
  assert.doesNotMatch(blob, /🖼 Museums & art/, blob);
  assert.doesNotMatch(blob, /🍷 Wine, beer & distillery tasting/, blob);
  assert.doesNotMatch(blob, /🍸 Nightlife & bars/, blob);
  assertNoRepeat(days, venues);
});

test("v1.14.5: generic beach wording is only used when no real beach exists", () => {
  const inp: any = syncActivityInput({
    destination: "Cape Town", start: "2026-11-20", end: "2026-11-25", travelers: 2, purpose: "Leisure", style: "Mix", travelMode: "flying",
    activities: ["beach", "sightseeing"],
  });
  const hl: any[] = [
    { name: "V&A Waterfront", type: "attraction", description: "harbour shops", source: "Wikipedia", indoor: false, setting: "outdoor" },
    { name: "Table Mountain", type: "peak", description: "peak", source: "Wikipedia", indoor: false, setting: "outdoor" },
  ];
  const days = itinerary(inp, capeWx as any, hl, [] as any);
  runActivitySchedule(days, inp, capeWx as any, hl, ["beach", "city"] as any, "Cape Town");
  const blob = midBlob(days);
  assert.match(blob, /🏖 Beach time at a nearby beach/, blob);
  assert.doesNotMatch(blob, /🏖 V&A Waterfront/, blob);
});

test("v1.14.5: Zermatt ski rotation and unique rest days still work", () => {
  const inp: any = syncActivityInput({ destination: "Zermatt", start: "2027-01-03", end: "2027-01-09", travelers: 2, purpose: "Ski", style: "Mix", travelMode: "flying", activities: ["ski"] });
  const hl: any[] = [
    { name: "Sunnegga Paradise", ski: true, description: "Ski area", source: "Fixture", indoor: false, setting: "outdoor", type: "ski resort" },
    { name: "Gornergrat", description: "Railway and viewpoint", source: "Fixture", indoor: false, setting: "outdoor", type: "viewpoint" },
    { name: "Theodul Pass", ski: true, description: "Ski sector", source: "Fixture", indoor: false, setting: "outdoor", type: "ski resort" },
    { name: "Riffelalp", ski: true, description: "Ski sector", source: "Fixture", indoor: false, setting: "outdoor", type: "ski resort" },
    { name: "Matterhorn Museum", type: "museum", description: "In-town museum", indoor: true, setting: "indoor", source: "Fixture" },
    { name: "Riffelsee", type: "lake", description: "Alpine lake", indoor: false, setting: "outdoor", source: "Fixture" },
  ];
  const days = itinerary(inp, snowWx as any, hl, []);
  runActivitySchedule(days, inp, snowWx as any, hl, ["ski"] as any, "Zermatt");
  const mid = days.slice(1, -1);
  const blob = mid.map(d => `${d.morning} / ${d.afternoon}`).join("\n");
  const sectors = mid.map(d => (d.morning.match(/Ski ([^—]+?)(?:\s+—|\s+slopes|$)/) || [])[1]?.trim()).filter(Boolean);
  assert.ok(new Set(sectors).size >= 3, `rotation too thin:\n${blob}`);
  assert.ok(sectors.every(s => isSkiSector({ name: s })), blob);
  assert.match(blob, /Matterhorn Museum|Riffelsee|Gornergrat/, blob);
});
