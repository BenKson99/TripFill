/** Distance display unit. Defaults to miles for the US and UK, kilometres elsewhere. */
export const DISTANCE_UNITS = ["km", "mi"] as const;
export type DistanceUnit = typeof DISTANCE_UNITS[number];
export const isDistanceUnit = (v: unknown): v is DistanceUnit => v === "km" || v === "mi";

const MILE_COUNTRIES = new Set(["US", "GB", "UK", "LR", "MM"]);

export function defaultDistanceUnit(countryCode?: string, locale?: string): DistanceUnit {
  const cc = (countryCode || "").toUpperCase();
  if (cc) return MILE_COUNTRIES.has(cc) ? "mi" : "km";
  const loc = locale || (typeof navigator !== "undefined" ? navigator.language : "");
  if (MILE_COUNTRIES.has(loc.split("-")[1]?.toUpperCase() || "")) return "mi";
  if (/^en-GB\b|^en-US\b/i.test(loc)) return "mi";
  return "km";
}

export const KM_PER_MILE = 1.609344;
export function kmToMiles(km: number) { return km / KM_PER_MILE; }

export function formatDistance(km: number, unit: DistanceUnit): string {
  if (unit === "mi") {
    const mi = Math.round(kmToMiles(km));
    return `${mi.toLocaleString("en-US")} mile${mi === 1 ? "" : "s"}`;
  }
  return `${Math.round(km).toLocaleString("en-US")} km`;
}

export function formatHoursMinutes(min: number): string {
  const m = Math.max(0, Math.round(min / 5) * 5);
  const H = Math.floor(m / 60), M = m % 60;
  if (H && M) return `${H} hour${H === 1 ? "" : "s"} ${M} minutes`;
  if (H) return `${H} hour${H === 1 ? "" : "s"}`;
  return `${M || 5} minutes`;
}

/** Shorter "~2h 15m" form used inside itinerary lines. */
export function formatShortDuration(min: number): string {
  const m = Math.max(0, Math.round(min / 5) * 5);
  const H = Math.floor(m / 60), M = m % 60;
  if (H && M) return `${H}h ${M}m`;
  if (H) return `${H}h`;
  return `${M || 5}m`;
}
