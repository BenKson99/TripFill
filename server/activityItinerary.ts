import type { ItinDay, TripInput } from "./plan.js";
import type { WeatherResult } from "./weather.js";
import type { Highlight } from "./places.js";
import { precipKind } from "../shared/precip.js";
import {
  ACTIVITY_BY_ID, activityFit, fitContextFromWeather, isRealisticDayTrip, isRealBeach,
  isNightlifeVenue, isRestDayFriendly, isSeriousPeak, isSkiSector, resolveActivities, suitableActivities,
  weatherAllows, type ActivityId, type FitCtx,
} from "../shared/activities.js";
import { driveLabel } from "./plan.js";
import { dedupeItineraryPlaces, releasePlaceFromOtherSlots } from "./itineraryPlaces.js";
import { presetItinerary, type Preset } from "./presets.js";
import { farDayTrip, paceItineraryForKids, applyKidPaceNotes, fillPreferredParks, ensureParkDayRest, capItineraryNotes, isTravelOrLeaveDay, tripHasKids, hasChildUnder, softenHikesForKidsAndHeat, EASY_RIM_WALK, EASY_RIM_AFTERNOON, splitAddOns, joinAddOns, stripOrphanHikeContinues, dedupeRestAfternoon } from "../shared/family.js";
import { isDestinationItself, isLodgingOrStay, isVagueSight, isNearBase, curatedParkSights, visitorCenterName, isHikeInOrInnerCanyon, isOffParkBase } from "../shared/nationalParks.js";
import { applyInterestVenues, applyInterestAddOns, fillNamedAfternoons, replaceVagueNearbySlots, reassignUsedRainBackups, assignUniqueRainBackups, isIndoorishBackup, curatedInterestVenues, curatedIndoorBackups, applyKidPlaceHints, attachCuratedInterestNotes, clusterPearlHarbor } from "../shared/interestVenues.js";
import { filterHighlightList, isJunkSight, isUnsolicitedReligiousAttraction, namedIceCream } from "../shared/junkVenues.js";
import { BEACH_SAFETY_NOTE, NAP_BREAK_NOTE, SENIOR_PACE_NOTE, hasInfantTraveler, hasSeniorTraveler, isOceanBeachDestination, preferredFamilyBeaches } from "../shared/travelAdvice.js";

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
    if (id === "museums") {
      if ((h as any).activity === "museums") return true;
      if (/\b(waterfront|harbour|harbor|aquarium|zoo)\b/i.test(blob)) return false;
      return /\b(museums?|art museums?|art galleries|gallery)\b/i.test(`${h.name} ${h.type || ""}`);
    }
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
    if (id === "nightlife") return isNightlifeVenue(h);
    if (id === "boat") return /marina|harbour|harbor|kayak|boat/.test(blob);
    if (id === "dive") {
      if (/aquarium|zoo|oceanarium/i.test(blob)) return false;
      if ((h as any).activity === "dive") return true;
      return /\b(dive|diving|snorkel|snorkeling|scuba)\b/i.test(blob);
    }
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
  if (id === "dive" && !h) return `${def.emoji} Guided snorkel or dive trip (book an operator)`;
  if (h) return farDayTrip(h) ? `${def.emoji} ${h.name}${driveLabel(h) ? ` (${driveLabel(h)})` : ""}` : `${def.emoji} ${h.name}`;
  const fallback: Partial<Record<ActivityId, string>> = {
    parks: "Pick a theme park nearby (ask a grown-up)",
    museums: "Pick a museum nearby (ask a grown-up)",
    family: "Pick a kid-friendly attraction nearby (ask a grown-up)",
    heritage: "Pick a castle or historic place nearby (ask a grown-up)",
    wildlife: "Pick a park or nature place nearby (ask a grown-up)",
    sightseeing: "Pick a famous sight nearby (ask a grown-up)",
  };
  return `${def.emoji} ${fallback[id] || `Pick a place nearby (ask a grown-up)`}`;
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

function dayMentionsPlace(d: ItinDay | undefined, name: string) {
  if (!d || !name) return false;
  const blob = `${d.morning} ${d.afternoon} ${d.evening} ${d.rainyBackup || ""}`.toLowerCase();
  return blob.includes(name.toLowerCase());
}

function tidyPlaceName(name: string) {
  return (name || "").split("|")[0].trim();
}

function dayHasBeach(d?: ItinDay) {
  if (!d) return false;
  return /🏖|playa |beach\b/i.test(`${d.morning || ""} ${d.afternoon || ""}`);
}

function pickPlace(id: ActivityId, hl: Highlight[], used: Set<string>, inp: TripInput, placeName?: string, day?: ItinDay, days: ItinDay[] = [], slot?: "morning" | "afternoon" | "evening") {
  let list = (id === "beach" || id === "surf") ? hlFor(id, hl).filter(isRealBeach) : hlFor(id, hl).filter(h => !isJunkSight(h));
  list = list.map(h => h.name && h.name.includes("|") ? { ...h, name: tidyPlaceName(h.name) } : h);
  if (id === "beach" || id === "surf") {
    const preferred = preferredFamilyBeaches(placeName || inp.destination || "", inp as any && (inp as any).countryCode || "");
    list = [...list].sort((a, b) => {
      const ia = preferred.findIndex(n => (a.name || "").toLowerCase().includes(n.toLowerCase().replace(/ \(calm\)$/i, "")));
      const ib = preferred.findIndex(n => (b.name || "").toLowerCase().includes(n.toLowerCase().replace(/ \(calm\)$/i, "")));
      const ra = ia >= 0 ? ia : preferred.length + 1;
      const rb = ib >= 0 ? ib : preferred.length + 1;
      return ra - rb;
    });
    // Don't add a *different* second beach the same day. If the afternoon is still generic
    // "Beach time", reuse the beach already named this morning (keeps a real name on the slot).
    if (dayHasBeach(day) && slot === "afternoon") {
      const same = list.find(x => x.name && dayMentionsPlace(day, x.name));
      if (same) {
        used.add(same.name);
        return same;
      }
      return undefined;
    }
  }
  const onOtherDay = (name: string) => days.some(d => d !== day && dayMentionsPlace(d, name));
  const realistic = (x: Highlight) => isRealisticDayTrip(x, inp, { name: placeName });
  const free = (x: Highlight) => realistic(x) && !dayMentionsPlace(day, x.name);
  // Prefer unused places. Never steal a highlight already named on another day (sunset/walks count)
  // when scheduling hiking. Other activities may reuse the only named venue on the *same* day or
  // if nothing else exists (a museum already used as a highlight still gets a museum slot).
  const h = list.find(x => !used.has(x.name) && !onOtherDay(x.name) && free(x))
    || list.find(x => !onOtherDay(x.name) && free(x))
    || (id === "hiking" ? undefined : list.find(x => free(x)))
    || (id === "hiking" || id === "beach" || id === "surf" ? undefined : list.find(x => realistic(x)));
  if (h) {
    used.add(h.name);
    if (day && slot) releasePlaceFromOtherSlots(days.length ? days : (day ? [day] : []), h.name, { day, slot });
    else if (days.length) releasePlaceFromOtherSlots(days, h.name, { day, slot });
  }
  return h;
}

/** Place every suitable activity at least once when mid-days allow, in its preferred slot, using real places. */
export function scheduleActivities(days: ItinDay[], inp: TripInput, w: WeatherResult, hl: Highlight[] = [], placeName?: string) {
  if (days.length < 2) return;
  const mid = days.slice(1, days.length - 1).filter(d => !isTravelOrLeaveDay(d));
  if (!mid.length) return;
  const ctx = fitContext(w, placeName);
  const raw = resolveActivities(inp);
  const fit = raw.filter(id => activityFit(id, ctx).ok);
  const unfit = raw.filter(id => !fit.includes(id));
  stripUnsuitableActivities(days, unfit);
  const wx = (d: ItinDay) => w.days.find(x => x.date === d.date);
  const usedHl = new Set<string>();
  for (const d of days) for (const h of hl) if (h?.name && dayMentionsPlace(d, tidyPlaceName(h.name))) usedHl.add(tidyPlaceName(h.name));
  const taken = new Set<string>(); // `${date}:${slot}`
  const load = new Map<string, number>();
  const bump = (d: ItinDay) => load.set(d.date, (load.get(d.date) || 0) + 1);

  // Claim slots already filled by presets, and attach a real beach name to generic beach wording.
  // Keep at most one preset beach/surf afternoon so tasting and other afternoon activities can land.
  const beachDays = mid.filter(d => mentions(d, "beach") || mentions(d, "surf"));
  for (const [i, d] of beachDays.entries()) {
    if (i === 0) {
      taken.add(`${d.date}:afternoon`);
      bump(d);
      if (/Beach time at a nearby beach|Surf time at a nearby beach/.test(d.afternoon)) {
        const id: ActivityId = /Surf time/.test(d.afternoon) && fit.includes("surf") ? "surf" : "beach";
        const h = pickPlace(id, hl, usedHl, inp, placeName, d, days, "afternoon");
        if (h) d.afternoon = activityLabel(id, h);
      }
    } else if (/Beach time at a nearby beach|Surf time at a nearby beach/.test(d.afternoon)) {
      d.afternoon = "Explore a market or local street";
      d.notes = (d.notes || "").split(" · ").filter(x => x && x !== "beach").join(" · ");
    }
  }
  for (const d of mid) {
    if (mentions(d, "ski")) { taken.add(`${d.date}:morning`); bump(d); }
    if (mentions(d, "hiking") && /🥾/.test(d.morning)) { taken.add(`${d.date}:morning`); bump(d); }
  }

  const alreadyHas = (id: ActivityId) => mid.some(d => mentions(d, id));
  const toPlace = fit.filter(id => {
    if (id === "ski" && alreadyHas("ski")) return false;
    if ((id === "beach" || id === "surf") && alreadyHas(id)) return false;
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
    const h = pickPlace(a.id, hl, usedHl, inp, placeName, a.day, days, a.slot);
    const text = activityLabel(a.id, h);
    if (a.slot === "evening") a.day.evening = `${text}; ${a.day.evening}`;
    else if (a.slot === "morning") a.day.morning = text;
    else if (a.id === "beach" || a.id === "surf") a.day.afternoon = text;
    else if (stockAfternoon(a.day.afternoon) || /Beach time/i.test(a.day.afternoon)) a.day.afternoon = text;
    else if (/Skiing until/.test(a.day.afternoon)) {
      a.day.afternoon = a.day.afternoon.replace(/\s*;\s*or a rest day:.*$/, "") + `; or a rest day: ${text}`;
    } else a.day.afternoon = text;
    // Do not append bare activity labels ("beach", "Surfing") as day notes.
  }
}

const PRESET_ACTIVITY: Record<string, ActivityId | undefined> = {
  ski: "ski", hiking: "hiking", beach: "beach", city: "sightseeing", kids: "family", roadtrip: "scenic",
};

export function runActivitySchedule(days: ItinDay[], inp: TripInput, w: WeatherResult, hl: Highlight[], ps: Preset[], placeName?: string, eats?: { restaurants?: { name?: string }[]; cafes?: { name?: string }[] }) {
  const ctx = fitContext(w, placeName);
  const fit = suitableActivities(inp, w, placeName);
  const youngDrive = hasChildUnder(6, inp);
  const dest = placeName || inp.destination;
  const parkSights = curatedParkSights(dest).map(s => ({
    name: s.name, description: s.description || "A kid-friendly stop in the park.", indoor: !!s.indoor,
    setting: s.setting, type: s.type, source: "TripFill",
  } as Highlight));
  const merged = filterHighlightList([...hl]).map(h => h.name && h.name.includes("|") ? { ...h, name: tidyPlaceName(h.name) } : h);
  for (const s of parkSights) if (!merged.some(h => (h.name || "").toLowerCase() === s.name.toLowerCase())) merged.unshift(s);
  for (const s of curatedIndoorBackups(dest)) if (!merged.some(h => (h.name || "").toLowerCase() === s.name.toLowerCase())) merged.push(s as Highlight);
  for (const slot of curatedInterestVenues(inp.interests || "", dest, { youngChild: hasChildUnder(6, inp) })) {
    if (slot.kind === "evening" || slot.far) continue;
    if (!merged.some(h => (h.name || "").toLowerCase() === slot.name.toLowerCase() || (h.name || "").toLowerCase().includes(slot.name.toLowerCase()))) {
      const typ = /magic kingdom|epcot|hollywood studios|animal kingdom|disneyland|theme park|universal|islands of adventure/i.test(slot.name) ? "theme park" : (slot.kind === "major" ? "attraction" : "sight");
      merged.unshift({ name: slot.name, description: "A well-known stop that matches this trip's interests.", indoor: typ === "theme park" ? false : undefined, setting: typ === "theme park" ? "outdoor" : undefined, type: typ, source: "TripFill" } as Highlight);
    }
  }
  for (const name of preferredFamilyBeaches(placeName || inp.destination || "")) {
    if (!merged.some(h => (h.name || "").toLowerCase().includes(name.toLowerCase().replace(/ \(calm\)$/i, "")))) {
      merged.unshift({ name, description: "A well-known family beach.", indoor: false, setting: "outdoor", type: "beach", source: "TripFill", activity: "beach" } as Highlight);
    }
  }
  const small = hasChildUnder(8, inp);
  const kids = tripHasKids(inp);
  const usable = merged.filter(h => (!h.dayTrip || isRealisticDayTrip(h, inp, { name: placeName }))
    && !isLodgingOrStay(h) && !isDestinationItself(h.name, dest) && !isVagueSight(h) && !isOffParkBase(h.name, dest)
    && isNearBase(h, { smallChild: youngDrive }) && !(small && isHikeInOrInnerCanyon(h)) && !isJunkSight(h)
    && !(kids && isUnsolicitedReligiousAttraction(h, inp.interests || "")));
  const psFit = ps.filter(p => {
    const id = PRESET_ACTIVITY[p];
    if (!id) return true;
    return fit.includes(id);
  }) as Preset[];
  presetItinerary(days, psFit, w, usable);
  scheduleActivities(days, inp, w, usable, placeName);
  stripUnsuitableActivities(days, resolveActivities(inp).filter(id => !activityFit(id, ctx).ok));
  dedupeItineraryPlaces(days, usable, placeName);
  fillPreferredParks(days, usable, inp.interests || "", placeName);
  applyInterestVenues(days, inp.interests || "", placeName, usable, isTravelOrLeaveDay, { youngChild: hasChildUnder(6, inp) });
  fillPreferredParks(days, usable, inp.interests || "", placeName);
  fillNamedAfternoons(days, usable, isTravelOrLeaveDay);
  applyInterestAddOns(days, inp.interests || "", placeName, usable, isTravelOrLeaveDay, {
    maxAddOns: hasChildUnder(8, inp) ? 1 : 2,
    youngChild: hasChildUnder(6, inp),
    iceCreamName: namedIceCream(eats) || namedIceCream(usable),
  });
  replaceVagueNearbySlots(days, usable, inp.interests || "", isTravelOrLeaveDay);
  paceItineraryForKids(days, inp, usable);
  softenHikesForKidsAndHeat(days, inp, w, placeName);
  replaceVagueNearbySlots(days, usable, inp.interests || "", isTravelOrLeaveDay);
  reassignUsedRainBackups(days, usable, visitorCenterName(merged, dest));
  for (const d of days) {
    if (isTravelOrLeaveDay(d)) continue;
    for (const slot of ["morning", "afternoon"] as const) {
      const parts = splitAddOns(d[slot] || "");
      if (!parts.length) continue;
      const cleaned = parts.filter(p => !isDestinationItself(p, dest) && !isLodgingOrStay(p) && !isVagueSight(p));
      if (cleaned.length === parts.length) continue;
      if (cleaned.length) { d[slot] = joinAddOns(cleaned); continue; }
      const next = usable.find(h => h.name && !`${d.morning} ${d.afternoon}`.includes(h.name));
      d[slot] = next?.name || (slot === "afternoon" ? EASY_RIM_AFTERNOON : EASY_RIM_WALK);
    }
  }
  dedupeItineraryPlaces(days, usable, dest);
  paceItineraryForKids(days, inp, usable);
  const vc = visitorCenterName(merged, dest);
  for (const d of days) {
    const bak = d.rainyBackup || "";
    if (!bak) continue;
    const named = bak.replace(/^If it rains:\s*/i, "").replace(/^Rain likely — try\s*/i, "").trim();
    if (!named || /café, museum or covered market|the visitor center or a nearby museum/i.test(named)) continue;
    const hit = usable.find(h => (h.name || "").toLowerCase() === named.toLowerCase()) || merged.find(h => (h.name || "").toLowerCase() === named.toLowerCase());
    const outdoor = !!(hit && (hit.setting === "outdoor" || hit.indoor === false));
    const unsuitable = /wildlife from a distance|stargazing|phantom ranch|\b(palace|castle|bridge)\b|hike-?in/i.test(named);
    const sameDay = `${d.morning || ""} ${d.afternoon || ""}`.toLowerCase().includes(named.toLowerCase());
    if (!outdoor && !unsuitable && !sameDay) continue;
    const used = new Set(days.flatMap(x => [x.morning, x.afternoon, x.rainyBackup]).map(t => (t || "").toLowerCase()));
    const alreadyBak = new Set(days.map(x => (x.rainyBackup || "").toLowerCase()));
    const alt = usable.find(h => h.name && isIndoorishBackup(h) && !used.has(h.name.toLowerCase()) && ![...alreadyBak].some(b => b.includes(h.name!.toLowerCase())));
    const replacement = alt?.name || (vc && !sameDay ? vc : "the visitor center or a nearby museum");
    d.rainyBackup = /^If it rains/i.test(bak) ? `If it rains: ${replacement}` : /^Rain likely/i.test(bak) ? `Rain likely — try ${replacement}` : bak;
  }
  assignUniqueRainBackups(days, usable, visitorCenterName(merged, dest));
  // Replace leftover generic free-mornings with a named family option when one exists.
  const usedNow = (name: string) => days.some(d => `${d.morning} ${d.afternoon} ${d.evening}`.toLowerCase().includes(name.toLowerCase()));
  const familyPick = () => preferredFamilyBeaches(placeName || "", "").find(n => !usedNow(n))
    || usable.find(h => h.name && !usedNow(h.name) && /beach|playa|park|aquarium|museum|zoo|ruins|pyramid|snorkel/i.test(`${h.name} ${h.type || ""}`))?.name;
  for (const d of days) {
    if (isTravelOrLeaveDay(d)) continue;
    if (/^Free morning — wander a new neighbou?rhood/i.test(d.morning || "")) {
      const next = familyPick();
      if (next) d.morning = next;
    }
    // One beach per day — drop a second beach afternoon.
    if (dayHasBeach({ ...d, afternoon: "" } as ItinDay) && dayHasBeach({ ...d, morning: "" } as ItinDay)) {
      const same = tidyPlaceName(d.morning || "") && (d.afternoon || "").toLowerCase().includes(tidyPlaceName(d.morning || "").toLowerCase());
      if (!same) {
        const next = usable.find(h => h.name && !usedNow(h.name) && !isRealBeach(h) && !isJunkSight(h));
        if (next?.name) d.afternoon = next.name;
      }
    }
  }
  if (isOceanBeachDestination(placeName || inp.destination || "")) {
    const firstBeach = days.find(d => !isTravelOrLeaveDay(d) && /🏖|playa |beach\b|snorkel|hanauma|waik[iī]k[iī]|kailua|ko olina|ala moana/i.test(`${d.morning} ${d.afternoon}`));
    if (firstBeach && !days.some(d => d.notes?.includes(BEACH_SAFETY_NOTE))) {
      firstBeach.notes = [firstBeach.notes, BEACH_SAFETY_NOTE].filter(Boolean).join(" · ");
    }
  }
  if (hasInfantTraveler(inp)) {
    for (const d of days) {
      if (isTravelOrLeaveDay(d)) continue;
      if (!d.notes?.includes(NAP_BREAK_NOTE)) d.notes = [d.notes, NAP_BREAK_NOTE].filter(Boolean).join(" · ");
    }
  }
  if (hasSeniorTraveler(inp)) {
    for (const d of days) {
      if (isTravelOrLeaveDay(d)) continue;
      if (!d.notes?.includes(SENIOR_PACE_NOTE)) d.notes = [d.notes, SENIOR_PACE_NOTE].filter(Boolean).join(" · ");
    }
  }
  for (const d of days) {
    for (const slot of ["morning", "afternoon", "evening", "rainyBackup"] as const) {
      const v = d[slot];
      if (v && v.includes("|")) (d as any)[slot] = tidyPlaceName(v);
    }
  }
  applyKidPaceNotes(days, inp, usable);
  // Late slot fills (free-morning replacement, kid icons) can collide with an earlier backup.
  assignUniqueRainBackups(days, usable, visitorCenterName(merged, dest));
  stripOrphanHikeContinues(days, placeName);
  ensureParkDayRest(days, placeName);
  applyInterestAddOns(days, inp.interests || "", placeName, usable, isTravelOrLeaveDay, {
    maxAddOns: hasChildUnder(8, inp) ? 1 : 2,
    youngChild: hasChildUnder(6, inp),
    iceCreamName: namedIceCream(eats) || namedIceCream(usable),
  });
  attachCuratedInterestNotes(days, inp.interests || "", placeName);
  clusterPearlHarbor(days, isTravelOrLeaveDay, placeName, usable);
  stripOrphanHikeContinues(days, placeName);
  if (kids) applyKidPlaceHints(days, usable);
  dedupeRestAfternoon(days, placeName);
  capItineraryNotes(days, 3);
}

