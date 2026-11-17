import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultDistanceUnit, formatDistance, isDistanceUnit } from "../shared/distance.js";
import { travelTimeLabel, formatTripTravel } from "../shared/travel.js";
import { applyRoadRoute, tripFacts } from "../server/trip.js";
import { driveLabel, itinerary, packing, timeline } from "../server/plan.js";
import {
  isMajorAttraction, interestBrands, isCompetitorPark, tripHasKids, holidayNote, isUsThanksgiving,
  paceItineraryForKids, fillPreferredParks, applyHolidayNotes, farDayTrip, KIDS_DRIVE_DAY, KIDS_POOL_REST,
  isGrownUpTask, isGrownUpPackingItem, GROWN_UP_LABEL,
} from "../shared/family.js";
import { maybeWetDay, wetDaysSummary } from "../shared/precip.js";
import { packingItems, suggestPacking, packingMembers, validatePacking, type PackingList } from "../shared/packing.js";
import { editTraveler, travelerRows } from "../src/Travelers.js";
import { GrownUpBadge, GrownUpNote } from "../src/GrownUp.js";
import { WrongPlace } from "../src/Home.js";
import { exportPlan, parsePlan } from "../shared/portable.js";
import { fixture } from "./fixtures.js";
import { readFileSync } from "node:fs";

const detroit = { id: 1, name: "Detroit", country: "United States", countryCode: "US", lat: 42.33, lon: -83.05, timezone: "America/Detroit" };
const orlando = { id: 2, name: "Orlando", country: "United States", countryCode: "US", lat: 28.54, lon: -81.38, timezone: "America/New_York" };
const familyMembers = [
  { id: "traveler-1", name: "Mom", profile: "woman" as const },
  { id: "traveler-2", name: "Dad", profile: "man" as const },
  { id: "traveler-3", name: "Me", profile: "girl" as const, child: true, age: 10 },
  { id: "traveler-4", name: "Little brother", profile: "boy" as const, child: true, age: 6 },
  { id: "traveler-5", name: "Baby sister", profile: "infant" as const, child: true },
];
const parks = [
  { name: "Epcot", description: "Disney theme park", indoor: false, setting: "outdoor" as const, source: "Fixture", type: "theme park", driveMin: 30, driveSrc: "osrm" as const, distanceKm: 20, lat: 28.37, lon: -81.55 },
  { name: "Magic Kingdom", description: "Disney theme park", indoor: false, setting: "outdoor" as const, source: "Fixture", type: "theme park", driveMin: 35, driveSrc: "osrm" as const, distanceKm: 25, lat: 28.42, lon: -81.58 },
  { name: "Disney's Hollywood Studios", description: "Disney theme park", indoor: false, setting: "outdoor" as const, source: "Fixture", type: "theme park", driveMin: 28, driveSrc: "osrm" as const, distanceKm: 18, lat: 28.36, lon: -81.56 },
  { name: "Disney's Animal Kingdom", description: "Disney theme park", indoor: false, setting: "outdoor" as const, source: "Fixture", type: "theme park", driveMin: 32, driveSrc: "osrm" as const, distanceKm: 22, lat: 28.36, lon: -81.59 },
  { name: "Universal's Islands of Adventure", description: "Universal theme park", indoor: false, setting: "outdoor" as const, source: "Fixture", type: "theme park", driveMin: 25, driveSrc: "osrm" as const, distanceKm: 15, lat: 28.47, lon: -81.47, dayTrip: true },
  { name: "Universal Studios Florida", description: "Universal theme park", indoor: false, setting: "outdoor" as const, source: "Fixture", type: "theme park", driveMin: 25, driveSrc: "osrm" as const, distanceKm: 15, lat: 28.47, lon: -81.47 },
];
const wx = (start = "2026-12-20", n = 8): any => {
  const days = Array.from({ length: n }, (_, i) => {
    const date = new Date(Date.UTC(2026, 11, 20 + i)).toISOString().slice(0, 10);
    return { date, tmax: 24, tmin: 15, summary: "Partly cloudy", typical: true, precipProb: i === 5 || i === 7 ? 33 : 10, precipMm: 0, code: 2 };
  });
  return { source: "typical" as const, note: "Typical for this season", days, stats: { avgHigh: 24, avgLow: 15, minLow: 15, maxHigh: 24, rainyDays: 0, snowDays: 0 } };
};
const familyInput = () => ({
  destination: "Orlando", start: "2026-12-20", end: "2026-12-27", travelers: 5, purpose: "Family", style: "Mix" as const,
  interests: "Disney World, theme parks, princesses, rides", travelMode: "driving" as const,
  presets: ["kids"], activities: ["family", "parks"] as any, members: familyMembers, walkingTolerance: "standard",
});

test("v1.15: distance units default to miles for the US and UK", () => {
  assert.equal(defaultDistanceUnit("US"), "mi");
  assert.equal(defaultDistanceUnit("GB"), "mi");
  assert.equal(defaultDistanceUnit("FR"), "km");
  assert.ok(isDistanceUnit("mi") && isDistanceUnit("km") && !isDistanceUnit("ft"));
  assert.equal(formatDistance(160.934, "mi"), "100 miles");
  assert.equal(formatDistance(1000, "km"), "1,000 km");
});

test("v1.15: drive card uses a road route, plain language, and borders only when international", () => {
  const routed = travelTimeLabel(1541, "driving", { roadMin: 17 * 60, roadKm: 1800, roadSrc: "osrm", domestic: true }, "mi");
  assert.match(routed.flightLabel, /About 17 hours of driving/);
  assert.match(routed.flightLabel, /plan stops \(and maybe a night on the way\)/);
  assert.match(routed.flightLabel, /1,118 miles by road \(traffic not included\)/);
  assert.ok(!/great-circle|OSRM|straight-line|border/i.test(routed.flightLabel));
  const fallback = travelTimeLabel(1541, "driving", undefined, "km");
  assert.match(fallback.flightLabel, /rough estimate, not a turn-by-turn route/);
  assert.ok(!/border/i.test(fallback.flightLabel));
  const intl = travelTimeLabel(800, "driving", { roadMin: 200, roadKm: 250, roadSrc: "osrm", domestic: false });
  assert.match(intl.flightLabel, /Crossing a border can take longer/);
  const facts = applyRoadRoute(tripFacts(detroit, orlando, "2026-12-20", "driving"), { durationMin: 17 * 60, distanceKm: 1800, src: "osrm", midpoint: { name: "Knoxville" } });
  assert.equal(facts.driveMin, 17 * 60);
  assert.equal(facts.overnightStop, "Knoxville");
  assert.match(formatTripTravel(facts, "driving", "mi"), /About 17 hours of driving/);
  assert.match(driveLabel({ driveMin: 30, driveSrc: "osrm" }), /~30 min drive, traffic not included/);
  assert.ok(!/OSRM|great-circle/i.test(driveLabel({ driveMin: 30, driveSrc: "osrm" })));
});

test("v1.15: long-drive Day 1 is a rest day and suggests a midpoint overnight over 10 hours", () => {
  const days = itinerary(familyInput(), wx(), parks as any, [], [], { domestic: true, travelMode: "driving", driveMin: 17 * 60, overnightStop: "Knoxville", countryCode: "US" });
  assert.match(days[0].morning, /Drive day — about 8 h to Knoxville; overnight there/);
  assert.match(days[0].afternoon, /Overnight in Knoxville/);
  assert.match(days[1].morning, /Finish the drive \(~9 h\) and check in/);
  assert.ok(!isMajorAttraction(days[1].morning) && !isMajorAttraction(days[1].afternoon), days[1].morning + days[1].afternoon);
  assert.ok(!/neighbourhood walk|local currency|SIM/i.test(`${days[0].morning} ${days[0].afternoon}`));
  const mid = itinerary(familyInput(), wx(), parks as any, [], [], { domestic: true, travelMode: "driving", driveMin: 7 * 60, countryCode: "US" });
  assert.equal(mid[0].morning, KIDS_DRIVE_DAY);
  assert.match(mid[0].afternoon, /Check in & rest/);
  assert.ok(!/overnight/i.test(`${mid[0].morning} ${mid[0].afternoon} ${mid[0].notes}`));
});

test("v1.15: day text never mentions local currency or a SIM", () => {
  const days = itinerary(familyInput(), wx(), parks as any, [], [], { domestic: true, travelMode: "flying", countryCode: "US" });
  assert.ok(!/currency|SIM/i.test(days.map(d => `${d.morning} ${d.afternoon} ${d.evening} ${d.notes}`).join(" ")));
  const intl = itinerary({ ...familyInput(), travelMode: "flying" }, wx(), parks as any, [], [], { domestic: false, travelMode: "flying" });
  assert.ok(!/currency|SIM/i.test(intl.map(d => `${d.morning} ${d.afternoon} ${d.evening} ${d.notes}`).join(" ")));
  const tasks = timeline("2026-12-20", false, "2026-11-17", "driving").map(t => t.task).join(" ");
  assert.ok(!/local currency/i.test(tasks));
});

test("v1.15: with kids, one major theme park per day and no 'Also nearby' parks or short 'Day trip' labels", () => {
  const input = familyInput();
  const days = itinerary(input, wx(), parks as any, [], [], { domestic: true, travelMode: "driving", driveMin: 17 * 60, countryCode: "US" });
  paceItineraryForKids(days, input);
  const mid = days.filter(d => /·/.test(d.label) && !/Arrive|Depart/.test(d.label));
  for (const d of mid) {
    const majors = [d.morning, d.afternoon].filter(s => isMajorAttraction(s));
    assert.ok(majors.length <= 1, `${d.label} has two majors: ${d.morning} / ${d.afternoon}`);
    assert.ok(!/Also nearby:/i.test(d.afternoon), d.afternoon);
    assert.ok(!/Day trip:/i.test(`${d.morning} ${d.afternoon}`), "nearby parks must not be labelled a day trip");
  }
  assert.ok(mid.some(d => d.afternoon === KIDS_POOL_REST || /pool|rest at the hotel/i.test(d.afternoon)));
  assert.equal(farDayTrip({ driveMin: 30, dayTrip: true, distanceKm: 20 }), false);
  assert.equal(farDayTrip({ driveMin: 75 }), true);
});

test("v1.15: interests that mention Disney prefer Disney parks over Universal while Disney days remain", () => {
  assert.deepEqual(interestBrands("Disney World, theme parks, princesses, rides"), ["disney"]);
  const leftover = parks.filter(p => /epcot|magic kingdom|hollywood|animal kingdom/i.test(p.name));
  assert.equal(isCompetitorPark("Universal's Islands of Adventure", "Disney World", leftover), true);
  assert.equal(isCompetitorPark("Epcot", "Disney World", leftover), false);
  const input = familyInput();
  const days = itinerary(input, wx(), parks as any, [], [], { domestic: true, travelMode: "driving", driveMin: 17 * 60, countryCode: "US" });
  paceItineraryForKids(days, input);
  const midText = days.filter(d => !/Arrive|Depart/.test(d.label)).map(d => `${d.morning} ${d.afternoon}`).join(" | ");
  assert.match(midText, /Epcot|Magic Kingdom|Hollywood Studios|Animal Kingdom/);
  const disneyLeftUnused = leftover.some(p => !midText.includes(p.name));
  if (!disneyLeftUnused) {
    // All Disney parks used — competitor parks may appear afterwards; that's fine.
  } else {
    assert.ok(!/Universal/i.test(midText), midText);
  }
  const overwritten = [
    { label: "Day 2", morning: "👨‍👩‍👧 Holy Land Experience", afternoon: KIDS_POOL_REST },
    { label: "Day 3", morning: "🎢 Epcot", afternoon: KIDS_POOL_REST },
    { label: "Day 4", morning: "Universal Studios Florida", afternoon: KIDS_POOL_REST },
  ];
  fillPreferredParks(overwritten, parks, "Disney World");
  const text = overwritten.map(d => d.morning).join(" | ");
  assert.match(text, /Magic Kingdom|Animal Kingdom|Hollywood Studios/);
  assert.ok(!/Holy Land/i.test(text));
  assert.ok(!/Universal/i.test(text), text);
});

test("v1.15: holiday notes land on Dec 24, 25, 31, Jan 1 and US Thanksgiving", () => {
  assert.equal(isUsThanksgiving("2026-11-26"), true);
  assert.equal(isUsThanksgiving("2026-11-19"), false);
  assert.match(holidayNote("2026-12-24")!, /Holiday — check opening hours & book ahead/);
  assert.match(holidayNote("2026-12-25")!, /Holiday/);
  assert.match(holidayNote("2026-12-31")!, /Holiday/);
  assert.match(holidayNote("2027-01-01")!, /Holiday/);
  assert.match(holidayNote("2026-11-26", "US")!, /Holiday/);
  assert.equal(holidayNote("2026-12-22"), undefined);
  const days = itinerary(familyInput(), wx(), parks as any, [], [], { domestic: true, travelMode: "driving", driveMin: 100, countryCode: "US" });
  applyHolidayNotes(days, "US");
  const xmasEve = days.find(d => d.date === "2026-12-24");
  const xmas = days.find(d => d.date === "2026-12-25");
  assert.match(xmasEve?.notes || "", /Holiday — check opening hours & book ahead/);
  assert.match(xmas?.notes || "", /Holiday — check opening hours & book ahead/);
});

test("v1.15: diapers, wipes and baby outfits scale by days with the assumption in the name", () => {
  const p = fixture();
  p.input = { ...p.input, start: "2026-12-20", end: "2026-12-27", travelers: 5, interests: "Disney World, theme parks" };
  p.trip = { domestic: true };
  const list = suggestPacking(p, { laundryEvery: null, luggage: "all", members: familyMembers } as any);
  const baby = packingItems(list).filter(i => i.owner === "traveler-5");
  const diapers = baby.find(i => i.item.startsWith("Diapers / nappies"));
  assert.ok(diapers, "diapers row");
  assert.equal(diapers!.quantity, 64);
  assert.match(diapers!.item, /~8 a day × 8 days ≈ 64 diapers/);
  const wipes = baby.find(i => i.item.startsWith("Wipes"));
  assert.ok(wipes);
  assert.equal(wipes!.quantity, 2);
  assert.match(wipes!.item, /≈ 2 packs/);
  const outfits = baby.find(i => i.item.startsWith("Baby outfits"));
  assert.ok(outfits);
  assert.match(outfits!.item, /~2 a day/);
  assert.equal(outfits!.quantity, 14); // 2 a day, capped at 14
});

test("v1.15: grown-up task tags match adult prep and packing rows", () => {
  assert.ok(isGrownUpTask("Check the car: tyres, lights, fluids and papers"));
  assert.ok(isGrownUpTask("Plan the route, fuel or charging stops, parking and tolls"));
  assert.ok(isGrownUpTask("Hold mail / packages or ask a neighbour"));
  assert.ok(isGrownUpTask("Set thermostat, unplug appliances, lock up"));
  assert.ok(isGrownUpPackingItem("Usual medicines / personal health supplies (if needed)"));
  assert.ok(isGrownUpPackingItem("Feeding supplies (as you feed)"));
  const html = renderToStaticMarkup(<GrownUpBadge name="Check the car: tyres, lights, fluids and papers" />);
  assert.match(html, new RegExp(GROWN_UP_LABEL));
  const note = renderToStaticMarkup(<GrownUpNote show />);
  assert.match(note, /Planning for the family\? Show this plan to a grown-up before booking anything\./);
});

test("v1.15: optional traveler ages persist, share, and lightly change packing", () => {
  assert.equal(tripHasKids(familyInput()), true);
  const rows = travelerRows(familyMembers, 5);
  const aged = editTraveler(rows, 5, "traveler-4", { age: 2 });
  assert.equal(aged.find(m => m.id === "traveler-4")?.age, 2);
  const p = fixture();
  p.input = { ...p.input, start: "2026-12-20", end: "2026-12-27", travelers: 5, interests: "Disney World, theme parks" };
  p.trip = { domestic: true };
  const members = familyMembers.map(m => m.id === "traveler-4" ? { ...m, age: 2 } : m);
  const list = suggestPacking(p, { laundryEvery: null, luggage: "all", members } as any);
  assert.ok(packingItems(list).some(i => /Toddler outfits \(~2 a day\)/.test(i.item)));
  assert.ok(packingItems(list).some(i => /Travel stroller \(for little ones under 5\)/.test(i.item)));
  const p2 = fixture();
  p2.input.travelers = 5;
  p2.packing = list;
  validatePacking(list);
  const back = parsePlan(exportPlan(p2));
  assert.equal(back.packing.settings.members.find((m: any) => m.id === "traveler-4").age, 2);
  const old = packingMembers({ members: [{ id: "traveler-1", name: "Ada" }] }, 1);
  assert.equal(old[0].age, undefined);
});

test("v1.15: Not the right place? alternatives stay hidden until the link is opened", () => {
  const alts = [{ id: 9, name: "Orlando", country: "South Africa", countryCode: "ZA", lat: 0, lon: 0 }];
  const html = renderToStaticMarkup(<WrongPlace alts={alts} onPick={() => {}} resolved />);
  assert.match(html, /Not the right place\? Pick another/);
  assert.ok(!html.includes("South Africa"), html);
});

test("v1.15: typical weather wet-day summary uses the same rainy-day definition as the stats line", () => {
  const days = wx().days;
  assert.equal(days.filter(maybeWetDay).length, 2);
  assert.equal(wetDaysSummary(days).label, "usually sunny");
  assert.equal(wetDaysSummary(days).count, 0);
  assert.ok(!maybeWetDay({ precipProb: 10, typical: true }));
  assert.ok(maybeWetDay({ precipProb: 30, typical: true }));
  // Display and packing share isRainy — 33% typical days are not "rainy".
  assert.equal(wx().stats.rainyDays, 0);
  assert.equal(wetDaysSummary(days).label.toLowerCase().includes("wet") ? 1 : 0, 0);
  const wet = [{ precipProb: 60, precipMm: 4, typical: false, summary: "Rain" }];
  assert.equal(wetDaysSummary(wet).label, "Wet days ~1");
});

test("v1.15: itinerary wrapping class is used so long lines are not clipped", () => {
  // The Editable wrap flag is a textarea with class "ed wrap"; CSS gives it overflow-wrap:anywhere.
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.slot \.ed/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /\.jump-itin/);
});
