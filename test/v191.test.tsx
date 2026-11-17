import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { itinerary } from "../server/plan.js";
import { runActivitySchedule } from "../server/activityItinerary.js";
import { isTravelOrLeaveDay, capDayNotes, kidsRestAfternoon, KIDS_POOL_REST, KIDS_CITY_REST, isWarmResortDestination, isLongHikeMorning, stripOrphanHikeContinues, ensureParkDayRest, isLightActivity } from "../shared/family.js";
import { curatedInterestVenues, applyInterestVenues, attachCuratedInterestNotes, clusterPearlHarbor, withKidHint, applyInterestAddOns, PEARL_HARBOR_MORNING, PEARL_HARBOR_ALSO } from "../shared/interestVenues.js";
import { isBarWordName, isBarVenue, filterDinnerList } from "../shared/junkVenues.js";
import { eatBrandKey, CASUAL_DINNER_FALLBACK } from "../shared/familyEats.js";
import { highlightReason } from "../shared/familyPlaces.js";
import { honoluluLiveInput, londonLiveInput } from "./liveInputs.js";

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
async function freePort() {
  const s = createServer();
  await new Promise<void>(r => s.listen(0, "127.0.0.1", r));
  const port = (s.address() as any).port;
  await new Promise<void>(r => s.close(() => r()));
  return port;
}

const DIAMOND_NOTE = "Diamond Head is an old volcano crater. The active volcano park (Hawaiʻi Volcanoes) is on the Big Island, a short flight away";

test("v1.19.1: a pre-placed Diamond Head still gets the Big Island volcano note", () => {
  const dest = { name: "Honolulu", admin1: "Hawaii", country: "United States", countryCode: "US" };
  const slots = curatedInterestVenues("volcano, turtles, luau", dest);
  const diamond = slots.find(s => /Diamond Head/i.test(s.name));
  assert.ok(diamond);
  assert.equal(diamond!.note, DIAMOND_NOTE);
  const days = [
    { label: "Day 1 · Arrive", morning: "Travel & check in", afternoon: "Rest", evening: "Dinner", notes: "" },
    { label: "Day 2", morning: "🥾 Diamond Head hike / crater (book ahead)", afternoon: "USS Missouri", evening: "Dinner", notes: "Take the day at a comfortable pace" },
    { label: "Day 3 · Depart", morning: "Pack", afternoon: "Airport", evening: "Travel home", notes: "" },
  ];
  attachCuratedInterestNotes(days, "volcano, turtles, luau", dest);
  assert.match(days[1].notes, /Diamond Head is an old volcano crater/);
  assert.match(days[1].notes, /Hawai[iʻ]i Volcanoes/);
  assert.match(days[1].notes, /short flight away/);
  applyInterestVenues(days, "volcano, turtles, luau", dest, [], d => /Arrive|Depart/i.test(d.label || ""));
  assert.match(days[1].notes, /old volcano crater/);
  const capped = capDayNotes(days[1].notes + " · with kids — keep the day light · extra filler note", 3);
  assert.match(capped, /old volcano crater/);
});

test("v1.19.1: kid dinner slots drop names that contain the word Bar, but not Barbecue or Barcelona", () => {
  assert.ok(isBarWordName("Tiki's Grill & Bar"));
  assert.ok(isBarVenue("Bar Leather Apron"));
  assert.ok(!isBarWordName("Barbecue Joint"));
  assert.ok(!isBarWordName("Barcelona Tapas"));
  assert.ok(!isBarWordName("Island Juice Bar"));
  const dinners = filterDinnerList([
    { name: "Tiki's Grill & Bar", tag: "grill" },
    { name: "Barbecue Joint", tag: "restaurant" },
    { name: "Barcelona Tapas", tag: "spanish" },
    { name: "Duke's Waikiki", tag: "restaurant" },
  ], { kids: true });
  assert.deepEqual(dinners.map(e => e.name), ["Barbecue Joint", "Barcelona Tapas", "Duke's Waikiki"]);
  const adult = filterDinnerList([{ name: "Tiki's Grill & Bar", tag: "grill" }], { kids: false });
  assert.equal(adult.length, 1);
});

test("v1.19.1: dinner brand keys treat Zippy's branches as the same chain", () => {
  assert.equal(eatBrandKey("Zippy's"), eatBrandKey("Zippy's Nimitz"));
  assert.equal(eatBrandKey("Zippy's"), eatBrandKey("Zippy's Makiki"));
  assert.notEqual(eatBrandKey("Zippy's"), eatBrandKey("Helena's Hawaiian Food"));
  const food = [
    { name: "Zippy's", tag: "restaurant" },
    { name: "Zippy's Nimitz", tag: "restaurant" },
    { name: "Zippy's Makiki", tag: "restaurant" },
    { name: "Helena's Hawaiian Food", tag: "restaurant" },
    { name: "Duke's Waikiki", tag: "restaurant" },
  ];
  const days = itinerary(honoluluLiveInput() as any, {
    days: Array.from({ length: 8 }, (_, i) => ({ date: `2027-07-0${i + 1}`, tmax: 31, tmin: 24, precipProb: 20, precipMm: 1, typical: true, summary: "Usually sunny" })),
    source: "typical", stats: { avgHigh: 31, avgLow: 24, rainyDays: 0, snowDays: 0 },
  } as any, [], food as any, [], { domestic: true, travelMode: "flying", destName: "Honolulu", countryCode: "US" });
  const named = days.filter(d => !/Arrive|Depart/i.test(d.label || "")).map(d => d.evening || "");
  const zippy = named.filter(e => /Zippy/i.test(e));
  assert.ok(zippy.length <= 1, named.join(" | "));
  assert.ok(named.some(e => /Helena|Duke/i.test(e)), named.join(" | "));
});

test("v1.19.1: hike-continues only stays on a day whose morning is a long hike", () => {
  assert.ok(isLongHikeMorning("🥾 Day hike (start early; driest day in the forecast)"));
  assert.ok(!isLongHikeMorning("Beginner surf lesson at Waikīkī (book a family lesson)"));
  assert.ok(!isLongHikeMorning("Laniakea Beach on the North Shore — view sea turtles from a respectful distance (10 ft)"));
  const days = [
    { morning: "Beginner surf lesson at Waikīkī (book a family lesson)", afternoon: "🥾 Hike continues — back by late afternoon; then Explore a market or local street" },
    { morning: "🥾 Day hike (start early; driest day in the forecast)", afternoon: "🥾 Hike continues — back by late afternoon; then a rim view" },
  ];
  stripOrphanHikeContinues(days, "Honolulu");
  assert.ok(!/Hike continues/i.test(days[0].afternoon), days[0].afternoon);
  assert.match(days[1].afternoon, /Hike continues/);
});

test("v1.19.1: USS Arizona uses a boat-ticket hint, and Pearl Harbor sites cluster on 1–2 slots", () => {
  assert.match(withKidHint("USS Arizona Memorial", { type: "memorial" }), /boat ride to the memorial — free timed tickets, book ahead/i);
  assert.ok(!/indoor exhibits/i.test(withKidHint("USS Arizona Memorial", { type: "museum", description: "Pearl Harbor memorial" })));
  assert.match(highlightReason({ name: "USS Arizona Memorial", type: "memorial", indoor: true, setting: "indoor" }, true), /boat ride to the memorial/i);
  const days = [
    { label: "Day 2", morning: "Waikiki Beach", afternoon: "USS Missouri (battleship you can walk through)", evening: "Dinner", notes: "" },
    { label: "Day 3", morning: "USS Arizona Memorial", afternoon: "pool", evening: "Dinner", notes: "" },
    { label: "Day 4", morning: "USS Bowfin (submarine you can walk through)", afternoon: "rest", evening: "Dinner", notes: "" },
    { label: "Day 5", morning: "Pearl Harbor National Memorial", afternoon: "rest", evening: "Dinner", notes: "" },
  ];
  clusterPearlHarbor(days, d => false, "Honolulu");
  const pearlDays = days.filter(d => /pearl harbor —|uss arizona|uss missouri|uss bowfin|pearl harbor national/i.test(`${d.morning} ${d.afternoon}`));
  assert.equal(pearlDays.length, 1, days.map(d => `${d.morning} / ${d.afternoon}`).join(" | "));
  const host = pearlDays[0];
  assert.equal(host.morning, PEARL_HARBOR_MORNING);
  assert.match(host.afternoon || "", /also: USS Missouri or Bowfin/);
});

test("v1.19.1: a double-decker is a short add-on and is not wiped by a park-day rest", () => {
  const name = "Ride the top deck of a red double-decker bus past Big Ben (any London bus, use a contactless card)";
  assert.ok(isLightActivity(name));
  const slots = curatedInterestVenues("double-decker bus, museums", { name: "London", countryCode: "GB" });
  assert.ok(slots.some(s => s.name === name));
  assert.ok(!/route 11 or 15/i.test(slots.map(s => s.name).join(" ")));
  const days = [
    { label: "Day 2", morning: "Warner Bros. Studio Tour London (book ahead)", afternoon: name, evening: "Dinner" },
    { label: "Day 3", morning: "Natural History Museum", afternoon: "Explore a market or local street", evening: "Dinner" },
  ];
  ensureParkDayRest(days as any, "London");
  const blob = days.map(d => `${d.morning} / ${d.afternoon}`).join(" | ");
  assert.match(blob, /double-decker bus past Big Ben/);
  assert.match(blob, /Quiet rest at the hotel or a nearby park\/playground/);
  const empty = [
    { label: "Day 2", morning: "Warner Bros. Studio Tour London (book ahead)", afternoon: "Explore a market or local street", evening: "Dinner" },
    { label: "Day 3", morning: "Natural History Museum", afternoon: KIDS_CITY_REST, evening: "Dinner" },
  ];
  applyInterestAddOns(empty, "double-decker bus", "London", [], d => false);
  assert.ok(empty.some(d => /double-decker bus past Big Ben/i.test(d.afternoon)), empty.map(d => d.afternoon).join(" | "));
});

test("v1.19.1: family dinner fallback prefers a named place and says family-friendly pub", () => {
  assert.match(CASUAL_DINNER_FALLBACK, /family-friendly pub/);
  assert.ok(!/\ba pub\b/.test(CASUAL_DINNER_FALLBACK.replace("family-friendly pub", "")));
  const inp = londonLiveInput();
  const wx = {
    days: Array.from({ length: 8 }, (_, i) => ({ date: `2027-07-${String(10 + i).padStart(2, "0")}`, tmax: 22, tmin: 14, precipProb: 30, precipMm: 1, typical: true, summary: "Some rain likely" })),
    source: "typical", stats: { avgHigh: 22, avgLow: 14, rainyDays: 0, snowDays: 0 },
  } as any;
  const days = itinerary(inp as any, wx, [], [
    { name: "Pizza Pilgrims", tag: "pizza" },
    { name: "Wagamama", tag: "japanese" },
  ] as any, [], {
    domestic: false, travelMode: "flying", destName: "London", countryCode: "GB",
    cafes: [{ name: "The Breakfast Club", kind: "cafe", tag: "cafe", source: "OpenStreetMap" } as any],
  });
  const evenings = days.filter(d => !/Arrive|Depart/i.test(d.label || "")).map(d => d.evening);
  assert.ok(evenings.some(e => /Pizza Pilgrims|Wagamama/i.test(e || "")), evenings.join(" | "));
  assert.ok(!evenings.some(e => /Breakfast Club|Coffee House/i.test(e || "")), evenings.join(" | "));
});

test("v1.19.1: cool city destinations use a park rest, not a hotel pool", () => {
  assert.equal(isWarmResortDestination("Honolulu"), true);
  assert.equal(isWarmResortDestination("Cancún, Mexico"), true);
  assert.equal(isWarmResortDestination("Orlando"), true);
  assert.equal(isWarmResortDestination("London"), false);
  assert.equal(kidsRestAfternoon("London"), KIDS_CITY_REST);
  assert.equal(kidsRestAfternoon("Honolulu"), KIDS_POOL_REST);
  const days = [
    { label: "Day 2", morning: "Warner Bros. Studio Tour London (book ahead)", afternoon: "Explore a market or local street" },
  ];
  ensureParkDayRest(days as any, "London");
  assert.equal(days[0].afternoon, KIDS_CITY_REST);
  const orlando = [
    { label: "Day 2", morning: "Magic Kingdom", afternoon: "Explore a market or local street" },
  ];
  ensureParkDayRest(orlando as any, "Orlando");
  assert.equal(orlando[0].afternoon, KIDS_POOL_REST);
});

async function generateLive(input: object, label: string) {
  const root = await mkdtemp(join(tmpdir(), `tf-v191-${label}-`));
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
      body: JSON.stringify(input),
    });
    const raw = await r.text();
    assert.equal(r.status, 200, raw.slice(0, 2000));
    return JSON.parse(raw);
  } finally {
    if (child && child.exitCode == null) {
      const done = new Promise<void>(r => child!.once("exit", () => r()));
      child.kill("SIGTERM");
      await done;
    }
    await rm(root, { recursive: true, force: true });
  }
}

test("v1.19.1: cold-cache Honolulu generate keeps the volcano note, unique brands, and clustered Pearl Harbor", { timeout: 180000 }, async () => {
  const plan = await generateLive(honoluluLiveInput(), "honolulu");
  const mid = (plan.itinerary || []).filter((d: any) => !/Arrive|Depart/i.test(d.label || ""));
  const text = mid.map((d: any) => `${d.label}: ${d.morning} / ${d.afternoon} / ${d.evening} | ${d.notes || ""}`).join("\n");
  assert.match(text, /Diamond Head/i);
  assert.match(text, /old volcano crater/);
  assert.match(text, /short flight away/);
  assert.ok(!/Tiki'?s Grill & Bar/i.test(text), text);
  const dinners = mid.map((d: any) => d.evening || "");
  const zippy = dinners.filter((e: string) => /Zippy/i.test(e));
  assert.ok(zippy.length <= 1, dinners.join(" | "));
  for (const d of mid) {
    if (/Hike continues/i.test(d.afternoon || "")) {
      assert.ok(isLongHikeMorning(d.morning), `${d.label}: ${d.morning} / ${d.afternoon}`);
    }
  }
  assert.ok(!/USS Arizona Memorial \(indoor exhibits\)/i.test(text), text);
  if (/USS Arizona|Pearl Harbor —/i.test(text)) assert.match(text, /boat ride/i);
  const pearlDays = mid.filter((d: any) => /uss arizona|uss missouri|uss bowfin|pacific aviation museum|pearl harbor national memorial/i.test(`${d.morning} ${d.afternoon}`));
  assert.ok(pearlDays.length <= 1, text);
  const beachDays = mid.filter((d: any) => /🏖|Waikiki Beach|Kailua|Ala Moana|Hanauma|Ko Olina/i.test(`${d.morning} ${d.afternoon}`));
  if (beachDays.length) assert.ok(mid.some((d: any) => d.afternoon === KIDS_POOL_REST || /Hotel pool/i.test(d.afternoon || "")), text);
});

test("v1.19.1: cold-cache London generate places the double-decker, names a dinner, and skips the pool", { timeout: 180000 }, async () => {
  const plan = await generateLive(londonLiveInput(), "london");
  const mid = (plan.itinerary || []).filter((d: any) => !/Arrive|Depart/i.test(d.label || ""));
  const text = mid.map((d: any) => `${d.label}: ${d.morning} / ${d.afternoon} / ${d.evening} | ${d.notes || ""}`).join("\n");
  const advice = (plan.activityNotes || []).join("\n");
  assert.match(`${text}\n${advice}`, /double-decker bus past Big Ben/i);
  assert.ok(!/We couldn't fit:.*double-?decker/i.test(advice), advice);
  assert.ok(!/route 11 or 15/i.test(text));
  const evenings = mid.map((d: any) => d.evening || "");
  assert.ok(evenings.some((e: string) => /Dinner:|Early dinner/i.test(e) && !/Casual family dinner near your stay/i.test(e)), evenings.join(" | "));
  assert.ok(!evenings.some((e: string) => /\(pizza, a pub or a cafe\)/i.test(e)), evenings.join(" | "));
  assert.ok(!mid.some((d: any) => /Hotel pool/i.test(d.afternoon || "")), text);
  assert.ok(mid.some((d: any) => /Quiet rest at the hotel or a nearby park\/playground/i.test(d.afternoon || "")), text);
});
