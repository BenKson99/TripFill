/** Seeded production HTTP acceptance; only targets a box-local server. No browser automation. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { qaCases, seedPackingQa } from "../test/packing-fixtures.js";
import { decodePlan, encodePlan, exportPlan, parsePlan } from "../shared/portable.js";
import { mergeSuggestions, packingItems, suggestPacking } from "../shared/packing.js";
const mode = process.argv[2], out = resolve(process.argv[3] || "/workspace/tripfill-v1.7.0-qa");
await mkdir(out, { recursive: true });
if (mode === "seed") { await seedPackingQa(join(out, "http-cache")); console.log(`Seeded deterministic fixtures in ${out}/http-cache`); }
else {
  const base = process.argv[4] || "http://127.0.0.1:8847";
  const u = new URL(base); if (!["127.0.0.1", "localhost"].includes(u.hostname)) throw new Error("QA must target a local server only");
  const health: any = await (await fetch(`${base}/healthz`)).json(); assert.equal(health.version, "1.8.0");
  const page = await (await fetch(base)).text(); assert.ok(page.includes('/assets/')); const js = page.match(/src="([^\"]+\.js)"/)?.[1]; assert.ok(js); assert.equal((await fetch(`${base}${js}`)).status, 200);
  const report: any[] = [];
  for (const c of qaCases) {
    const input: any = { destination: c.place.name, place: c.place, start: c.start, end: c.end, travelers: 2, purpose: "Leisure", style: "Mix", interests: "", presets: c.presets, today: "2026-11-10", tz: "America/Detroit" };
    if (c.next) input.legs = [{ destination: c.next.name, place: c.next, start: c.nextStart }];
    const response = await fetch(`${base}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(15000) });
    const raw: any = await response.json(); assert.equal(response.status, 200, raw.error); const plan = parsePlan(JSON.stringify(raw));
    plan.title = `QA FIXTURE — ${c.id} (synthetic weather and places)`;
    const beforeItin = structuredClone(plan.itinerary), beforeBudget = structuredClone(plan.budget);
    if (c.id === "long-laundry") { plan.packing.settings = { ...plan.packing.settings, laundryEvery: 7, luggage: "carry-on" }; plan.packing = mergeSuggestions(plan.packing, suggestPacking(plan, plan.packing.settings)); }
    const items = packingItems(plan.packing), find = (name: string) => items.find(i => i.item === name)!;
    assert.equal(new Set(items.map(i => i.id)).size, items.length); assert.deepEqual(plan.itinerary, beforeItin); assert.deepEqual(plan.budget, beforeBudget);
    if (c.id === "warm-short") { assert.equal(find("Tops").quantity, 3); assert.ok(find("Swimwear")); assert.ok(!find("Insulated winter coat")); }
    if (c.id === "cold-rainy") { assert.ok(find("Insulated winter coat")); assert.ok(find("Packable waterproof shell")); }
    if (c.id === "mixed-multi") { assert.ok(find("Insulated winter coat")); assert.ok(find("Sun hat")); assert.equal(plan.legs.length, 2); }
    if (c.id === "long-laundry") { assert.equal(find("Underwear").quantity, 8); assert.equal(find("Tops").quantity, 7); assert.equal(plan.capped, true); }
    assert.deepEqual(decodePlan(encodePlan(plan)), parsePlan(exportPlan(plan)));
    await writeFile(join(out, `${c.id}.json`), exportPlan(plan)); await writeFile(join(out, `${c.id}-link.txt`), `${base}/#plan=${encodePlan(plan)}`);
    // Legacy short-link endpoint remains compatible; local HTTP only, not an external share.
    const saved = await fetch(`${base}/api/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) }); assert.equal(saved.status, 200); const { id }: any = await saved.json();
    const loaded: any = await (await fetch(`${base}/api/share/${id}`)).json(); assert.deepEqual(loaded.plan.packing, plan.packing);
    report.push({ case: c.id, generated: response.status, days: Math.round((Date.parse(c.end) - Date.parse(c.start)) / 86400000) + 1, weatherDays: plan.weather.days.length, items: items.length, tops: find("Tops").quantity, underwear: find("Underwear").quantity, httpShare: saved.status, portable: "pass", planBudgetUnchanged: true });
  }
  const invalid = parsePlan(await (await import("node:fs/promises")).readFile(join(out, "warm-short.json"), "utf8")); invalid.packing.groups[0].items[0].quantity = -1;
  assert.equal((await fetch(`${base}/api/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: invalid }) })).status, 400);
  await writeFile(join(out, "report.json"), JSON.stringify({ version: health.version, base, syntheticFixtures: true, invalidPackingRejected: true, report }, null, 2)); console.log(JSON.stringify(report, null, 2));
}
