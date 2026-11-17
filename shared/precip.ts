/** Rain vs snow, used by weather, itinerary and packing. No network. */
export type PrecipKind = "none" | "rain" | "snow" | "mixed";
export type PrecipDay = { tmax?: number; tmin?: number; precipMm?: number; precipHours?: number | null; precipProb?: number | null; snowCm?: number | null; summary?: string; code?: number | null; typical?: boolean; passingShowers?: boolean };

/** Warm-place short showers (hours or mm) — not a wet day that needs an indoor plan. */
export function isBriefTropicalShower(d: PrecipDay): boolean {
  if (d.passingShowers) return true;
  const warm = (d.tmax ?? 0) >= 24 && (d.tmin == null || d.tmin >= 16);
  if (!warm) return false;
  if ((d.snowCm ?? 0) > 0) return false;
  const mm = d.precipMm ?? 0;
  const hours = d.precipHours;
  if (!(mm > 0 || (hours != null && hours > 0))) return false;
  if (hours != null && hours <= 3 && mm < 8) return true;
  if (mm > 0 && mm < 5) return true;
  return false;
}

/** Same wet threshold as the pre-1.13 isRainy: 50% probability, or ≥2 mm on a forecast day — except short tropical showers. */
export const isWet = (d: PrecipDay) => {
  if (isBriefTropicalShower(d)) return false;
  return (d.precipProb ?? 0) >= 50 || (!d.typical && (d.precipMm ?? 0) >= 2);
};
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

export function typicalPrecipSummary(prob: number, kind: PrecipKind, d?: PrecipDay): string {
  if (d && isBriefTropicalShower(d)) return "Usually sunny";
  if (kind === "snow") return prob >= 50 ? "Often snowy" : "Usually dry";
  if (kind === "mixed") return prob >= 50 ? "Often mixed rain/snow" : "Usually dry";
  if (prob >= 70) return "Rainy most days";
  if (prob >= 40) return "Some rain likely";
  return d && (d.tmax ?? 0) >= 22 ? "Usually sunny" : "Usually dry";
}

export function adjustForecastSummary(summary: string, kind: PrecipKind): string {
  if (kind === "snow" && /rain|shower|drizzle|wet/i.test(summary) && !/snow|sleet|freezing/i.test(summary)) return "Snowy";
  if (kind === "mixed" && /rain|shower|drizzle|wet/i.test(summary) && !/mixed|sleet|snow/i.test(summary)) return "Mixed rain and snow";
  return summary || (kind === "snow" ? "Snowy" : kind === "mixed" ? "Mixed rain and snow" : "");
}

export function precipProbLabel(d: PrecipDay, kind = precipKind(d)): string {
  if (d.precipProb == null) return "";
  const wet = kind !== "none";
  if (d.typical) {
    if (!wet) return " usually dry in sampled years";
    return kind === "snow" ? " snow in sampled years" : kind === "mixed" ? " wet (rain or snow) in sampled years" : " wet in sampled years";
  }
  if (!wet) return "";
  return kind === "snow" ? " snow" : kind === "mixed" ? " rain/snow" : " rain";
}

/** Nearest plain fraction for a historical rain frequency (e.g. 33 → "1 in 3"). */
export function rainFractionLabel(prob: number): string {
  const p = Math.max(0, Math.min(100, prob));
  if (p >= 88) return "almost all";
  if (Math.abs(p - 50) <= 8) return "half";
  const parts: [number, number][] = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [1, 6], [5, 6], [1, 8], [1, 10]];
  let best = parts[0], bestDiff = Infinity;
  for (const [n, d] of parts) {
    const diff = Math.abs(p - (100 * n) / d);
    if (diff < bestDiff) { best = [n, d]; bestDiff = diff; }
  }
  return `${best[0]} in ${best[1]}`;
}

/** Plain wet-chance phrase. Typical days use a past-years fraction; 0% adds nothing. */
export function rainChancePhrase(d: PrecipDay, kind = precipKind(d)): string {
  if (d.precipProb == null) return "";
  const p = d.precipProb;
  if (d.typical) {
    if (p <= 0) return "";
    if (isBriefTropicalShower(d)) return "quick showers are common but short";
    if (kind === "snow") {
      if (p >= 70) return "it snowed on most of these days in past years";
      return `snowed on about ${rainFractionLabel(p)} of these days in past years`;
    }
    if (kind === "mixed") {
      if (p >= 70) return "it had rain or snow on most of these days in past years";
      return `had rain or snow on about ${rainFractionLabel(p)} of these days in past years`;
    }
    if (p >= 70) return "it rained on most of these days in past years";
    return `rained on about ${rainFractionLabel(p)} of these days in past years`;
  }
  if (p <= 0) return "";
  if (kind === "snow") return `${p}% chance of snow`;
  if (kind === "mixed") return `${p}% chance of rain or snow`;
  return `${p}% chance of rain`;
}

/** Compact day line: "Usually dry · {tr:22.3:27.8} · rained on about 1 in 3 of these days in past years". */
export function formatDayWeather(d: PrecipDay): string {
  const kind = precipKind(d);
  const summary = (d.summary || "").trim() || typicalPrecipSummary(d.precipProb ?? 0, kind, d);
  const lo = d.tmin, hi = d.tmax;
  const temps = Number.isFinite(lo) && Number.isFinite(hi) ? `{tr:${lo}:${hi}}` : Number.isFinite(hi) ? `{t:${hi}}` : Number.isFinite(lo) ? `{t:${lo}}` : "";
  const chance = rainChancePhrase(d, kind);
  return [summary, temps, chance].filter(Boolean).join(" · ");
}

/** Expand {t:c} and {tr:lo:hi} temperature tokens into the display unit. */
export function renderTempTokens(text: string, unit: "C" | "F" = "C"): string {
  const conv = (c: number) => unit === "F" ? Math.round(c * 9 / 5 + 32) : Math.round(c);
  const u = unit === "F" ? "°F" : "°C";
  return (text || "")
    .replace(/\{tr:(-?[\d.]+):(-?[\d.]+)\}/g, (_m, a, b) => `${conv(Number(a))}–${conv(Number(b))}${u}`)
    .replace(/\{t:(-?[\d.]+)\}/g, (_m, v) => `${conv(Number(v))}${u}`)
    .replace(/(-?\d+(?:\.\d+)?)°C\b/g, (_m, v) => unit === "F" ? `${Math.round(Number(v) * 9 / 5 + 32)}°F` : `${Math.round(Number(v))}°C`);
}

export function itineraryPrecipCopy(kind: PrecipKind, ski: boolean, indoorName?: string): string {
  if (kind === "snow") return ski ? "Fresh snow, great for skiing; dress warm" : "Snow likely — dress warm and wear shoes with grip";
  if (kind === "mixed") return ski ? "Mixed snow and rain possible — check conditions; dress warm" : indoorName ? `Mixed rain and snow — waterproof layers; indoor option: ${indoorName}` : "Mixed rain and snow — waterproof layers; indoor sights if it turns to rain";
  if (kind === "rain") return indoorName ? `Rain likely — try ${indoorName}` : "Rain likely — indoor / partly-covered sights first";
  return indoorName ? `If it rains: ${indoorName}` : "If it rains: café, museum or covered market";
}

export function backupSlotLabel(kind: PrecipKind): string {
  if (kind === "snow") return "❄️ snow";
  if (kind === "mixed") return "❄️ mixed";
  return "☔ backup";
}

/** Legacy 30% display helper — kept for tests. Packing and the wet-day summary use isRainy. */
export function maybeWetDay(d: PrecipDay): boolean {
  return (d.precipProb ?? 0) >= 30 || (!d.typical && (d.precipMm ?? 0) >= 2);
}
/** Same definition as stats.rainyDays (isRainy): 50% chance, or ≥2 mm on a forecast day. */
export function wetDaysSummary(days: PrecipDay[] = []): { count: number; label: string } {
  const count = days.filter(isRainy).length;
  if (count === 0) {
    if (days.some(isBriefTropicalShower)) return { count: 0, label: "quick showers are common but short" };
    return { count: 0, label: days.some(d => (d.tmax ?? 0) >= 22) ? "usually sunny" : "usually dry" };
  }
  return { count, label: `Wet days ~${count}` };
}
