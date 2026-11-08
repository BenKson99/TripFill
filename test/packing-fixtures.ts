/** Deterministic weather/place inputs: synthetic QA data, never real travel recommendations. */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dateRange } from "../server/weather.js";
export const qaCases = [
  { id: "warm-short", place: { id: 3369157, name: "Cape Town", country: "South Africa", countryCode: "ZA", lat: -33.9258, lon: 18.4232, timezone: "Africa/Johannesburg" }, start: "2026-11-10", end: "2026-11-12", presets: ["beach"], high: 31, low: 22, rain: false },
  { id: "cold-rainy", place: { id: 3133895, name: "Tromso", country: "Norway", countryCode: "NO", lat: 69.6492, lon: 18.9553, timezone: "Europe/Oslo" }, start: "2026-11-10", end: "2026-11-15", presets: ["hiking", "ski"], high: 2, low: -9, rain: true },
  { id: "mixed-multi", place: { id: 3369157, name: "Cape Town", country: "South Africa", countryCode: "ZA", lat: -33.9258, lon: 18.4232, timezone: "Africa/Johannesburg" }, start: "2026-11-10", end: "2026-11-17", presets: ["beach", "hiking"], high: 33, low: 23, rain: false, next: { id: 3133895, name: "Tromso", country: "Norway", countryCode: "NO", lat: 69.6492, lon: 18.9553, timezone: "Europe/Oslo" }, nextStart: "2026-11-14" },
  { id: "long-laundry", place: { id: 2735943, name: "Porto", country: "Portugal", countryCode: "PT", lat: 41.1496, lon: -8.6109, timezone: "Europe/Lisbon" }, start: "2026-11-10", end: "2026-12-09", presets: ["city"], high: 21, low: 12, rain: true }
];
export async function seedPackingQa(cacheDir: string) {
  await mkdir(cacheDir, { recursive: true });
  const put = (key: string, data: any) => writeFile(join(cacheDir, createHash("sha1").update(key).digest("hex") + ".json"), JSON.stringify(data));
  await put("https://open.er-api.com/v6/latest/USD", { result: "success", rates: { USD: 1, EUR: .92, NOK: 11, ZAR: 18 }, time_last_update_utc: "Fri, 06 Nov 2026 00:00:00 +0000" });
  for (const c of qaCases) {
    const end = dateRange(c.start, c.end).slice(0, 14).at(-1)!;
    const legs = [{ place: c.place, start: c.start, end: c.next ? c.nextStart! : end, high: c.high, low: c.low, rain: c.rain }, ...(c.next ? [{ place: c.next, start: c.nextStart!, end, high: 1, low: -13, rain: true }] : [])];
    for (const l of legs) {
      const dates = dateRange(l.start, l.end), forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${l.place.lat}&longitude=${l.place.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code&timezone=auto&start_date=${l.start}&end_date=${l.end}`;
      const daily = { time: dates, temperature_2m_max: dates.map(() => l.high), temperature_2m_min: dates.map(() => l.low), precipitation_sum: dates.map(() => l.rain ? 5 : 0), precipitation_probability_max: dates.map(() => l.rain ? 80 : 0), weather_code: dates.map(() => l.rain ? 63 : 0) };
      // ClientToday=2026-11-10 makes every capped fixture range fit the forecast horizon.
      await put(forecastUrl, { daily });
      const opts = c.presets.includes("ski"), want = opts ? 20 : 14;
      const highlights = Array.from({ length: 12 }, (_, i) => ({ name: `QA ONLY ${l.place.name} sight ${i + 1}`, type: "museum", description: "Synthetic fixture — not a real venue", source: "Deterministic QA fixture", setting: "indoor", indoor: true, lat: l.place.lat, lon: l.place.lon }));
      const eats = { restaurants: Array.from({ length: 4 }, (_, i) => ({ name: `QA ONLY restaurant ${i + 1}`, kind: "restaurant", source: "Deterministic QA fixture" })), cafes: [] };
      await put(`places|v12|${l.place.name}|${l.place.lat.toFixed(3)},${l.place.lon.toFixed(3)}|${opts}|${want}`, { highlights, eats, indoorExtra: [], sources: ["Deterministic QA fixture — synthetic, not travel advice"] });
    }
  }
}
