/** Rain vs snow, used by weather, itinerary and packing. No network. */
export type PrecipKind = "none" | "rain" | "snow" | "mixed";
export type PrecipDay = { tmax?: number; tmin?: number; precipMm?: number; precipProb?: number | null; snowCm?: number | null; summary?: string; code?: number | null; typical?: boolean };

/** Same wet threshold as the pre-1.13 isRainy: 50% probability, or ≥2 mm on a forecast day. */
export const isWet = (d: PrecipDay) => (d.precipProb ?? 0) >= 50 || (!d.typical && (d.precipMm ?? 0) >= 2);
const tmean = (d: PrecipDay) => Number.isFinite(d.tmax) && Number.isFinite(d.tmin) ? (d.tmax! + d.tmin!) / 2 : (d.tmax ?? d.tmin);
/** Mean ≤ ~1°C, or high ≤ ~2°C. */
export const isColdSnow = (d: PrecipDay) => { const m = tmean(d); return (m != null && m <= 1) || (d.tmax != null && d.tmax <= 2); };
/** Up to ~4°C, above the snow band. */
export const isMixedTemp = (d: PrecipDay) => { const m = tmean(d); return (m != null && m <= 4) || (d.tmax != null && d.tmax <= 4); };
const snowCode = (c?: number | null) => c != null && ((c >= 71 && c <= 77) || c === 85 || c === 86);

export function precipKind(d: PrecipDay, loose = false): PrecipKind {
  const hasSnow = Number.isFinite(d.snowCm) && (d.snowCm as number) > 0;
  const wet = loose
    ? (d.precipProb ?? 0) >= 40 || (d.precipMm ?? 0) >= 1 || hasSnow || /rain|snow|shower|sleet|drizzle|storm/i.test(d.summary || "")
    : isWet(d) || hasSnow;
  if (!wet) return "none";
  if (hasSnow) return isColdSnow(d) ? "snow" : isMixedTemp(d) ? "mixed" : "mixed";
  if (snowCode(d.code) || /snow|sleet/i.test(d.summary || "")) return isMixedTemp(d) && !isColdSnow(d) ? "mixed" : "snow";
  if (isColdSnow(d)) return "snow";
  if (isMixedTemp(d)) return "mixed";
  return "rain";
}

/** Liquid rain or mixed slush — indoor rain backups apply. Pure snow does not. */
export const isRainy = (d: PrecipDay) => precipKind(d) === "rain" || precipKind(d) === "mixed";
export const isSnowy = (d: PrecipDay) => precipKind(d) === "snow" || precipKind(d) === "mixed";

export function typicalPrecipSummary(prob: number, kind: PrecipKind): string {
  if (prob >= 50) return kind === "snow" ? "Often snowy" : kind === "mixed" ? "Often mixed rain/snow" : "Often wet";
  if (prob >= 34) return kind === "snow" ? "Sometimes snowy" : kind === "mixed" ? "Sometimes mixed rain/snow" : "Sometimes wet";
  return "Usually dry";
}

export function adjustForecastSummary(summary: string, kind: PrecipKind): string {
  if (kind === "snow" && /rain|shower|drizzle|wet/i.test(summary) && !/snow|sleet|freezing/i.test(summary)) return "Snowy";
  if (kind === "mixed" && /rain|shower|drizzle|wet/i.test(summary) && !/mixed|sleet|snow/i.test(summary)) return "Mixed rain and snow";
  return summary || (kind === "snow" ? "Snowy" : kind === "mixed" ? "Mixed rain and snow" : "");
}

export function precipProbLabel(d: PrecipDay, kind = precipKind(d)): string {
  if (d.precipProb == null) return "";
  if (d.typical) return kind === "snow" ? " snow in sampled years" : kind === "mixed" ? " wet (rain or snow) in sampled years" : " wet in sampled years";
  return kind === "snow" ? " snow" : kind === "mixed" ? " rain/snow" : " rain";
}

export function itineraryPrecipCopy(kind: PrecipKind, ski: boolean, indoorName?: string): string {
  if (kind === "snow") return ski ? "Fresh snow, great for skiing; dress warm" : "Snow likely — dress warm and wear shoes with grip";
  if (kind === "mixed") return ski ? "Mixed snow and rain possible — check conditions; dress warm" : indoorName ? `Mixed rain and snow — waterproof layers; indoor option: ${indoorName}` : "Mixed rain and snow — waterproof layers; indoor sights if it turns to rain";
  if (kind === "rain") return indoorName ? `Rain likely — indoor / partly-covered sights first` : "Rain likely — indoor / partly-covered sights first";
  return indoorName ? `If it rains: ${indoorName}` : "If it rains: café, museum or covered market";
}

export function backupSlotLabel(kind: PrecipKind): string {
  if (kind === "snow") return "❄️ snow";
  if (kind === "mixed") return "❄️ mixed";
  return "☔ backup";
}
