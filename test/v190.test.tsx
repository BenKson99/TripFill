import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { itinerary, packing } from "../server/plan.js";
import { geocode } from "../server/weather.js";
import { rankPlaceMatches, placeChoiceScore, isSettlementPlace, isPoiPlace } from "../shared/placeQuery.js";
import { capDayNotes, capItineraryNotes } from "../shared/family.js";
import { curatedInterestVenues, unplacedInterestNotes, withKidHint, isIndoorishBackup } from "../shared/interestVenues.js";
import { isBarVenue, isBakeryOrTreat, isJunkEat, isIndustrialOrAirportBeach, isFamousFamilyBeach, familySightScore, filterDinnerList } from "../shared/junkVenues.js";
import { preferredFamilyBeaches, BEACH_SAFETY_NOTE, INFANT_PASSPORT_TASK } from "../shared/travelAdvice.js";
import { typicalPrecipSummary, rainChancePhrase, formatDayWeather, isWet, isBriefTropicalShower, wetDaysSummary } from "../shared/precip.js";
import { localizeEn } from "../shared/enLocale.js";
import { defaultPrep } from "../src/Prep.js";
import { groupPrepTasks } from "../shared/prepTiming.js";
import { startHereItems } from "../shared/packing.js";
import { highlightReason } from "../shared/familyPlaces.js";
import { resolveActivities } from "../shared/activities.js";

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function freePort() {
  const s = createServer();
  await new Promise<void>(r => s.listen(0, "127.0.0.1", r));
  const port = (s.address() as any).port;
  await new Promise<void>(r => s.close(() => r()));
  return port;
}

const T = (s: string) => localizeEn(s || "", "us");

const honoluluMembers = [
  { id: "traveler-1", name: "Mom", profile: "woman" as const },
  { id: "traveler-2", name: "Dad", profile: "man" as const },
  { id: "traveler-3", name: "Girl", profile: "girl" as const, child: true, age: 10 },
  { id: "traveler-4", name: "Boy", profile: "boy" as const, child: true, age: 8 },
  { id: "traveler-5", name: "Grandparent", profile: "grandparent" as const },
];

export function honoluluLiveInput() {
  const interests = "volcano, turtles, surfing lessons, luau, beach";
  return {
    destination: "Honolulu",
    homeCity: "Seattle",
    start: "2027-07-01",
    end: "2027-07-08",
    travelers: 5,
    purpose: "Family",
    style: "Mix" as const,
    travelMode: "flying" as const,
    interests,
    activities: resolveActivities({ interests, purpose: "Family" }),
    members: honoluluMembers,
    today: "2026-11-17",
    tz: "America/Detroit",
  };
}

const cancunInfantMembers = [
  { id: "traveler-1", name: "Mom", profile: "woman" as const },
  { id: "traveler-2", name: "Dad", profile: "man" as const },
  { id: "traveler-3", name: "Girl", profile: "girl" as const, child: true, age: 10 },
  { id: "traveler-4", name: "Grandparent", profile: "grandparent" as const },
  { id: "traveler-5", name: "Infant", profile: "infant" as const, child: true, age: 1 },
];

function city(name: string, code: string, pop: number, admin1: string, extras: { country?: string } = {}) {
  return { name, featureCode: code, population: pop, admin1, country: extras.country || "United States" };
}

test("v1.19.0: geocoding ranks cities and towns ahead of parks, stadiums and POIs", () => {
  const cases: { query: string; city: any; poi: any }[] = [
    { query: "Honolulu", city: city("Honolulu", "PPLA", 350964, "Hawaii"), poi: city("Honolulu Stadium State Park", "PRK", 0, "Hawaii") },
    { query: "Orlando", city: city("Orlando", "PPLA2", 307573, "Florida"), poi: city("Orlando Stadium Park", "PRK", 0, "Florida") },
    { query: "Cancun", city: city("Cancún", "PPLA2", 888797, "Quintana Roo", { country: "Mexico" }), poi: city("Cancun Stadium Park", "PRK", 0, "Quintana Roo", { country: "Mexico" }) },
    { query: "London", city: city("London", "PPLC", 8961989, "England", { country: "United Kingdom" }), poi: city("London Stadium", "STDM", 0, "England", { country: "United Kingdom" }) },
    { query: "Paris", city: city("Paris", "PPLC", 2138551, "Île-de-France", { country: "France" }), poi: city("Parc de Paris", "PRK", 0, "Île-de-France", { country: "France" }) },
  ];
  for (const { query, city: c, poi } of cases) {
    const ranked = rankPlaceMatches([poi, c], 4, query);
    assert.equal(ranked[0].name, c.name, `${query} ranked ${ranked[0].name} first`);
    assert.ok(isSettlementPlace(ranked[0]), query);
    assert.ok(isPoiPlace(poi), poi.name);
    assert.ok(placeChoiceScore(c, query) > placeChoiceScore(poi, query));
  }
  const gc = rankPlaceMatches([
    city("Grand Canyon Village", "PPL", 2000, "Arizona"),
    city("Grand Canyon National Park", "PRK", 0, "Arizona"),
  ], 4, "Grand Canyon");
  assert.equal(gc[0].name, "Grand Canyon National Park");
});

test("v1.19.0: live geocode prefers the city for Honolulu, Orlando, Cancun, London and Paris", { timeout: 60000 }, async () => {
  const queries = ["Honolulu", "Orlando", "Cancun", "London", "Paris"];
  for (const q of queries) {
    const matches = await geocode(q);
    assert.ok(matches.length, `no geocode results for ${q}`);
    const top = matches[0];
    assert.ok(!/stadium|state park/i.test(top.name || ""), `${q} resolved to ${top.name}`);
    assert.ok(isSettlementPlace(top) || /national park/i.test(top.name || ""), `${q} top is not a settlement: ${top.name} ${top.featureCode}`);
    const first = (top.name || "").toLowerCase();
    const q0 = q.toLowerCase().replace("cancun", "cancún");
    assert.ok(first.includes(q.toLowerCase()) || first.includes(q0) || first.startsWith("canc"), `${q} → ${top.name}`);
  }
});

test("v1.19.0: Hawaiʻi interest dictionary covers luau, turtles, surf lessons and Diamond Head", () => {
  const dest = { name: "Honolulu", admin1: "Hawaii", country: "United States", countryCode: "US" };
  const slots = curatedInterestVenues("volcano, turtles, surfing lessons, luau, beach", dest);
  const names = slots.map(s => s.name).join("\n");
  assert.match(names, /Family luau \(book ahead\)/);
  assert.match(names, /Laniakea Beach on the North Shore/);
  assert.match(names, /respectful distance \(10 ft\)/);
  assert.match(names, /Beginner surf lesson at Waik[iī]k[iī]/);
  assert.match(names, /Diamond Head/);
  const volc = slots.find(s => /Diamond Head/i.test(s.name));
  assert.match(volc?.note || "", /Hawai[iʻ]i Volcanoes National Park is on the Big Island, a short flight away/);
});

test("v1.19.0: unplaced interests are listed plainly instead of disappearing", () => {
  const days = [
    { morning: "Arrive and settle in", afternoon: "Easy walk around town", evening: "Dinner nearby", notes: "" },
  ];
  const notes = unplacedInterestNotes("volcano, turtles, luau, knitingxyz", days, { name: "Honolulu", countryCode: "US" });
  const blob = notes.join("\n");
  assert.match(blob, /We couldn't fit: volcano — try /i);
  assert.match(blob, /We couldn't fit: turtles — try /i);
  assert.match(blob, /We couldn't fit: luau — try /i);
  assert.match(blob, /We couldn't fit: knitingxyz/);
  const placed = unplacedInterestNotes("luau, turtles", [
    { morning: "Laniakea Beach on the North Shore — view sea turtles from a respectful distance (10 ft)", afternoon: "Waikiki Beach", evening: "Family luau (book ahead)", notes: "" },
  ], { name: "Honolulu" });
  assert.equal(placed.length, 0, placed.join("\n"));
});

test("v1.19.0: bars and bakeries are not dinner, and dinner names do not repeat", () => {
  assert.ok(isBarVenue("Bar Leather Apron"));
  assert.ok(isJunkEat({ name: "Bar Leather Apron", tag: "bar" }));
  assert.ok(isBakeryOrTreat("Leonard's Bakery"));
  assert.ok(!isBakeryOrTreat({ name: "Duke's Waikiki", tag: "restaurant" }));
  const dinners = filterDinnerList([
    { name: "Bar Leather Apron", tag: "bar" },
    { name: "Leonard's Bakery", tag: "bakery" },
    { name: "Duke's Waikiki", tag: "restaurant" },
    { name: "Helena's Hawaiian Food", tag: "restaurant" },
  ], { kids: true });
  assert.deepEqual(dinners.map(e => e.name), ["Duke's Waikiki", "Helena's Hawaiian Food"]);

  const food = [
    { name: "Leonard's Bakery", tag: "bakery" },
    { name: "Duke's Waikiki", tag: "restaurant" },
    { name: "Helena's Hawaiian Food", tag: "restaurant" },
    { name: "Bar Leather Apron", tag: "bar" },
    { name: "La Ronde", tag: "restaurant" },
  ];
  const days = itinerary(honoluluLiveInput() as any, {
    days: Array.from({ length: 8 }, (_, i) => ({ date: `2027-07-0${i + 1}`, tmax: 31, tmin: 24, precipProb: 20, precipMm: 1.2, precipHours: 1, typical: true, summary: "Usually sunny" })),
    source: "typical", stats: { avgHigh: 31, avgLow: 24, rainyDays: 0, snowDays: 0 },
  } as any, [], food as any, [], { domestic: true, travelMode: "flying", destName: "Honolulu", countryCode: "US" });
  const midEve = days.filter(d => !/Arrive|Depart/i.test(d.label || "")).map(d => d.evening || "");
  const named = midEve.map(e => (e.match(/Dinner(?: nearby)?: ([^(]+)/i) || e.match(/Early dinner nearby: ([^(]+)/i) || [])[1]?.trim()).filter(Boolean);
  assert.ok(!named.some(n => /Bar Leather Apron|Leonard'?s Bakery/i.test(n || "")), midEve.join(" | "));
  const counts = new Map<string, number>();
  for (const n of named) counts.set(n!, (counts.get(n!) || 0) + 1);
  for (const [n, c] of counts) assert.equal(c, 1, `dinner repeated: ${n} × ${c} (${midEve.join(" | ")})`);
});

test("v1.19.0: family beaches beat airport and industrial lagoons; ships are not indoor exhibits", () => {
  const beaches = preferredFamilyBeaches("Honolulu", "US");
  assert.ok(beaches.some(n => /Waikiki|Waikīkī/i.test(n)));
  assert.ok(beaches.some(n => /Kailua/i.test(n)));
  assert.ok(beaches.some(n => /Hanauma/i.test(n)));
  assert.ok(beaches.some(n => /Ko Olina/i.test(n)));
  assert.ok(beaches.some(n => /Ala Moana/i.test(n)));
  assert.ok(isFamousFamilyBeach("Waikiki Beach"));
  assert.ok(isIndustrialOrAirportBeach("Keʻehi Lagoon Beach Park"));
  assert.ok(isIndustrialOrAirportBeach("Kalaeloa Beach"));
  assert.ok(familySightScore({ name: "Waikiki Beach", type: "beach", views30d: 8000 }) > familySightScore({ name: "Keʻehi Lagoon Beach Park", type: "beach" }));
  assert.match(withKidHint("USS Missouri", { type: "museum ship" }), /battleship you can walk through/i);
  assert.match(withKidHint("USS Bowfin", { type: "submarine museum" }), /submarine you can walk through/i);
  assert.ok(!/indoor exhibits/i.test(withKidHint("USS Missouri", { type: "museum", description: "battleship" })));
  assert.match(highlightReason({ name: "USS Missouri", type: "museum ship", indoor: true, setting: "indoor" }, true), /battleship you can walk through/i);
  assert.ok(!isIndoorishBackup({ name: "Private house tour of a historic home", type: "tourism=attraction", indoor: true }));
});

test("v1.19.0: weather uses plain kid words and does not treat short tropical showers as wet days", () => {
  assert.equal(typicalPrecipSummary(20, "none", { tmax: 31, tmin: 24, precipMm: 0 }), "Usually sunny");
  assert.equal(typicalPrecipSummary(45, "rain"), "Some rain likely");
  assert.equal(typicalPrecipSummary(80, "rain"), "Rainy most days");
  assert.equal(rainChancePhrase({ precipProb: 80, typical: true, tmax: 18, tmin: 10, precipMm: 8 }), "it rained on most of these days in past years");
  assert.ok(!/about almost all/.test(rainChancePhrase({ precipProb: 90, typical: true, tmax: 18, tmin: 10, precipMm: 10 })));
  const shower = { date: "2027-07-03", tmax: 31, tmin: 24, precipMm: 2, precipHours: 1, precipProb: 55, typical: true, passingShowers: true, summary: "Usually sunny" };
  assert.equal(isBriefTropicalShower(shower), true);
  assert.equal(isWet(shower), false);
  assert.match(rainChancePhrase(shower), /quick showers are common but short/);
  assert.match(formatDayWeather(shower), /Usually sunny/);
  assert.match(wetDaysSummary([shower, shower, shower]).label, /quick showers are common but short/);
});

test("v1.19.0: day notes cap at 3 after every source and drop bare interest tokens; beach safety once", () => {
  const long = [
    "Swim only where lifeguards are; check the beach flag colors; hold little hands in the waves",
    "beach",
    "Surfing",
    "Plan a nap break",
    "Optional big day trip: somewhere far",
    "with kids — keep the day light",
  ].join(" · ");
  const capped = capDayNotes(long, 3);
  const parts = capped.split(" · ");
  assert.ok(parts.length <= 3, capped);
  assert.ok(!/^beach$/i.test(capped.split(" · ").join("\n")));
  assert.ok(!parts.some(p => /^(beach|Surfing)$/i.test(p)), capped);
  const days = [
    { notes: "beach · Swim only where lifeguards are; check the beach flag colors; hold little hands in the waves · Extra one · Extra two · Extra three" },
    { notes: `${BEACH_SAFETY_NOTE} · another` },
    { notes: "Surfing · keep the day light" },
  ];
  capItineraryNotes(days as any, 3);
  assert.ok(days.every(d => (d.notes || "").split(" · ").filter(Boolean).length <= 3), JSON.stringify(days));
  assert.ok(!days.some(d => /(^|· )beach( ·|$)/i.test(d.notes || "") && !/flag/i.test(d.notes || "")));
});

test("v1.19.0: artefacts becomes artifacts through T()/localizeEn", () => {
  assert.equal(T("Mayan artefacts indoors"), "Mayan artifacts indoors");
  assert.equal(localizeEn("an artefact in the museum", "us"), "an artifact in the museum");
  assert.equal(localizeEn("Mayan artefacts indoors", "uk"), "Mayan artefacts indoors");
  const html = renderToStaticMarkup(<div data-testid="hint">{T("Mayan artefacts indoors")}</div>);
  assert.match(html, /Mayan artifacts indoors/);
  assert.ok(!/artefacts/i.test(html));
});

test("v1.19.0: infant passport prep is visible in the default uncollapsed view when members are stripped", () => {
  const input = {
    destination: "Cancún",
    homeCity: "Detroit",
    start: "2027-03-20",
    end: "2027-03-27",
    travelers: 5,
    purpose: "Family",
    style: "Mix" as const,
    travelMode: "flying" as const,
    interests: "beach, swimming, snorkeling",
    members: cancunInfantMembers,
    today: "2026-11-17",
    tz: "America/Detroit",
  };
  const place = { name: "Cancún", country: "Mexico", countryCode: "MX" };
  const wx = { days: Array.from({ length: 8 }, (_, i) => ({ date: `2027-03-${20 + i}`, tmax: 29, tmin: 23, precipProb: 33, precipMm: 0, typical: true, summary: "Usually sunny" })), source: "typical", stats: { avgHigh: 29, avgLow: 23, rainyDays: 0, snowDays: 0 } } as any;
  const pack = packing(input as any, wx, { id: 1, lat: 21.16, lon: -86.85, ...place } as any, 8, false);
  assert.ok(packingItemsHavePassport(pack), "packing row missing");
  const start = startHereItems(pack).map(i => i.item).join("\n");
  assert.match(start, /Passport · Infant needs their own/);
  // Live-form path: members stripped from input, packing.settings.members remains.
  const stripped = { input: { ...input, members: undefined }, packing: pack, place, trip: { domestic: false, home: { countryCode: "US", name: "Detroit" } }, timeline: [] };
  const prep = defaultPrep(stripped as any);
  assert.match(prep.map(t => t.task).join("\n"), /Baby needs their own passport \(grown-up task\)/);
  const week = groupPrepTasks(prep).find(g => g.when === "week" || /week/i.test(g.label));
  assert.ok(week, "A week before group missing");
  assert.ok(week!.items.some(t => /Baby needs their own passport/.test(t.task)), week!.items.map(t => t.task).join("\n"));
  const html = renderToStaticMarkup(
    <div data-testid="prep-list">
      {groupPrepTasks(prep).map(g => (
        <div key={g.when} className="prep-group" data-testid={`prep-group-${g.when}`}>
          <h3>{g.label}</h3>
          {g.items.map(t => <div key={t.id} data-testid="prep-item">{T(t.task)}</div>)}
        </div>
      ))}
    </div>,
  );
  assert.match(html, /Baby needs their own passport \(grown-up task\)/);
  assert.ok(!/hidden|collapsed|display:\s*none/i.test(html));
  const weekIdx = html.indexOf("A week before");
  const infantIdx = html.indexOf("Baby needs their own passport");
  assert.ok(weekIdx >= 0 && infantIdx > weekIdx, "infant line should appear under the default week-before group");
});

function packingItemsHavePassport(pack: any) {
  return (pack.groups || []).some((g: any) => (g.items || []).some((i: any) => /Passport · Infant needs their own/i.test(i.item || "")));
}

test("v1.19.0: cold-cache Honolulu generate with live-form inputs", { timeout: 180000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "tf-v190-honolulu-"));
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
      body: JSON.stringify(honoluluLiveInput()),
    });
    const raw = await r.text();
    assert.equal(r.status, 200, raw.slice(0, 2000));
    const plan = JSON.parse(raw);
    assert.ok(!plan.needsChoice, `chooser shown for ${plan.place?.name || plan.matches?.[0]?.name}`);
    assert.match(plan.place?.name || "", /Honolulu/i);
    assert.ok(!/Stadium State Park/i.test(plan.place?.name || ""), plan.place?.name);
    assert.equal(plan.input?.members, undefined, "live form should strip members");
    const days = plan.itinerary || [];
    const mid = days.filter((d: any) => !/Arrive|Depart/i.test(d.label || ""));
    const text = mid.map((d: any) => `${d.label}: ${d.morning} / ${d.afternoon} / ${d.evening} | ${d.notes || ""} | ${d.rainyBackup || ""}`).join("\n");
    const advice = (plan.activityNotes || []).join("\n");
    const all = `${text}\n${advice}`;
    assert.ok(/Family luau/i.test(all) || /couldn't fit: luau/i.test(all), all);
    assert.ok(/Laniakea|turtle/i.test(all) || /couldn't fit: turtles/i.test(all), all);
    assert.ok(/surf lesson|Waik[iī]k[iī].*lesson/i.test(all) || /couldn't fit: surfing/i.test(all), all);
    assert.ok(/Diamond Head|Volcanoes National Park/i.test(all) || /couldn't fit: volcano/i.test(all), all);
    const dinners = mid.map((d: any) => d.evening || "");
    assert.ok(!dinners.some((e: string) => /Bar Leather Apron/i.test(e)), dinners.join(" | "));
    const bakeryDinners = dinners.filter((e: string) => /Leonard'?s Bakery/i.test(e));
    assert.equal(bakeryDinners.length, 0, dinners.join(" | "));
    const named = dinners.map((e: string) => (e.match(/Dinner(?: nearby)?: ([^(]+)/i) || [])[1]?.trim()).filter(Boolean) as string[];
    const counts = new Map<string, number>();
    for (const n of named) counts.set(n, (counts.get(n) || 0) + 1);
    for (const [n, c] of counts) assert.ok(c === 1, `dinner repeated live: ${n} × ${c} (${dinners.join(" | ")})`);
    const beaches = mid.map((d: any) => `${d.morning} ${d.afternoon}`).join("\n");
    assert.ok(!/Ke[ʻ']?ehi Lagoon|Kalaeloa/i.test(beaches), beaches);
    assert.ok(!/USS (Missouri|Bowfin) \([^)]*indoor exhibits/i.test(all), all);
    const wx = (plan.weather?.days || []).map((d: any) => `${d.summary} ${formatDayWeather(d)}`).join("\n");
    assert.ok(!/rained on about almost all/i.test(wx), wx);
    let safetyDays = 0;
    for (const d of mid) {
      const parts = (d.notes || "").split(/\s*·\s*/).map((s: string) => s.trim()).filter(Boolean);
      assert.ok(parts.length <= 3, `${d.label} has ${parts.length} notes: ${d.notes}`);
      assert.ok(!parts.some((p: string) => /^(beach|Surfing)$/i.test(p)), d.notes);
      if (parts.some((p: string) => p.includes(BEACH_SAFETY_NOTE) || /lifeguards|beach flag/i.test(p))) safetyDays++;
    }
    assert.ok(safetyDays <= 1, `beach safety on ${safetyDays} days`);
  } finally {
    if (child && child.exitCode == null) {
      const done = new Promise<void>(r => child!.once("exit", () => r()));
      child.kill("SIGTERM");
      await done;
    }
    await rm(root, { recursive: true, force: true });
  }
});
