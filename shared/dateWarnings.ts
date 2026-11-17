import { tripDays } from "./packing.js";

export type DateWarnings = { past?: string; order?: string; long?: string };

/** Friendly inline date hints for the Plan form. */
export function dateWarnings(start: string, end: string, today: string): DateWarnings {
  const out: DateWarnings = {};
  if (start && today && start < today) {
    out.past = "That day is in the past. Pick today or a future day, or plan it anyway as a typical-weather trip.";
  }
  if (start && end && end < start) {
    out.order = "The end date is before the start date. Pick a day on or after your start date.";
  }
  if (start && end && end >= start && tripDays({ start, end }) > 30) {
    out.long = "This trip is longer than 30 days. We'll plan the first 14 days in detail — try a shorter trip if you want the full stay covered.";
  }
  return out;
}
