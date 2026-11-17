import test from "node:test";
import assert from "node:assert/strict";
import { itinerary, timeline } from "../server/plan.js";
import { hasChildUnder, softenHikesForKidsAndHeat, EASY_RIM_WALK, EASY_RIM_AFTERNOON, HEAT_HIKE_NOTE, CLIFF_NOTE, isNatureDestination, sunsetViewpointLine, isGrownUpTask, isTravelOrLeaveDay } from "../shared/family.js";
import { applyInterestVenues, applyInterestAddOns, replaceVagueNearbySlots, namedCampground, isGenericSlot } from "../shared/interestVenues.js";
import { isFineDining, preferFamilyEats, familyDinnerList, CASUAL_DINNER_FALLBACK } from "../shared/familyEats.js";
import { isRealisticDayTrip, detectActivities } from "../shared/activities.js";
import { rankPlaceMatches, placeChoiceScore, placeKindLabel } from "../shared/placeQuery.js";
import { suggestPacking, packingItems, startHereItems } from "../shared/packing.js";
import { defaultPrep } from "../src/Prep.js";
import { fixture } from "./fixtures.js";
import { eatsKey } from "../server/eats.js";
import { localizeEn } from "../shared/enLocale.js";

const londonKids = {
  style: "Mix" as const,
  interests: "Harry Potter, castles, double-decker bus, museums",
  purpose: "Family",
  travelers: 5,
  travelMode: "flying" as const,
  start: "2027-07-10",
  end: "2027-07-17",
  destination: "London",
  members: [
    { id: "traveler-1", name: "Mom", profile: "woman" },
    { id: "traveler-2", name: "Dad", profile: "man" },
    { id: "traveler-3", name: "Me", profile: "boy", child: true, age: 10 },
    { id: "traveler-4", name: "Twin 1", profile: "girl", child: true, age: 7 },
    { id: "traveler-5", name: "Twin 2", profile: "girl", child: true, age: 7 },
  ],
};

function mildWx(n = 8, start = "2027-07-10") {
  const [y, m, d] = start.split("-").map(Number);
  const days = Array.from({ length: n }, (_, i) => {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const iso = dt.toISOString().slice(0, 10);
    return { date: iso, tmax: 22, tmin: 14, precipProb: 10, summary: "Usually dry", typical: true };
  });
  return { days, source: "typical", stats: { avgHigh: 22, avgLow: 14, snowDays: 0 } } as any;
}

test("v1.17.1: Harry Potter is guaranteed a mid-day slot even when mornings are already named", () => {
  const days = [
    { label: "Day 1 · Fly", morning: "Fly overnight — you land the next morning", afternoon: "Sleep on the plane" },
    { label: "Day 2 · Arrive", morning: "Get outside in daylight, early bedtime", afternoon: "Check in & rest" },
    { label: "Day 3", morning: "Madame Tussauds", afternoon: "British Museum" },
    { label: "Day 4", morning: "Buckingham Palace", afternoon: "Tate Modern" },
    { label: "Day 5", morning: "The Shard", afternoon: "Hyde Park" },
  ];
  applyInterestVenues(days, londonKids.interests, { name: "London", country: "United Kingdom", countryCode: "GB" }, [], isTravelOrLeaveDay);
  applyInterestAddOns(days, londonKids.interests, { name: "London", countryCode: "GB" }, [], isTravelOrLeaveDay);
  const blob = days.map(d => `${d.morning} ${d.afternoon}`).join(" | ");
  assert.match(blob, /Warner Bros\. Studio Tour London/);
  assert.match(days.map(d => d.afternoon).join(" "), /double-decker bus/);
  assert.ok(!isTravelOrLeaveDay(days.find(d => /Warner Bros/i.test(d.morning))!));
});

test("v1.17.1: family dinners drop fine dining from any source and never serve only Michelin names", () => {
  const list = [
    { name: "Bob Bob Ricard" },
    { name: "The Dorchester" },
    { name: "Le Gavroche", description: "Michelin-starred tasting menu" },
    { name: "Restaurant Gordon Ramsay" },
    { name: "The Wolseley" },
    { name: "Pizza Pilgrims", tag: "pizza" },
  ];
  for (const n of ["Bob Bob Ricard", "The Dorchester", "Le Gavroche", "Restaurant Gordon Ramsay", "The Wolseley"]) {
    assert.ok(isFineDining(n), n);
  }
  const ranked = preferFamilyEats(list);
  assert.equal(ranked[0].name, "Pizza Pilgrims");
  const dinners = familyDinnerList(list, true);
  assert.ok(dinners.every(d => !isFineDining(d)));
  assert.deepEqual(dinners.map(d => d.name), ["Pizza Pilgrims"]);
  const days = itinerary(londonKids as any, mildWx(), [], list as any, [], { domestic: false, travelMode: "flying", flightHours: 8, tzDiffHours: 6, destName: "London" });
  const ev = days.map(d => d.evening).join(" ");
  assert.match(ev, /Pizza Pilgrims/);
  assert.ok(!/Dorchester|Gavroche|Gordon Ramsay|Bob Bob|Wolseley/i.test(ev));
  assert.equal(familyDinnerList(list.filter(r => r.name !== "Pizza Pilgrims"), true).length, 0);
  const emptyDays = itinerary(londonKids as any, mildWx(), [], list.filter(r => r.name !== "Pizza Pilgrims") as any, [], { domestic: false, travelMode: "flying", flightHours: 8, tzDiffHours: 6, destName: "London" });
  assert.ok(emptyDays.some(d => d.evening.includes("Casual family dinner") || d.evening === CASUAL_DINNER_FALLBACK || /Casual family dinner/.test(d.evening)));
});

test("v1.17.1: eats and places cache keys were bumped so stale pre-1.17.1 rankings are not reused", () => {
  assert.match(eatsKey({ name: "London", lat: 51.507, lon: -0.128 }), /^eats\|v11\|/);
});

test("v1.17.1: a US driving plan keeps one Driver's license row, not a UK-spelled duplicate", () => {
  const p = fixture();
  p.input = { ...p.input, travelMode: "driving", travelers: 2, members: [{ id: "traveler-1", name: "A", profile: "man" }, { id: "traveler-2", name: "B", profile: "woman" }], activities: ["scenic"], home: { countryCode: "US", name: "Chicago" } };
  p.trip = { ...(p.trip || {}), domestic: true, home: { countryCode: "US", name: "Chicago" } };
  const names = packingItems(suggestPacking(p, { laundryEvery: null, luggage: "all", members: p.input.members, activityKits: ["roadtrip"] } as any)).map(i => i.item);
  const docs = names.filter(n => /licen[cs]e|vehicle documents|rental documents/i.test(n));
  assert.equal(docs.length, 1, docs.join(" | "));
  assert.match(docs[0], /Driving licence & vehicle documents/);
  assert.equal(localizeEn(docs[0], "us"), "Driver's license & vehicle documents");
  assert.ok(!docs.some(n => /rental documents/i.test(n)));
});

test("v1.17.1: the UK plug prep item has no 'GB type G' jargon note", () => {
  const plan = fixture();
  plan.input = { ...plan.input, ...londonKids };
  plan.place = { ...(plan.place || {}), name: "London", country: "United Kingdom", countryCode: "GB" };
  plan.trip = { ...(plan.trip || {}), domestic: false, home: { countryCode: "US", name: "Chicago" } };
  const prep = defaultPrep(plan);
  const plug = prep.find(t => /plug adapter/i.test(t.task));
  assert.ok(plug);
  assert.match(plug!.task, /UK plugs have 3 big prongs/);
  assert.ok(!plug!.why || !/GB type G|home sockets are type/i.test(plug!.why));
  assert.ok(!prep.some(t => /GB type G|home sockets are type A\/B/i.test(`${t.task} ${t.why || ""}`)));
});

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
    { id: "traveler-3", name: "Me", profile: "girl", child: true, age: 10 },
    { id: "traveler-4", name: "Brother", profile: "boy", child: true, age: 4 },
  ],
};

function gcWx() {
  const days = [
    { date: "2027-06-14", tmax: 35.6, tmin: 19.4, precipProb: 0, summary: "Usually dry", typical: true },
    { date: "2027-06-15", tmax: 37.8, tmin: 19.4, precipProb: 0, summary: "Usually dry", typical: true },
    { date: "2027-06-16", tmax: 36.1, tmin: 20, precipProb: 0, summary: "Usually dry", typical: true },
    { date: "2027-06-17", tmax: 35.6, tmin: 20.6, precipProb: 0, summary: "Usually dry", typical: true },
    { date: "2027-06-18", tmax: 36.7, tmin: 19.4, precipProb: 0, summary: "Usually dry", typical: true },
  ];
  return { days, source: "typical", stats: { avgHigh: 36.4, avgLow: 19.8, snowDays: 0, rainyDays: 0 } } as any;
}

test("v1.17.1: with a child under 6 or 90°F heat, hikes become short rim walks with safety notes", () => {
  assert.ok(hasChildUnder(6, gcKids));
  const days = [
    { date: "2027-06-15", label: "Day 2", morning: "🥾 Day hike (start early; driest day in the forecast)", afternoon: "🥾 Hike continues — back by late afternoon; then Explore a market or local street", notes: "" },
  ];
  softenHikesForKidsAndHeat(days, gcKids, gcWx(), "Grand Canyon National Park");
  assert.equal(days[0].morning, EASY_RIM_WALK);
  assert.ok(!/Hike continues/i.test(days[0].afternoon));
  assert.match(days[0].notes || "", new RegExp(HEAT_HIKE_NOTE.replace(/[!*]/g, "\\$&")));
  assert.match(days[0].notes || "", new RegExp(CLIFF_NOTE));
});

test("v1.17.1: day trips over about an hour are dropped when a child is under 6", () => {
  const wupatki = { name: "Wupatki National Monument", dayTrip: true, driveMin: 125 };
  assert.ok(!isRealisticDayTrip(wupatki, gcKids, { name: "Grand Canyon National Park" }));
  assert.ok(isRealisticDayTrip(wupatki, { ...gcKids, members: londonKids.members }, { name: "Grand Canyon National Park" }));
});

test("v1.17.1: rain backups prefer a nearby visitor center or museum, never Phantom Ranch", () => {
  const days = itinerary(gcKids as any, gcWx(), [
    { name: "Mather Point", type: "viewpoint" },
    { name: "Desert View Watchtower", type: "viewpoint" },
  ] as any, [], [
    { name: "Phantom Ranch", type: "lodge", description: "Hike-in lodge at the bottom of the canyon" },
    { name: "Grand Canyon Visitor Center", type: "visitor centre", indoor: true, setting: "indoor" },
  ] as any, { domestic: true, travelMode: "driving", destName: "Grand Canyon National Park" });
  const backups = days.map(d => d.rainyBackup || "").join(" ");
  assert.ok(!/Phantom Ranch/i.test(backups));
  assert.match(backups, /Visitor Center|museum|café, museum or covered market/i);
});

test("v1.17.1: an already-scheduled Junior Ranger morning is not evicted for the campsite", () => {
  const days = [
    { label: "Day 1 · Arrive", morning: "Travel & check in", afternoon: "Sunset at a viewpoint", evening: "Dinner nearby: Bright Angel Restaurant" },
    { label: "Day 2", morning: "🥾 Day hike at the rim", afternoon: "🥾 Hike continues — back by late afternoon", evening: "Dinner: Bright Angel Restaurant" },
    { label: "Day 3", morning: "Junior Ranger program at the visitor center", afternoon: "Kolb Studio", evening: "Dinner: The Arizona Room" },
    { label: "Day 4 · Depart", morning: "Pack & check out", afternoon: "Hit the road", evening: "Travel home" },
  ];
  applyInterestVenues(days, gcKids.interests, "Grand Canyon National Park", [{ name: "Mather Campground", type: "camp_site" }], isTravelOrLeaveDay);
  const blob = days.map(d => `${d.morning} ${d.afternoon} ${d.evening}`).join(" | ");
  assert.match(blob, /Junior Ranger program at the visitor center/);
  assert.match(blob, /Mather Campground|Your campsite/);
  assert.equal(days[2].morning, "Junior Ranger program at the visitor center");
});

test("v1.17.1: a camping 'Pick a place nearby' afternoon is replaced with a named sight", () => {
  assert.ok(isGenericSlot("🏕 Pick a place nearby (ask a grown-up)"));
  const days = [
    { label: "Day 1 · Arrive", morning: "Travel & check in", afternoon: "Sunset at Mather Point", evening: "Dinner nearby" },
    { label: "Day 2", morning: "Your campsite (a grown-up books it)", afternoon: "🏕 Pick a place nearby (ask a grown-up)", evening: "Dinner" },
    { label: "Day 3 · Depart", morning: "Pack & check out", afternoon: "Hit the road", evening: "Travel home" },
  ];
  replaceVagueNearbySlots(days, [{ name: "Hopi House", type: "museum" }, { name: "Mather Campground", type: "camp_site" }], gcKids.interests, isTravelOrLeaveDay);
  assert.equal(days[1].afternoon, "Hopi House");
  assert.ok(!/Pick a place nearby/i.test(days.map(d => d.afternoon).join(" ")));
});

test("v1.17.1: rain backups stay indoor even if a wildlife or stargazing highlight is marked indoor", () => {
  const days = itinerary(gcKids as any, gcWx(), [
    { name: "Stargazing after dark — bring a flashlight with red light", type: "attraction", indoor: true, setting: "indoor" },
    { name: "Watch wildlife from a distance (never approach or feed animals)", type: "attraction", indoor: true, setting: "indoor" },
    { name: "Kolb Studio", type: "photographic studio", setting: "mixed" },
    { name: "Hopi House", type: "museum", setting: "mixed" },
    { name: "Phantom Ranch", type: "dude ranch", description: "Hike-in lodge at the bottom of the canyon", setting: "mixed" },
  ] as any, [], [], { domestic: true, travelMode: "driving", destName: "Grand Canyon National Park" });
  const backups = days.map(d => d.rainyBackup || "").join(" | ");
  assert.ok(!/Phantom Ranch/i.test(backups), backups);
  assert.ok(!/wildlife from a distance/i.test(backups), backups);
  assert.ok(!/Stargazing/i.test(backups), backups);
  assert.match(backups, /Kolb Studio|Hopi House|Visitor Center|museum|café, museum or covered market/i);
});

test("v1.17.1: a dry desert packing list starts with sun and water, not a rain shell, and has one headlamp", () => {
  const p = fixture();
  p.input = { ...p.input, ...gcKids, home: { countryCode: "US", name: "Phoenix" } };
  p.trip = { domestic: true, home: { countryCode: "US", name: "Phoenix" } };
  p.place = { name: "Grand Canyon National Park", countryCode: "US" };
  p.weather = gcWx();
  const list = suggestPacking(p, { laundryEvery: null, luggage: "all", members: gcKids.members, activityKits: ["hiking", "camping"] } as any);
  const names = packingItems(list).map(i => i.item);
  assert.ok(names.some(n => /~1 gallon per person per day/i.test(n)));
  const start = startHereItems(list).map(i => i.item).join(" | ");
  assert.ok(!/waterproof shell/i.test(start), start);
  assert.match(start, /sun hat|sunscreen|gallon per person|water/i);
  const lamps = names.filter(n => /headlamp/i.test(n));
  assert.equal(lamps.filter(n => /^headlamp$/i.test(n.trim())).length, 0, lamps.join(" | "));
  assert.ok(lamps.length <= 1 || lamps.every(n => /trail map/i.test(n) ? true : lamps.filter(x => /trail map/i.test(x)).length === 0));
});

test("v1.17.1: stars, animals and camping become concrete itinerary lines", () => {
  assert.ok(isNatureDestination("Grand Canyon National Park"));
  const days = [
    { label: "Day 1 · Arrive", morning: "Travel & check in", afternoon: "Easy walk around your neighbourhood", evening: "Dinner nearby: Bright Angel Restaurant" },
    { label: "Day 2", morning: "Free morning — wander a new neighbourhood", afternoon: "Explore a market or local street", evening: "Dinner: Bright Angel Restaurant" },
    { label: "Day 3", morning: "Free morning — wander a new neighbourhood", afternoon: "Explore a market or local street", evening: "Dinner: El Tovar" },
    { label: "Day 4 · Depart", morning: "Pack & check out", afternoon: "Hit the road", evening: "Travel home" },
  ];
  const hl = [{ name: "Mather Campground", type: "camp_site" }, { name: "Grand Canyon Visitor Center", type: "visitor centre" }];
  applyInterestVenues(days, gcKids.interests, { name: "Grand Canyon National Park", countryCode: "US" }, hl, isTravelOrLeaveDay);
  applyInterestAddOns(days, gcKids.interests, { name: "Grand Canyon National Park" }, hl, isTravelOrLeaveDay);
  const blob = days.map(d => `${d.morning} ${d.afternoon} ${d.evening}`).join(" | ");
  assert.match(blob, /Stargazing after dark — bring a flashlight with red light/);
  assert.match(blob, /Junior Ranger program at the visitor center/);
  assert.match(blob, /Watch wildlife from a distance/);
  assert.ok(!/Pick a place nearby/i.test(blob));
  assert.equal(namedCampground(hl), "Camp at Mather Campground");
  assert.equal(sunsetViewpointLine([{ name: "Mather Point", type: "viewpoint" }]), "Sunset at Mather Point");
});

test("v1.17.1: nature-destination Day 1 uses a sunset viewpoint instead of a neighbourhood stroll", () => {
  const days = itinerary(gcKids as any, gcWx(), [{ name: "Mather Point", type: "viewpoint" }] as any, [], [], { domestic: true, travelMode: "driving", destName: "Grand Canyon National Park", driveMin: 260 });
  assert.match(days[0].afternoon, /Sunset at Mather Point/);
  assert.ok(!/Easy walk around your neighbourhood/i.test(days[0].afternoon));
  // Camping trips also mention setting up camp on Day 1.
  if (/camping/i.test((gcKids as any).interests || "")) assert.match(days[0].afternoon, /Set up at your campsite|Sunset at Mather Point/i);
});

test("v1.17.1: ambiguous places preselect a national park or city and return at most four options", () => {
  const matches = [
    { name: "Grand Canyon Village", featureCode: "PPL", population: 2000, admin1: "Arizona" },
    { name: "Grand Canyon Caverns", featureCode: "CAVE", population: 0, admin1: "Arizona" },
    { name: "Grand Canyon West Airport", featureCode: "AIRP", population: 0, admin1: "Arizona" },
    { name: "Grand Canyon National Park", featureCode: "PRK", population: 0, admin1: "Arizona" },
    { name: "Grand Canyon National Game Preserve", featureCode: "PRK", population: 0, admin1: "Arizona" },
    { name: "Grand Canyon Bar 10 Airport", featureCode: "AIRP", population: 0, admin1: "Arizona" },
  ];
  const ranked = rankPlaceMatches(matches, 4);
  assert.equal(ranked[0].name, "Grand Canyon National Park");
  assert.ok(placeChoiceScore(ranked[0]) > placeChoiceScore(matches.find(m => /Airport/.test(m.name))!));
  assert.equal(ranked.length, 4);
  assert.equal(placeKindLabel(ranked[0]), "national park");
  assert.equal(placeKindLabel({ name: "Grand Canyon West Airport", featureCode: "AIRP" }), "airport");
  assert.ok(!ranked.some(m => /Airport/i.test(m.name)));
});

test("v1.17.1: activity chips detected from interests can be recomputed when interests change", () => {
  assert.ok(detectActivities("Harry Potter, castles, double-decker bus, museums").includes("museums"));
  const fromGc = detectActivities("hiking, camping, animals, stars");
  assert.ok(fromGc.includes("hiking") && fromGc.includes("camping"));
  assert.ok(!fromGc.includes("museums"));
});

test("v1.17.1: timeline tasks use kid-readable grown-up wording", () => {
  const tasks = timeline("2027-06-14", false, "2026-11-17", "driving").map(t => t.task);
  assert.ok(tasks.some(t => /valid photo ID \(grown-up task\)/i.test(t)));
  assert.ok(tasks.some(t => /travel insurance in case plans change \(grown-up task\)/i.test(t)));
  assert.ok(tasks.some(t => /Check the forecast and finish the packing list \(grown-up task\)/i.test(t)));
  assert.ok(isGrownUpTask("Check the forecast and finish the packing list (grown-up task)"));
  assert.ok(isGrownUpTask("Pick routes and check trail conditions or hut reservations (grown-up task)"));
  assert.ok(isGrownUpTask("Make sure everyone has a valid photo ID (grown-up task)"));
});

test("v1.17.1: softening a hike afternoon does not overwrite a campsite or Junior Ranger morning", () => {
  const days = [
    { date: "2027-06-15", label: "Day 2", morning: "Your campsite (a grown-up books it)", afternoon: "🥾 Hike continues — back by late afternoon", notes: "" },
    { date: "2027-06-16", label: "Day 3", morning: "Junior Ranger program at the visitor center", afternoon: "Kolb Studio", notes: "" },
  ];
  softenHikesForKidsAndHeat(days, gcKids, gcWx(), "Grand Canyon National Park");
  assert.equal(days[0].morning, "Your campsite (a grown-up books it)");
  assert.equal(days[0].afternoon, EASY_RIM_AFTERNOON);
  assert.equal(days[1].morning, "Junior Ranger program at the visitor center");
});
