/** Trip travel mode (flying vs driving). Labels stay client- and server-safe: no extra API calls. */
export const TRAVEL_MODES = ["flying", "driving"] as const;
export type TravelMode = typeof TRAVEL_MODES[number];
/** Old plans without a saved choice: drive when the home–destination great-circle is under this many km. */
export const DRIVE_DEFAULT_KM = 300;

export const isTravelMode = (v: unknown): v is TravelMode => v === "flying" || v === "driving";

export function resolveTravelMode(input?: { travelMode?: unknown } | TravelMode | null, distanceKm?: number | null): TravelMode {
  if (isTravelMode(input)) return input;
  if (isTravelMode(input?.travelMode)) return input.travelMode;
  if (distanceKm != null && Number.isFinite(distanceKm) && distanceKm < DRIVE_DEFAULT_KM) return "driving";
  return "flying";
}

const hm = (h: number) => { const H = Math.floor(h), M = Math.round((h - H) * 60 / 5) * 5; return M === 60 ? `${H + 1}h` : M ? (H ? `${H}h ${M}m` : `${M}m`) : `${H}h`; };
const xb = "; straight-line distance ÷ 80 km/h, not road-routed; roads/borders can take much longer";

/** Flying wording is unchanged from v1.11. Driving always uses an approximate, unrouted drive time. */
export function travelTimeLabel(km: number, mode: TravelMode): { flightHours: number | null; flightLabel: string } {
  if (mode === "driving") return { flightHours: km / 80, flightLabel: `~${hm(km / 80)} drive (approx., ${km.toLocaleString("en-US")} km great-circle, not a road route)${xb}` };
  if (km < 300) return { flightHours: null, flightLabel: `${km} km — closer by road or rail (~${hm(km / 80)} drive${xb})` };
  const flightHours = 0.5 + (km * 1.05) / 800;
  return { flightHours, flightLabel: `~${hm(flightHours)} nonstop flight (approx., ${km.toLocaleString("en-US")} km great-circle)${km < 700 ? `; or ~${hm(km / 80)} by road (straight-line ÷ 80 km/h, not routed)` : ""}` };
}

export const DEPART_FLY = "Last souvenir/coffee stop, then head to the airport/station";
export const DEPART_DRIVE = "Last souvenir/coffee stop, then hit the road";
export const departAfternoon = (mode: TravelMode) => mode === "driving" ? DEPART_DRIVE : DEPART_FLY;

/** Stock timeline lines that swap when the mode changes (overdue suffix is preserved). */
export const TIMELINE_SWAPS: [string, string][] = [
  ["Book flights/transport and accommodation", "Confirm the route, vehicle and accommodation"],
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
