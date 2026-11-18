import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WrongPlace } from "../src/Home.js";
import { TravelerFields } from "../src/Travelers.js";
import { SimpleLists, PackingWorkspace } from "../src/Packing.js";
import { GENERATE_STEPS } from "../src/GenerateProgress.js";
import { suggestPacking, type PackingList, packingItems, SIMPLE_MUST_PACK_LIMIT } from "../shared/packing.js";
import { weatherLabel } from "../shared/portable.js";
import { filterDinnerList, isCoffeeVenue, isDefunctOrHistoricVenue, filterHighlightList, isIndustrialOrAirportBeach } from "../shared/junkVenues.js";
import { clusterPearlHarbor, PEARL_HARBOR_MORNING, PEARL_HARBOR_ALSO } from "../shared/interestVenues.js";
import { scheduledHighlightDay } from "../shared/highlightSchedule.js";
import { dedupeRestAfternoon, KIDS_POOL_REST, KIDS_CITY_REST, splitAddOns, isRestSlot } from "../shared/family.js";
import { fixture } from "./fixtures.js";
import { honoluluLiveInput, londonLiveInput } from "./liveInputs.js";

const g = globalThis as any;
g.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };

test("v1.20.0: generate progress uses friendly timed stages, not a bare Building your plan line", () => {
  assert.deepEqual([...GENERATE_STEPS], ["Checking the weather", "Finding fun places", "Packing your bags"]);
  assert.ok(!GENERATE_STEPS.join(" ").includes("Building your plan"));
});

test("v1.20.0: questionnaire wording is kid-friendly and still goes through T() spellings", () => {
  assert.equal(weatherLabel({ typical: true }, "typical"), "Weather guess from past years (real forecast shows ~2 weeks before)");
  assert.ok(!weatherLabel({ typical: true }, "typical").includes("Seasonal estimate"));
  const html = renderToStaticMarkup(<WrongPlace alts={[{ id: 1, name: "Honolulu", country: "United States", countryCode: "US", lat: 0, lon: 0 }]} onPick={() => {}} resolved />);
  assert.match(html, /Not the right place\? Pick another/);
  assert.ok(!/Wrong place\?/.test(html));
  const age = renderToStaticMarkup(<TravelerFields idPrefix="q" members={[{ id: "traveler-1", name: "Ada", profile: "woman", age: 70 }]} onEdit={() => {}} />);
  assert.match(age, /\(optional\)/);
  assert.ok(!/65\+/.test(age));
});

test("v1.20.0: Simple mode shows My stuff by category, hides Whose bag behind More options, and caps the list", () => {
  const plan = fixture();
  plan.input.travelers = 3;
  plan.input.purpose = "Family";
  const members = [
    { id: "traveler-1", name: "Mom", profile: "woman" },
    { id: "traveler-2", name: "Dad", profile: "man" },
    { id: "traveler-3", name: "Kid", profile: "girl", child: true, age: 10 },
  ];
  const p = suggestPacking(plan, { laundryEvery: null, luggage: "all", members } as any);
  const html = renderToStaticMarkup(<SimpleLists p={p} readOnly={false} onCheck={() => {}} onCheckMany={() => {}} />);
  const screen = html.slice(0, html.indexOf("simple-print") >= 0 ? html.indexOf("simple-print") : html.length);
  assert.match(screen, /data-testid="my-stuff-list"/);
  assert.match(screen, />My stuff</);
  assert.match(screen, /Essentials are first/);
  assert.match(screen, /data-testid="simple-more"/);
  assert.match(screen, />More options</);
  const moreIdx = screen.indexOf("data-testid=\"simple-more\"");
  const beforeMore = screen.slice(0, moreIdx);
  assert.ok(!/Whose bag\?/.test(beforeMore), "Whose bag is behind More options");
  assert.ok(!/Show people/.test(beforeMore), "Show people is behind More options");
  assert.match(screen.slice(moreIdx), /Whose bag\?/);
  if (packingItems(p).filter(i => !i.skipped).length > SIMPLE_MUST_PACK_LIMIT) {
    assert.match(screen, /Show everything \(\d+\)/);
  }
  const ws = renderToStaticMarkup(<PackingWorkspace plan={{ ...plan, packing: p }} readOnly={false} onChange={() => {}} T={s => s} simple />);
  assert.match(ws, /My stuff, grouped by category, with the must-pack items first/);
  assert.ok(!/Just the lists/.test(ws));
});

test("v1.20.0: Pearl Harbor becomes one Arizona-morning day even when only Missouri was scheduled", () => {
  const days = [
    { label: "Day 1 · Arrive", morning: "Travel", afternoon: "Rest", evening: "Dinner", notes: "" },
    { label: "Day 2", morning: "Waikiki Beach", afternoon: "USS Missouri (battleship you can walk through)", evening: "Dinner", notes: "" },
    { label: "Day 3", morning: "Free morning — wander a new neighbourhood", afternoon: KIDS_POOL_REST, evening: "Dinner", notes: "" },
    { label: "Day 4 · Depart", morning: "Pack", afternoon: "Airport", evening: "Travel", notes: "" },
  ];
  const highlights = [
    { name: "USS Arizona Memorial" }, { name: "USS Missouri" }, { name: "USS Bowfin" },
    { name: "Pearl Harbor National Memorial" }, { name: "Ford Island" },
  ];
  clusterPearlHarbor(days, d => /Arrive|Depart/i.test(d.label), "Honolulu", highlights);
  const mid = days.filter(d => !/Arrive|Depart/i.test(d.label));
  const pearl = mid.filter(d => /pearl harbor —|uss arizona|uss missouri|uss bowfin|ford island/i.test(`${d.morning} ${d.afternoon}`));
  assert.equal(pearl.length, 1, mid.map(d => `${d.morning} / ${d.afternoon}`).join(" | "));
  assert.equal(pearl[0].morning, PEARL_HARBOR_MORNING);
  assert.match(pearl[0].notes || "", /Optional: also tour the USS Missouri or USS Bowfin/);
  assert.ok(!/Missouri or Bowfin/i.test(pearl[0].afternoon || ""), pearl[0].afternoon);
  assert.ok(splitAddOns(pearl[0].afternoon || "").length <= 2, pearl[0].afternoon);
  assert.match(days[1].morning, /Waikiki Beach/);
});

test("v1.20.0: coffee houses and defunct historic venues are not dinner", () => {
  const list = [
    { name: "Lloyd's Coffee House", kind: "cafe" as const, description: "was a coffee house in London" },
    { name: "Hindoostane Coffee House", tag: "historic café", description: "was a coffee house" },
    { name: "Button's Coffee House", kind: "cafe" as const, former: true },
    { name: "Algerian Coffee Stores", kind: "cafe" as const, tag: "coffee store" },
    { name: "Zippy's", kind: "restaurant" as const, tag: "restaurant" },
    { name: "Helena's Hawaiian Food", kind: "restaurant" as const, tag: "restaurant" },
  ];
  assert.ok(isCoffeeVenue(list[0]));
  assert.ok(isDefunctOrHistoricVenue(list[0]));
  assert.ok(isDefunctOrHistoricVenue(list[2]));
  assert.ok(isCoffeeVenue(list[3]));
  const dinners = filterDinnerList(list, { kids: true });
  const names = dinners.map(e => e.name).join(" | ");
  assert.ok(!/Coffee House|Coffee Stores/i.test(names), names);
  assert.ok(dinners.some(e => e.name === "Zippy's"), names);
  assert.ok(dinners.some(e => e.name === "Helena's Hawaiian Food"), names);
});

test("v1.20.0: highlights drop industrial beaches and label scheduled vs more ideas", () => {
  assert.ok(isIndustrialOrAirportBeach("Kalaeloa Beach"));
  const kept = filterHighlightList([
    { name: "Kalaeloa Beach", type: "beach", description: "industrial lagoon near the airport" },
    { name: "Aliiolani Hale", type: "building" },
    { name: "USS Missouri", type: "museum ship" },
  ]);
  assert.ok(!kept.some(h => /Kalaeloa/i.test(h.name || "")));
  assert.ok(kept.some(h => h.name === "Aliiolani Hale"));
  const days = [
    { label: "Day 2 · Tue, Jul 2", morning: PEARL_HARBOR_MORNING, afternoon: KIDS_POOL_REST },
  ];
  assert.equal(scheduledHighlightDay("USS Arizona Memorial", days)?.dayN, "Day 2");
  assert.equal(scheduledHighlightDay("Aliiolani Hale", days), undefined);
});

test("v1.20.0: a beach afternoon keeps a single rest line", () => {
  const days = [
    { label: "Day 2", morning: "🏖 Waikiki Beach", afternoon: `${KIDS_POOL_REST}; then ${KIDS_CITY_REST}` },
  ];
  dedupeRestAfternoon(days, "Honolulu");
  const parts = splitAddOns(days[0].afternoon);
  assert.equal(parts.filter(isRestSlot).length, 1, days[0].afternoon);
  assert.equal(days[0].afternoon, KIDS_POOL_REST);
});

async function freePort() {
  const s = createServer();
  await new Promise<void>(r => s.listen(0, "127.0.0.1", r));
  const port = (s.address() as any).port;
  await new Promise<void>(r => s.close(() => r()));
  return port;
}

async function generateLive(input: any, tag: string) {
  const root = await mkdtemp(join(tmpdir(), `tf-v200-${tag}-`));
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

function afternoonRests(text: string) {
  return splitAddOns(text).filter(isRestSlot);
}

test("v1.20.0: cold-cache Honolulu generate keeps one Pearl Harbor day, no coffee dinners, and one rest line", { timeout: 180000 }, async () => {
  const plan = await generateLive(honoluluLiveInput(), "honolulu");
  const mid = (plan.itinerary || []).filter((d: any) => !/Arrive|Depart/i.test(d.label || ""));
  const text = mid.map((d: any) => `${d.label}: ${d.morning} / ${d.afternoon} / ${d.evening}`).join("\n");
  const hl = (plan.highlights || []).map((h: any) => h.name).join(" | ");
  assert.ok(!/Kalaeloa/i.test(hl), hl);
  const pearlSites = (plan.highlights || []).filter((h: any) => /uss arizona|uss missouri|uss bowfin|pearl harbor|ford island/i.test(h.name || ""));
  if (pearlSites.length) {
    const pearlDays = mid.filter((d: any) => /pearl harbor —|uss arizona|uss missouri|uss bowfin/i.test(`${d.morning} ${d.afternoon} ${d.notes || ""}`));
    assert.equal(pearlDays.length, 1, text);
    assert.equal(pearlDays[0].morning, PEARL_HARBOR_MORNING, text);
    assert.match(pearlDays[0].notes || "", /Optional: also tour the USS Missouri or USS Bowfin/);
    assert.ok(!/Missouri or Bowfin/i.test(pearlDays[0].afternoon || ""), pearlDays[0].afternoon);
  }
  const evenings = mid.map((d: any) => d.evening || "").join(" | ");
  assert.ok(!/Coffee House|Algerian Coffee Stores|Hindoostane|Lloyd's Coffee/i.test(evenings), evenings);
  for (const d of mid) {
    assert.ok(afternoonRests(d.afternoon || "").length <= 1, `${d.label}: ${d.afternoon}`);
  }
  const scheduled = (plan.highlights || []).filter((h: any) => scheduledHighlightDay(h.name, plan.itinerary || []));
  const more = (plan.highlights || []).filter((h: any) => !isIndustrialOrAirportBeach(h) && !scheduledHighlightDay(h.name, plan.itinerary || []));
  if (scheduled.length) assert.ok(scheduled.some((h: any) => scheduledHighlightDay(h.name, plan.itinerary)?.dayN));
  void more;
});

test("v1.20.0: cold-cache London generate skips coffee-house dinners and keeps a single rest line", { timeout: 180000 }, async () => {
  const plan = await generateLive(londonLiveInput(), "london");
  const mid = (plan.itinerary || []).filter((d: any) => !/Arrive|Depart/i.test(d.label || ""));
  const evenings = mid.map((d: any) => d.evening || "").join(" | ");
  assert.ok(!/Coffee House|Algerian Coffee Stores|Hindoostane|Lloyd's Coffee|Button's Coffee/i.test(evenings), evenings);
  for (const d of mid) {
    assert.ok(afternoonRests(d.afternoon || "").length <= 1, `${d.label}: ${d.afternoon}`);
    assert.ok(!/Hotel pool/i.test(d.afternoon || ""), d.afternoon);
  }
});
