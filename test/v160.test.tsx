import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fixture } from "./fixtures.js";
import {
  suggestPacking, startHereItems, packingEncouragement, simpleGroupLabel,
  shouldConfirmMarkAll, groupSimpleRows, laundryChoice, laundryEveryFromChoice,
  midTripLaundryDay, type PackingList, type SimpleGroup,
} from "../shared/packing.js";
import { whatToWear } from "../shared/wear.js";
import { highlightReason, sortForFamily, familyPlaceScore, isBarStyleVenue, isKidFriendlyPlace } from "../shared/familyPlaces.js";
import { prepTiming, groupPrepTasks, prepOwnerHint, PREP_WHEN_LABEL } from "../shared/prepTiming.js";
import { SimpleLists, PackingSettingsPanel, PackingWorkspace } from "../src/Packing.js";
import { defaultPrep } from "../src/Prep.js";

const familyMembers = [
  { id: "traveler-1", name: "Mom", profile: "woman" as const },
  { id: "traveler-2", name: "Dad", profile: "man" as const },
  { id: "traveler-3", name: "Me", profile: "girl" as const, child: true, age: 10 },
  { id: "traveler-4", name: "Little brother", profile: "boy" as const, child: true, age: 6 },
  { id: "traveler-5", name: "Baby sister", profile: "infant" as const, child: true },
];

function familyPlan() {
  const p = fixture();
  p.input = { ...p.input, start: "2026-12-20", end: "2026-12-27", travelers: 5, interests: "Disney World, theme parks", purpose: "Family" };
  p.trip = { ...(p.trip || {}), domestic: true };
  p.packing = suggestPacking(p, { laundryEvery: null, luggage: "all", members: familyMembers } as any);
  return p;
}

test("v1.16: Start here is a short must-have list with a friendly progress message", () => {
  const p = familyPlan();
  const start = startHereItems(p.packing);
  assert.ok(start.length >= 6 && start.length <= 10, `got ${start.length}`);
  const names = start.map(i => i.item).join(" | ");
  assert.match(names, /Photo ID|Passport|photo ID/i);
  assert.match(names, /Phone & charger/i);
  assert.match(names, /Diapers/i);
  assert.match(names, /Feeding supplies/i);
  assert.match(names, /walking shoes|Hiking shoes/i);
  const msg = packingEncouragement(p.packing, start);
  assert.match(msg, /must-haves|Start with/i);
  assert.ok(!/0 of 92 active items packed/.test(msg));
  const html = renderToStaticMarkup(<PackingWorkspace plan={p} readOnly={false} onChange={() => {}} T={s => s} simple />);
  assert.match(html, /Start here/);
  assert.match(html, /data-testid="start-here"/);
  assert.match(html, /must-haves|Start with/i);
});

test("v1.16: grouped rows name people when there are 4 or fewer, and mark-all confirms for more than one person", () => {
  const rows = [
    { item: { id: "a", item: "Tops", quantity: 8, checked: false, skipped: false, bag: "unassigned" as const, reason: "", owner: "traveler-1" }, ownerName: "Mom", shared: false },
    { item: { id: "b", item: "Tops", quantity: 8, checked: false, skipped: false, bag: "unassigned" as const, reason: "", owner: "traveler-2" }, ownerName: "Dad", shared: false },
  ];
  const grouped = groupSimpleRows(rows as any);
  const g = grouped.groups[0] as SimpleGroup;
  assert.match(simpleGroupLabel(g), /8 × Tops · Mom, Dad/);
  assert.ok(!simpleGroupLabel(g).includes("2 people"));
  assert.equal(shouldConfirmMarkAll(g), true);
  const one: SimpleGroup = { ...g, rows: [g.rows[0]], total: 1, packed: 0 };
  assert.equal(shouldConfirmMarkAll(one), false);
});

test("v1.16: Before you leave groups tasks by timing, grown-up first, with an owner hint", () => {
  const p = familyPlan();
  p.input.travelMode = "driving";
  const tasks = defaultPrep(p);
  const groups = groupPrepTasks(tasks);
  assert.deepEqual(groups.map(g => g.when).sort(), ["dayBefore", "morning", "week"].filter(k => groups.some(g => g.when === k)).sort());
  assert.ok(groups.some(g => g.label === PREP_WHEN_LABEL.week));
  assert.ok(groups.some(g => g.label === PREP_WHEN_LABEL.dayBefore));
  assert.ok(groups.some(g => g.label === PREP_WHEN_LABEL.morning));
  assert.equal(prepTiming("Check the car: tyres, lights, fluids and papers"), "dayBefore");
  assert.equal(prepTiming("Photo ID packed"), "morning");
  assert.equal(prepTiming("Hold mail / packages or ask a neighbour"), "week");
  assert.match(prepOwnerHint("Hold mail / packages or ask a neighbour")!, /grown-up/i);
  for (const g of groups) {
    const flags = g.items.map(i => /grown-up/i.test(prepOwnerHint(i.task) || "") || false);
    const firstKid = flags.findIndex(f => !f);
    const lastGrown = flags.lastIndexOf(true);
    if (firstKid >= 0 && lastGrown >= 0) assert.ok(lastGrown < firstKid || flags.every(Boolean) || flags.every(f => !f), g.label);
  }
});

test("v1.16: Settings laundry uses simple choices and hides advanced controls", () => {
  assert.equal(laundryChoice(8, null), "none");
  assert.equal(laundryChoice(8, midTripLaundryDay(8)), "mid");
  assert.equal(midTripLaundryDay(8), 4);
  assert.equal(laundryEveryFromChoice("few", 8), 3);
  const p = familyPlan();
  const html = renderToStaticMarkup(<PackingSettingsPanel plan={p} p={p.packing as PackingList} readOnly={false} change={() => {}} setMessage={() => {}} />);
  assert.match(html, /No laundry/);
  assert.match(html, /Once mid-trip/);
  assert.match(html, /Every few days/);
  assert.match(html, /Advanced \(for grown-ups\)/);
  assert.match(html, /Adds new suggestions and keeps everything you changed/);
  assert.ok(!/Wash every 1-30 days/.test(html));
  assert.match(html, />Travelers</);
  assert.match(html, /Packing details/);
  const simple = renderToStaticMarkup(<SimpleLists p={p.packing as PackingList} readOnly={false} onCheck={() => {}} onCheckMany={() => {}} />);
  assert.match(simple, /My stuff · Me/);
  assert.match(simple, /Whose bag\?/);
});

test("v1.16: family ranking lifts kid-friendly places and writes a plain reason, never raw OSM types", () => {
  const playground = { name: "Lake Eola Playground", type: "leisure playground", description: "Play area", setting: "outdoor" as const };
  const club = { name: "Pulse Nightclub", type: "nightclub", description: "Dance club", setting: "indoor" as const };
  const church = { name: "St James Cathedral", type: "church", description: "Historic cathedral", setting: "indoor" as const };
  const theatre = { name: "Annie Russell Theatre", type: "theatre building, university building", description: "Campus theatre", indoor: true, setting: "indoor" as const };
  assert.ok(isKidFriendlyPlace(playground));
  assert.ok(isBarStyleVenue(club));
  assert.ok(familyPlaceScore(playground) > familyPlaceScore(theatre));
  assert.ok(familyPlaceScore(theatre) > familyPlaceScore(club));
  assert.ok(familyPlaceScore(church) >= 0, "identity/religion venues are not treated as unsafe");
  const ranked = sortForFamily([club, theatre, playground], true);
  assert.equal(ranked[0].name, playground.name);
  assert.equal(highlightReason(playground, true), "Good for kids: playground");
  assert.equal(highlightReason(theatre, true), "Indoor — good if it rains");
  assert.ok(!/university building|theatre building/i.test(highlightReason(theatre, true)));
  assert.match(highlightReason(club, true), /grown-ups|Nightlife/);
});

test("v1.16: what-to-wear uses plain kid language for a warm Orlando day and a wet cool day", () => {
  assert.equal(whatToWear({ tmax: 27, tmin: 19, precipProb: 10, summary: "Sunny" }), "Shorts & t-shirt");
  assert.equal(whatToWear({ tmax: 24, tmin: 15, precipProb: 10, summary: "Partly cloudy" }), "Shorts & t-shirt, light jacket at night");
  assert.match(whatToWear({ tmax: 12, tmin: 6, precipProb: 60, summary: "Rain" }), /rain|waterproof|jumper|coat/i);
  assert.match(whatToWear({ tmax: 0, tmin: -4, precipProb: 20, summary: "Snowy" }), /coat|hat|gloves/i);
});

test("v1.16: mobile CSS gives checkboxes and buttons at least 40px tap targets", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(css, /min-width:\s*40px/);
  assert.match(css, /min-height:\s*40px/);
  assert.match(css, /@media \(max-width:\s*720px\)/);
});
