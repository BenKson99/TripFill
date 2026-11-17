import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { itinerary, timeline, packing } from "../server/plan.js";
import {
  isFullOrHalfDayAttraction, isBigSight, isLightActivity, hasChildUnder,
  paceItineraryForKids, altitudeNote, splitAddOns, KIDS_POOL_REST,
} from "../shared/family.js";
import { applyInterestVenues, applyInterestAddOns } from "../shared/interestVenues.js";
import { isTravelOrLeaveDay } from "../shared/family.js";
import { whatToWear } from "../shared/wear.js";
import { itineraryPrecipCopy } from "../shared/precip.js";
import {
  isDestinationItself, isLodgingOrStay, isVagueSight, isNearBase, curatedParkSights,
  visitorCenterName, campsiteSetupLine, isHikeInOrInnerCanyon, isOffParkBase, preferredParkBase,
} from "../shared/nationalParks.js";
import { highlightReason, highlightCaveat } from "../shared/familyPlaces.js";
import { localizeEn } from "../shared/enLocale.js";
import { suggestPacking, packingItems, startHereItems } from "../shared/packing.js";
import { defaultPrep } from "../src/Prep.js";
import { PackingWorkspace } from "../src/Packing.js";
import { fixture } from "./fixtures.js";
import { runActivitySchedule } from "../server/activityItinerary.js";

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

function mildWx(n = 8, start = "2027-07-10") {
  const [y, m, d] = start.split("-").map(Number);
  const days = Array.from({ length: n }, (_, i) => {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    return { date: dt.toISOString().slice(0, 10), tmax: 22, tmin: 14, precipProb: i === 5 ? 70 : 10, precipMm: i === 5 ? 6 : 0, summary: i === 5 ? "Rain" : "Usually dry", typical: true };
  });
  return { days, source: "typical", stats: { avgHigh: 22, avgLow: 14, snowDays: 0 }, elevationM: 11 } as any;
}

function gcWx() {
  const start = "2027-06-14";
  const [y, m, d] = start.split("-").map(Number);
  const days = Array.from({ length: 5 }, (_, i) => {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    return { date: dt.toISOString().slice(0, 10), tmax: 36, tmin: 12, precipProb: 0, precipMm: 0, summary: "Usually dry", typical: true };
  });
  return { days, source: "typical", stats: { avgHigh: 36, avgLow: 12, snowDays: 0 }, elevationM: 2130 } as any;
}

test("v1.17.2: a half-day attraction is not stacked with several afternoon add-ons", () => {
  assert.ok(isFullOrHalfDayAttraction("Warner Bros. Studio Tour London (book ahead)"));
  assert.ok(isFullOrHalfDayAttraction("Windsor Castle"));
  assert.ok(isBigSight("Tower of London"));
  assert.ok(isBigSight("Victoria and Albert Museum"));
  assert.ok(isLightActivity("Ride a red double-decker bus (route 11 or 15 passes the big sights)"));
  assert.ok(isLightActivity("Platform 9¾ at King's Cross"));
  assert.ok(hasChildUnder(8, londonKids));

  const days = [
    { label: "Day 1 · Fly", morning: "Fly overnight — you land the next morning", afternoon: "Sleep on the plane", evening: "Overnight on the plane", notes: "" },
    { label: "Day 2 · Arrive", morning: "Get outside in daylight, early bedtime", afternoon: "Check in & rest — keep today light", evening: "Dinner nearby", notes: "" },
    { label: "Day 3", morning: "Madame Tussauds", afternoon: "British Museum", evening: "Dinner", notes: "" },
    { label: "Day 4", morning: "Buckingham Palace", afternoon: "Hyde Park", evening: "Dinner", notes: "" },
    { label: "Day 5", morning: "The Shard", afternoon: "Explore a market or local street", evening: "Dinner", notes: "" },
    { label: "Day 6", morning: "Kensington Palace", afternoon: "Explore a market or local street", evening: "Dinner", notes: "" },
    { label: "Day 7", morning: "Natural History Museum", afternoon: "Explore a market or local street", evening: "Dinner", notes: "" },
    { label: "Day 8 · Depart", morning: "Pack & check out", afternoon: "Head to the airport", evening: "Travel home", notes: "" },
  ];
  applyInterestVenues(days, londonKids.interests, { name: "London", countryCode: "GB" }, [], isTravelOrLeaveDay);
  applyInterestAddOns(days, londonKids.interests, { name: "London", countryCode: "GB" }, [], isTravelOrLeaveDay, { maxAddOns: 1 });
  paceItineraryForKids(days, londonKids, [{ name: "St. James's Park", type: "park" }, { name: "Hyde Park", type: "park" }]);
  const wb = days.find(d => /Warner Bros/i.test(d.morning))!;
  assert.ok(wb);
  const wbAdds = splitAddOns(wb.afternoon);
  assert.ok(wbAdds.length <= 1, wb.afternoon);
  assert.ok(isLightActivity(wb.afternoon) || /pool|rest/i.test(wb.afternoon), wb.afternoon);
  const all = days.map(d => `${d.morning} ${d.afternoon}`).join(" | ");
  assert.match(all, /double-decker bus/);
  assert.match(all, /Platform 9/);
  // Not all stacked on the WB day.
  assert.ok(!/Platform 9/.test(wb.afternoon) || !/double-decker/.test(wb.afternoon));
  for (const d of days.filter(d => !isTravelOrLeaveDay(d))) {
    assert.ok(splitAddOns(d.afternoon).length <= 1, d.afternoon);
    if (isFullOrHalfDayAttraction(d.morning) && isBigSight(d.afternoon) && !isLightActivity(d.afternoon)) {
      assert.fail(`heavy+heavy: ${d.morning} / ${d.afternoon}`);
    }
    if (isBigSight(d.morning) && isBigSight(d.afternoon) && !isLightActivity(d.afternoon)) {
      assert.fail(`two big sights: ${d.morning} / ${d.afternoon}`);
    }
    assert.ok(!/one main attraction per day/.test(d.notes || "") || isRestSlotish(d.afternoon) || splitAddOns(d.afternoon).length === 0, d.notes + " / " + d.afternoon);
  }
});

function isRestSlotish(text: string) {
  return /pool|quiet rest|rest in the shade|keep today light/i.test(text);
}

test("v1.17.2: Windsor or the Tower is paired with a light outdoor stop, not another big museum", () => {
  const days = [
    { label: "Day 1 · Arrive", morning: "Travel & check in", afternoon: "Easy walk around your neighbourhood", evening: "Dinner", notes: "" },
    { label: "Day 2", morning: "Tower of London", afternoon: "Palace of Whitehall", evening: "Dinner", notes: "with kids — one main attraction per day" },
    { label: "Day 3", morning: "Windsor Castle", afternoon: "Victoria and Albert Museum", evening: "Dinner", notes: "with kids — one main attraction per day" },
    { label: "Day 4 · Depart", morning: "Pack & check out", afternoon: "Airport", evening: "Travel home", notes: "" },
  ];
  paceItineraryForKids(days, londonKids, [{ name: "St. James's Park", type: "park" }, { name: "Hyde Park", type: "park" }]);
  assert.ok(!/Palace of Whitehall/i.test(days[1].afternoon));
  assert.ok(!/Victoria and Albert/i.test(days[2].afternoon));
  assert.match(days[1].afternoon, /Park|playground|pool|rest/i);
  assert.match(days[2].afternoon, /Park|playground|pool|rest/i);
  assert.ok(!/one main attraction per day/.test(days[1].notes) || /short add-on|lighter|half-day/i.test(days[1].notes) || /pool|rest|Park/i.test(days[1].afternoon));
  assert.match(days[1].notes, /short add-on|lighter|one main attraction per day|keep the day light|half-day/i);
});

test("v1.17.2: a Rain likely backup names an indoor place when one exists", () => {
  assert.match(itineraryPrecipCopy("rain", false, "British Library"), /British Library/);
  const days = itinerary(londonKids as any, mildWx(), [
    { name: "Tower of London", type: "castle", setting: "outdoor" },
    { name: "British Library", type: "library", indoor: true, setting: "indoor" },
    { name: "National Gallery", type: "museum", indoor: true, setting: "indoor" },
  ] as any, [], [], { domestic: false, travelMode: "flying", flightHours: 8, tzDiffHours: 6, destName: "London" });
  const rainy = days.filter(d => /Rain likely/i.test(d.rainyBackup || ""));
  assert.ok(rainy.length >= 1, days.map(d => d.rainyBackup).join(" | "));
  assert.ok(rainy.some(d => /British Library|National Gallery|museum|library/i.test(d.rainyBackup || "")), rainy.map(d => d.rainyBackup).join(" | "));
});

test("v1.17.2: a rendered US plan has no UK-only spelling in packing, prep or timeline", () => {
  const p = fixture();
  p.input = { ...p.input, ...gcKids, home: { countryCode: "US", name: "Phoenix" }, travelMode: "driving" };
  p.trip = { domestic: true, home: { countryCode: "US", name: "Phoenix" } };
  p.place = { name: "Grand Canyon National Park", countryCode: "US" };
  p.weather = gcWx();
  p.packing = packing(p.input, p.weather, p.place, 4, true);
  p.timeline = timeline(p.input.start, false, "2026-11-17", "driving");
  p.prep = defaultPrep(p);
  const T = (s: string) => localizeEn(s || "", "us");
  const detailed = renderToStaticMarkup(<PackingWorkspace plan={p} readOnly={false} onChange={() => {}} T={T} simple={false} />);
  const simple = renderToStaticMarkup(<PackingWorkspace plan={p} readOnly={false} onChange={() => {}} T={T} simple={true} />);
  const lists = renderToStaticMarkup(
    <div data-testid="prep-and-timeline">
      {(p.prep || []).map((t: any) => <div key={t.id} data-testid="prep-item"><button aria-label={T(t.task)} />{T(t.task)} {T(t.why || "")}</div>)}
      {(p.timeline || []).map((t: any) => <div key={t.id}><button aria-label={T(t.task)} />{T(t.task)}</div>)}
      <div data-testid="kid-hint">{T("Mayan artefacts indoors")}</div>
    </div>
  );
  const visible = (html: string) => html
    .replace(/ data-(?:item-id|testid|group-key|shared)="[^"]*"/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  const html = visible(`${detailed}\n${simple}\n${lists}`);
  assert.match(html, /Driver's license/);
  assert.match(html, /ask a neighbor/);
  assert.match(html, /Mayan artifacts indoors/);
  assert.ok(!/artefacts/i.test(html), "artefacts should be US artifacts via T()/localizeEn");
  assert.ok(!/ask a neighbour/i.test(html), "prep still has UK neighbour");
  const uk = /\b(licence|nappies|jumper|tyres|travelling|neighbour|colour|organise|centre|artefacts?)\b/i;
  const hit = html.match(uk);
  assert.equal(hit, null, `UK wording still visible: ${hit && hit[0]}`);
});

test("v1.17.2: lodging does not fill activity slots; the campsite is mentioned on Day 1", () => {
  assert.ok(isLodgingOrStay("Maswik Lodge"));
  assert.ok(isLodgingOrStay({ name: "Your campsite (a grown-up books it)", type: "camp_site" }));
  assert.ok(!isLodgingOrStay("Bright Angel Restaurant"));
  assert.equal(campsiteSetupLine([], "hiking, camping, animals, stars"), "Set up at your campsite");
  assert.equal(campsiteSetupLine([{ name: "Mather Campground", type: "camp_site" }], "camping"), "Set up at Mather Campground");

  const days = itinerary(gcKids as any, gcWx(), [
    { name: "Mather Point", type: "viewpoint" },
    { name: "Maswik Lodge", type: "lodge", setting: "mixed" },
    { name: "Grand Canyon National Park", type: "national park" },
  ] as any, [{ name: "Bright Angel Restaurant", kind: "restaurant", source: "x" }, { name: "Grand Canyon Lodge Dining Room", kind: "restaurant", source: "x", driveMin: 210, lat: 36.2, lon: -112.05 } as any], [], { domestic: true, travelMode: "driving", destName: "Grand Canyon National Park", elevationM: 2130, driveMin: 220 });
  const blob = days.map(d => `${d.morning} ${d.afternoon} ${d.evening}`).join(" | ");
  assert.match(days[0].afternoon, /Set up at your campsite/i);
  assert.ok(!/Your campsite \(a grown-up books it\)/.test(days.slice(1).map(d => `${d.morning} ${d.afternoon}`).join(" ")));
  assert.ok(!/Maswik Lodge/i.test(blob));
  assert.ok(!/Grand Canyon Lodge Dining Room/i.test(blob));
  assert.match(blob, /Bright Angel Restaurant/);
});

test("v1.17.2: the destination itself is not a sight; curated park walks are used instead", () => {
  assert.ok(isDestinationItself("Grand Canyon National Park", "Grand Canyon National Park"));
  assert.ok(!isDestinationItself("Walk the Rim Trail between Mather Point and Yavapai Point (flat, paved)", "Grand Canyon National Park"));
  assert.ok(isVagueSight("Mary Jane Colter buildings"));
  const sights = curatedParkSights("Grand Canyon National Park").map(s => s.name);
  assert.ok(sights.some(n => /Rim Trail between Mather Point and Yavapai Point/i.test(n)));
  for (const park of ["Yellowstone", "Yosemite", "Zion", "Great Smoky Mountains", "Rocky Mountain", "Acadia", "Olympic", "Grand Teton", "Glacier"]) {
    assert.ok(curatedParkSights(park).length >= 2, park);
  }
  const days = itinerary(gcKids as any, gcWx(), [
    { name: "Grand Canyon National Park", type: "national park", setting: "outdoor" },
    { name: "Mary Jane Colter buildings", type: "architectural ensemble, historic district", setting: "outdoor" },
  ] as any, [], [], { domestic: true, travelMode: "driving", destName: "Grand Canyon National Park", elevationM: 2130 });
  runActivitySchedule(days, gcKids as any, gcWx(), [
    { name: "Grand Canyon National Park", type: "national park", setting: "outdoor", description: "", source: "x", indoor: false },
    { name: "Mary Jane Colter buildings", type: "architectural ensemble", setting: "outdoor", description: "", source: "x", indoor: false },
  ] as any, ["hiking"], "Grand Canyon National Park");
  const blob = days.map(d => `${d.morning} ${d.afternoon}`).join(" | ");
  assert.ok(!/^(?=.*Grand Canyon National Park).*Grand Canyon National Park$/.test(""), "noop");
  for (const d of days.filter(d => !isTravelOrLeaveDay(d))) {
    assert.ok(!isDestinationItself(d.morning, "Grand Canyon National Park"), d.morning);
    assert.ok(!isVagueSight(d.morning), d.morning);
  }
  assert.match(blob, /Rim Trail|Mather Point|Visitor Center|Junior Ranger|Yavapai|short rim|easy walk|Set up at your campsite/i);
});

test("v1.17.2: places about an hour or more from the base are dropped from days and dinners with small kids", () => {
  assert.ok(!isNearBase({ driveMin: 210 }, { smallChild: true }));
  assert.ok(isNearBase({ driveMin: 25 }, { smallChild: true }));
  assert.ok(!isNearBase({ driveMin: 125 }, { smallChild: true }));
});

test("v1.17.2: high elevation and hot days get an altitude note and sun/cool-night wear", () => {
  assert.match(altitudeNote(2130)!, /You're up high \(~7,000 ft\) — drink extra water and take it slow the first day/);
  assert.equal(altitudeNote(100), undefined);
  assert.match(whatToWear({ tmax: 36, tmin: 12, precipProb: 0, summary: "Usually dry" }), /Shorts by day, warm layer at night/);
  assert.match(whatToWear({ tmax: 36, tmin: 12, precipProb: 0, summary: "Usually dry" }), /sun hat/);
  assert.equal(whatToWear({ tmax: 27, tmin: 19, precipProb: 10, summary: "Sunny" }), "Shorts & t-shirt");
  const days = itinerary(gcKids as any, gcWx(), [{ name: "Mather Point", type: "viewpoint" }] as any, [], [], { domestic: true, travelMode: "driving", destName: "Grand Canyon National Park", elevationM: 2130, driveMin: 220 });
  assert.match(days[0].notes, /You're up high \(~7,000 ft\)/);
});

test("v1.17.2: far or hike-in highlights carry a kid caveat", () => {
  assert.ok(isHikeInOrInnerCanyon({ name: "Phantom Ranch", description: "Hike-in lodge at the bottom of the canyon" }));
  assert.match(highlightCaveat({ name: "Phantom Ranch", description: "Hike-in lodge at the bottom of the canyon" }, { kids: true, smallChild: true }), /Hike-in only — not for little kids/);
  assert.match(highlightCaveat({ name: "Wupatki National Monument", driveMin: 125 }, { kids: true, smallChild: true }), /2 h away/);
  assert.match(highlightReason({ name: "Wupatki National Monument", type: "archaeological site", setting: "outdoor", driveMin: 125 }, true, { smallChild: true }), /2 h away/);
});

test("v1.17.2: a generic visitor-center backup becomes the named visitor center", () => {
  assert.equal(visitorCenterName([], "Grand Canyon National Park"), "Grand Canyon Visitor Center");
  assert.equal(visitorCenterName([{ name: "Grand Canyon Visitor Center", type: "visitor centre" }]), "Grand Canyon Visitor Center");
});


test("v1.17.2: a castle is not used as a named rain backup just because its type mentions museum", () => {
  const days = itinerary(londonKids as any, mildWx(), [
    { name: "Tower of London", type: "castle, museum", indoor: false, setting: "outdoor", description: "", source: "x" },
    { name: "British Library", type: "library", indoor: true, setting: "indoor", description: "", source: "x" },
  ] as any, [], [], { destName: "London" });
  const rainy = days.find(d => /Rain likely/i.test(d.rainyBackup || ""));
  assert.ok(rainy);
  assert.match(rainy!.rainyBackup || "", /British Library/);
  assert.doesNotMatch(rainy!.rainyBackup || "", /Tower of London/);
});

test("v1.17.2: North Rim lodging and dinners are off a South Rim base; hike-in highlights are flagged", () => {
  assert.equal(isOffParkBase("Grand Canyon Lodge Dining Room", "Grand Canyon National Park"), true);
  assert.equal(isOffParkBase("Bright Angel Restaurant", "Grand Canyon National Park"), false);
  assert.equal(isOffParkBase("Grand Canyon Lodge Dining Room", "Grand Canyon North Rim"), false);
  const base = preferredParkBase("Grand Canyon National Park");
  assert.ok(base && base.lat < 36.12 && base.lat > 36.04);
  assert.equal(isHikeInOrInnerCanyon("Phantom Ranch"), true);
  const days = itinerary(gcKids as any, gcWx(), [
    { name: "Mather Point", type: "viewpoint", source: "x" },
    { name: "Phantom Ranch", type: "dude ranch", description: "Hike-in lodge at the bottom of the canyon", source: "x", driveMin: 2 },
  ] as any, [
    { name: "Bright Angel Restaurant", kind: "restaurant", source: "x" },
    { name: "Grand Canyon Lodge Dining Room", kind: "restaurant", source: "x" },
  ] as any, [], { destName: "Grand Canyon National Park", elevationM: 2100 });
  const blob = days.map(d => `${d.morning} ${d.afternoon} ${d.evening} ${d.notes || ""}`).join(" | ");
  assert.doesNotMatch(blob, /Phantom Ranch/);
  assert.doesNotMatch(blob, /Grand Canyon Lodge/);
  assert.match(blob, /Bright Angel|Arizona Room|Dinner nearby|campsite|Sunset/);
  assert.match(days[0].notes || "", /up high|6500|7,000|7000|drink extra water/i);
});

test("v1.17.2: uniqueness does not punch Mather Point out of a sunset or rim-walk line", () => {
  const days = itinerary(gcKids as any, gcWx(), [
    { name: "Mather Point", type: "viewpoint", source: "x" },
    { name: "Walk the Rim Trail between Mather Point and Yavapai Point (flat, paved)", type: "trail", source: "x" },
  ] as any, [], [], { destName: "Grand Canyon National Park", travelMode: "driving", elevationM: 2100 });
  const blob = days.map(d => `${d.morning} ${d.afternoon}`).join(" | ");
  assert.match(blob, /Sunset at Mather Point/);
  assert.doesNotMatch(blob, /Sunset at\s*(;|$)/);
  assert.doesNotMatch(blob, /between and Yavapai/);
});
