/** Trip travel mode (flying vs driving). Labels stay client- and server-safe: no extra API calls. */
import { formatDistance, formatHoursMinutes, type DistanceUnit } from "./distance.js";

export const TRAVEL_MODES = ["flying", "driving"] as const;
export type TravelMode = typeof TRAVEL_MODES[number];
/** Old plans without a saved choice: drive when the home–destination distance is under this many km. */
export const DRIVE_DEFAULT_KM = 300;

export const isTravelMode = (v: unknown): v is TravelMode => v === "flying" || v === "driving";

export function resolveTravelMode(input?: { travelMode?: unknown } | TravelMode | null, distanceKm?: number | null): TravelMode {
  if (isTravelMode(input)) return input;
  if (isTravelMode(input?.travelMode)) return input.travelMode;
  if (distanceKm != null && Number.isFinite(distanceKm) && distanceKm < DRIVE_DEFAULT_KM) return "driving";
  return "flying";
}

const hm = (h: number) => { const H = Math.floor(h), M = Math.round((h - H) * 60 / 5) * 5; return M === 60 ? `${H + 1}h` : M ? (H ? `${H}h ${M}m` : `${M}m`) : `${H}h`; };

export type RoadHint = { roadMin?: number; roadKm?: number; roadSrc?: "osrm" | "estimate"; domestic?: boolean };

function driveAdvice(hours: number, domestic: boolean, routed: boolean): string {
  let s = "";
  if (hours >= 10) s = " — plan stops (and maybe a night on the way)";
  else if (hours >= 6) s = " — plan stops along the way";
  else if (hours >= 3) s = " — plan a couple of breaks";
  const estimate = routed ? "" : " This is a rough estimate, not a turn-by-turn route.";
  const border = domestic ? "" : " Crossing a border can take longer.";
  return s + estimate + border;
}

/** Kid-friendly travel card. Distances default to km; pass `unit` to show miles. */
export function travelTimeLabel(km: number, mode: TravelMode, hint?: RoadHint, unit: DistanceUnit = "km"): { flightHours: number | null; flightLabel: string } {
  const dist = (n: number) => formatDistance(n, unit);
  if (mode === "driving") {
    const routed = hint?.roadSrc === "osrm" && hint.roadMin != null;
    const minutes = routed ? hint.roadMin! : (hint?.roadMin ?? (km / 80) * 60);
    const hours = minutes / 60;
    const roadKm = hint?.roadKm ?? km;
    const distBit = routed
      ? `About ${dist(roadKm)} by road (traffic not included).`
      : `About ${dist(roadKm)} as the crow flies.`;
    return {
      flightHours: hours,
      flightLabel: `About ${formatHoursMinutes(minutes)} of driving${driveAdvice(hours, hint?.domestic !== false, routed)} ${distBit}`.replace(/\s+/g, " ").trim(),
    };
  }
  if (km < 300) {
    return { flightHours: null, flightLabel: `${dist(km)} — usually quicker by road or rail (about ${formatHoursMinutes((km / 80) * 60)} of driving).` };
  }
  const flightHours = 0.5 + (km * 1.05) / 800;
  const road = km < 700 ? ` Or about ${formatHoursMinutes((km / 80) * 60)} by road.` : "";
  return { flightHours, flightLabel: `About ${hm(flightHours)} nonstop flight (about ${dist(km)}).${road}` };
}

/** Rebuild a saved trip's travel card in the user's distance unit. */
export function formatTripTravel(trip: { distanceKm?: number; driveMin?: number; driveKm?: number; driveSrc?: string; domestic?: boolean; flightLabel?: string }, mode: TravelMode, unit: DistanceUnit): string {
  const km = trip.distanceKm ?? 0;
  const hint: RoadHint = {
    roadMin: trip.driveMin,
    roadKm: trip.driveKm,
    roadSrc: trip.driveSrc === "osrm" || trip.driveSrc === "estimate" ? trip.driveSrc : undefined,
    domestic: trip.domestic,
  };
  return travelTimeLabel(km, mode, hint, unit).flightLabel;
}

export const DEPART_FLY = "Last souvenir/coffee stop, then head to the airport/station";
export const DEPART_DRIVE = "Last souvenir/coffee stop, then hit the road";
export const departAfternoon = (mode: TravelMode) => mode === "driving" ? DEPART_DRIVE : DEPART_FLY;

/** Stock timeline lines that swap when the mode changes (overdue suffix is preserved). */
export const TIMELINE_SWAPS: [string, string][] = [
  ["Book flights/transport and accommodation", "Confirm the route, vehicle and accommodation"],
  ["Online check-in, and make a plan to get to the airport (grown-up task)", "Check the car (tyres, fluids, lights), charge or fuel up, pack"],
  ["Online check-in; charge devices; pack", "Check the car (tyres, fluids, lights), charge or fuel up, pack"],
];
export const TIMELINE_DRIVE_EXTRA = "Plan the route, fuel or charging stops, parking and tolls";
const OVERDUE = " (overdue — do now)";

export function applyTimelineMode(tasks: { id: string; due: string; task: string; done: boolean }[], mode: TravelMode, start: string) {
  const strip = (s: string) => s.endsWith(OVERDUE) ? s.slice(0, -OVERDUE.length) : s;
  const out = tasks.map(t => {
    const base = strip(t.task), overdue = t.task.endsWith(OVERDUE);
    for (const [fly, drive] of TIMELINE_SWAPS) {
      if (base === fly || base === drive) return { ...t, task: (mode === "driving" ? drive : fly) + (overdue ? OVERDUE : "") };
    }
    return t;
  });
  if (mode === "driving" && !out.some(t => strip(t.task) === TIMELINE_DRIVE_EXTRA)) {
    const due = tasks[0]?.due || start;
    out.splice(Math.max(0, out.length - 2), 0, { id: "t-drive-route", due, task: TIMELINE_DRIVE_EXTRA, done: false });
  }
  return out;
}
