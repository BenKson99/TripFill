import type { Place } from "./weather.js";
import { countryInfo } from "./countries.js";
import { resolveTravelMode, travelTimeLabel, type TravelMode } from "../shared/travel.js";

export interface TripFacts {
  home: Place; domestic: boolean; distanceKm: number; flightHours: number | null; flightLabel: string;
  tzDiffHours: number | null; tzLabel: string; homeCurrency: string; homeTz?: string; destTz?: string;
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371, r = (x: number) => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** UTC offset in minutes for an IANA zone at a given date */
export function tzOffsetMin(tz: string, isoDate: string): number | null {
  try {
    const d = new Date(isoDate + "T12:00:00Z");
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d).map(x => [x.type, x.value]));
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    return Math.round((asUtc - d.getTime()) / 60000);
  } catch { return null; }
}
export function tripFacts(home: Place, dest: Place, start: string, modeOrInput?: TravelMode | { travelMode?: unknown } | null): TripFacts {
  const domestic = !!home.countryCode && home.countryCode === dest.countryCode;
  const km = Math.round(haversineKm(home, dest));
  const mode: TravelMode = modeOrInput == null ? "flying" : resolveTravelMode(modeOrInput, km);
  const { flightHours, flightLabel } = travelTimeLabel(km, mode);
  let tzDiffHours: number | null = null, tzLabel = "Time difference unknown";
  if (home.timezone && dest.timezone) {
    const a = tzOffsetMin(home.timezone, start), b = tzOffsetMin(dest.timezone, start);
    if (a != null && b != null) {
      tzDiffHours = (b - a) / 60;
      const abs = Math.abs(tzDiffHours); const n = Number.isInteger(abs) ? `${abs}` : abs.toFixed(1).replace(/\.0$/, "");
      tzLabel = tzDiffHours === 0 ? "Same time as home" : `${n} h ${tzDiffHours > 0 ? "ahead of" : "behind"} home`;
    }
  }
  return { home, domestic, distanceKm: km, flightHours, flightLabel, tzDiffHours, tzLabel, homeCurrency: countryInfo(home.countryCode).cur, homeTz: home.timezone, destTz: dest.timezone };
}
