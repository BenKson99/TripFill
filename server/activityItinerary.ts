import type { ItinDay, TripInput } from "./plan.js";
import type { WeatherResult } from "./weather.js";
import type { Highlight } from "./places.js";
import { precipKind } from "../shared/precip.js";
import {
  ACTIVITY_BY_ID, activityFit, fitContextFromWeather, isRealisticDayTrip, isRealBeach,
  isRestDayFriendly, isSeriousPeak, isSkiSector, resolveActivities, suitableActivities,
  weatherAllows, type ActivityId, type FitCtx,
} from "../shared/activities.js";
import { driveLabel } from "./plan.js";
import { presetItinerary, type Preset } from "./presets.js";

export function fitContext(w: WeatherResult, placeName?: string): FitCtx {
  return fitContextFromWeather(w, placeName);
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
    if ((id === "beach" || id === "surf") && isRealBeach(h)) return true;
    const blob = `${h.name} ${h.type || ""} ${h.description || ""}`.toLowerCase();
    if (id === "museums") return /museum|gallery|art/.test(blob);
    if (id === "heritage") return /castle|cathedral|heritage|historic|ruin|palace/.test(blob);
    if (id === "food") return /restaurant|food|market/.test(blob);
    if (id === "shopping") return /market|shop|bazaar/.test(blob);
    if (id === "beach" || id === "surf") return false;
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

const stockMorning = (s: string) => /^(Free morning|Travel & check)/i.test(s);
const stockAfternoon = (s: string) => /^(Long lunch|Explore a market|Explore a market or local street)/i.test(s);
const skiMorning = (s: string) => /^⛷/.test(s) || /^Ski /i.test(s);

function slotOrder(id: ActivityId): Array<"morning" | "afternoon" | "evening"> {
  const slot = ACTIVITY_BY_ID[id]?.slot;
  if (slot === "morning") return ["morning", "afternoon", "evening"];
  if (slot === "evening") return ["evening", "afternoon", "morning"];
  if (slot === "afternoon") return ["afternoon", "morning", "evening"];
  return ["afternoon", "morning", "evening"];
}

function activityLabel(id: ActivityId, h?: Highlight) {
  const def = ACTIVITY_BY_ID[id];
  if (id === "beach" || id === "surf") {
    if (h && isRealBeach(h)) return `${def.emoji} ${h.name}`;
    return id === "surf" ? `${def.emoji} Surf time at a nearby beach` : `${def.emoji} Beach time at a nearby beach`;
  }
  if (h) return h.dayTrip ? `${def.emoji} ${def.label}: ${h.name}${driveLabel(h) ? ` (${driveLabel(h)})` : ""}` : `${def.emoji} ${h.name}`;
  return `${def.emoji} ${def.label}`;
}

function mentions(d: ItinDay, id: ActivityId) {
  const def = ACTIVITY_BY_ID[id];
  const text = `${d.morning} ${d.afternoon} ${d.evening}`;
  if (def.emoji && text.includes(def.emoji)) return true;
  if (id === "ski" && /ski(?:ing)?\b/i.test(text)) return true;
  if (id === "beach" && /beach time/i.test(text)) return true;
  return new RegExp(def.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text);
}

/** Drop any itinerary mention of activities that do not fit this place or season. */
export function stripUnsuitableActivities(days: ItinDay[], unfit: ActivityId[]) {
  for (const id of unfit) {
    const def = ACTIVITY_BY_ID[id];
    const emoji = def?.emoji;
    const bits = [emoji, def?.label, id === "beach" ? "Beach time" : "", id === "surf" ? "Surf time" : ""].filter(Boolean) as string[];
    const re = new RegExp(`(?:^|;\\s*|·\\s*)(?:${bits.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})[^;]*`, "gi");
    for (const d of days) {
      for (const k of ["morning", "afternoon", "evening", "notes"] as const) {
        const next = (d[k] || "").replace(re, "").replace(/^[;·,\s]+/, "").replace(/[;·,\s]+$/, "").replace(/\s*;\s*;/g, ";").replace(/\s{2,}/g, " ").trim();
        (d as any)[k] = next;
      }
      if (!d.afternoon) d.afternoon = "Explore a market or local street";
      if (!d.morning) d.morning = "Free morning — wander a new neighbourhood";
    }
  }
}

function pickPlace(id: ActivityId, hl: Highlight[], used: Set<string>, inp: TripInput, placeName?: string) {
  const list = (id === "beach" || id === "surf") ? hlFor(id, hl).filter(isRealBeach) : hlFor(id, hl);
  const h = list.find(x => !used.has(x.name) && isRealisticDayTrip(x, inp, { name: placeName }))
    || list.find(x => isRealisticDayTrip(x, inp, { name: placeName }));
  if (h) used.add(h.name);
  return h;
}

/** Place every suitable activity at least once when mid-days allow, in its preferred slot, using real places. */
export function scheduleActivities(days: ItinDay[], inp: TripInput, w: WeatherResult, hl: Highlight[] = [], placeName?: string) {
  if (days.length < 2) return;
  const mid = days.slice(1, days.length - 1);
  if (!mid.length) return;
  const ctx = fitContext(w, placeName);
  const raw = resolveActivities(inp);
  const fit = raw.filter(id => activityFit(id, ctx).ok);
  const unfit = raw.filter(id => !fit.includes(id));
  stripUnsuitableActivities(days, unfit);
  const wx = (d: ItinDay) => w.days.find(x => x.date === d.date);
  const usedHl = new Set<string>();
  const taken = new Set<string>(); // `${date}:${slot}`
  const load = new Map<string, number>();
  const bump = (d: ItinDay) => load.set(d.date, (load.get(d.date) || 0) + 1);

  // Claim slots already filled by presets, and attach a real beach name to generic beach wording.
  for (const d of mid) {
    if (mentions(d, "beach") || mentions(d, "surf")) {
      taken.add(`${d.date}:afternoon`);
      bump(d);
      if (/Beach time at a nearby beach|Surf time at a nearby beach/.test(d.afternoon)) {
        const id: ActivityId = /Surf time/.test(d.afternoon) && fit.includes("surf") ? "surf" : "beach";
        const h = pickPlace(id, hl, usedHl, inp, placeName);
        if (h) d.afternoon = activityLabel(id, h);
      }
    }
    if (mentions(d, "ski")) { taken.add(`${d.date}:morning`); bump(d); }
    if (mentions(d, "hiking") && /🥾/.test(d.morning)) { taken.add(`${d.date}:morning`); bump(d); }
  }

  const toPlace = fit.filter(id => {
    if (id === "ski" && mid.some(d => mentions(d, "ski"))) return false;
    return true;
  }).sort((a, b) => {
    const ra = { morning: 0, afternoon: 1, evening: 2, flex: 3 }[ACTIVITY_BY_ID[a].slot] ?? 3;
    const rb = { morning: 0, afternoon: 1, evening: 2, flex: 3 }[ACTIVITY_BY_ID[b].slot] ?? 3;
    return ra - rb;
  });

  type Slot = "morning" | "afternoon" | "evening";
  const assignments: { day: ItinDay; slot: Slot; id: ActivityId }[] = [];

  for (const id of toPlace) {
    let chosen: { day: ItinDay; slot: Slot } | undefined;
    for (const slot of slotOrder(id)) {
      const cands = mid.filter(d => {
        const dayWx = wx(d);
        const kind = dayWx ? precipKind(dayWx) : "none";
        if (dayWx && !weatherAllows(id, dayWx, kind)) return false;
        if (slot === "morning" && skiMorning(d.morning) && id !== "ski") return false;
        if (taken.has(`${d.date}:${slot}`)) return false;
        return true;
      }).sort((a, b) => (load.get(a.date) || 0) - (load.get(b.date) || 0));
      if (cands[0]) { chosen = { day: cands[0], slot }; break; }
    }
    if (!chosen) continue;
    assignments.push({ ...chosen, id });
    taken.add(`${chosen.day.date}:${chosen.slot}`);
    bump(chosen.day);
  }

  for (const a of assignments) {
    const h = pickPlace(a.id, hl, usedHl, inp, placeName);
    const text = activityLabel(a.id, h);
    if (a.slot === "evening") a.day.evening = `${text}; ${a.day.evening}`;
    else if (a.slot === "morning") a.day.morning = text;
    else if (a.id === "beach" || a.id === "surf") a.day.afternoon = text;
    else if (stockAfternoon(a.day.afternoon) || /Beach time/i.test(a.day.afternoon)) a.day.afternoon = text;
    else if (/Skiing until/.test(a.day.afternoon)) {
      a.day.afternoon = a.day.afternoon.replace(/\s*;\s*or a rest day:.*$/, "") + `; or a rest day: ${text}`;
    } else a.day.afternoon = text;
    a.day.notes = [a.day.notes, ACTIVITY_BY_ID[a.id].label].filter((x, i, arr) => x && arr.indexOf(x) === i).join(" · ");
  }
}

const PRESET_ACTIVITY: Record<string, ActivityId | undefined> = {
  ski: "ski", hiking: "hiking", beach: "beach", city: "sightseeing", kids: "family", roadtrip: "scenic",
};

export function runActivitySchedule(days: ItinDay[], inp: TripInput, w: WeatherResult, hl: Highlight[], ps: Preset[], placeName?: string) {
  const ctx = fitContext(w, placeName);
  const fit = suitableActivities(inp, w, placeName);
  const usable = hl.filter(h => !h.dayTrip || isRealisticDayTrip(h, inp, { name: placeName }));
  const psFit = ps.filter(p => {
    const id = PRESET_ACTIVITY[p];
    if (!id) return true;
    return fit.includes(id);
  }) as Preset[];
  presetItinerary(days, psFit, w, usable);
  scheduleActivities(days, inp, w, usable, placeName);
  stripUnsuitableActivities(days, resolveActivities(inp).filter(id => !activityFit(id, ctx).ok));
}
