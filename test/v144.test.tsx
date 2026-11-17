import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { fixture } from "./fixtures.js";
import { isSkiSector, syncActivityInput } from "../shared/activities.js";
import { runActivitySchedule } from "../server/activityItinerary.js";
import { itinerary } from "../server/plan.js";
import { stats } from "../server/weather.js";
import { namesInText, dedupeItineraryPlaces, itineraryPlaceNames } from "../server/itineraryPlaces.js";
import { PackTab, setSimplePacking, getSimplePacking } from "../src/packingMode.js";
import { packingMembers, suggestPacking, packingItems } from "../shared/packing.js";

const capeDays = [20, 21, 22, 23, 24, 25].map(d => ({ date: `2026-11-${d}`, tmax: 26, tmin: 16, precipMm: 0, precipProb: 10, typical: false, summary: "Sunny" }));
const capeWx = { source: "forecast" as const, note: "", days: capeDays, stats: stats(capeDays as any) };
const snowDays = [3, 4, 5, 6, 7, 8, 9].map(d => ({ date: `2027-01-0${d}`, tmax: 1, tmin: -7, precipMm: 4, precipProb: 60, typical: true, summary: "Often snowy" }));
const snowWx = { source: "typical" as const, note: "", days: snowDays, stats: stats(snowDays as any) };

const capeHl: any[] = [
  { name: "V&A Waterfront", description: "Harbour shops", source: "Wikipedia/Wikidata", indoor: false, setting: "outdoor", type: "attraction" },
  { name: "Camps Bay Beach", description: "beach", source: "Wikidata", indoor: false, setting: "outdoor", type: "beach", activity: "beach" },
  { name: "Clifton Beach", description: "beach", source: "Wikidata", indoor: false, setting: "outdoor", type: "beach", activity: "beach" },
  { name: "Muizenberg Beach", description: "beach", source: "Wikidata", indoor: false, setting: "outdoor", type: "beach", activity: "beach" },
  { name: "Zeitz Museum of Contemporary Art Africa", description: "museum", source: "Wikidata", indoor: true, setting: "indoor", type: "museum", activity: "museums" },
  { name: "Iziko Museums of South Africa", description: "museum", source: "Wikidata", indoor: true, setting: "indoor", type: "museum", activity: "museums" },
  { name: "Groot Constantia", description: "winery", source: "Wikidata", indoor: false, setting: "outdoor", type: "winery", activity: "tasting" },
  { name: "Foresters Arms", description: "bar", source: "Wikidata", indoor: true, setting: "indoor", type: "bar", activity: "nightlife" },
  { name: "Lion's Head", description: "peak", source: "Wikipedia/Wikidata", indoor: false, setting: "outdoor", type: "peak", activity: "hiking" },
  { name: "Table Mountain", description: "trail and peak", source: "Wikipedia/Wikidata", indoor: false, setting: "outdoor", type: "peak", activity: "hiking" },
  { name: "Kirstenbosch", description: "botanical garden", source: "Wikipedia/Wikidata", indoor: false, setting: "outdoor", type: "garden" },
];

test("v1.14.4: namesInText prefers the longer highlight and ignores substrings", () => {
  const names = itineraryPlaceNames([{ name: "Matterhorn" }, { name: "Matterhorn Museum" }]);
  assert.deepEqual(namesInText("or a rest day: Matterhorn Museum", names), ["Matterhorn Museum"]);
  assert.deepEqual(namesInText("views of Matterhorn", names), ["Matterhorn"]);
});

test("v1.14.4: a named place is not scheduled on two different days", () => {
  const inp: any = syncActivityInput({
    destination: "Cape Town", start: "2026-11-20", end: "2026-11-25", travelers: 2, purpose: "Leisure", style: "Mix", travelMode: "flying",
    activities: ["beach", "food", "hiking", "dive", "museums", "tasting", "nightlife", "sightseeing"],
  });
  const food = [{ name: "Eastern Food Bazaar", tag: "food court" }, { name: "Greek Fisherman", tag: "seafood" }] as any;
  const days = itinerary(inp, capeWx as any, capeHl, food);
  runActivitySchedule(days, inp, capeWx as any, capeHl, ["beach", "hiking", "city"] as any, "Cape Town");
  const mid = days.slice(1, -1);
  const blob = mid.map(d => `${d.morning} / ${d.afternoon} / ${d.evening} / ${d.rainyBackup || ""}`).join("\n");
  const names = itineraryPlaceNames(capeHl);
  const seen = new Map<string, string>();
  for (const d of mid) {
    for (const n of namesInText(`${d.morning} ${d.afternoon} ${d.evening}`, names)) {
      if (n.toLowerCase() === "cape town") continue;
      const prev = seen.get(n.toLowerCase());
      assert.equal(prev, undefined, `${n} repeats on ${prev} and ${d.date}:\n${blob}`);
      seen.set(n.toLowerCase(), d.date);
    }
  }
  assert.match(blob, /🥾/, blob);
  assert.doesNotMatch(blob, /then Lion's Head[\s\S]*Lion's Head|Lion's Head[\s\S]*then Lion's Head/, blob);
  assert.ok(mid.some(d => /🍸 Foresters Arms/.test(d.evening)), blob);
});

test("v1.14.4: hike follow-ups, rest days and rain backups are included in the uniqueness pass", () => {
  const days: any[] = [
    { date: "2026-11-21", morning: "🖼 District Six Museum", afternoon: "🏖 Camps Bay Beach", evening: "Dinner", rainyBackup: "If it rains: Lion's Head", notes: "" },
    { date: "2026-11-22", morning: "🥾 Day hike", afternoon: "🥾 Hike continues — back by late afternoon; then Lion's Head", evening: "Dinner", notes: "" },
    { date: "2026-11-23", morning: "🚶 Kirstenbosch", afternoon: "Explore a market or local street", evening: "Dinner", rainyBackup: "If it rains: District Six Museum", notes: "" },
  ];
  dedupeItineraryPlaces(days as any, capeHl as any, "Cape Town");
  const blob = days.map(d => `${d.morning} / ${d.afternoon} / ${d.rainyBackup || ""}`).join("\n");
  const names = itineraryPlaceNames(capeHl);
  const seen = new Set<string>();
  for (const d of days) {
    for (const n of namesInText(`${d.morning} ${d.afternoon} ${d.evening} ${d.rainyBackup || ""}`, names)) {
      assert.equal(seen.has(n.toLowerCase()), false, `${n} still repeats:\n${blob}`);
      seen.add(n.toLowerCase());
    }
  }
  assert.doesNotMatch(days[1].afternoon, /then Lion's Head/, blob);
});

test("v1.14.4: ski sector rotation is kept; rest-day sights stay unique", () => {
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
  const restNames = itineraryPlaceNames(hl.filter((h: any) => !h.ski));
  const seen = new Set<string>();
  for (const d of mid) {
    const rest = (d.afternoon.split("rest day:")[1] || "").trim();
    for (const n of namesInText(rest, restNames)) {
      assert.equal(seen.has(n.toLowerCase()), false, `rest-day ${n} repeats:\n${blob}`);
      seen.add(n.toLowerCase());
    }
  }
  assert.match(blob, /Matterhorn Museum|Riffelsee|Gornergrat/, blob);
});

test("v1.14.4: Simple mode is a local store; toggling does not live in App state", () => {
  const srcApp = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const srcPack = readFileSync(new URL("../src/Packing.tsx", import.meta.url), "utf8");
  const srcMode = readFileSync(new URL("../src/packingMode.tsx", import.meta.url), "utf8");
  assert.match(srcMode, /useSyncExternalStore/);
  assert.match(srcMode, /PackTab/);
  assert.match(srcApp, /<PackTab /);
  assert.doesNotMatch(srcApp, /useState\(\(\) => readPackMode/);
  assert.doesNotMatch(srcApp, /simplePacking/);
  assert.match(srcPack, /setSimplePacking/);
  assert.match(srcPack, /simple === undefined/);

  const layout = { order: ["packing", "prep", "timeline"], collapsed: [] as string[], hidden: [] as string[], printCollapsed: false };
  const packing = <div data-testid="pack-body">packing</div>;
  const prep = <div data-testid="prep-body">prep</div>;
  const timeline = <div data-testid="timeline-body">timeline</div>;
  setSimplePacking(false);
  assert.equal(getSimplePacking(), false);
  const detailed = renderToStaticMarkup(<PackTab layout={layout} setLayout={() => {}} titles={{ packing: "Packing list", prep: "Before you leave", timeline: "Pre-trip timeline" }} summaries={{}} packing={packing} prep={prep} timeline={timeline} />);
  assert.ok(detailed.includes("timeline-body"), detailed);
  assert.ok(!detailed.includes("simple-prep"), detailed);
  setSimplePacking(true);
  const simple = renderToStaticMarkup(<PackTab layout={layout} setLayout={() => {}} titles={{ packing: "Packing list", prep: "Before you leave", timeline: "Pre-trip timeline" }} summaries={{}} packing={packing} prep={prep} timeline={timeline} />);
  assert.ok(simple.includes("simple-prep"), simple);
  assert.ok(simple.includes("Before you leave checklist"), simple);
  assert.ok(!simple.includes("timeline-body"), simple);
  setSimplePacking(false);

  const p = fixture();
  p.input = syncActivityInput({ ...p.input, travelers: 16, activities: ["hiking", "beach", "food", "museums"] });
  const members = packingMembers({ members: Array.from({ length: 16 }, (_, i) => ({ id: `traveler-${i + 1}`, name: `Sister ${i + 1}`, profile: "woman" })) }, 16);
  p.packing = suggestPacking(p, { laundryEvery: null, luggage: "all", members } as any);
  assert.ok(packingItems(p.packing).length >= 250);
});
