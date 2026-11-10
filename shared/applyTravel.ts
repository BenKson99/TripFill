import { mergeSuggestions, suggestPacking } from "./packing.js";
import { applyTimelineMode, departAfternoon, DEPART_DRIVE, DEPART_FLY, travelTimeLabel, type TravelMode } from "./travel.js";

/** Relabel travel time, hop labels and stock depart wording, then merge packing suggestions. No API calls. */
export function applyTravelMode(plan: any, mode: TravelMode): any {
  const out = structuredClone(plan);
  out.input = { ...out.input, travelMode: mode };
  const relabel = (km: number | undefined, prev?: string) => {
    if (km == null || !Number.isFinite(km)) return prev;
    return travelTimeLabel(km, mode).flightLabel;
  };
  if (out.trip && out.trip.distanceKm != null) {
    const t = travelTimeLabel(out.trip.distanceKm, mode);
    out.trip.flightHours = t.flightHours;
    out.trip.flightLabel = t.flightLabel;
  }
  if (Array.isArray(out.legs)) {
    for (const leg of out.legs) {
      if (!leg?.fromPrev) continue;
      const prev = leg.fromPrev.flightLabel;
      const next = relabel(leg.fromPrev.distanceKm, prev);
      leg.fromPrev.flightLabel = next;
      if (Array.isArray(out.itinerary) && prev && next && prev !== next) {
        for (const d of out.itinerary) {
          if (typeof d.morning === "string" && d.morning.startsWith("Check out in ") && d.morning.endsWith(prev)) d.morning = d.morning.slice(0, -prev.length) + next;
        }
      }
    }
  }
  if (Array.isArray(out.itinerary)) {
    const next = departAfternoon(mode);
    for (const d of out.itinerary) if (d.afternoon === DEPART_FLY || d.afternoon === DEPART_DRIVE) d.afternoon = next;
  }
  if (Array.isArray(out.timeline)) out.timeline = applyTimelineMode(out.timeline, mode, out.input?.start);
  if (out.packing) out.packing = mergeSuggestions(out.packing, suggestPacking(out, out.packing.settings));
  return out;
}
