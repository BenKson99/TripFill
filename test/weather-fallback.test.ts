import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("all-null/missing forecasts become honestly seasonal; empty history fails instead of fake 0°", async () => {
  const root = await mkdtemp(join(tmpdir(), "tripfill-weather-")); process.env.TRIPFILL_CACHE_DIR = root;
  const { getWeather } = await import("../server/weather.js");
  const original = globalThis.fetch; let empty = false;
  globalThis.fetch = (async (input: any) => {
    const u = new URL(String(input)); const start = u.searchParams.get("start_date")!;
    if (u.hostname === "api.open-meteo.com") return Response.json({ daily: { time: [start], temperature_2m_max: [null], temperature_2m_min: [null] } });
    if (u.hostname === "archive-api.open-meteo.com") return Response.json({ daily: { time: [start], temperature_2m_max: [empty ? null : 22], temperature_2m_min: [empty ? null : 12], precipitation_sum: [0] } });
    throw new Error("Unexpected external request " + u.hostname);
  }) as typeof fetch;
  try {
    const p = { id: 99, name: "Fixture", country: "Test", countryCode: "XX", lat: 70.12345, lon: 0.12345 };
    const w = await getWeather(p, "2026-11-10", "2026-11-10", false, "2026-11-06");
    assert.equal(w.source, "typical"); assert.equal(w.days[0].typical, true); assert.equal(w.days[0].tmax, 22); assert.equal(w.stats.avgHigh, 22);
    empty = true; await assert.rejects(() => getWeather({ ...p, lat: 71.12345 }, "2026-11-11", "2026-11-11", false, "2026-11-06"), /unavailable/);
  } finally { globalThis.fetch = original; await rm(root, { recursive: true, force: true }); }
});
