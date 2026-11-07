import { packing, itinerary, timeline } from "../server/plan.js";
import { stats, type Place, type WeatherResult } from "../server/weather.js";
export const porto: Place = { id: 1, name: "Porto", country: "Portugal", countryCode: "PT", lat: 41.15, lon: -8.61, timezone: "Europe/Lisbon" };
export const lisbon: Place = { ...porto, id: 2, name: "Lisbon", lat: 38.72, lon: -9.14 };
export const weather: WeatherResult = (() => { const days = Array.from({ length: 7 }, (_, i) => ({ date: `2026-11-${String(i + 10).padStart(2, "0")}`, tmax: 20, tmin: 10, precipMm: 0, precipProb: 0, code: 0, summary: "Clear" })); return { source: "forecast", note: "Open-Meteo forecast", days, stats: stats(days) }; })();
export const highlights = Array.from({ length: 12 }, (_, i) => ({ name: i === 0 ? "Mountain hike" : i === 1 ? "Art Museum" : `Garden ${i}`, type: i === 0 ? "mountain trail" : i === 1 ? "museum" : "garden", description: "A visitor attraction", setting: "outdoor" as const, indoor: false, source: "Fixture" }));
export function fixture(): any {
  const input = { destination: "Porto", start: "2026-11-10", end: "2026-11-16", travelers: 2, purpose: "Leisure", style: "Mix" as const, interests: "" };
  return { input, place: porto, generatedAt: "2026-11-06T12:00:00Z", weather: structuredClone(weather), highlights: structuredClone(highlights), packing: packing(input, weather, porto, 6), itinerary: itinerary(input, weather, highlights, []), timeline: timeline(input.start, true, "2026-11-06"), prep: [{ id: "prep1", task: "Custom task", done: true }], budget: { currency: "EUR", note: "Rough estimate", lines: [{ category: "Food", basis: "model", total: 123, low: 100, high: 150 }] }, eats: { restaurants: [{ name: "Legacy Cafe", kind: "restaurant", source: "Wikivoyage", tag: "portuguese" }], cafes: [] }, sources: ["Wikivoyage"] };
}
