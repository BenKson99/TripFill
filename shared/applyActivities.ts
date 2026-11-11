import { mergeSuggestions, suggestPacking } from "./packing.js";
import { resolveActivities, syncActivityInput, type ActivityId } from "./activities.js";
import { mergeActivityPrep, mergeActivityTimeline } from "./activityPrep.js";

/** Update activities on a plan: packing merge, prep and timeline, no weather fetch. */
export function applyActivities(plan: any, ids: ActivityId[]): any {
  const out = structuredClone(plan);
  out.input = syncActivityInput(out.input || {}, ids);
  if (out.packing) out.packing = mergeSuggestions(out.packing, suggestPacking(out, out.packing.settings));
  out.prep = mergeActivityPrep(out);
  if (Array.isArray(out.timeline)) out.timeline = mergeActivityTimeline(out.timeline, out);
  return out;
}

export function activitiesOfPlan(plan: any): ActivityId[] {
  return resolveActivities(plan?.input);
}
