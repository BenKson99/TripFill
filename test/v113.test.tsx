import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { fixture, weather, highlights } from "./fixtures.js";
import { precipKind, isRainy, isWet, typicalPrecipSummary, itineraryPrecipCopy, adjustForecastSummary } from "../shared/precip.js";
import { packingItems, suggestPacking, simpleLists, groupSimpleRows, simpleGroupLabel, updatePackingItems, packingMembers, inheritProfile, setAllTravelerTypes } from "../shared/packing.js";
import { itinerary } from "../server/plan.js";
import { stats } from "../server/weather.js";
import { TravelerFields, setAllTypes, travelerRows } from "../src/Travelers.js";
import { PackingWorkspace, SimpleLists } from "../src/Packing.js";

const zermattDay = (over: Record<string, unknown> = {}) => ({ date: "2027-01-04", tmax: 1.5, tmin: -6, precipMm: 4, precipProb: 60, code: null, typical: true, summary: "Often wet", ...over });

test("v1.13.0: freezing precipitation is snow; Open-Meteo snowfall overrides rain wording; warm rain stays rain", () => {
  assert.equal(precipKind(zermattDay()), "snow");
  assert.equal(isRainy(zermattDay()), false);
  assert.equal(isWet(zermattDay()), true);
  assert.equal(typicalPrecipSummary(60, "snow"), "Often snowy");
  assert.equal(typicalPrecipSummary(40, "snow"), "Sometimes snowy");
  assert.equal(adjustForecastSummary("Rain showers", "snow"), "Snowy");
  // snowfall_sum present on a borderline-warm day → mixed; with cold temps → snow
  assert.equal(precipKind({ tmax: 6, tmin: 2, precipMm: 5, precipProb: 80, snowCm: 3.2 }), "mixed");
  assert.equal(precipKind({ tmax: 0, tmin: -8, precipMm: 5, precipProb: 80, snowCm: 8 }), "snow");
  const warm = { tmax: 22, tmin: 14, precipMm: 8, precipProb: 80, typical: false, summary: "Rain" };
  assert.equal(precipKind(warm), "rain");
  assert.equal(isRainy(warm), true);
  const mixed = { tmax: 3, tmin: 1, precipMm: 3, precipProb: 70 };
  assert.equal(precipKind(mixed), "mixed");
  assert.equal(isRainy(mixed), true);
  const s = stats([zermattDay({ date: "2027-01-03" }), zermattDay({ date: "2027-01-04" }), { ...warm, date: "2027-01-05" } as any]);
  assert.equal(s.snowDays, 2);
  assert.equal(s.rainyDays, 1);
});

test("v1.13.0: ski + snow itinerary is good news, not an indoor rain backup; warm rain is unchanged", () => {
  const snowDays = [3, 4, 5, 6, 7].map(d => zermattDay({ date: `2027-01-0${d}`, summary: "Often snowy" }));
  const snowWx = { source: "typical" as const, note: "", days: snowDays, stats: stats(snowDays as any) };
  const inp: any = { destination: "Zermatt", start: "2027-01-03", end: "2027-01-09", travelers: 16, purpose: "Ski", style: "Mix", interests: "skiing", presets: ["ski"], travelMode: "flying" };
  const days = itinerary(inp, snowWx as any, highlights, []);
  const mid = days.filter(d => !/Arrive|Depart/.test(d.label));
  assert.ok(mid.length >= 1);
  for (const d of mid) {
    assert.match(d.rainyBackup || "", /Fresh snow, great for skiing; dress warm/);
    assert.doesNotMatch(d.rainyBackup || "", /Rain likely/);
    assert.match(d.weather, /snow/i);
  }
  assert.equal(itineraryPrecipCopy("snow", false), "Snow likely — dress warm and wear shoes with grip");
  const rainWx = { ...weather, days: weather.days.map(d => ({ ...d, tmax: 18, tmin: 12, precipMm: 8, precipProb: 70, summary: "Rain" })) };
  const wet = itinerary({ ...inp, purpose: "Leisure", interests: "", presets: [] }, rainWx as any, highlights, []);
  const rainMid = wet.filter(d => !/Arrive|Depart/.test(d.label));
  assert.ok(rainMid.every(d => /Rain likely — indoor/.test(d.rainyBackup || "")));
});

test("v1.13.0: snow packing suggests a shell and snow boots, not an umbrella; plug adapters scale", () => {
  const p = fixture();
  p.input = { ...p.input, destination: "Zermatt", start: "2027-01-03", end: "2027-01-09", travelers: 16, purpose: "Ski", interests: "skiing", presets: ["ski"] };
  const days = [3, 4, 5, 6, 7, 8, 9].map(d => zermattDay({ date: `2027-01-0${d}`, summary: "Often snowy" }));
  p.weather = { source: "typical", note: "", days, stats: stats(days as any) };
  const members = packingMembers({ members: Array.from({ length: 16 }, (_, i) => ({ id: `traveler-${i + 1}`, name: `Sister ${i + 1}`, profile: "woman" })) }, 16);
  const list = suggestPacking(p, { laundryEvery: null, luggage: "all", members, activityKits: ["ski"] } as any);
  const items = packingItems(list);
  const shell = items.find(i => i.item === "Packable waterproof shell")!;
  const boots = items.find(i => i.item === "Waterproof boots with grip")!;
  assert.ok(shell && boots);
  assert.match(shell.reason, /waterproof shell and warm layers, not an umbrella/i);
  assert.match(boots.reason, /snow boots/i);
  assert.ok(!items.some(i => /umbrella/i.test(i.item)));
  const adapters = items.find(i => /Plug adapter/.test(i.item))!;
  assert.equal(adapters.quantity, Math.ceil(16 / 3));
  assert.match(adapters.reason, /1 per 3 travelers/);
});

function sixteen() {
  const p = fixture();
  p.input.travelers = 16; p.input.purpose = "Ski"; p.input.interests = "skiing"; p.input.presets = ["ski"];
  const members = Array.from({ length: 16 }, (_, i) => ({ id: `traveler-${i + 1}`, name: `Sister ${i + 1}`, profile: "woman" as const }));
  p.packing = suggestPacking(p, { laundryEvery: null, luggage: "all", members, activityKits: ["ski"] } as any);
  return p;
}

test("v1.13.0: Simple mode collapses identical items for 16 travelers, marks all onto real item ids, leaves shared ungrouped", () => {
  const p = sixteen();
  const all = packingItems(p.packing);
  assert.ok(all.length >= 250, `expected a large list, got ${all.length}`);
  const { adults } = simpleLists(p.packing);
  const t0 = performance.now();
  const grouped = groupSimpleRows(adults);
  const ms = performance.now() - t0;
  assert.ok(ms < 50, `grouping took ${ms.toFixed(1)}ms`);
  const passports = adults.filter(r => /Passport/.test(r.item.item) && !r.shared);
  assert.equal(passports.length, 16);
  const g = grouped.groups.find(x => /Passport/.test(x.name))!;
  assert.equal(g.rows.length, 16);
  assert.equal(g.packed, 0); assert.equal(g.total, 16);
  assert.equal(simpleGroupLabel(g), `${g.name} ×16`);
  assert.equal(grouped.shared.filter(r => r.item.item === "House keys").length, 1);
  const html = renderToStaticMarkup(<SimpleLists p={p.packing} readOnly={false} onCheck={() => {}} onCheckMany={() => {}} />);
  assert.ok(html.includes(`${g.name} ×16`) || html.includes(`${g.name.replace(/&/g, "&amp;")} ×16`));
  assert.ok(html.includes("0/16 packed"));
  assert.ok(html.includes("Mark all packed"));
  assert.equal((html.match(/data-shared="true"/g) || []).length, grouped.shared.length * 2); // screen + print
  const screen = html.slice(0, html.indexOf("simple-print"));
  assert.equal((screen.match(/class="simple-name">Passport \/ accepted travel ID[^<]*<\/span>/g) || []).length, 1, "collapsed to one visible Passport row");
  assert.ok(!screen.includes("Sister 2") && !screen.includes("Sister 16"), "people stay collapsed until expanded");
  const packed = updatePackingItems(p.packing, g.rows.map(r => r.item.id), { checked: true });
  const after = packingItems(packed).filter(i => /Passport/.test(i.item) && i.checked);
  assert.equal(after.length, 16);
  assert.ok(after.every(i => i.owner !== "shared" && i.stage === "packed"));
  const skippedOne = updatePackingItems(p.packing, [g.rows[0].item.id], { skipped: true });
  const marked = updatePackingItems(skippedOne, g.rows.map(r => r.item.id), { checked: true });
  assert.equal(packingItems(marked).find(i => i.id === g.rows[0].item.id)!.skipped, true);
  assert.equal(packingItems(marked).find(i => i.id === g.rows[0].item.id)!.checked, false);
  assert.equal(packingItems(marked).filter(i => /Passport/.test(i.item) && i.checked).length, 15);
  const detailed = renderToStaticMarkup(<PackingWorkspace plan={p} readOnly={false} onChange={() => {}} T={s => s} />);
  assert.ok(detailed.includes('data-testid="packing-show-only"') && detailed.includes("My list"));
});

test("v1.13.0: Set everyone to a type; new rows inherit the most common / last-chosen type; names stay", () => {
  const names = Array.from({ length: 16 }, (_, i) => ({ id: `traveler-${i + 1}`, name: `Sister ${i + 1}` }));
  const all = setAllTypes(names, 16, "woman");
  assert.equal(all.length, 16);
  assert.ok(all.every(m => m.profile === "woman" && !m.child && m.name.startsWith("Sister")));
  const html = renderToStaticMarkup(<TravelerFields idPrefix="form-traveler" members={travelerRows(names, 16)} onEdit={() => {}} onEditAll={() => {}} />);
  assert.ok(html.includes('data-testid="form-traveler-set-everyone"') && html.includes("Set everyone to"));
  assert.ok(html.includes("Choose type…") && html.includes("Woman"));
  const ro = renderToStaticMarkup(<TravelerFields idPrefix="x" members={travelerRows(names, 16)} disabled onEdit={() => {}} onEditAll={() => { throw new Error("no"); }} />);
  assert.ok(ro.includes('aria-label="Set everyone to"') && ro.includes("disabled"));
  // inherit most common
  const two = packingMembers({ members: [{ id: "traveler-1", name: "A", profile: "woman" }, { id: "traveler-2", name: "B", profile: "woman" }] }, 4);
  assert.equal(two[0].profile, "woman"); assert.equal(two[1].profile, "woman");
  assert.equal(two[2].name, "Traveler 3"); assert.equal(two[2].profile, "woman");
  assert.equal(two[3].profile, "woman");
  // ties go to last chosen
  const tied = packingMembers({ members: [{ id: "traveler-1", name: "A", profile: "man" }, { id: "traveler-2", name: "B", profile: "woman" }, { id: "traveler-3", name: "C", profile: "man" }, { id: "traveler-4", name: "D", profile: "woman" }] }, 6);
  assert.equal(inheritProfile(tied.slice(0, 4)), "woman");
  assert.equal(tied[4].profile, "woman");
  // existing unset rows are not overwritten
  const keep = packingMembers({ members: [{ id: "traveler-1", name: "A", profile: "woman" }, { id: "traveler-2", name: "B" }] }, 3);
  assert.deepEqual(keep[1], { id: "traveler-2", name: "B" });
  assert.equal(keep[2].profile, "woman");
  // setAllTravelerTypes preserves names
  const cleared = setAllTravelerTypes(all, "");
  assert.ok(cleared.every(m => m.name.startsWith("Sister") && !m.profile));
  // existing URLs gained snowfall_sum on the same requests, no new hosts
  const wx = readFileSync(new URL("../server/weather.ts", import.meta.url), "utf8");
  assert.equal((wx.match(/snowfall_sum/g) || []).length >= 2, true);
  assert.ok(!/api\.(weatherapi|visualcrossing|openweathermap)/i.test(wx));
});
