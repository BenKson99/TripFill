import type { ItinDay, TripInput } from "./plan.js";
import type { WeatherResult } from "./weather.js";
import type { Highlight } from "./places.js";
import { precipKind, isRainy } from "../shared/precip.js";
import { ACTIVITY_BY_ID, activityFit, hasActivity, isRealisticDayTrip, resolveActivities, weatherAllows, type ActivityId, type FitCtx } from "../shared/activities.js";
import { driveLabel } from "./plan.js";
import { presetItinerary, type Preset } from "./presets.js";

export function fitContext(w: WeatherResult, placeName?: string): FitCtx {
  const days = w.days || [];
  const snowy = days.some(d => { const k = precipKind(d); return k === "snow" || k === "mixed"; });
  const rainyShare = days.length ? days.filter(d => isRainy(d)).length / days.length : 0;
  return { avgHigh: w.stats?.avgHigh, minLow: w.stats?.minLow, snowy, rainyShare, placeName };
}

export function activityNotes(inp: TripInput, w: WeatherResult, placeName?: string): string[] {
  const ctx = fitContext(w, placeName);
  return resolveActivities(inp).map(id => activityFit(id, ctx)).filter(f => !f.ok && f.note).map(f => f.note!);
}

function hlFor(id: ActivityId, hl: Highlight[]): Highlight[] {
  const def = ACTIVITY_BY_ID[id];
  const key = (def?.osm || id).replace(/_/g, " ");
  return hl.filter(h => {
    if ((h as any).activity === id) return true;
    if (h.ski && id === "ski") return true;
    const blob = `${h.name} ${h.type || ""} ${h.description || ""}`.toLowerCase();
    if (id === "museums") return /museum|gallery|art/.test(blob);
    if (id === "heritage") return /castle|cathedral|heritage|historic|ruin|palace/.test(blob);
    if (id === "food") return /restaurant|food|market/.test(blob);
    if (id === "shopping") return /market|shop|bazaar/.test(blob);
    if (id === "beach" || id === "surf") return /beach|bay|cove|strand/.test(blob);
    if (id === "hiking") return /trail|hike|peak|summit|pass|viewpoint/.test(blob);
    if (id === "wildlife") return /park|reserve|wildlife|safari|nature/.test(blob);
    if (id === "family") return /zoo|aquarium|family|park/.test(blob);
    if (id === "tasting") return /winery|vineyard|brewery|distillery|tasting/.test(blob);
    if (id === "golf") return /golf/.test(blob);
    if (id === "spa") return /spa|hot spring|onsen|bath/.test(blob);
    if (id === "parks") return /theme park|water park|amusement/.test(blob);
    if (id === "shows") return /theatre|theater|concert|festival|opera/.test(blob);
    if (id === "nightlife") return /bar|club|nightlife/.test(blob);
    if (id === "boat") return /marina|harbour|harbor|kayak|boat/.test(blob);
    if (id === "dive") return /dive|snorkel|scuba/.test(blob);
    if (id === "camping") return /camp/.test(blob);
    if (id === "cycling") return /bike|cycle/.test(blob);
    if (id === "climbing") return /climb|crag/.test(blob);
    if (id === "sightseeing") return /viewpoint|old town|square|plaza/.test(blob);
    return blob.includes(key);
  });
}

/** Schedule selected activities across mid-days, then keep legacy preset behaviour for ski/hike/beach/road. */
export function scheduleActivities(days: ItinDay[], inp: TripInput, w: WeatherResult, hl: Highlight[] = [], placeName?: string) {
  if (days.length < 2) return;
  const mid = days.slice(1, days.length - 1);
  if (!mid.length) return;
  const ctx = fitContext(w, placeName);
  const raw = resolveActivities(inp);
  const fit = raw.filter(id => activityFit(id, ctx).ok);
  const wx = (d: ItinDay) => w.days.find(x => x.date === d.date);
  const usedHl = new Set<string>();
  const pickHl = (id: ActivityId) => {
    const h = hlFor(id, hl).find(x => !usedHl.has(x.name) && isRealisticDayTrip(x, inp, { name: placeName }));
    if (h) usedHl.add(h.name);
    return h;
  };
  const label = (id: ActivityId, h?: Highlight) => {
    const def = ACTIVITY_BY_ID[id];
    if (h) return h.dayTrip ? `${def.emoji} ${def.label}: ${h.name}${driveLabel(h) ? ` (${driveLabel(h)})` : ""}` : `${def.emoji} ${h.name}`;
    return `${def.emoji} ${def.label}`;
  };
  const stockMorning = (s: string) => /^(Free morning|Travel & check)/i.test(s);
  const stockAfternoon = (s: string) => /^(Long lunch|Explore a market|Explore a market or local street)/i.test(s);

  // Primary ski days still come from the existing preset. Other activities rotate across remaining slots.
  const rotate = fit.filter(id => id !== "ski" || !fit.includes("ski"));
  // If ski is the only "mainRepeat" and present, others fill rest-day / leftover slots — handled after presetItinerary.
  const others = fit.filter(id => !(ACTIVITY_BY_ID[id].mainRepeat && fit.length === 1));
  let ri = 0;
  for (const d of mid) {
    const dayWx = wx(d);
    const kind = dayWx ? precipKind(dayWx) : "none";
    const candidates = others.filter(id => !dayWx || weatherAllows(id, dayWx, kind));
    if (!candidates.length) continue;
    const id = candidates[ri++ % candidates.length];
    // Don't plant an activity on every single day if many mid-days and it's not a main activity
    const isMain = ACTIVITY_BY_ID[id].mainRepeat && (fit.length === 1 || id === fit[0]);
    if (!isMain && mid.length > 2 && (ri - 1) % 2 === 1 && candidates.length > 1) {
      // skip every other leftover so we don't repeat the same outing daily
      const alt = candidates[(ri) % candidates.length];
      if (alt && alt !== id && dayWx && weatherAllows(alt, dayWx, kind)) {
        const h = pickHl(alt);
        const def = ACTIVITY_BY_ID[alt];
        if (def.slot === "evening" && !/Dinner:/.test(d.evening) === false) {
          d.evening = `${label(alt, h)}; ${d.evening}`;
        } else if (def.slot === "morning" && stockMorning(d.morning)) d.morning = label(alt, h);
        else if (stockAfternoon(d.afternoon) || def.slot === "afternoon" || def.slot === "flex") {
          if (stockAfternoon(d.afternoon)) d.afternoon = label(alt, h);
          else if (!d.afternoon.includes(ACTIVITY_BY_ID[alt].label) && !d.afternoon.includes(ACTIVITY_BY_ID[alt].emoji)) d.afternoon = `${d.afternoon}; or ${label(alt, h)}`;
        }
        continue;
      }
    }
    const h = pickHl(id);
    const def = ACTIVITY_BY_ID[id];
    if (def.slot === "evening") {
      d.evening = `${label(id, h)}; ${d.evening}`;
    } else if (def.slot === "morning") {
      if (stockMorning(d.morning) || !hasActivity(inp, "ski")) d.morning = d.morning && !stockMorning(d.morning) && hasActivity(inp, "ski") ? d.morning : label(id, h);
      else if (stockAfternoon(d.afternoon)) d.afternoon = label(id, h);
    } else {
      if (stockAfternoon(d.afternoon)) d.afternoon = label(id, h);
      else if (stockMorning(d.morning)) d.morning = label(id, h);
      else if (!d.afternoon.includes(def.emoji)) d.afternoon = `${d.afternoon}; or ${label(id, h)}`;
    }
    d.notes = [d.notes, def.label].filter((x, i, a) => x && a.indexOf(x) === i).join(" · ");
  }
}

export function runActivitySchedule(days: ItinDay[], inp: TripInput, w: WeatherResult, hl: Highlight[], ps: Preset[], placeName?: string) {
  // Filter day-trip highlights that aren't realistic for this mode/place before presets run
  const usable = hl.filter(h => !h.dayTrip || isRealisticDayTrip(h, inp, { name: placeName }));
  presetItinerary(days, ps, w, usable);
  scheduleActivities(days, inp, w, usable, placeName);
}
