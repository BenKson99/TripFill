import React, { useState } from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { englishVariant, localizeEn } from "../shared/enLocale.js";
import { friendlyError } from "../shared/friendlyError.js";
import { dateWarnings } from "../shared/dateWarnings.js";
import { highlightReason, isOutdoorFamilyPlace } from "../shared/familyPlaces.js";
import { overnightDay1Morning, overnightDay2Morning, overnightDriveHours, isTravelOrLeaveDay } from "../shared/family.js";
import { itinerary } from "../server/plan.js";
import { isMajorAttraction } from "../shared/family.js";
import { whatToWear } from "../shared/wear.js";
import { CrashRecovery } from "../src/ErrorBoundary.js";
import { placeLabel } from "../src/Home.js";
import { readSaved, STORAGE_KEY } from "../shared/portable.js";

const g = globalThis as any;
const store: Record<string, string> = {};
g.localStorage ??= {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = String(v); },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  key: (i: number) => Object.keys(store)[i] ?? null,
  get length() { return Object.keys(store).length; },
};
g.window ??= g;
g.document ??= { getElementById: () => null, addEventListener() {}, documentElement: { style: {}, classList: { add() {}, remove() {} } }, body: {}, querySelector() { return null; }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, classList: { add() {} } }) };
g.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
g.confirm ??= () => true;
g.fetch ??= async () => ({ ok: true, json: async () => ({}) });

test("v1.16.1: App must not redeclare placeLabel — that crashed reload when a home city was stored", () => {
  const src = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(src, /import \{[^}]*\bplaceLabel\b[^}]*\} from "\.\/Home"/);
  assert.ok(!/const placeLabel\s*=/.test(src), "a local placeLabel shadows the import and is in the temporal dead zone for useState");
  assert.match(src, /homeCity \? placeLabel\(homeCity\)/);
});

test("v1.16.1: rendering App with the stored Orlando plan, then again (reload), does not go blank", async () => {
  const saved = JSON.parse(readFileSync(new URL("./orlando-family-saved.json", import.meta.url), "utf8"));
  assert.equal(saved.plan.place.name, "Orlando");
  assert.ok(saved.plan.trip?.home?.name);
  assert.ok(saved.form.members.some((m: any) => m.age === 10));
  for (const k of Object.keys(store)) delete store[k];
  store[STORAGE_KEY] = JSON.stringify(saved);
  store["tripfill:homeCity"] = JSON.stringify(saved.plan.trip.home);
  store["tripfill:v1:unit"] = "F";
  store["tripfill:v1:distance"] = "mi";
  // Loading the saved shape must succeed before render, and again on "reload".
  const first = readSaved(g.localStorage)!;
  assert.equal(first.plan.place.name, "Orlando");
  const second = readSaved(g.localStorage)!;
  assert.equal(second.plan.place.name, "Orlando");
  const { default: App } = await import("../src/App.js");
  const html1 = renderToStaticMarkup(<App />);
  assert.match(html1, /Orlando/);
  assert.ok(!html1.includes("Something went wrong loading your trip"));
  assert.ok(html1.length > 1000);
  const html2 = renderToStaticMarkup(<App />);
  assert.match(html2, /Orlando/);
  assert.ok(!html2.includes("Something went wrong loading your trip"));
  // The home-text initializer must be able to call placeLabel now that it is not shadowed.
  assert.equal(placeLabel(saved.plan.trip.home), "Detroit, Michigan, United States");
  assert.doesNotThrow(() => { const t = saved.plan.trip.home ? placeLabel(saved.plan.trip.home) : ""; assert.match(t, /Detroit/); });
});

test("v1.16.1: malformed saved data is tolerated and the recovery screen is available", () => {
  const html = renderToStaticMarkup(<CrashRecovery onTryAgain={() => {}} onStartNew={() => {}} />);
  assert.match(html, /Something went wrong loading your trip/);
  assert.match(html, /Try again/);
  assert.match(html, /Start a new trip \(keeps a backup\)/);
  store[STORAGE_KEY] = "{not-json";
  const r = readSaved(g.localStorage)!;
  assert.equal(r.plan, null);
  assert.match(r.error || "", /couldn't read|couldn't load|try again/i);
  store[STORAGE_KEY] = JSON.stringify({ form: { destination: "Orlando", start: "2026-12-20", end: "2026-12-27" }, plan: { nope: true } });
  const r2 = readSaved(g.localStorage)!;
  assert.equal(r2.plan, null);
  assert.equal(r2.form.destination, "Orlando");
  assert.ok(r2.error);
});

test("v1.16.1: Day by day jump targets #day-by-day with a sticky-tab scroll offset", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const sections = readFileSync(new URL("../src/Sections.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(app, /href="#day-by-day"/);
  assert.match(app, /getElementById\("day-by-day"\)/);
  assert.match(sections, /id=\{id === "itinerary" \? "day-by-day"/);
  assert.match(css, /scroll-margin-top:\s*4\.75rem/);
  assert.match(css, /scroll-padding-top:\s*4\.75rem/);
});

test("v1.16.1: a central English dictionary uses American words for US homes and UK words for UK homes", () => {
  assert.equal(englishVariant({ countryCode: "US" }), "us");
  assert.equal(englishVariant({ countryCode: "FR" }), "us");
  assert.equal(englishVariant({ countryCode: "GB" }), "uk");
  const uk = "Driving licence and Diapers / nappies, a jumper, a neighbourhood walk, check the tyres. Travel home.";
  assert.equal(localizeEn(uk, "uk"), uk);
  const us = localizeEn(uk, "us");
  assert.match(us, /Driver's license/);
  assert.ok(!/licence/i.test(us));
  assert.match(us, /Diapers/);
  assert.ok(!/nappies/i.test(us));
  assert.match(us, /sweater/);
  assert.ok(!/jumper/i.test(us));
  assert.match(us, /neighborhood/);
  assert.match(us, /tires/);
  assert.match(us, /Travel home/);
});

test("v1.16.1: gardens, parks, zoos and theme parks never get an Indoor reason", () => {
  const leu = { name: "Harry P. Leu Gardens", type: "botanical garden, historic district", description: "Historic gardens", setting: "indoor" as const, indoor: true };
  assert.ok(isOutdoorFamilyPlace(leu));
  assert.equal(highlightReason(leu, true), "Outdoor — check the weather");
  assert.ok(!/Indoor/i.test(highlightReason(leu, true)));
  assert.ok(!/Indoor/i.test(highlightReason({ name: "Lake Eola Park", type: "park, urban park", setting: "indoor", indoor: true, description: "City park" }, true)));
  assert.ok(!/Indoor/i.test(highlightReason({ name: "Disney's Animal Kingdom", type: "animal theme park, theme park", setting: "mixed", description: "Park" }, true)));
  assert.ok(!/Indoor/i.test(highlightReason({ name: "Orlando Zoo", type: "zoo", setting: "indoor", indoor: true, description: "Zoo" }, true)));
  assert.match(highlightReason({ name: "Orlando Museum of Art", type: "art museum", setting: "indoor", indoor: true, description: "Museum" }, true), /Indoor — good if it rains/);
});

test("v1.16.1: overnight midpoint drives use Day 1 overnight and Day 2 finish, with parks shifted later", () => {
  assert.deepEqual(overnightDriveHours(1282), { firstH: 10, secondH: 11 });
  assert.equal(overnightDay1Morning("Knoxville", 1282), "Drive day — about 10 h to Knoxville; overnight there");
  assert.equal(overnightDay2Morning(1282), "Finish the drive (~11 h) and check in");
  const wx = { source: "typical", note: "", days: Array.from({ length: 8 }, (_, i) => ({ date: `2026-12-${20 + i}`, tmax: 22, tmin: 14, summary: "Usually dry", precipProb: 0 })), stats: { avgHigh: 22, avgLow: 14, minLow: 10, maxHigh: 24, rainyDays: 0 } };
  const parks = [
    { name: "Magic Kingdom", description: "Disney theme park", indoor: false, setting: "outdoor" as const, source: "Fixture", type: "theme park" },
    { name: "Epcot", description: "Disney theme park", indoor: false, setting: "outdoor" as const, source: "Fixture", type: "theme park" },
    { name: "Disney's Hollywood Studios", description: "Disney theme park", indoor: false, setting: "outdoor" as const, source: "Fixture", type: "theme park" },
    { name: "Disney's Animal Kingdom", description: "Disney theme park", indoor: false, setting: "outdoor" as const, source: "Fixture", type: "theme park" },
    { name: "Universal Studios Florida", description: "Universal theme park", indoor: false, setting: "outdoor" as const, source: "Fixture", type: "theme park" },
  ];
  const input = { destination: "Orlando", start: "2026-12-20", end: "2026-12-27", travelers: 5, purpose: "Family", style: "Mix" as const, interests: "Disney World, theme parks", travelMode: "driving" as const, members: [{ id: "traveler-3", name: "Me", child: true, profile: "girl", age: 10 }] };
  const days = itinerary(input, wx as any, parks as any, [], [], { domestic: true, travelMode: "driving", driveMin: 1282, overnightStop: "Knoxville", countryCode: "US" });
  assert.match(days[0].morning, /about 10 h to Knoxville; overnight there/);
  assert.match(days[1].morning, /Finish the drive \(~11 h\) and check in/);
  assert.ok(isTravelOrLeaveDay(days[0]) && isTravelOrLeaveDay(days[1]));
  assert.ok(!isMajorAttraction(days[1].morning) && !isMajorAttraction(days[1].afternoon));
  const parkDays = days.filter(d => isMajorAttraction(`${d.morning} ${d.afternoon}`));
  assert.ok(parkDays.length >= 3, parkDays.map(d => d.morning).join(" | "));
  assert.ok(parkDays.every(d => !/Day 1|Day 2 ·/.test(d.label) || /Day [3-7]/.test(d.label)));
});

test("v1.16.1: what-to-wear follows stored Celsius so a °F setting does not change the advice", () => {
  const orlando = whatToWear({ tmax: 24, tmin: 15, precipProb: 10, summary: "Partly cloudy" });
  assert.equal(orlando, "Shorts & t-shirt, light jacket at night");
  // If 75°F / 59°F were wrongly treated as °C, this would suggest a coat.
  const notF = whatToWear({ tmax: 75, tmin: 59, precipProb: 10, summary: "Partly cloudy" });
  assert.notEqual(notF, orlando);
  const en = localizeEn(orlando, "us");
  assert.equal(en, orlando); // this line has no jumper
  assert.equal(localizeEn(whatToWear({ tmax: 19, tmin: 11, precipProb: 0, summary: "Usually dry" }), "us"), "T-shirt plus a hoodie");
});

test("v1.16.1: Plan steps and a friendly Generate label are in the questionnaire", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /1 Where/);
  assert.match(app, /2 When/);
  assert.match(app, /3 Who/);
  assert.match(app, /4 How you'll get there/);
  assert.match(app, /5 What you like/);
  assert.match(app, /Make my trip plan ✨/);
});

test("v1.16.1: user-visible errors are calm sentences, never raw HTTP or stacks", () => {
  assert.equal(friendlyError('Couldn\'t find "Narnia"'), 'We couldn\'t find "Narnia". Check the spelling or try a bigger city nearby.');
  assert.equal(friendlyError('Couldn\'t find home city "Xxqzt"'), 'We couldn\'t find "Xxqzt". Check the spelling or try a bigger city nearby.');
  assert.match(friendlyError("Weather unavailable for some dates. Try again later; no zero-temperature placeholders were used."), /couldn't load the weather/i);
  assert.match(friendlyError("overpass 504"), /map data is taking too long/i);
  assert.match(friendlyError(new Error("Failed to fetch")), /couldn't reach the internet/i);
  const raw = friendlyError(new Error("HTTP 502 for https://overpass.example/api/interpreter\n    at getJSON (server/fetchy.ts:60:13)"));
  assert.ok(!/HTTP 502/i.test(raw) && !/https?:\/\//.test(raw) && !/at getJSON/.test(raw));
  assert.match(raw, /try again/i);
});

test("v1.16.1: date entry shows a friendly inline message instead of failing silently", () => {
  const past = dateWarnings("2020-01-01", "2020-01-08", "2026-11-17");
  assert.match(past.past!, /in the past/i);
  const order = dateWarnings("2026-12-27", "2026-12-20", "2026-11-17");
  assert.match(order.order!, /end date is before the start date/i);
  const long = dateWarnings("2026-12-01", "2027-01-15", "2026-11-17");
  assert.match(long.long!, /longer than 30 days/i);
  const ok = dateWarnings("2026-12-20", "2026-12-27", "2026-11-17");
  assert.equal(ok.past, undefined);
  assert.equal(ok.order, undefined);
  assert.equal(ok.long, undefined);
});
