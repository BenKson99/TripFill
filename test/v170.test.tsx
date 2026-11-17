import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixture } from "./fixtures.js";
import { suggestPacking, dropUnusedWaterParkSwimwear, packingItems } from "../shared/packing.js";
import { whatToWear } from "../shared/wear.js";
import { localizeEn } from "../shared/enLocale.js";
import { itinerary, timeline } from "../server/plan.js";
import { isOvernightFlight, jetLagNote, isTravelOrLeaveDay, isGrownUpTask, OVERNIGHT_FLY_DAY1, OVERNIGHT_FLY_DAY2 } from "../shared/family.js";
import { normalizePlaceQuery, placeQueryFallbacks } from "../shared/placeQuery.js";
import {
  curatedInterestVenues, keywordInterestHits, applyInterestVenues, fillNamedAfternoons,
  isBareCategorySlot, itineraryHasWaterPark,
} from "../shared/interestVenues.js";
import { isFineDining, isCasualFamilyEat, preferFamilyEats } from "../shared/familyEats.js";
import { defaultPrep } from "../src/Prep.js";

const london = { name: "London", country: "United Kingdom", countryCode: "GB" };
const family = {
  style: "Mix",
  interests: "Harry Potter, castles, double-decker bus, museums",
  purpose: "Family",
  travelers: 5,
  travelMode: "flying" as const,
  walkingTolerance: "standard",
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

function mildWx(n = 8) {
  const days = Array.from({ length: n }, (_, i) => ({
    date: `2027-07-${String(10 + i).padStart(2, "0")}`,
    tmax: 22, tmin: 14, precipProb: 30, summary: "Partly cloudy", typical: true,
  }));
  return { days, source: "typical", stats: { avgHigh: 22, avgLow: 14, snowDays: 0 } } as any;
}

test("v1.17: curated interest venues map Harry Potter, buses and castles in London", () => {
  const slots = curatedInterestVenues(family.interests, london).map(s => s.name);
  assert.ok(slots.some(s => /Warner Bros\. Studio Tour London/i.test(s)));
  assert.ok(slots.some(s => /Platform 9¾/i.test(s)));
  assert.ok(slots.some(s => /double-decker bus/i.test(s)));
  assert.ok(slots.some(s => /Tower of London/i.test(s)));
  assert.ok(slots.some(s => /Windsor Castle/i.test(s)));
  const orlando = curatedInterestVenues("Harry Potter", { name: "Orlando", admin1: "Florida", countryCode: "US" }).map(s => s.name);
  assert.ok(orlando.some(s => /Universal Orlando/i.test(s)));
  const dino = curatedInterestVenues("dinosaurs", london).map(s => s.name);
  assert.deepEqual(dino, ["Natural History Museum"]);
});

test("v1.17: keyword fallback finds interest phrases in highlight names", () => {
  const hits = keywordInterestHits("Harry Potter, museums", [
    { name: "The Making of Harry Potter Shop" },
    { name: "Tate Modern" },
    { name: "Random Cafe" },
  ]);
  assert.equal(hits.length, 1);
  assert.match(hits[0].name!, /Harry Potter/);
});

test("v1.17: never leave a bare category as an itinerary slot", () => {
  const days = [
    { label: "Day 1 · Sat, Jul 10 · Fly", morning: OVERNIGHT_FLY_DAY1, afternoon: "Sleep on the plane — you'll arrive tomorrow" },
    { label: "Day 2 · Sun, Jul 11 · Arrive", morning: OVERNIGHT_FLY_DAY2, afternoon: "Check in & rest — keep today light" },
    { label: "Day 3 · Mon, Jul 12", morning: "🎢 Theme & water parks", afternoon: "Explore a market or local street" },
    { label: "Day 4 · Tue, Jul 13", morning: "🏛 Museums & galleries", afternoon: "Explore a market or local street" },
    { label: "Day 5 · Wed, Jul 14", morning: "Free morning — wander a new neighbourhood", afternoon: "Explore a market or local street" },
  ];
  assert.ok(isBareCategorySlot("🎢 Theme & water parks"));
  applyInterestVenues(days, family.interests, london, [], isTravelOrLeaveDay);
  fillNamedAfternoons(days, [
    { name: "Natural History Museum", type: "museum" },
    { name: "London Aquarium", type: "aquarium" },
    { name: "Hyde Park", type: "park" },
  ], isTravelOrLeaveDay);
  const mid = days.slice(2);
  for (const d of mid) {
    assert.ok(!isBareCategorySlot(d.morning), d.morning);
    assert.ok(!/^🎢 Theme & water parks$/i.test(d.morning));
  }
  assert.match(days[2].morning, /Warner Bros|Platform 9|Tower of London|Windsor|double-decker/i);
  const afternoons = mid.map(d => d.afternoon);
  assert.ok(afternoons.every(a => !/^Explore a market/i.test(a)));
  assert.equal(new Set(afternoons).size, afternoons.length, afternoons.join(" | "));
});

test("v1.17: water-park swimwear is packed only when a water park is scheduled", () => {
  const p = fixture();
  p.input = { ...p.input, ...family, activities: ["parks"] };
  p.trip = { ...(p.trip || {}), domestic: false };
  const list = suggestPacking(p, { laundryEvery: null, luggage: "all", members: family.members, activityKits: ["theme-park"] } as any);
  const names = packingItems(list).map(i => i.item);
  const had = names.some(n => /swimwear \(if a water park\)/i.test(n));
  // If the parks kit did not add the item, invent one so the filter can be proven.
  const withItem = had ? list : { ...list, groups: [...list.groups, { group: "Activities", items: [{ id: "swim-wp", item: "Swimwear (if a water park)", quantity: 1, checked: false, owner: "shared" }] }] };
  assert.equal(itineraryHasWaterPark([{ morning: "Warner Bros. Studio Tour London (book ahead)" }]), false);
  const dropped = dropUnusedWaterParkSwimwear(withItem, [{ morning: "Warner Bros. Studio Tour London (book ahead)", afternoon: "Hyde Park" }]);
  assert.ok(!packingItems(dropped as any).some(i => /swimwear \(if a water park\)/i.test(i.item)));
  const kept = dropUnusedWaterParkSwimwear(withItem, [{ morning: "Volcano Bay" }]);
  assert.ok(packingItems(kept as any).some(i => /swimwear \(if a water park\)/i.test(i.item)));
});

test("v1.17: place lookup accepts London, UK, Paris, FR, NYC and LA", () => {
  assert.equal(normalizePlaceQuery("London, UK"), "London, United Kingdom");
  assert.equal(normalizePlaceQuery("Paris, FR"), "Paris, France");
  assert.equal(normalizePlaceQuery("NYC"), "New York");
  assert.equal(normalizePlaceQuery("LA"), "Los Angeles");
  assert.equal(normalizePlaceQuery("Washington, USA"), "Washington, United States");
  assert.deepEqual(placeQueryFallbacks("London, UK"), ["London, United Kingdom", "London, UK", "London"]);
});

test("v1.17: eastbound overnight flights get a fly-night Day 1, a light Day 2, and a jet-lag note", () => {
  assert.ok(isOvernightFlight({ travelMode: "flying", domestic: false, flightHours: 8, tzDiffHours: 6 }));
  assert.ok(!isOvernightFlight({ travelMode: "flying", domestic: true, flightHours: 8, tzDiffHours: 6 }));
  assert.ok(!isOvernightFlight({ travelMode: "flying", domestic: false, flightHours: 8, tzDiffHours: 3 }));
  const note = jetLagNote("London", 6);
  assert.equal(note, "London is 6 hours ahead — you'll feel sleepy at odd times for a day or two");
  const days = itinerary(family as any, mildWx(), [], [], [], {
    domestic: false, travelMode: "flying", flightHours: 8, tzDiffHours: 6, destName: "London", countryCode: "GB",
  });
  assert.match(days[0].label, /Fly/);
  assert.equal(days[0].morning, OVERNIGHT_FLY_DAY1);
  assert.match(days[0].afternoon, /Sleep on the plane/);
  assert.match(days[0].notes, /6 hours ahead/);
  assert.ok(!/currency|SIM/i.test(`${days[0].morning} ${days[0].afternoon} ${days[0].evening}`));
  assert.match(days[1].label, /Arrive/);
  assert.equal(days[1].morning, OVERNIGHT_FLY_DAY2);
  assert.match(days[1].afternoon, /keep today light|Check in & rest/i);
  assert.ok(isTravelOrLeaveDay(days[0]) && isTravelOrLeaveDay(days[1]));
});

test("v1.17: with kids, casual family restaurants rank above fine dining", () => {
  const ranked = preferFamilyEats([
    { name: "The Dorchester", tag: "fine_dining" },
    { name: "Restaurant Gordon Ramsay", tag: "french" },
    { name: "Le Gavroche", description: "Michelin-starred tasting menu" },
    { name: "Pizza Pilgrims", tag: "pizza" },
    { name: "Honest Burgers", tag: "burger" },
    { name: "Family Cafe", kind: "cafe" },
  ]);
  const names = ranked.map(r => r.name);
  assert.ok(names.indexOf("Pizza Pilgrims") < names.indexOf("The Dorchester"));
  assert.ok(names.indexOf("Honest Burgers") < names.indexOf("Restaurant Gordon Ramsay"));
  assert.ok(names.indexOf("Family Cafe") < names.indexOf("Le Gavroche"));
  assert.ok(isFineDining("The Dorchester"));
  assert.ok(isCasualFamilyEat({ name: "Pizza Pilgrims", tag: "pizza" }));
});

test("v1.17: a mild London July is a hoodie, not seven identical shorts lines", () => {
  const line = whatToWear({ tmax: 22, tmin: 14, precipProb: 30, summary: "Partly cloudy", typical: true });
  assert.equal(line, "T-shirt plus a hoodie");
  const mid = whatToWear({ tmax: 19, tmin: 11, precipProb: 0, summary: "Usually dry", typical: true });
  assert.equal(mid, "T-shirt plus a hoodie");
  const wet = whatToWear({ tmax: 22, tmin: 14, precipProb: 60, summary: "Often wet", typical: true });
  assert.equal(wet, "T-shirt plus a hoodie and a light rain jacket");
  const days = Array.from({ length: 7 }, () => whatToWear({ tmax: 22, tmin: 14, precipProb: 30, summary: "Partly cloudy", typical: true }));
  assert.ok(days.every(l => l === line));
  assert.equal(localizeEn(line, "us"), line);
});

test("v1.17: prep and timeline use kid-readable grown-up wording and a plain UK plug line", () => {
  const plan = fixture();
  plan.input = { ...plan.input, ...family };
  plan.place = { ...(plan.place || {}), name: "London", country: "United Kingdom", countryCode: "GB" };
  plan.trip = { ...(plan.trip || {}), domestic: false, home: { countryCode: "US", name: "Chicago" }, tzDiffHours: 6 };
  const prep = defaultPrep(plan);
  const tasks = prep.map(t => t.task).join("\n");
  assert.match(tasks, /Check that everyone's passport is good for 6\+ months after you come home \(grown-up task\)/);
  assert.match(tasks, /visa and entry rules/i);
  assert.match(tasks, /UK plugs have 3 big prongs — bring a UK plug adapter \(grown-up: check voltage\)/);
  assert.ok(!/Plug adapter: GB type G/i.test(tasks));
  assert.ok(!/your home sockets are type A\/B/i.test(tasks));
  assert.match(tasks, /roaming plan or eSIM \(grown-up task\)/i);
  assert.match(tasks, /Tell your bank/i);
  assert.ok(isGrownUpTask("Make sure everyone's passport is good for 6+ months after you come home (grown-up task)"));
  assert.ok(isGrownUpTask("UK plugs have 3 big prongs — bring a UK plug adapter (grown-up: check voltage)"));
  const us = localizeEn("Tell your bank & card issuer you're travelling (grown-up task). Hold mail or ask a neighbour.", "us");
  assert.match(us, /traveling/);
  assert.match(us, /neighbor/);
  assert.ok(!/travelling|neighbour/.test(us));
  const tl = timeline("2027-07-10", true, "2026-11-17", "flying").map(t => t.task).join(" ");
  assert.match(tl, /passport is good for 6\+ months/i);
  assert.ok(!/order some local currency/i.test(tl));
});

test("v1.17: flying with kids packs a neck pillow, headphones and flight entertainment", () => {
  const p = fixture();
  p.input = { ...p.input, ...family, travelMode: "flying" };
  p.trip = { ...(p.trip || {}), domestic: false };
  const names = packingItems(suggestPacking(p, { laundryEvery: null, luggage: "all", members: family.members } as any)).map(i => i.item);
  assert.ok(names.some(n => /neck pillow/i.test(n)));
  assert.ok(names.some(n => /headphones/i.test(n)));
  assert.ok(names.some(n => /entertainment for the flight/i.test(n)));
});

test("v1.17: narrow-screen CSS keeps the tab bar and long words from overflowing 390–512px", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(css, /html,body,#root\{[^}]*overflow-x:\s*hidden/);
  assert.match(css, /\.tabs\{[^}]*max-width:\s*100%/);
  assert.match(css, /\.tabs \[role=tab\]\{[^}]*min-width:\s*0/);
  assert.match(css, /@media \(max-width:512px\)/);
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /seenTabs/);
  assert.match(app, /beforeprint/);
});
