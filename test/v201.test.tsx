import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Snapshot } from "../src/Home.js";
import { SimpleLists } from "../src/Packing.js";
import { GENERATE_STEPS, GENERATE_STEP_MS, generateStepAt, startGenerateStepTimer } from "../src/GenerateProgress.js";
import { suggestPacking, packingItems, packingProgress, SIMPLE_MUST_PACK_LIMIT } from "../shared/packing.js";
import { detectActivities, suggestActivities } from "../shared/activities.js";
import { eatBrandKey, CASUAL_DINNER_FALLBACK } from "../shared/familyEats.js";
import { familySightScore } from "../shared/junkVenues.js";
import { applyInterestAddOns, clusterPearlHarbor, unplacedInterestNotes, PEARL_HARBOR_MORNING, PEARL_HARBOR_ALSO, avoidHeavyEveningOnPearlHarbor } from "../shared/interestVenues.js";
import { splitAddOns, isRestSlot, capItinerarySlots, ensureYoungChildRest, KIDS_POOL_REST, KIDS_CITY_REST, isNamedSight } from "../shared/family.js";
import { itinerary } from "../server/plan.js";
import { fixture } from "./fixtures.js";
import { honoluluLiveInput, londonLiveInput } from "./liveInputs.js";

const g = globalThis as any;
g.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };

test("v1.20.1: generate steps advance with fake timers and paint each label", () => {
  assert.equal(generateStepAt(0), GENERATE_STEPS[0]);
  assert.equal(generateStepAt(GENERATE_STEP_MS - 1), GENERATE_STEPS[0]);
  assert.equal(generateStepAt(GENERATE_STEP_MS), GENERATE_STEPS[1]);
  assert.equal(generateStepAt(GENERATE_STEP_MS * 2), GENERATE_STEPS[2]);
  assert.equal(generateStepAt(GENERATE_STEP_MS * 9), GENERATE_STEPS[2]);

  const painted: string[] = [];
  let now = 0;
  const timers = new Map<number, { due: number; fn: () => void }>();
  let nextId = 1;
  const stop = startGenerateStepTimer(step => painted.push(step), {
    now: () => now,
    interval: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { due: now + ms, fn });
      return id as unknown as ReturnType<typeof setInterval>;
    },
    clear: id => { timers.delete(id as unknown as number); },
    flush: fn => fn(),
  });
  assert.deepEqual(painted, ["Checking the weather"]);
  const tick = (t: number) => {
    now = t;
    for (const timer of timers.values()) {
      if (timer.due <= now) {
        timer.due = now + GENERATE_STEP_MS;
        timer.fn();
      }
    }
  };
  tick(GENERATE_STEP_MS);
  assert.equal(painted.at(-1), "Finding fun places");
  tick(GENERATE_STEP_MS * 2);
  assert.equal(painted.at(-1), "Packing your bags");
  const before = painted.slice();
  tick(GENERATE_STEP_MS * 3);
  assert.equal(painted.at(-1), "Packing your bags");
  assert.deepEqual([...new Set(painted)], [...GENERATE_STEPS]);
  assert.ok(before.includes("Checking the weather") && before.includes("Finding fun places") && before.includes("Packing your bags"));
  stop();
  assert.equal(timers.size, 0);
});

test("v1.20.1: Simple mode hides Shared and Mark all packed, and the header matches what's shown", () => {
  const plan = fixture();
  const members = [
    { id: "traveler-1", name: "Mom", profile: "woman" as const },
    { id: "traveler-2", name: "Dad", profile: "man" as const },
    { id: "traveler-3", name: "Kid", profile: "girl" as const, child: true, age: 10 },
  ];
  const p = suggestPacking(plan, { laundryEvery: null, luggage: "all", members } as any);
  const html = renderToStaticMarkup(<SimpleLists p={p} readOnly={false} onCheck={() => {}} onCheckMany={() => {}} />);
  const moreIdx = html.indexOf("data-testid=\"simple-more\"");
  assert.ok(moreIdx > 0);
  const beforeMore = html.slice(0, moreIdx);
  const more = html.slice(moreIdx);
  assert.ok(!/<small class="simple-owner">Shared<\/small>/.test(beforeMore), "Shared badge stays behind More options");
  assert.ok(!/Mark all packed/.test(beforeMore), "Mark all packed stays behind More options");
  assert.ok(!/grownup-badge/.test(beforeMore), "Grown-up task badge stays behind More options");
  assert.match(more, /Mark all packed/);
  assert.match(beforeMore, /data-testid="simple-visible-count"/);
  const total = packingProgress(packingItems(p)).total;
  const showAll = beforeMore.match(/Show everything \((\d+)\)/);
  if (showAll) {
    assert.match(beforeMore, new RegExp(`0/${SIMPLE_MUST_PACK_LIMIT} packed`));
    assert.equal(showAll[1], String(total));
    assert.ok(!new RegExp(`${total} packed`).test(beforeMore.replace(/Show everything \(\d+\)/, "")));
    assert.ok(!new RegExp(`${total} items`).test(beforeMore), "helper should not say the full count while 25 show");
  } else {
    assert.match(beforeMore, new RegExp(`0/${total} packed`));
  }
});

test("v1.20.1: Pearl Harbor optional sites are a note, slots stay at 2, and the luau moves off that day", () => {
  const days = [
    { label: "Day 1 · Arrive", morning: "Travel", afternoon: "Rest", evening: "Dinner", notes: "" },
    { label: "Day 2", morning: PEARL_HARBOR_MORNING, afternoon: `${KIDS_POOL_REST}; then also: USS Missouri or Bowfin; then 🏖 Waikiki Beach`, evening: "Family luau (book ahead)", notes: "" },
    { label: "Day 3", morning: "Free morning — wander a new neighbourhood", afternoon: KIDS_CITY_REST, evening: "Dinner near your stay", notes: "" },
    { label: "Day 4 · Depart", morning: "Pack", afternoon: "Airport", evening: "Travel", notes: "" },
  ];
  clusterPearlHarbor(days, d => /Arrive|Depart/i.test(d.label), "Honolulu", [{ name: "USS Missouri" }, { name: "USS Bowfin" }, { name: "Waikiki Beach" }]);
  avoidHeavyEveningOnPearlHarbor(days, d => /Arrive|Depart/i.test(d.label));
  capItinerarySlots(days, 2);
  const host = days[1];
  assert.equal(host.morning, PEARL_HARBOR_MORNING);
  assert.match(host.notes || "", new RegExp(PEARL_HARBOR_ALSO.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(!/Missouri or Bowfin/i.test(host.afternoon || ""), host.afternoon);
  assert.ok(splitAddOns(host.afternoon || "").length <= 2, host.afternoon);
  assert.ok(!/Waikiki/i.test(host.afternoon || ""), host.afternoon);
  assert.ok(/Waikiki/i.test(`${days[2].morning} ${days[2].afternoon}`), days.map(d => `${d.morning} / ${d.afternoon}`).join(" | "));
  assert.ok(!/luau/i.test(host.evening || ""), host.evening);
  assert.match(days[2].evening || "", /luau/i);
});

test("v1.20.1: London placed interests are not listed as we couldn't fit them", () => {
  const days = [
    { label: "Day 2", morning: "Warner Bros. Studio Tour London (book ahead)", afternoon: "Quiet rest at the hotel", evening: "Dinner", notes: "" },
    { label: "Day 3", morning: "Windsor Castle", afternoon: "Hyde Park", evening: "Dinner", notes: "" },
    { label: "Day 4", morning: "Tower of London", afternoon: "Madame Tussauds", evening: "Dinner", notes: "" },
    { label: "Day 5", morning: "Natural History Museum", afternoon: "Science Museum", evening: "Dinner", notes: "Short add-on: Ride the top deck of a red double-decker bus past Big Ben (any London bus, use a contactless card)" },
  ];
  const notes = unplacedInterestNotes("Harry Potter, castles, double-decker bus, museums", days, { name: "London", countryCode: "GB" });
  const blob = notes.join(" | ");
  assert.ok(!/Harry Potter/i.test(blob), blob);
  assert.ok(!/castles/i.test(blob), blob);
  assert.ok(!/museums/i.test(blob), blob);
  assert.ok(!/double-?decker/i.test(blob), blob);
});

test("v1.20.1: a bus ride is not glued onto a rest afternoon, and under-8 days keep a rest", () => {
  const name = "Ride the top deck of a red double-decker bus past Big Ben (any London bus, use a contactless card)";
  const restDays = [
    { label: "Day 2", morning: "Warner Bros. Studio Tour London (book ahead)", afternoon: KIDS_CITY_REST, evening: "Dinner", notes: "" },
    { label: "Day 3", morning: "Tower of London", afternoon: KIDS_CITY_REST, evening: "Dinner", notes: "" },
  ];
  applyInterestAddOns(restDays, "double-decker bus", { name: "London", countryCode: "GB" }, [], undefined, { maxAddOns: 1, youngChild: true });
  const restBlob = restDays.map(d => d.afternoon).join(" | ");
  assert.ok(!/; then /.test(restBlob), restBlob);
  assert.ok(restDays.every(d => isRestSlot(d.afternoon)), restBlob);
  assert.match(restDays.map(d => d.notes || "").join(" | "), /Short add-on:.*double-decker/i);
  const days = [
    { label: "Day 2", morning: "Warner Bros. Studio Tour London (book ahead)", afternoon: KIDS_CITY_REST, evening: "Dinner", notes: "" },
    { label: "Day 3", morning: "Natural History Museum", afternoon: "Museum of Richmond", evening: "Dinner", notes: "" },
    { label: "Day 4", morning: "Science Museum", afternoon: "Pitzhanger Manor", evening: "Dinner", notes: "" },
  ];
  const input = londonLiveInput();
  ensureYoungChildRest(days, input);
  assert.ok(isNamedSight("Museum of Richmond"));
  assert.ok(isRestSlot(days[1].afternoon) || !isNamedSight(days[1].afternoon), days[1].afternoon);
  assert.ok(isRestSlot(days[2].afternoon) || !isNamedSight(days[2].afternoon), days[2].afternoon);
  for (const d of days) {
    const sights = [d.morning, ...splitAddOns(d.afternoon)].filter(p => isNamedSight(p));
    assert.ok(sights.length <= 2, `${d.label}: ${sights.join(" | ")}`);
    assert.ok(splitAddOns(d.afternoon).some(isRestSlot) || splitAddOns(d.afternoon).length <= 1, d.afternoon);
  }
});

test("v1.20.1: well-known London kid sights outrank obscure local museums", () => {
  assert.ok(familySightScore({ name: "Science Museum", type: "museum" }) > familySightScore({ name: "Museum of Richmond", type: "museum" }));
  assert.ok(familySightScore({ name: "Natural History Museum", type: "museum" }) > familySightScore({ name: "Pitzhanger Manor", type: "historic house" }));
  assert.ok(familySightScore({ name: "London Zoo", type: "zoo" }) > familySightScore({ name: "Museum of Richmond", type: "museum" }));
});

test("v1.20.1: typing volcano suggests Hiking but does not auto-tick it", () => {
  assert.ok(!detectActivities("volcano, turtles, luau").includes("hiking"));
  assert.deepEqual(suggestActivities("volcano"), ["hiking"]);
  assert.ok(detectActivities("hiking the crater rim").includes("hiking"));
  assert.deepEqual(suggestActivities("hiking the crater rim"), []);
});

test("v1.20.1: trip type and diet wording stay kid-plain", () => {
  const dest = { name: "Honolulu", country: "United States", lat: 21.3, lon: -157.8 };
  const own = renderToStaticMarkup(<Snapshot trip={{ domestic: true, home: { name: "Seattle" }, tzLabel: "3 hours behind", destTz: "HST", distanceKm: 4300 }} dest={dest} />);
  assert.match(own, /Trip in your own country/);
  assert.ok(!/Domestic \(United States\)/.test(own), own);
  const away = renderToStaticMarkup(<Snapshot trip={{ domestic: false, home: { name: "Chicago" }, tzLabel: "6 hours ahead", destTz: "BST", distanceKm: 6300 }} dest={{ name: "London", country: "United Kingdom" }} />);
  assert.match(away, /Trip to another country/);
  assert.ok(!/>International</.test(away), away);
});

test("v1.20.1: dinner brand keys keep The-named places distinct, and the generic dinner is used at most once", () => {
  assert.equal(eatBrandKey("Zippy's"), eatBrandKey("Zippy's Nimitz"));
  assert.notEqual(eatBrandKey("The Pig and the Lady"), eatBrandKey("The Surfjack"));
  assert.equal(eatBrandKey("Wagamama Soho"), eatBrandKey("Wagamama Covent Garden"));
  const inp = {
    ...honoluluLiveInput(),
    destination: "Honolulu",
  };
  const wx = {
    days: Array.from({ length: 8 }, (_, i) => ({ date: `2027-07-0${i + 1}`, tmax: 30, tmin: 24, precipProb: 10, summary: "Usually dry", typical: true })),
    source: "typical",
    stats: { avgHigh: 30, avgLow: 24, rainyDays: 0, snowDays: 0 },
  } as any;
  const eats = [
    { name: "The Pig and the Lady", tag: "restaurant", kind: "restaurant" },
    { name: "The Surfjack", tag: "restaurant", kind: "restaurant" },
    { name: "Helena's Hawaiian Food", tag: "restaurant", kind: "restaurant" },
  ];
  const days = itinerary(inp as any, wx, [{ name: "Waikiki Beach", type: "beach" }] as any, eats as any, [], { domestic: true, travelMode: "flying", destName: "Honolulu" });
  const mid = days.filter((d: any) => !/Arrive|Depart|Travel/i.test(d.label || ""));
  const dinners = mid.map((d: any) => d.evening || "");
  const generics = dinners.filter((t: string) => t.includes(CASUAL_DINNER_FALLBACK) || /Casual family dinner near your stay/i.test(t));
  assert.ok(generics.length <= 1, dinners.join(" | "));
  assert.ok(dinners.filter((t: string) => /Pig and the Lady|Surfjack|Helena's/.test(t)).length >= 2, dinners.join(" | "));
});

async function freePort() {
  const s = createServer();
  await new Promise<void>(r => s.listen(0, "127.0.0.1", r));
  const port = (s.address() as any).port;
  await new Promise<void>(r => s.close(() => r()));
  return port;
}

async function generateLive(input: any, tag: string) {
  const root = await mkdtemp(join(tmpdir(), `tf-v201-${tag}-`));
  const port = await freePort();
  const env = { ...process.env, NODE_ENV: "production", PORT: String(port), HOST: "127.0.0.1", TRIPFILL_DISABLE_AI: "1", TRIPFILL_CACHE_DIR: join(root, "cache"), TRIPFILL_SHARE_DIR: join(root, "shares") };
  const child: ChildProcess = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], { env, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  try {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("server start timeout: " + logs)), 20000);
      const on = (c: Buffer) => { logs += c; if (logs.includes("TripFill listening")) { clearTimeout(t); resolve(); } };
      child.stdout?.on("data", on); child.stderr?.on("data", on);
      child.on("exit", code => { clearTimeout(t); reject(new Error("server exited " + code + " " + logs)); });
    });
    const r = await fetch(`http://127.0.0.1:${port}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const raw = await r.text();
    assert.equal(r.status, 200, raw.slice(0, 2000));
    return JSON.parse(raw);
  } finally {
    if (child.exitCode == null) {
      const done = new Promise<void>(r => child.once("exit", () => r()));
      child.kill("SIGTERM");
      await done;
    }
    await rm(root, { recursive: true, force: true });
  }
}

test("v1.20.1: cold-cache Honolulu generate keeps Pearl Harbor, named dinners, and a two-item slot cap", { timeout: 180000 }, async () => {
  const plan = await generateLive(honoluluLiveInput(), "honolulu");
  const mid = (plan.itinerary || []).filter((d: any) => !/Arrive|Depart/i.test(d.label || ""));
  const text = mid.map((d: any) => `${d.label}: ${d.morning} / ${d.afternoon} / ${d.evening} / ${d.notes || ""}`).join("\n");
  const pearlSites = (plan.highlights || []).filter((h: any) => /uss arizona|uss missouri|uss bowfin|pearl harbor|ford island/i.test(h.name || ""));
  if (pearlSites.length) {
    const pearlDays = mid.filter((d: any) => /pearl harbor —|uss arizona/i.test(d.morning || ""));
    assert.equal(pearlDays.length, 1, text);
    assert.equal(pearlDays[0].morning, PEARL_HARBOR_MORNING, text);
    assert.match(pearlDays[0].notes || "", /Optional: also tour the USS Missouri or USS Bowfin/);
    assert.ok(!/Missouri or Bowfin/i.test(pearlDays[0].afternoon || ""), pearlDays[0].afternoon);
    assert.ok(!/luau/i.test(pearlDays[0].evening || "") || mid.filter((d: any) => /luau/i.test(d.evening || "")).length <= 1 && mid.some((d: any) => d !== pearlDays[0] && /luau/i.test(d.evening || "")), text);
    const waikikiElsewhere = mid.some((d: any) => d !== pearlDays[0] && /waik[iī]k[iī]/i.test(`${d.morning} ${d.afternoon}`));
    const waikikiOnPearlAfternoon = /waik[iī]k[iī]/i.test(pearlDays[0].afternoon || "");
    assert.ok(waikikiElsewhere || !waikikiOnPearlAfternoon, text);
  }
  for (const d of mid) {
    assert.ok(splitAddOns(d.afternoon || "").length <= 2, `${d.label}: ${d.afternoon}`);
    assert.ok(!/; then .*; then /i.test(d.afternoon || ""), d.afternoon);
  }
  const dinners = mid.map((d: any) => d.evening || "");
  const generics = dinners.filter((t: string) => /Casual family dinner near your stay/i.test(t));
  assert.ok(generics.length <= 1, dinners.join(" | "));
});

test("v1.20.1: cold-cache London generate does not contradict placed interests and rests under-8 days", { timeout: 180000 }, async () => {
  const plan = await generateLive(londonLiveInput(), "london");
  const mid = (plan.itinerary || []).filter((d: any) => !/Arrive|Depart/i.test(d.label || ""));
  const text = mid.map((d: any) => `${d.label}: ${d.morning} / ${d.afternoon} / ${d.notes || ""}`).join("\n");
  const advice = [...(plan.activityNotes || []), ...(plan.notes || []), ...mid.map((d: any) => d.notes || "")].join("\n");
  assert.ok(!/We couldn't fit: Harry Potter/i.test(advice), advice);
  assert.ok(!/We couldn't fit: castles/i.test(advice), advice);
  assert.ok(!/We couldn't fit: museums/i.test(advice), advice);
  for (const d of mid) {
    const afternoon = d.afternoon || "";
    assert.ok(!/Quiet rest.*; then Ride the top deck/i.test(afternoon), afternoon);
    assert.ok(splitAddOns(afternoon).length <= 2, afternoon);
    const sights = [d.morning, ...splitAddOns(afternoon)].filter((p: string) => isNamedSight(p));
    assert.ok(sights.length <= 2, `${d.label}: ${sights.join(" | ")}`);
    assert.ok(splitAddOns(afternoon).some(isRestSlot) || sights.length <= 1, `${d.label}: ${afternoon}`);
  }
  const blob = text + " " + mid.map((d: any) => d.rainyBackup || "").join(" ");
  const obscure = /Museum of Richmond|Pitzhanger Manor/i.test(blob);
  const known = /Science Museum|Natural History Museum|London Zoo|Kew|Thames/i.test(blob);
  if (obscure) assert.ok(known, text);
  void known;
});
