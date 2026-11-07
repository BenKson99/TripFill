import test from "node:test";
import assert from "node:assert/strict";
import LZ from "lz-string";
import { parsePlan, exportPlan, encodePlan, decodePlan, MAX_PLAN_BYTES, safeUrl, savePlan, readSaved, validDate, weatherLabel } from "../shared/portable.js";
import { dietaryEats, preferredHighlights, walkingNotes } from "../server/preferences.js";
import { packing, itinerary, driveLabel, timeline } from "../server/plan.js";
import { dateRange, stats, forecastDays, todayIn } from "../server/weather.js";
import { eatsKey } from "../server/eats.js";
import { fixture, weather, highlights, porto, lisbon } from "./fixtures.js";

test("versioned and legacy roundtrips preserve checks, edits, budgets and preferences", () => {
  const p = fixture(); p.input.dietaryNeeds = "vegan"; p.input.walkingTolerance = "low";
  p.packing.groups[0].items[0].checked = true; p.itinerary[1].notes = "My edits <b>as text</b>";
  const q = parsePlan(exportPlan(p));
  assert.equal(q.packing.groups[0].items[0].checked, true); assert.equal(q.prep[0].done, true); assert.equal(q.budget.lines[0].total, 123);
  assert.equal(q.input.dietaryNeeds, "vegan"); assert.equal(q.input.walkingTolerance, "low");
  assert.deepEqual(decodePlan(encodePlan(p)), q);
  const old = fixture(); old.input.travelers = "2"; delete old.eats; old.food = [{ name: "old dish" }];
  const migrated = parsePlan(JSON.stringify(old)); assert.equal(migrated.input.travelers, 2); assert.equal(migrated.input.walkingTolerance, "standard");
  assert.equal(decodePlan(LZ.compressToEncodedURIComponent(JSON.stringify(old))).input.style, "Mix");
});

test("strict validation, actionable errors, hostile keys and active URLs", () => {
  assert.throws(() => parsePlan("not json"), /Invalid JSON/);
  assert.throws(() => parsePlan("null"), /Not a TripFill/);
  assert.throws(() => parsePlan(' '.repeat(MAX_PLAN_BYTES + 1)), /750 KB/);
  assert.throws(() => parsePlan('{"__proto__":{"polluted":true}}'), /Unsafe property/);
  assert.equal(({} as any).polluted, undefined);
  for (const mutate of [(p: any) => p.packing.groups = {}, (p: any) => p.itinerary[0].morning = {}, (p: any) => p.input.end = "2026-02-30", (p: any) => p.prep[0].done = "yes", (p: any) => p.legs = [{ place: porto }], (p: any) => p.eats.restaurants[0].description = {}]) {
    const p = fixture(); mutate(p); assert.throws(() => parsePlan(JSON.stringify(p)), /Invalid|Missing/);
  }
  assert.throws(() => parsePlan(JSON.stringify({ format: "tripfill", schemaVersion: 2, plan: fixture() })), /Unsupported/);
  const p = fixture(); p.highlights[0].url = "javascript:alert(1)"; p.eats.restaurants[0].url = "data:text/html,hi";
  const q = parsePlan(JSON.stringify(p)); assert.equal(q.highlights[0].url, undefined); assert.equal(q.eats.restaurants[0].url, undefined);
  assert.equal(safeUrl("https://example.com"), "https://example.com/"); assert.equal(safeUrl("https://user:pass@example.com"), undefined);
  assert.throws(() => decodePlan("A".repeat(100001)), /too large/); assert.throws(() => decodePlan(encodePlan(p).slice(0, 20)), /Truncated|damaged|Invalid|JSON/);
  assert.throws(() => decodePlan(LZ.compressToEncodedURIComponent("x".repeat(MAX_PLAN_BYTES + 1))), /exceeds|beyond/);
});

test("legacy eats never acquire invented source confidence", () => {
  const p = fixture(); p.eats.restaurants[0].retrievedAt = "2026-11-06"; p.eats.restaurants[0].cuisineEvidence = "source-tag";
  const q = parsePlan(JSON.stringify(p)).eats.restaurants[0]; assert.equal(q.cuisineEvidence, "unknown"); assert.equal(q.retrievedAt, undefined); assert.match(q.dietaryStatus, /unverified/);
});

test("storage preserves packing, custom checklist, timeline and imported preference state", () => {
  const data = new Map<string, string>(); const storage = { getItem: (k: string) => data.get(k) || null, setItem: (k: string, v: string) => { data.set(k, v); } };
  const p = fixture(); p.packing.groups[0].items[0].checked = true; p.timeline[0].done = true; p.input.dietaryNeeds = "halal";
  savePlan(storage as any, p.input, p); const q = readSaved(storage as any)!;
  assert.equal(q.plan.packing.groups[0].items[0].checked, true); assert.equal(q.plan.timeline[0].done, true); assert.equal(q.plan.prep[0].done, true); assert.equal(q.form.dietaryNeeds, "halal");
});

test("same-country destinations and coordinates have independent eats cache keys", () => {
  assert.notEqual(eatsKey(porto), eatsKey(lisbon)); assert.notEqual(eatsKey(porto), eatsKey({ ...porto, lat: porto.lat + .1 }));
});

test("pace, interests and walking tolerance change actual selection/intensity and packing", () => {
  const inp = fixture().input;
  assert.equal(preferredHighlights(highlights, { ...inp, interests: "museums" })[0].name, "Art Museum");
  assert.ok(!preferredHighlights(highlights, { ...inp, walkingTolerance: "low" }).some(h => /Mountain/.test(h.name)));
  const slow = itinerary({ ...inp, style: "Slow" }, weather, highlights, []);
  const packed = itinerary({ ...inp, style: "Packed" }, weather, highlights, []);
  assert.equal(slow[1].afternoon, "Long lunch & downtime"); assert.notEqual(packed[1].afternoon, slow[1].afternoon);
  const interested = itinerary({ ...inp, interests: "museums" }, weather, highlights, []); assert.equal(interested[1].morning, "Art Museum");
  const low = itinerary({ ...inp, walkingTolerance: "low" }, weather, highlights, []); walkingNotes(low, { ...inp, walkingTolerance: "low" });
  assert.match(low[1].afternoon, /rest/); assert.match(low[1].notes, /not verified/);
  const high = itinerary({ ...inp, style: "Packed", walkingTolerance: "high" }, weather, highlights, []);
  assert.ok(high[1].afternoon.split(" → ").length > packed[1].afternoon.split(" → ").length);
  const pk = packing({ ...inp, walkingTolerance: "low", dietaryNeeds: "vegan", interests: "photography hiking" }, weather, porto, 6);
  const names = pk.groups.flatMap(g => g.items.map(i => i.item)).join(";"); assert.match(names, /mobility/); assert.match(names, /Dietary translation/); assert.match(names, /Camera/); assert.match(names, /Hiking/);
});

test("dietary source tags rank known matches, exclude conflicts, keep unknown honestly", () => {
  const p = fixture(); const e = p.eats.restaurants[0];
  const eats = { restaurants: [{ ...e, name: "Unknown" }, { ...e, name: "Conflict", dietary: { vegan: "no" } }, { ...e, name: "Match", dietary: { vegan: "yes" } }], cafes: [] };
  const result = dietaryEats(eats, { ...p.input, dietaryNeeds: "vegan" });
  assert.deepEqual(result.restaurants.map(x => x.name), ["Match", "Unknown"]); assert.match(result.restaurants[1].dietaryStatus!, /unknown/); assert.match(result.restaurants[0].dietaryStatus!, /confirm/);
  assert.equal(dietaryEats(eats, { ...p.input, dietaryNeeds: "none" }).restaurants.length, 3);
});

test("dates, Detroit late-night, missing temperatures and estimate method labels", () => {
  assert.equal(validDate("2026-02-30"), false); assert.throws(() => dateRange("bad", "bad"), /Valid dates/);
  assert.equal(todayIn("America/Detroit", new Date("2026-11-07T02:00:00Z")), "2026-11-06");
  assert.equal(dateRange("2028-02-28", "2028-03-01").length, 3);
  const days = forecastDays({ time: ["2026-11-10"], temperature_2m_max: [null], temperature_2m_min: [null] }, ["2026-11-10", "2026-11-11"]);
  assert.ok(days.every(d => Number.isNaN(d.tmax))); assert.throws(() => stats(days), /No usable/);
  assert.equal(stats([weather.days[0], ...days]).avgHigh, 20);
  assert.match(weatherLabel({}, "mixed"), /unknown/); assert.match(weatherLabel({}, "typical"), /not forecast/);
  const legacy = fixture(); legacy.weather.source = "typical"; assert.equal(parsePlan(JSON.stringify(legacy)).weather.days[0].typical, true);
  assert.match(driveLabel({ driveMin: 80, driveSrc: "osrm" }), /OSRM road route; no live traffic/);
  assert.match(driveLabel({ distanceKm: 60 }), /straight-line/); assert.ok(!driveLabel({ driveMin: 119 }).includes("60m"));
  assert.ok(timeline("2026-11-06", false, "2026-11-06").every(t => t.due === "2026-11-06"));
  assert.match(itinerary(fixture().input, weather, highlights, [])[1].weather, /Open-Meteo forecast/);
  const seasonal = structuredClone(weather); (seasonal.days[1] as any).typical = true;
  assert.match(itinerary(fixture().input, seasonal, highlights, [])[1].weather, /not forecast/);
});
