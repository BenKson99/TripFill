import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { itinerary } from "../server/plan.js";
import { runActivitySchedule } from "../server/activityItinerary.js";
import { isTravelOrLeaveDay, isMajorAttraction, KIDS_POOL_REST, fillPreferredParks, interestBrands } from "../shared/family.js";
import { isLodgingOrStay } from "../shared/nationalParks.js";
import { isCinemaOrCityTheatre, isJunkSight, isJunkEat, isSportsBar, isParkOrPlazaDinner, isUnsolicitedReligiousAttraction, filterDinnerList, filterHighlightList } from "../shared/junkVenues.js";
import { curatedInterestVenues, optionalFarInterestNotes, keywordInterestHits, curatedIndoorBackups } from "../shared/interestVenues.js";
import { resolveActivities, detectActivities } from "../shared/activities.js";
import { isRainy, isWet, typicalPrecipSummary, precipProbLabel, wetDaysSummary, precipKind } from "../shared/precip.js";
import { whatToWear } from "../shared/wear.js";
import { INFANT_PASSPORT_TASK } from "../shared/travelAdvice.js";
import { defaultPrep } from "../src/Prep.js";
import { fixture } from "./fixtures.js";

const INTERESTS = "Disney World, theme parks, princesses, rides";
const orlandoMembers = [
  { id: "traveler-1", name: "Mom", profile: "woman" as const },
  { id: "traveler-2", name: "Dad", profile: "man" as const },
  { id: "traveler-3", name: "Girl", profile: "girl" as const, child: true, age: 10 },
  { id: "traveler-4", name: "Boy", profile: "boy" as const, child: true, age: 6 },
  { id: "traveler-5", name: "Baby", profile: "infant" as const, child: true, age: 1 },
];

export function orlandoLiveInput() {
  const interests = INTERESTS;
  return {
    destination: "Orlando",
    homeCity: "Detroit",
    start: "2026-12-20",
    end: "2026-12-27",
    travelers: 5,
    purpose: "Family",
    style: "Mix" as const,
    travelMode: "driving" as const,
    interests,
    activities: resolveActivities({ interests, purpose: "Family" }),
    members: orlandoMembers,
    today: "2026-11-17",
    tz: "America/Detroit",
  };
}

function orlandoWx() {
  const days = Array.from({ length: 8 }, (_, i) => {
    const date = new Date(Date.UTC(2026, 11, 20 + i)).toISOString().slice(0, 10);
    return { date, tmax: 24, tmin: 14, precipProb: 20, precipMm: 0, summary: "Usually dry", typical: true };
  });
  return { days, source: "typical", stats: { avgHigh: 24, avgLow: 14, rainyDays: 0, snowDays: 0 }, elevationM: 25 } as any;
}

/** Live-shaped blurbs that 1.18.0 wrongly treated as theatres or lodging. */
const orlandoHl = [
  { name: "Magic Kingdom", type: "theme park", setting: "outdoor" as const, indoor: false, source: "Wikipedia/Wikidata", description: "A theme park at Walt Disney World Resort with castle-forecourt theater shows." },
  { name: "EPCOT", type: "theme park", setting: "outdoor" as const, indoor: false, source: "Wikipedia/Wikidata", description: "A theme park at Walt Disney World Resort known for its showcase and theater attractions." },
  { name: "Disney's Hollywood Studios", type: "theme park", setting: "outdoor" as const, indoor: false, source: "Wikipedia/Wikidata", description: "A Disney park at Walt Disney World Resort with working studios and theaters." },
  { name: "Disney's Animal Kingdom", type: "theme park", setting: "outdoor" as const, indoor: false, source: "Wikipedia/Wikidata", description: "A zoological theme park at Walt Disney World Resort." },
  { name: "Typhoon Lagoon", type: "water park", setting: "outdoor" as const, indoor: false, source: "Wikipedia/Wikidata", description: "A Disney water park." },
  { name: "Universal's Islands of Adventure", type: "theme park", setting: "outdoor" as const, indoor: false, source: "Wikipedia/Wikidata", description: "A Universal Orlando theme park.", dayTrip: false, driveMin: 25, distanceKm: 15 },
  { name: "Holy Land Experience", type: "theme park", setting: "outdoor" as const, indoor: false, source: "Wikipedia/Wikidata", description: "A Christian theme park and bible museum." },
  { name: "Icon Park", type: "park", setting: "outdoor" as const, indoor: false, source: "osm", description: "An entertainment complex." },
  { name: "Lake Eola Park", type: "park", setting: "outdoor" as const, indoor: false, source: "osm", description: "A downtown lake and park." },
  { name: "Orange County Regional History Center", type: "museum", setting: "indoor" as const, indoor: true, source: "wikidata", description: "Local history museum." },
] as any[];

const orlandoEats = [
  { name: "The Polite Pig", tag: "restaurant", kind: "restaurant" },
  { name: "Champions Sports Bar", tag: "sports bar", kind: "restaurant" },
  { name: "Parque de las Palapas", tag: "plaza", kind: "attraction" },
];

test("v1.18.1: live-form activities detect Disney World and theme parks", () => {
  const ids = detectActivities(INTERESTS);
  assert.ok(ids.includes("parks"), ids.join(","));
  const resolved = orlandoLiveInput().activities;
  assert.ok(resolved.includes("parks"));
  assert.ok(resolved.includes("family"));
  assert.deepEqual(interestBrands("Disney World"), ["disney"]);
  assert.deepEqual(interestBrands("Disney, theme parks"), ["disney"]);
});

test("v1.18.1: theme parks are not junk theatres or lodging just because a blurb mentions a theatre or resort", () => {
  for (const h of orlandoHl.filter(x => /Magic Kingdom|EPCOT|Hollywood Studios|Animal Kingdom/i.test(x.name))) {
    assert.equal(isCinemaOrCityTheatre(h), false, h.name);
    assert.equal(isJunkSight(h), false, h.name);
    assert.equal(isLodgingOrStay(h), false, h.name);
  }
  assert.ok(isCinemaOrCityTheatre({ name: "Teatro de la Ciudad", type: "cultural centre" }));
  assert.ok(isLodgingOrStay({ name: "Disney's Animal Kingdom Lodge", type: "hotel" }));
  assert.ok(isLodgingOrStay("Maswik Lodge"));
  const kept = filterHighlightList(orlandoHl).map(h => h.name).join("\n");
  assert.match(kept, /Magic Kingdom/);
  assert.match(kept, /EPCOT/);
  assert.match(kept, /Hollywood Studios/);
  assert.match(kept, /Animal Kingdom/);
});

test("v1.18.1: Disney / Disney World both schedule the four main Orlando parks, not Holy Land Experience", () => {
  for (const phrase of ["Disney World, theme parks", "Disney, theme parks"]) {
    const names = curatedInterestVenues(phrase, { name: "Orlando", countryCode: "US", admin1: "Florida" }).map(s => s.name).join("\n");
    assert.match(names, /Magic Kingdom/);
    assert.match(names, /EPCOT/);
    assert.match(names, /Hollywood Studios/);
    assert.match(names, /Animal Kingdom/);
  }
  const hits = keywordInterestHits("Disney World", orlandoHl).map(h => h.name).join("\n");
  assert.match(hits, /Magic Kingdom/);
  assert.ok(isUnsolicitedReligiousAttraction({ name: "Holy Land Experience", type: "theme park" }, INTERESTS));
  assert.ok(!isUnsolicitedReligiousAttraction({ name: "Holy Land Experience" }, "churches and the Holy Land"));
});

test("v1.18.1: an Orlando family itinerary is one park per day with pool rest, preferring Disney parks", () => {
  const inp = orlandoLiveInput();
  const days = itinerary(inp as any, orlandoWx(), orlandoHl, orlandoEats as any, orlandoHl.filter(h => h.indoor), {
    domestic: true, travelMode: "driving", destName: "Orlando", countryCode: "US", driveMin: 17 * 60,
  });
  runActivitySchedule(days, inp as any, orlandoWx(), orlandoHl, ["parks", "kids"] as any, "Orlando", { restaurants: orlandoEats });
  const mid = days.filter(d => !isTravelOrLeaveDay(d));
  const text = mid.map(d => `${d.label}: ${d.morning} / ${d.afternoon} / ${d.evening}`).join("\n");
  assert.match(text, /Magic Kingdom/);
  assert.match(text, /EPCOT|Epcot/);
  assert.match(text, /Hollywood Studios/);
  assert.match(text, /Animal Kingdom/);
  assert.ok(!/Holy Land/i.test(text), text);
  assert.ok(!/Champions Sports Bar|Parque de las Palapas/i.test(text), text);
  for (const d of mid) {
    const majors = [d.morning, d.afternoon].filter(s => isMajorAttraction(s));
    assert.ok(majors.length <= 1, `${d.label} has two majors: ${d.morning} / ${d.afternoon}`);
  }
  assert.ok(mid.some(d => d.afternoon === KIDS_POOL_REST || /pool|rest at the hotel/i.test(d.afternoon)), text);
  const disneyDays = mid.filter(d => /Magic Kingdom|EPCOT|Epcot|Hollywood Studios|Animal Kingdom/i.test(`${d.morning} ${d.afternoon}`));
  assert.ok(disneyDays.length >= 4, text);
});

test("v1.18.1: sports bars and plazas are dropped from kid restaurant and dinner lists", () => {
  assert.ok(isSportsBar({ name: "Champions Sports Bar", tag: "sports bar" }));
  assert.ok(isJunkEat({ name: "Champions Sports Bar", tag: "sports bar" }));
  assert.ok(isParkOrPlazaDinner("Parque de las Palapas"));
  assert.ok(isJunkEat({ name: "Parque de las Palapas", tag: "plaza" }));
  assert.ok(!isParkOrPlazaDinner({ name: "Plaza Garibaldi Restaurant", tag: "restaurant" }));
  const dinners = filterDinnerList(orlandoEats, { kids: true });
  assert.deepEqual(dinners.map(e => e.name), ["The Polite Pig"]);
});

test("v1.18.1: wet-day labels, notes and rain-jacket wear share the 50% threshold", () => {
  const dry = { precipProb: 33, precipMm: 0, typical: true, summary: "Usually dry", tmax: 29, tmin: 23 };
  const wet = { precipProb: 67, precipMm: 0, typical: true, summary: "Often wet", tmax: 29, tmin: 23 };
  assert.equal(isRainy(dry), false);
  assert.equal(isWet(dry), false);
  assert.equal(isRainy(wet), true);
  assert.equal(typicalPrecipSummary(33, "none"), "Usually dry");
  assert.equal(typicalPrecipSummary(67, "rain"), "Some rain likely");
  assert.match(precipProbLabel(dry, precipKind(dry)), /usually dry/i);
  assert.match(precipProbLabel(wet, precipKind(wet)), /wet in sampled years/i);
  assert.equal(wetDaysSummary([dry, dry, wet, dry, dry, dry, dry, wet]).label, "Wet days ~2");
  assert.ok(!/light rain jacket/i.test(whatToWear(dry)));
  assert.match(whatToWear(wet), /light rain jacket/i);
});

test("v1.18.1: a wet departure day gets a short rain note", () => {
  const wx = orlandoWx();
  wx.days[wx.days.length - 1] = { ...wx.days[wx.days.length - 1], precipProb: 67, summary: "Often wet" };
  const days = itinerary(orlandoLiveInput() as any, wx, orlandoHl, [], [], { domestic: true, travelMode: "driving", destName: "Orlando", countryCode: "US" });
  const depart = days[days.length - 1];
  assert.match(depart.label, /Depart/);
  assert.match(depart.notes, /Wet departure/i);
});

test("v1.18.1: optional Cancún day trips use real drive times, named indoor backups, and a specific infant passport line", () => {
  const dest = { name: "Cancún", country: "Mexico", countryCode: "MX" };
  const notes = optionalFarInterestNotes("pyramids", dest, true).join("\n");
  assert.match(notes, /Optional big day trip: Chichén Itzá \(~2\.5 h by bus\) or Tulum \(~2 h\) — a grown-up decides/);
  assert.ok(!/\(ask a grown-up\)/i.test(notes), notes);
  const indoor = curatedIndoorBackups(dest).map(s => s.name).join("\n");
  assert.match(indoor, /Museo Maya de Cancún/);
  assert.match(indoor, /Aquarium|La Isla/i);
  assert.equal(INFANT_PASSPORT_TASK, "Baby needs their own passport (grown-up task)");
  const p: any = fixture();
  p.input = { members: orlandoMembers, travelMode: "flying", start: "2027-03-20", end: "2027-03-27" };
  p.place = { name: "Cancún", country: "Mexico", countryCode: "MX" };
  p.trip = { domestic: false, home: { countryCode: "US", name: "Detroit" } };
  assert.match(defaultPrep(p).map(t => t.task).join("\n"), /Baby needs their own passport/);
});

async function freePort() {
  const s = createServer();
  await new Promise<void>(r => s.listen(0, "127.0.0.1", r));
  const port = (s.address() as any).port;
  await new Promise<void>(r => s.close(() => r()));
  return port;
}

test("v1.18.1: cold-cache Orlando generate with live-form activities schedules Disney parks", { timeout: 120000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "tf-v181-orlando-"));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  let child: ChildProcess | undefined;
  let logs = "";
  try {
    child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
      env: { ...process.env, NODE_ENV: "production", PORT: String(port), HOST: "127.0.0.1", TRIPFILL_CACHE_DIR: join(root, "cache"), TRIPFILL_SHARE_DIR: join(root, "shares"), TRIPFILL_DISABLE_AI: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", b => { logs += b; });
    child.stderr?.on("data", b => { logs += b; });
    let up = false;
    for (let i = 0; i < 100; i++) {
      if (child.exitCode != null) throw new Error("server exited: " + logs);
      try { if ((await fetch(`${base}/healthz`)).ok) { up = true; break; } } catch {}
      await delay(50);
    }
    if (!up) throw new Error("server did not start: " + logs);
    const r = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orlandoLiveInput()),
    });
    const raw = await r.text();
    assert.equal(r.status, 200, raw.slice(0, 2000));
    const plan = JSON.parse(raw);
    const days = plan.itinerary || [];
    const mid = days.filter((d: any) => !/Arrive|Depart/i.test(d.label || ""));
    const text = mid.map((d: any) => `${d.label}: ${d.morning} / ${d.afternoon} / ${d.evening}`).join("\n");
    assert.match(text, /Magic Kingdom/i);
    assert.match(text, /EPCOT|Epcot/i);
    assert.match(text, /Hollywood Studios/i);
    assert.match(text, /Animal Kingdom/i);
    assert.ok(!/Holy Land/i.test(text), text);
    const eats = (plan.eats?.restaurants || []).map((e: any) => e.name).join("\n");
    assert.ok(!/Champions Sports Bar/i.test(eats), eats);
    for (const d of mid) {
      const majors = [d.morning, d.afternoon].filter((s: string) => isMajorAttraction(s));
      assert.ok(majors.length <= 1, `${d.label} has two majors: ${d.morning} / ${d.afternoon}`);
    }
  } finally {
    if (child && child.exitCode == null) {
      const done = new Promise<void>(r => child!.once("exit", () => r()));
      child.kill("SIGTERM");
      await done;
    }
    await rm(root, { recursive: true, force: true });
  }
});
