import { getJSON } from "./fetchy.js";

export interface Place { id: number; name: string; country: string; countryCode: string; admin1?: string; lat: number; lon: number; timezone?: string; population?: number; featureCode?: string }
export interface DayWeather { date: string; tmax: number; tmin: number; precipMm: number; precipProb: number | null; code: number | null; summary: string; typical?: boolean }
export interface WeatherResult { source: "forecast" | "typical" | "mixed"; note: string; days: DayWeather[]; stats: { avgHigh: number; avgLow: number; minLow: number; maxHigh: number; rainyDays: number } }

export async function geocode(q: string): Promise<Place[]> {
  const d = await getJSON<any>(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`);
  const all: Place[] = (d.results || []).map((r: any) => ({ id: r.id, name: r.name, country: r.country, countryCode: r.country_code, admin1: r.admin1, lat: r.latitude, lon: r.longitude, timezone: r.timezone, population: r.population, featureCode: r.feature_code }));
  return sortPlaces(all);
}
/** Populated places (GeoNames PPL*) first, by population; islands, glaciers, peaks etc. after (v1.5.2). */
export const isPopulated = (p: Place) => /^PPL/.test(p.featureCode || "") || (!p.featureCode && (p.population ?? 0) > 0);
export function sortPlaces(all: Place[]): Place[] {
  return all.map((p, i) => ({ p, i })).sort((a, b) => (+isPopulated(b.p) - +isPopulated(a.p)) || (isPopulated(a.p) ? ((b.p.population || 0) - (a.p.population || 0)) : 0) || a.i - b.i).map(x => x.p);
}
/** Today's calendar date (YYYY-MM-DD) in an IANA zone; falls back to UTC if unknown. */
export function todayIn(tz?: string, now = new Date()): string {
  try { if (tz) return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now); } catch {}
  return now.toISOString().slice(0, 10);
}

const CODES: Record<number, string> = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Showers", 81: "Showers", 82: "Violent showers", 85: "Snow showers", 86: "Snow showers", 95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Thunderstorm w/ hail" };

export function dateRange(start: string, end: string): string[] {
  const out: string[] = []; const d = new Date(start + "T00:00:00Z"); const e = new Date(end + "T00:00:00Z");
  while (d <= e) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}
const r1 = (n: number) => Math.round(n * 10) / 10;

export function stats(days: DayWeather[]) {
  const n = days.length || 1;
  return { avgHigh: r1(days.reduce((s, d) => s + d.tmax, 0) / n), avgLow: r1(days.reduce((s, d) => s + d.tmin, 0) / n), minLow: Math.min(...days.map(d => d.tmin)), maxHigh: Math.max(...days.map(d => d.tmax)), rainyDays: days.filter(isRainy).length };
}
// Typical (historical) days: the mm figure is a multi-year mean that one stormy year can inflate,
// so judge them by how often it was wet; forecast days use probability or amount.
export const isRainy = (d: DayWeather) => (d.precipProb ?? 0) >= 50 || (!d.typical && d.precipMm >= 2);

export async function getWeather(p: Place, start: string, end: string, forceTypical = false, todayIso?: string): Promise<WeatherResult> {
  // "Today" = traveller's local date (client tz), else destination's — never raw UTC (v1.5.2)
  const today = new Date((todayIso || todayIn(p.timezone)) + "T00:00:00Z");
  const endD = new Date(end + "T00:00:00Z");
  const daysOut = (endD.getTime() - today.getTime()) / 86400000;
  const startD = new Date(start + "T00:00:00Z");
  const lastFc = new Date(today); lastFc.setUTCDate(lastFc.getUTCDate() + 14);
  const lastFcIso = lastFc.toISOString().slice(0, 10);
  if (!forceTypical && daysOut > 14 && startD <= lastFc && startD >= today) {
    // Mixed: forecast for the first part, typical for the rest
    const [a, b] = await Promise.all([getWeather(p, start, lastFcIso, false, todayIso), getWeather(p, dateRange(lastFcIso, end)[1], end, false, todayIso)]);
    const days = [...a.days, ...b.days];
    return { source: "mixed", note: `Live forecast through ${lastFcIso}; later days are typical for this season (averages of prior years, not a forecast).`, days, stats: stats(days) };
  }
  if (!forceTypical && daysOut <= 14 && startD >= today) {
    const d = await getJSON<any>(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code&timezone=auto&start_date=${start}&end_date=${end}`);
    const days: DayWeather[] = d.daily.time.map((t: string, i: number) => ({ date: t, tmax: r1(d.daily.temperature_2m_max[i]), tmin: r1(d.daily.temperature_2m_min[i]), precipMm: r1(d.daily.precipitation_sum[i] ?? 0), precipProb: d.daily.precipitation_probability_max[i], code: d.daily.weather_code[i], summary: CODES[d.daily.weather_code[i]] ?? "" }));
    // Open-Meteo's last horizon day(s) can come back null — fill those from typical instead of showing 0°
    const gaps = d.daily.time.filter((_: string, i: number) => d.daily.temperature_2m_max[i] == null || d.daily.temperature_2m_min[i] == null);
    if (gaps.length) {
      const typ = await getWeather(p, gaps[0], gaps[gaps.length - 1], true).catch(() => null);
      const byDate = new Map((typ?.days || []).map(x => [x.date, x]));
      for (let i = 0; i < days.length; i++) if (gaps.includes(days[i].date) && byDate.has(days[i].date)) days[i] = byDate.get(days[i].date)!;
      const ok = days.filter(x => !gaps.includes(x.date) || byDate.has(x.date));
      if (gaps.length < days.length) return { source: "mixed", note: `Live forecast where available; ${gaps.length} later day(s) are typical for this season (not a forecast).`, days: ok, stats: stats(ok) };
    }
    return { source: "forecast", note: "Live forecast from Open-Meteo.", days, stats: stats(days) };
  }
  // Typical: same calendar dates over the previous 3 years from the ERA5 archive.
  const dates = dateRange(start, end);
  const thisYear = today.getUTCFullYear();
  const years = [1, 2, 3].map(k => Math.min(Number(start.slice(0, 4)), thisYear) - k);
  const shift = (iso: string, y: number) => { const yy = Number(iso.slice(0, 4)); const md = iso.slice(5); const ny = y + (yy - Number(start.slice(0, 4))); return `${ny}-${md === "02-29" ? "02-28" : md}`; };
  const runs = await Promise.all(years.map(y => getJSON<any>(`https://archive-api.open-meteo.com/v1/archive?latitude=${p.lat}&longitude=${p.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&start_date=${shift(dates[0], y)}&end_date=${shift(dates[dates.length - 1], y)}`).catch(() => null)));
  const ok = runs.filter(Boolean) as any[];
  if (!ok.length) throw new Error("No historical weather available");
  const days: DayWeather[] = dates.map((date, i) => {
    const vals = ok.map(r => ({ mx: r.daily.temperature_2m_max[i], mn: r.daily.temperature_2m_min[i], p: r.daily.precipitation_sum[i] })).filter(v => v.mx != null);
    const n = vals.length || 1;
    const wet = vals.filter(v => (v.p ?? 0) >= 1).length;
    const prob = Math.round((wet / n) * 100);
    const precip = r1(vals.reduce((s, v) => s + (v.p ?? 0), 0) / n);
    return { date, tmax: r1(vals.reduce((s, v) => s + v.mx, 0) / n), tmin: r1(vals.reduce((s, v) => s + v.mn, 0) / n), precipMm: precip, precipProb: prob, code: null, summary: prob >= 50 ? "Often wet" : prob >= 34 ? "Sometimes wet" : "Usually dry", typical: true };
  });
  return { source: "typical", note: `Typical for this season — averages of the same dates in ${ok.length} prior year(s) (Open-Meteo historical archive). Not a forecast.`, days, stats: stats(days) };
}
