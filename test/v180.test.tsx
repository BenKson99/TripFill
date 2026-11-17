import test from "node:test";
import assert from "node:assert/strict";
import { itinerary } from "../server/plan.js";
import { hasChildUnder } from "../shared/family.js";
import {
  applyInterestVenues, applyInterestAddOns, assignUniqueRainBackups, curatedInterestVenues,
  optionalFarInterestNotes, isIndoorishBackup,
} from "../shared/interestVenues.js";
import { isTravelOrLeaveDay } from "../shared/family.js";
import { mentionedPlaceNames, placesUsedInDays, namesInText } from "../server/itineraryPlaces.js";
import { wetDaysSummary, maybeWetDay, isRainy } from "../shared/precip.js";
import { DEPART_FLY, departAfternoon } from "../shared/travel.js";
import { suggestPacking, packingItems, startHereItems, packingMembers, validatePacking, MAX_TRAVELER_AGE, PROFILES, PROFILE_LABELS } from "../shared/packing.js";
import { defaultPrep } from "../src/Prep.js";
import { editTraveler } from "../src/Travelers.js";
import { fixture } from "./fixtures.js";
import { runActivitySchedule } from "../server/activityItinerary.js";
import {
  isJunkSight, isJunkEat, isSportsBar, isNamelessFoodStall, isStreetFoodStall, filterDinnerList, namedIceCream,
} from "../shared/junkVenues.js";
import {
  tripAdviceNotes, currencyLine, kidPhrases, healthAdvice, preferredFamilyBeaches, hasSeniorTraveler,
  BEACH_SAFETY_NOTE, NAP_BREAK_NOTE, SENIOR_PACE_NOTE, CHICHEN_BABY_NOTE , DIAPERS_FLYING_ABROAD,
} from "../shared/travelAdvice.js";
import { plugsMatchHome } from "../shared/plugs.js";

const cancúnKids = {
  style: "Mix" as const,
  interests: "beach, swimming, snorkeling, pyramids, ice cream",
  purpose: "Family",
  travelers: 5,
  travelMode: "flying" as const,
  start: "2027-03-20",
  end: "2027-03-27",
  destination: "Cancún",
  members: [
    { id: "traveler-1", name: "Mom", profile: "woman" },
    { id: "traveler-2", name: "Dad", profile: "man" },
    { id: "traveler-3", name: "Girl", profile: "girl", child: true, age: 10 },
    { id: "traveler-4", name: "Grandma", profile: "woman", age: 68 },
    { id: "traveler-5", name: "Baby", profile: "infant", child: true, age: 1 },
  ],
};

const gcKids = {
  style: "Mix" as const,
  interests: "hiking, camping, animals, stars",
  purpose: "Family",
  travelers: 4,
  travelMode: "driving" as const,
  start: "2027-06-14",
  end: "2027-06-18",
  destination: "Grand Canyon National Park",
  members: [
    { id: "traveler-1", name: "Mom", profile: "woman" },
    { id: "traveler-2", name: "Dad", profile: "man" },
    { id: "traveler-3", name: "Girl", profile: "girl", child: true, age: 10 },
    { id: "traveler-4", name: "Boy", profile: "boy", child: true, age: 4 },
  ],
};

function gcWx() {
  const days = Array.from({ length: 5 }, (_, i) => {
    const dt = new Date(Date.UTC(2027, 5, 14 + i));
    return { date: dt.toISOString().slice(0, 10), tmax: 36, tmin: 12, precipProb: 0, precipMm: 0, summary: "Usually dry", typical: true };
  });
  return { days, source: "typical", stats: { avgHigh: 36, avgLow: 12, rainyDays: 0, snowDays: 0 }, elevationM: 2130 } as any;
}

function cancunWx() {
  const days = Array.from({ length: 8 }, (_, i) => {
    const dt = new Date(Date.UTC(2027, 2, 20 + i));
    return { date: dt.toISOString().slice(0, 10), tmax: 30, tmin: 23, precipProb: i === 3 || i === 6 ? 55 : 20, precipMm: i === 3 ? 4 : 0, summary: i === 3 ? "Rain" : "Partly cloudy", typical: true };
  });
  return { days, source: "typical", stats: { avgHigh: 30, avgLow: 23, rainyDays: 2, snowDays: 0 }, elevationM: 10 } as any;
}

const gcHl = [
  { name: "Mather Point", type: "viewpoint", setting: "outdoor", indoor: false, description: "A railed lookout.", source: "TripFill" },
  { name: "Walk the Rim Trail between Mather Point and Yavapai Point (flat, paved)", type: "trail", setting: "outdoor", indoor: false, description: "A short paved rim walk.", source: "TripFill" },
  { name: "Yavapai Geology Museum", type: "museum", setting: "indoor", indoor: true, description: "Geology exhibits.", source: "TripFill" },
  { name: "Grand Canyon Visitor Center", type: "visitor center", setting: "indoor", indoor: true, description: "Exhibits and info.", source: "TripFill" },
  { name: "Hopi House", type: "Historic trading post / boutique", setting: "mixed", indoor: false, description: "A historic rim building with craft displays.", source: "TripFill" },
  { name: "Kolb Studio", type: "studio", setting: "mixed", indoor: false, description: "Historic studio on the rim.", source: "TripFill" },
  { name: "Junior Ranger program at the visitor center", type: "activity", setting: "indoor", indoor: true, description: "Kids program.", source: "TripFill" },
] as any[];

test("v1.18: curated walks count contained place names as already used, without hole-punching titles", () => {
  const names = ["Mather Point", "Yavapai Point", "Yavapai Geology Museum", "Walk the Rim Trail between Mather Point and Yavapai Point (flat, paved)"];
  const walk = "Walk the Rim Trail between Mather Point and Yavapai Point (flat, paved)";
  const mentioned = mentionedPlaceNames(walk, names);
  assert.ok(mentioned.includes("Mather Point"));
  assert.ok(mentioned.includes("Yavapai Point"));
  // namesInText still prefers the longer title and does not emit the shorter names (no hole-punch).
  const longestFirst = [...names].sort((a, b) => b.length - a.length);
  assert.deepEqual(namesInText(walk, longestFirst), [walk]);
  const days = [
    { morning: "Travel & check in", afternoon: "Sunset at Mather Point", evening: "Dinner", rainyBackup: "", notes: "", date: "2027-06-14", label: "1", weather: "" },
    { morning: walk, afternoon: "Kolb Studio", evening: "Dinner", rainyBackup: "", notes: "", date: "2027-06-16", label: "3", weather: "" },
  ] as any;
  const used = placesUsedInDays(days, names.map(name => ({ name })));
  assert.ok([...used].some(n => n.toLowerCase() === "mather point"));
  assert.ok([...used].some(n => /yavapai point/i.test(n)));
});

test("v1.18: Grand Canyon schedule does not reuse Mather Point as a standalone hike after sunset or the rim walk", () => {
  const days = itinerary(gcKids as any, gcWx(), gcHl, [], gcHl.filter(h => h.indoor || h.setting === "mixed" || /hopi|kolb|visitor|museum/i.test(h.name)), {
    domestic: true, travelMode: "driving", destName: "Grand Canyon National Park", elevationM: 2130, driveMin: 220,
  });
  runActivitySchedule(days, gcKids as any, gcWx(), gcHl, ["hiking", "kids"] as any, "Grand Canyon National Park");
  const blob = days.map(d => `${d.morning} ${d.afternoon}`).join("\n");
  assert.match(blob, /Mather Point/);
  const standalone = days.filter(d => /^(?:🥾\s*)?Mather Point\s*$/i.test((d.morning || "").trim()) || /^(?:🥾\s*)?Mather Point\s*$/i.test((d.afternoon || "").trim()));
  const longer = days.filter(d => /Sunset at Mather Point|Rim Trail between Mather Point/i.test(`${d.morning} ${d.afternoon}`));
  assert.ok(longer.length >= 1, blob);
  assert.equal(standalone.length, 0, `standalone Mather still scheduled:\n${blob}`);
  const collisions = days.filter(d => {
    const named = (d.rainyBackup || "").replace(/^If it rains:\s*/i, "").replace(/^Rain likely — try\s*/i, "").trim();
    if (!named || /café, museum or covered market|visitor center or a nearby museum/i.test(named)) return false;
    return `${d.morning || ""} ${d.afternoon || ""}`.toLowerCase().includes(named.toLowerCase());
  });
  assert.equal(collisions.length, 0, collisions.map(d => `${d.label}: ${d.morning} / ${d.rainyBackup}`).join(" | "));
});

test("v1.18: rain backups are unique named indoor places when alternatives exist", () => {
  const days = [
    { morning: "Junior Ranger program at the visitor center", afternoon: "Rest in the shade", evening: "Dinner", rainyBackup: "If it rains: Yavapai Geology Museum", notes: "" },
    { morning: "Short easy walk", afternoon: "Rest in the shade", evening: "Dinner", rainyBackup: "If it rains: Yavapai Geology Museum", notes: "" },
    { morning: "Walk the Rim Trail between Mather Point and Yavapai Point (flat, paved)", afternoon: "Easy walk", evening: "Dinner", rainyBackup: "If it rains: café, museum or covered market", notes: "" },
  ] as any;
  assignUniqueRainBackups(days, gcHl, "Grand Canyon Visitor Center");
  const names = days.map((d: any) => d.rainyBackup);
  assert.ok(names.every((n: string) => !/café, museum or covered market/i.test(n)), names.join(" | "));
  const named = names.map((n: string) => n.replace(/^If it rains:\s*/i, "").toLowerCase());
  assert.equal(new Set(named).size, named.length, names.join(" | "));
  assert.ok(isIndoorishBackup({ name: "Hopi House", type: "Historic trading post / boutique", indoor: false, setting: "mixed" }));
});

test("v1.18: same-day rain backup falls back to a generic line when no unused indoor remains", () => {
  const days = [
    { morning: "Junior Ranger program at the visitor center", afternoon: "Desert View Watchtower", evening: "Dinner", rainyBackup: "If it rains: Yavapai Geology Museum", notes: "" },
    { morning: "Walk the Rim Trail between Mather Point and Yavapai Point (flat, paved)", afternoon: "Hopi House", evening: "Dinner", rainyBackup: "If it rains: Grand Canyon Visitor Center", notes: "" },
    { morning: "Kolb Studio", afternoon: "Watch wildlife from a distance", evening: "Dinner", rainyBackup: "If it rains: Kolb Studio", notes: "" },
  ] as any;
  assignUniqueRainBackups(days, gcHl, "Grand Canyon Visitor Center");
  assert.match(days[2].rainyBackup, /café, museum or covered market/i);
  assert.ok(!/If it rains: Kolb Studio/i.test(days[2].rainyBackup));
  const named = days.slice(0, 2).map((d: any) => d.rainyBackup.replace(/^If it rains:\s*/i, "").toLowerCase());
  assert.equal(new Set(named).size, 2, days.map((d: any) => d.rainyBackup).join(" | "));
});

test("v1.18: wet-day summary wording matches the rainy-days stat", () => {
  const dry = [{ precipProb: 33, precipMm: 0, typical: true, summary: "Sometimes wet" }];
  assert.ok(maybeWetDay(dry[0]));
  assert.ok(!isRainy(dry[0]));
  assert.equal(wetDaysSummary(dry).label, "usually dry");
  const wet = [{ precipProb: 60, precipMm: 5, typical: false, summary: "Rain" }, { precipProb: 10, typical: true }];
  assert.equal(wetDaysSummary(wet).label, "Wet days ~1");
});

test("v1.18: flying depart day heads to the airport, not the airport/station", () => {
  assert.equal(DEPART_FLY, "Last souvenir/coffee stop, then head to the airport");
  assert.equal(departAfternoon("flying"), DEPART_FLY);
  assert.match(departAfternoon("driving"), /car|drive|road/i);
  assert.ok(!/airport\/station/i.test(DEPART_FLY));
});

test("v1.18: pyramids and snorkeling near Cancún, with closer ruins when a baby is along", () => {
  assert.ok(hasChildUnder(6, cancúnKids));
  const dest = { name: "Cancún", country: "Mexico", countryCode: "MX" };
  const nearby = curatedInterestVenues(cancúnKids.interests, dest, { youngChild: true }).map(s => s.name).join("\n");
  assert.match(nearby, /El Rey|El Meco/i);
  assert.ok(!/Chichén Itzá/i.test(nearby), nearby);
  const notes = optionalFarInterestNotes(cancúnKids.interests, dest, true).join("\n");
  assert.match(notes, /Chichén Itzá/i);
  assert.match(notes, /about 2\.5 h each way by bus; a grown-up decides/i);
  assert.ok(!/\(ask a grown-up\)/i.test(notes), notes);
  assert.match(notes, new RegExp(CHICHEN_BABY_NOTE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const older = curatedInterestVenues("pyramids, snorkeling", dest).map(s => s.name).join("\n");
  assert.match(older, /Chichén Itzá/i);
  assert.match(older, /Tulum/i);
  const snorkel = curatedInterestVenues("snorkeling", dest).map(s => s.name).join("\n");
  assert.match(snorkel, /Puerto Morelos|Isla Mujeres|Playa Norte/i);
  const hawaii = curatedInterestVenues("snorkeling, beach", { name: "Honolulu" }).map(s => s.name).join("\n");
  assert.match(hawaii, /Hanauma|Waikiki/i);
});

test("v1.18: junk venues are never scheduled; family dinners abroad prefer sit-down places", () => {
  assert.ok(isJunkSight({ name: "Cinépolis Cancún", type: "cinema" }));
  assert.ok(isJunkSight({ name: "Cinemark Downtown", type: "cinema" }));
  assert.ok(isJunkSight({ name: "Teatro Cancún", type: "theatre" }));
  assert.ok(isJunkSight({ name: "Teatro de la Ciudad" }));
  assert.ok(isJunkEat({ name: "Food stall 12" }));
  assert.ok(isNamelessFoodStall("Food stall …"));
  assert.ok(isSportsBar({ name: "Champions Sports Bar" }));
  assert.ok(isStreetFoodStall({ name: "Street food stall", tag: "street food" }));
  const list = filterDinnerList([
    { name: "Food stall 3", tag: "street food" },
    { name: "La Fisheria", tag: "restaurant" },
    { name: "Bus station tacos", description: "At the bus station" },
    { name: "Monday Night Sports Bar", tag: "sports bar" },
  ], { kids: true, infant: true, senior: true, abroad: true });
  assert.deepEqual(list.map(e => e.name), ["La Fisheria"]);
  assert.equal(namedIceCream({ cafes: [{ name: "Heladería Santa Clara" }], restaurants: [] }), "Heladería Santa Clara");
});

test("v1.18: preferred Cancún beaches, health, money, phrases, and plugs", () => {
  const beaches = preferredFamilyBeaches("Cancún", "MX");
  assert.ok(beaches.some(b => /Langosta/i.test(b)));
  assert.ok(beaches.some(b => /Tortugas/i.test(b)));
  assert.ok(beaches.some(b => /Delfines/i.test(b)));
  const health = healthAdvice("MX", "Cancún");
  assert.match(health.tapWater || "", /bottled or filtered water in Mexico/i);
  assert.equal(health.mosquitoes, true);
  assert.match(health.foodSafety || "", /sit-down|skip ice/i);
  assert.match(currencyLine("MX") || "", /Mexican pesos \(MXN\)/i);
  assert.match(kidPhrases("es") || "", /Hola \(hello\).*Por favor \(please\).*Gracias \(thank you\).*helado.*baño/i);
  assert.equal(plugsMatchHome("US", ["MX"]), true);
  const notes = tripAdviceNotes({
    input: cancúnKids, place: { name: "Cancún", country: "Mexico", countryCode: "MX" }, homeCC: "US", domestic: false, members: cancúnKids.members,
  }).join("\n");
  assert.match(notes, /Mexican pesos/i);
  assert.match(notes, /bottled or filtered water in Mexico/i);
  assert.match(notes, /Same plugs as home/i);
  assert.match(notes, new RegExp(BEACH_SAFETY_NOTE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(notes, new RegExp(NAP_BREAK_NOTE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(notes, new RegExp(SENIOR_PACE_NOTE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(hasSeniorTraveler(cancúnKids));
});

test("v1.18: packing and prep for a Cancún flying family trip with a baby and a grandparent", () => {
  const p: any = fixture();
  p.input = { ...p.input, ...cancúnKids, home: { countryCode: "US", name: "Detroit" } };
  p.place = { name: "Cancún", country: "Mexico", countryCode: "MX", lat: 21.1619, lon: -86.8515 };
  p.trip = { domestic: false, home: { countryCode: "US", name: "Detroit" }, distanceKm: 1540 };
  p.weather = cancunWx();
  p.packing = suggestPacking(p, { members: cancúnKids.members } as any);
  const items = packingItems(p.packing).map(i => i.item).join("\n");
  assert.match(items, /Diapers \/ nappies \(~2 days in your carry-on; buy the rest there\)/);
  assert.match(items, /Reef-safe sunscreen/);
  assert.match(items, /Insect repellent/);
  assert.match(items, /Snorkel set/);
  assert.match(items, /Swim diapers/);
  assert.match(items, /Sun tent \/ shade/);
  assert.match(items, /rash guard/i);
  assert.match(items, /Light rain poncho|Same plugs as home/);
  assert.ok(!/Packable waterproof shell/i.test(items), items);
  assert.match(items, /Same plugs as home — no adapter needed/);
  const start = startHereItems(p.packing).map(i => i.item).join("\n");
  assert.ok(!/waterproof shell|rain shell/i.test(start), start);
  assert.match(start, /Diapers \/ nappies \(~2 days/);
  const prep = defaultPrep(p).map(t => t.task).join("\n");
  assert.match(prep, /Baby needs their own passport/);
  assert.match(prep, /consent letter/i);
  assert.match(prep, /Same plugs as home — no adapter needed/);
  assert.ok(!/plug adapter for/i.test(prep));
  const members = packingMembers({ members: cancúnKids.members }, 5);
  assert.equal(members.find(m => m.name === "Grandma")?.age, 68);
  validatePacking(p.packing);
});

test("v1.18: driving or remote trips still pack a full diaper count", () => {
  const p: any = fixture();
  p.input = { ...gcKids, home: { countryCode: "US", name: "Phoenix" }, members: [...gcKids.members, { id: "traveler-5", name: "Baby", profile: "infant", child: true, age: 1 }], travelers: 5 };
  p.place = { name: "Grand Canyon National Park", country: "United States", countryCode: "US", lat: 36.05, lon: -112.14 };
  p.trip = { domestic: true, home: { countryCode: "US", name: "Phoenix" } };
  p.weather = gcWx();
  const items = packingItems(suggestPacking(p, { members: p.input.members } as any)).map(i => i.item).join("\n");
  assert.match(items, /Diapers \/ nappies \(~8 a day/);
  assert.ok(!/2 days in your carry-on/i.test(items));
});

test("v1.18: Grandparent type and adult ages up to 120 are valid", () => {
  assert.ok(PROFILES.includes("grandparent"));
  assert.equal(PROFILE_LABELS.grandparent, "Grandparent");
  const rows = packingMembers({ members: [{ id: "traveler-1", name: "Gran", profile: "grandparent", age: 72 }] }, 1);
  assert.equal(rows[0].age, 72);
  const edited = editTraveler([{ id: "traveler-1", name: "Ada", profile: "woman" }], 1, "traveler-1", { age: 70 });
  assert.equal(edited[0].age, 70);
  assert.equal(MAX_TRAVELER_AGE, 120);
});

test("v1.18: a Cancún itinerary names family beaches or ruins, not a cinema, and adds advice notes", () => {
  const hl = [
    { name: "Cinépolis Cancún", type: "cinema", setting: "indoor", indoor: true, source: "osm", description: "Movies" },
    { name: "Playa Tortugas | Playa Ancha", type: "beach", setting: "outdoor", indoor: false, source: "osm", activity: "beach" },
    { name: "Playa Langosta", type: "beach", setting: "outdoor", indoor: false, source: "osm", activity: "beach" },
    { name: "Zona Arqueológica El Rey (Hotel Zone)", type: "ruins", setting: "outdoor", indoor: false, source: "wikidata" },
    { name: "Museo Maya de Cancún", type: "museum", setting: "indoor", indoor: true, source: "wikidata" },
  ] as any;
  const eats = { restaurants: [{ name: "La Fisheria", tag: "restaurant" }, { name: "Food stall 4" }, { name: "Champions Sports Bar", tag: "sports bar" }], cafes: [{ name: "Heladería Santa Clara" }] };
  const days = itinerary(cancúnKids as any, cancunWx(), hl, eats.restaurants as any, [hl[4]], {
    domestic: false, travelMode: "flying", destName: "Cancún", countryCode: "MX", flightHours: 4, tzDiffHours: 0,
  });
  runActivitySchedule(days, cancúnKids as any, cancunWx(), hl, ["beach", "kids"] as any, "Cancún", eats);
  const text = days.map(d => `${d.label}: ${d.morning} / ${d.afternoon} / ${d.evening} / ${d.rainyBackup || ""} / ${d.notes}`).join("\n");
  assert.ok(!/Cinépolis|Cinemark|Food stall/i.test(text), text);
  assert.ok(!/Sports Bar/i.test(text), text);
  assert.ok(!/Playa Tortugas \| Playa Ancha/i.test(text), text);
  assert.ok(/El Rey|El Meco|Langosta|Tortugas|Delfines|Puerto Morelos|Isla Mujeres|Ice cream|Heladería/i.test(text), text);
  assert.match(text, /head to the airport/);
  assert.ok(!/airport\/station/i.test(text));
  const mid = days.filter(d => !isTravelOrLeaveDay(d));
  assert.ok(mid.some(d => /lifeguards|beach flag/i.test(d.notes || "")), text);
  assert.ok(mid.some(d => /nap break back at the hotel/i.test(d.notes || "")), text);
  assert.ok(mid.some(d => /comfortable pace|shade and a place to sit/i.test(d.notes || "")), text);
});
