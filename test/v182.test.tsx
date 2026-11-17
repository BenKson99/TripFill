import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { itinerary, packing } from "../server/plan.js";
import { runActivitySchedule } from "../server/activityItinerary.js";
import { isTravelOrLeaveDay, isMajorAttraction, KIDS_POOL_REST, capDayNotes, ensureParkDayRest, hasChildUnder } from "../shared/family.js";
import { isInfrastructureSight, isJunkSight, isUnsolicitedReligiousAttraction, filterHighlightList } from "../shared/junkVenues.js";
import { assignUniqueRainBackups, optionalFarInterestNotes, curatedIndoorBackups, withKidHint, applyKidPlaceHints } from "../shared/interestVenues.js";
import { formatDayWeather, renderTempTokens, rainChancePhrase } from "../shared/precip.js";
import { isFineDining, familyDinnerList } from "../shared/familyEats.js";
import { preferredHighlights } from "../server/preferences.js";
import { suggestPacking, packingItems } from "../shared/packing.js";
import { defaultPrep } from "../src/Prep.js";
import { groupPrepTasks } from "../shared/prepTiming.js";
import { PackingWorkspace } from "../src/Packing.js";
import { INFANT_PASSPORT_TASK } from "../shared/travelAdvice.js";

const cancunMembers = [
  { id: "traveler-1", name: "Mom", profile: "woman" as const },
  { id: "traveler-2", name: "Dad", profile: "man" as const },
  { id: "traveler-3", name: "Girl", profile: "girl" as const, child: true, age: 10 },
  { id: "traveler-4", name: "Grandparent", profile: "grandparent" as const },
  { id: "traveler-5", name: "Infant", profile: "infant" as const, child: true, age: 1 },
];

function cancunInput() {
  return {
    destination: "Cancún",
    homeCity: "Detroit",
    start: "2027-03-20",
    end: "2027-03-27",
    travelers: 5,
    purpose: "Family",
    style: "Mix" as const,
    travelMode: "flying" as const,
    interests: "pyramids, snorkeling, beaches",
    members: cancunMembers,
    today: "2026-11-17",
    tz: "America/Detroit",
  };
}

test("v1.18.2: weather labels use a wet-chance phrase and a compact temperature range", () => {
  const dry = { precipProb: 33, precipMm: 0, typical: true, summary: "Usually dry", tmax: 27.8, tmin: 22.2 };
  const none = { precipProb: 0, precipMm: 0, typical: true, summary: "Usually dry", tmax: 22, tmin: 10 };
  const wet = { precipProb: 67, precipMm: 0, typical: true, summary: "Often wet", tmax: 29, tmin: 23 };
  const forecast = { precipProb: 40, precipMm: 1, typical: false, summary: "Partly cloudy", tmax: 18, tmin: 12 };
  const line = formatDayWeather(dry);
  assert.equal(line, "Usually dry · {tr:22.2:27.8} · rained on about 1 in 3 of these days in past years");
  assert.equal(renderTempTokens(line, "F"), "Usually dry · 72–82°F · rained on about 1 in 3 of these days in past years");
  assert.equal(renderTempTokens(line, "C"), "Usually dry · 22–28°C · rained on about 1 in 3 of these days in past years");
  assert.equal(rainChancePhrase(none), "");
  assert.equal(formatDayWeather(none), "Usually dry · {tr:10:22}");
  assert.ok(!/%/.test(formatDayWeather(none)));
  assert.ok(!/usually dry in (sampled|past) years/i.test(formatDayWeather(dry)));
  assert.match(formatDayWeather(wet), /rained on about 2 in 3 of these days in past years/);
  assert.match(formatDayWeather(forecast), /40% chance of rain/);
});

test("v1.18.2: infrastructure is dropped from slots and highlights, except famous walkable bridges", () => {
  assert.ok(isInfrastructureSight({ name: "Nichupté Vehicular Bridge", type: "bridge" }));
  assert.ok(isJunkSight("Nichupté Vehicular Bridge"));
  assert.ok(isInfrastructureSight({ name: "US 1 Highway" }));
  assert.ok(isInfrastructureSight({ name: "Lincoln Tunnel" }));
  assert.ok(isInfrastructureSight({ name: "Spaghetti Junction interchange" }));
  assert.ok(!isInfrastructureSight({ name: "Tower Bridge", type: "bridge" }));
  assert.ok(!isInfrastructureSight("Golden Gate Bridge"));
  assert.ok(!isInfrastructureSight("Brooklyn Bridge"));
  assert.ok(!isJunkSight("Tower Bridge"));
  const list = filterHighlightList([
    { name: "Nichupté Vehicular Bridge", type: "bridge" },
    { name: "Playa Delfines", type: "beach" },
    { name: "Golden Gate Bridge", type: "bridge" },
  ]);
  assert.deepEqual(list.map(h => h.name), ["Playa Delfines", "Golden Gate Bridge"]);
});

test("v1.18.2: rain backups name a real indoor place when the city has them, with a kid hint", () => {
  const indoor = curatedIndoorBackups({ name: "Cancún", countryCode: "MX" });
  assert.ok(indoor.length >= 5, indoor.map(s => s.name).join(", "));
  const days = Array.from({ length: 6 }, (_, i) => ({
    morning: i === 0 ? "Zona Arqueológica El Rey (Hotel Zone)" : "Playa Delfines",
    afternoon: "Hotel pool or a quiet rest at the hotel",
    evening: "Dinner",
    rainyBackup: "If it rains: café, museum or covered market",
    notes: "",
  }));
  assignUniqueRainBackups(days, indoor);
  applyKidPlaceHints(days, indoor);
  const lines = days.map(d => d.rainyBackup);
  assert.ok(lines.every(n => !/café, museum or covered market/i.test(n)), lines.join(" | "));
  assert.ok(lines.some(n => /Interactive Aquarium Cancún \(see sea animals indoors\)/.test(n)), lines.join(" | "));
  assert.equal(withKidHint("Interactive Aquarium Cancún", { type: "aquarium" }), "Interactive Aquarium Cancún (see sea animals indoors)");
});

test("v1.18.2: every major theme park day pairs with a pool or rest afternoon", () => {
  const days = [
    { label: "Day 2", morning: "Magic Kingdom", afternoon: "Explore a market or local street", evening: "Dinner", notes: "" },
    { label: "Day 3", morning: "EPCOT", afternoon: "Lake Eola Park", evening: "Dinner", notes: "" },
    { label: "Depart", morning: "Pack up", afternoon: "Head to the airport", evening: "", notes: "" },
  ] as any;
  ensureParkDayRest(days);
  assert.equal(days[0].afternoon, KIDS_POOL_REST);
  assert.equal(days[1].afternoon, KIDS_POOL_REST);
  assert.match(days[2].afternoon, /airport/i);

  const inp = {
    destination: "Orlando",
    start: "2026-12-20",
    end: "2026-12-27",
    travelers: 5,
    purpose: "Family",
    style: "Mix" as const,
    travelMode: "driving" as const,
    interests: "Disney World, theme parks",
    members: cancunMembers,
    today: "2026-11-17",
  };
  const wx = {
    days: Array.from({ length: 8 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 11, 20 + i)).toISOString().slice(0, 10),
      tmax: 24, tmin: 14, precipProb: 20, precipMm: 0, summary: "Usually dry", typical: true,
    })),
    source: "typical", stats: { avgHigh: 24, avgLow: 14, rainyDays: 0, snowDays: 0 }, elevationM: 25,
  } as any;
  const hl = [
    { name: "Magic Kingdom", type: "theme park", setting: "outdoor", indoor: false, source: "TripFill" },
    { name: "EPCOT", type: "theme park", setting: "outdoor", indoor: false, source: "TripFill" },
    { name: "Disney's Hollywood Studios", type: "theme park", setting: "outdoor", indoor: false, source: "TripFill" },
    { name: "Disney's Animal Kingdom", type: "theme park", setting: "outdoor", indoor: false, source: "TripFill" },
    { name: "Orange County Regional History Center", type: "museum", setting: "indoor", indoor: true, source: "wikidata" },
  ] as any;
  const planned = itinerary(inp as any, wx, hl, [], [], { domestic: true, travelMode: "driving", destName: "Orlando", countryCode: "US" });
  runActivitySchedule(planned, inp as any, wx, hl, ["parks", "kids"] as any, "Orlando", { restaurants: [] });
  const mid = planned.filter(d => !isTravelOrLeaveDay(d));
  const parkDays = mid.filter(d => isMajorAttraction(d.morning));
  assert.ok(parkDays.length >= 1, mid.map(d => `${d.label}: ${d.morning} / ${d.afternoon}`).join("\n"));
  for (const d of parkDays) {
    assert.ok(/pool|quiet rest at the hotel/i.test(d.afternoon), `${d.label}: ${d.morning} / ${d.afternoon}`);
    assert.ok(!/Explore a market or local street/i.test(d.afternoon), `${d.label}: ${d.afternoon}`);
  }
});

test("v1.18.2: unsolicited religious attractions are dropped from Local highlights on kid trips", () => {
  const hl = [
    { name: "Holy Land Experience", type: "theme park", description: "A Christian theme park" },
    { name: "Magic Kingdom", type: "theme park" },
    { name: "Lake Eola Park", type: "park" },
  ] as any;
  const kids = preferredHighlights(hl, { interests: "Disney World, theme parks", members: cancunMembers } as any);
  assert.ok(!kids.some(h => /Holy Land/i.test(h.name || "")), kids.map(h => h.name).join(", "));
  assert.ok(kids.some(h => h.name === "Magic Kingdom"));
  const asked = preferredHighlights(hl, { interests: "churches and the Holy Land", members: cancunMembers } as any);
  assert.ok(asked.some(h => /Holy Land/i.test(h.name || "")));
  assert.ok(isUnsolicitedReligiousAttraction({ name: "Holy Land Experience" }, "Disney World"));
});

test("v1.18.2: the infant passport line is visible in prep and as the baby's packing row", () => {
  assert.ok(hasChildUnder(2, { members: cancunMembers }));
  const input = cancunInput();
  const place = { id: 1, name: "Cancún", country: "Mexico", countryCode: "MX", lat: 21.16, lon: -86.85, timezone: "America/Cancun" };
  const wx = {
    days: Array.from({ length: 8 }, (_, i) => ({
      date: `2027-03-${String(20 + i).padStart(2, "0")}`, tmax: 29, tmin: 23, precipProb: 33, precipMm: 0, summary: "Usually dry", typical: true,
    })),
    source: "typical", note: "Typical", stats: { avgHigh: 29, avgLow: 23, rainyDays: 0, snowDays: 0 },
  } as any;
  const pk = packing(input as any, wx, place as any, 7, false, { name: "Detroit", countryCode: "US" } as any);
  const infantRow = packingItems(pk).find(i => i.owner === "traveler-5" && /passport/i.test(i.item));
  assert.ok(infantRow, packingItems(pk).filter(i => i.owner === "traveler-5").map(i => i.item).join(" | "));
  assert.match(infantRow!.item, /Passport · Infant needs their own/);

  // Recreate the live generate shape: members stripped from input, kept on packing.settings.
  const plan: any = {
    input: { ...input, members: undefined },
    packing: pk,
    place,
    weather: wx,
    trip: { domestic: false, home: { name: "Detroit", countryCode: "US" } },
    itinerary: [],
    timeline: [],
  };
  const prep = defaultPrep(plan);
  assert.ok(prep.some(t => t.task === INFANT_PASSPORT_TASK), prep.map(t => t.task).join("\n"));

  const T = (s: string) => s;
  const packingHtml = renderToStaticMarkup(<PackingWorkspace plan={{ ...plan, input }} readOnly={false} onChange={() => {}} T={T} simple />);
  const detailedHtml = renderToStaticMarkup(<PackingWorkspace plan={{ ...plan, input }} readOnly={false} onChange={() => {}} T={T} simple={false} />);
  assert.ok(/Passport · Infant needs their own/.test(packingHtml) || /Passport · Infant needs their own/.test(detailedHtml), "passport row missing from packing DOM");

  const prepHtml = renderToStaticMarkup(
    <div data-testid="prep-list">
      {groupPrepTasks(prep).map(g => (
        <div key={g.when} data-testid={`prep-group-${g.when}`}>
          {g.items.map(t => <div key={t.id} data-testid="prep-item"><span>{T(t.task)}</span></div>)}
        </div>
      ))}
    </div>,
  );
  assert.match(prepHtml, /Baby needs their own passport \(grown-up task\)/);
  assert.match(prepHtml, /data-testid="prep-item"/);
});

test("v1.18.2: day notes cap at 3, safety first, with one merged optional trip line", () => {
  const notes = optionalFarInterestNotes("pyramids", { name: "Cancún", countryCode: "MX" }, true);
  assert.equal(notes.length, 1);
  assert.equal(notes[0], "Optional big day trip: Chichén Itzá (~2.5 h by bus) or Tulum (~2 h) — a grown-up decides");
  const long = [
    "Swim where lifeguards are and check the beach flags",
    "Optional big day trip: Chichén Itzá (~2.5 h by bus) or Tulum (~2 h) — a grown-up decides",
    "Plan a nap break",
    "with kids — keep the day light",
    "A comfortable pace and the usual medicines",
  ].join(" · ");
  const capped = capDayNotes(long, 3);
  const parts = capped.split(" · ");
  assert.equal(parts.length, 3, capped);
  assert.match(parts[0], /beach flags|lifeguards/);
  assert.match(parts[1], /Optional big day trip: Chichén Itzá/);
  assert.ok(!/keep the day light/.test(capped) || !/usual medicines/.test(capped));
});

test("v1.18.2: infant and under-7 trips drop fine dining from dinner slots", () => {
  assert.ok(isFineDining("Le Coq Au Vin"));
  assert.ok(isFineDining({ name: "Kres Chophouse" }));
  assert.ok(!isFineDining({ name: "The Polite Pig", tag: "restaurant" }));
  const list = familyDinnerList([
    { name: "Le Coq Au Vin", tag: "french" },
    { name: "Kres Chophouse", tag: "steakhouse" },
    { name: "The Polite Pig", tag: "restaurant" },
  ], true);
  assert.deepEqual(list.map(e => e.name), ["The Polite Pig"]);

  const inp = {
    destination: "Orlando",
    start: "2026-12-20",
    end: "2026-12-27",
    travelers: 5,
    purpose: "Family",
    style: "Mix" as const,
    members: cancunMembers,
    interests: "Disney World",
  };
  const wx = {
    days: Array.from({ length: 8 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 11, 20 + i)).toISOString().slice(0, 10),
      tmax: 24, tmin: 14, precipProb: 20, precipMm: 0, summary: "Usually dry", typical: true,
    })),
    source: "typical", stats: { avgHigh: 24, avgLow: 14, rainyDays: 0, snowDays: 0 },
  } as any;
  const eats = [
    { name: "Le Coq Au Vin", tag: "french" },
    { name: "Kres Chophouse", tag: "steakhouse" },
    { name: "The Polite Pig", tag: "restaurant" },
  ];
  const days = itinerary(inp as any, wx, [], eats as any, [], { domestic: true, travelMode: "driving", destName: "Orlando", countryCode: "US" });
  const evenings = days.map(d => d.evening).join("\n");
  assert.ok(!/Le Coq Au Vin|Kres Chophouse/i.test(evenings), evenings);
  assert.match(evenings, /Polite Pig|Casual family dinner/i);
});
