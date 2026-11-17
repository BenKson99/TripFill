import { suggestPacking } from "../shared/packing.js";
import { departAfternoon, resolveTravelMode, TIMELINE_DRIVE_EXTRA } from "../shared/travel.js";
import type { WeatherResult, DayWeather, Place } from "./weather.js";
import { isRainy, todayIn } from "./weather.js";
import { precipKind, itineraryPrecipCopy, formatDayWeather } from "../shared/precip.js";
import { isBroadRegion } from "../shared/region.js";
import { isRealisticDayTrip } from "../shared/activities.js";
import type { Highlight } from "./places.js";
import { preferredHighlights } from "./preferences.js";
import type { Eat } from "./eats.js";
import { familyDinnerList, CASUAL_DINNER_FALLBACK, eatBrandKey } from "../shared/familyEats.js";
import { filterDinnerList, filterHighlightList, preferFamilySights, isUnsolicitedReligiousAttraction } from "../shared/junkVenues.js";
import { hasInfantTraveler, hasSeniorTraveler, preferredFamilyBeaches } from "../shared/travelAdvice.js";
import { isIndoorishBackup, curatedInterestVenues, curatedIndoorBackups } from "../shared/interestVenues.js";
import { tripHasKids, hasChildUnder, isMajorAttraction, isCompetitorPark, interestBrands, matchesBrand, farDayTrip, holidayNote, paceItineraryForKids, applyHolidayNotes, KIDS_DRIVE_DAY, overnightDay1Morning, overnightDay2Morning, overnightStopName, isOvernightFlight, jetLagNote, OVERNIGHT_FLY_DAY1, OVERNIGHT_FLY_DAY2, isNatureDestination, sunsetViewpointLine, altitudeNote } from "../shared/family.js";
import { isDestinationItself, isLodgingOrStay, isVagueSight, isNearBase, visitorCenterName, campsiteSetupLine, curatedParkSights, isHikeInOrInnerCanyon, isOffParkBase } from "../shared/nationalParks.js";
import { formatShortDuration } from "../shared/distance.js";

export interface TripInput { destination: string; start: string; end: string; travelers?: number; purpose?: string; style?: "Slow" | "Packed" | "Mix"; interests?: string; dietaryNeeds?: string; walkingTolerance?: string; home?: Place; travelMode?: "flying" | "driving"; presets?: string[]; activities?: import("../shared/activities.js").ActivityId[] }
export type { PackingItem as PackItem, PackingGroup as PackGroup } from "../shared/packing.js";
export interface ItinDay { date: string; label: string; weather: string; morning: string; afternoon: string; evening: string; rainyBackup?: string; notes: string }
export interface Task { id: string; due: string; task: string; done: boolean }
export interface BudgetLine { category: string; perDay: number; total: number; basis: string }

let n = 0; const id = () => `i${++n}`;
const fmt = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const addDays = (iso: string, k: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };

/** Shared deterministic packing engine also powers explicit client-side refresh. */
export function packing(inp: TripInput, w: WeatherResult, place: Place, nights: number, domestic = false, home?: Place) {
  return suggestPacking({ input: inp, weather: w, place, trip: { domestic, home: home || inp.home } });
}

const dist = (a: { lat?: number; lon?: number }, b: { lat?: number; lon?: number }) => { const r = (x: number) => x * Math.PI / 180; const h = Math.sin(r(b.lat! - a.lat!) / 2) ** 2 + Math.cos(r(a.lat!)) * Math.cos(r(b.lat!)) * Math.sin(r(b.lon! - a.lon!) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
/** "~30 min drive, traffic not included" from OSRM, or a rough estimate fallback. */
export const driveLabel = (h: { driveMin?: number; driveSrc?: string; distanceKm?: number }) => {
  const m = h.driveMin ?? (h.distanceKm != null ? Math.round(h.distanceKm * 1.4) : undefined);
  if (m == null) return "";
  const r5 = Math.max(5, Math.round(m / 5) * 5);
  const short = r5 < 60 ? `${r5} min` : formatShortDuration(r5);
  const how = h.driveSrc === "osrm" ? "traffic not included" : "rough estimate, traffic not included";
  return `~${short} drive, ${how}`;
};
export type ItineraryOpts = { domestic?: boolean; travelMode?: "flying" | "driving"; driveMin?: number; overnightStop?: string | null; countryCode?: string; flightHours?: number | null; tzDiffHours?: number | null; destName?: string; elevationM?: number; cafes?: Eat[] };
const tidyPlaceName = (name: string) => (name || "").split("|")[0].trim();
export function itinerary(inp: TripInput, w: WeatherResult, hl: Highlight[], food: Eat[], extraIndoor: Highlight[] = [], opts: ItineraryOpts = {}): ItinDay[] {
  const tidy = (h: Highlight) => h.name && h.name.includes("|") ? { ...h, name: tidyPlaceName(h.name) } : h;
  hl = preferredHighlights(hl.map(tidy), inp);
  extraIndoor = extraIndoor.map(tidy);
  const destName = opts.destName || inp.destination;
  const youngDrive = hasChildUnder(6, inp);
  const parkSights = curatedParkSights(destName).map(s => ({
    name: s.name, description: s.description || "A kid-friendly stop in the park.", indoor: !!s.indoor,
    setting: s.setting, type: s.type, source: "TripFill",
  } as Highlight));
  for (const s of parkSights) if (!hl.some(h => (h.name || "").toLowerCase() === s.name.toLowerCase())) hl = [s, ...hl];
  for (const s of curatedIndoorBackups(destName)) if (!extraIndoor.some(h => (h.name || "").toLowerCase() === s.name.toLowerCase()) && !hl.some(h => (h.name || "").toLowerCase() === s.name.toLowerCase())) extraIndoor = [s as Highlight, ...extraIndoor];
  for (const slot of curatedInterestVenues(inp.interests || "", destName, { youngChild: hasChildUnder(6, inp) })) {
    if (slot.kind === "evening" || slot.far) continue;
    if (!hl.some(h => (h.name || "").toLowerCase() === slot.name.toLowerCase())) {
      const typ = /magic kingdom|epcot|hollywood studios|animal kingdom|disneyland|theme park|universal|islands of adventure/i.test(slot.name) ? "theme park" : "attraction";
      hl = [{ name: slot.name, description: "A well-known stop that matches this trip's interests.", indoor: typ === "theme park" ? false : undefined, setting: typ === "theme park" ? "outdoor" : undefined, type: typ, source: "TripFill" } as Highlight, ...hl];
    }
  }
  const sourceHighlights = hl;
  const lightAddOnOnly = (h: Highlight) => /platform\s*9|double-?decker|hop-?on hop-?off|watch wildlife from a distance|stargazing after dark|set up at (?:your )?camp/i.test(h.name || "");
  const activityOk = (h: Highlight) => !isLodgingOrStay(h) && !isDestinationItself(h.name, destName) && !isVagueSight(h) && !isOffParkBase(h.name, destName) && isNearBase(h, { smallChild: youngDrive }) && !(hasChildUnder(8, inp) && isHikeInOrInnerCanyon(h)) && !lightAddOnOnly(h) && !(tripHasKids(inp) && isUnsolicitedReligiousAttraction(h, inp.interests || ""));

  const activityHl = hl.filter(activityOk);
  const style = inp.walkingTolerance === "low" ? "Slow" : inp.style || "Mix";
  const kids = tripHasKids(inp);
  const casualDinner = !!(hasInfantTraveler(inp) || hasChildUnder(7, inp) || kids);
  const nearFood = food.filter(e => isNearBase(e as any, { smallChild: youngDrive }) && !isOffParkBase(e?.name, destName));
  const abroad = opts.domestic === false;
  const dinnerOpts = { kids: casualDinner, infant: hasInfantTraveler(inp), senior: hasSeniorTraveler(inp), abroad };
  food = casualDinner || dinnerOpts.senior || abroad
    ? filterDinnerList(familyDinnerList(nearFood.length ? nearFood : food, casualDinner), dinnerOpts)
    : filterDinnerList(nearFood.length ? nearFood : food, dinnerOpts);
  if ((casualDinner || kids) && opts.cafes?.length) {
    const extra = filterDinnerList(opts.cafes, dinnerOpts).filter(c => c.name && !food.some(f => eatBrandKey(f) === eatBrandKey(c)));
    food = food.concat(extra);
  }
  const dinnerUsed = new Set<string>();
  const dinnerPick = () => {
    const next = food.find(e => {
      if (!e.name) return false;
      const key = eatBrandKey(e);
      return !dinnerUsed.has(e.name.toLowerCase()) && !dinnerUsed.has(key);
    });
    if (next?.name) {
      dinnerUsed.add(next.name.toLowerCase());
      dinnerUsed.add(eatBrandKey(next));
      return next;
    }
    return undefined;
  };
  const dinnerLine = (prefix: string, fallback: string) => {
    const e = dinnerPick();
    if (!e?.name) return fallback;
    const tag = e.tag && e.tag !== "restaurant" ? ` (${e.tag})` : "";
    return `${prefix}${e.name}${tag}`;
  };
  const familyDinnerFallback = casualDinner || kids ? CASUAL_DINNER_FALLBACK : "Dinner somewhere local";
  const perDay = kids ? 1 : style === "Slow" ? 1 : style === "Packed" ? (inp.walkingTolerance === "high" ? 4 : 3) : 2;
  hl = preferFamilySights(filterHighlightList(activityHl.filter(h => !isBroadRegion(h)))); extraIndoor = filterHighlightList(extraIndoor.filter(h => !isBroadRegion(h) && activityOk(h as Highlight)));
  const outdoor = hl.filter(h => h.setting !== "indoor"), indoor = [...hl.filter(h => h.setting === "indoor"), ...hl.filter(h => h.setting === "mixed")];
  hl = hl.filter(h => !h.ski); // ski areas are scheduled by the ski preset
  const outdoorF = outdoor.filter(h => !h.ski);
  const queue = [...hl];
  const brands = interestBrands(inp.interests || "");
  if (brands.length) queue.sort((a, b) => {
    const score = (h: Highlight) => brands.some(br => matchesBrand(h.name, br)) ? 0 : isMajorAttraction(h) ? 2 : 1;
    return score(a) - score(b);
  });
  const days = w.days.slice(0, 14); const usedBackup = new Set<string>(); const usedNames = new Set<string>();
  const rememberPlaces = (text: string) => { for (const h of sourceHighlights) if (h?.name && text.toLowerCase().includes(h.name.toLowerCase())) usedNames.add(h.name); };
  const label = (h: Highlight) => farDayTrip(h) ? `🚐 Day trip: ${h.name} (${driveLabel(h)} each way)` : h.name;
  const vcName = visitorCenterName([...extraIndoor, ...sourceHighlights], destName);
  const previewBlob = (h: Highlight) => `${h.name} ${h.type || ""} ${h.description || ""}`;
  const previewSafe = (h: Highlight) => !farDayTrip(h) && isIndoorishBackup(h);
  const previewNearby = (h: Highlight) => previewSafe(h) && (h.driveMin == null || h.driveMin <= 25);
  const previewPrefer = (h: Highlight) => previewNearby(h) && /visitor (centre|center)|museum|gallery|library|studio|junior ranger|hopi house/i.test(previewBlob(h));
  const takeIndoorForBackup = () => extraIndoor.find(h => h?.name && !usedBackup.has(h.name) && previewPrefer(h))
    || extraIndoor.find(h => h?.name && !usedBackup.has(h.name) && previewNearby(h))
    || queue.find(h => !h.dayTrip && !h.ski && !usedBackup.has(h.name) && previewPrefer(h))
    || queue.find(h => !h.dayTrip && !h.ski && !usedBackup.has(h.name) && previewNearby(h));
  const reservedByIndex = new Map<number, string>();
  const midIdx = days.map((_, i) => i).filter(i => i !== 0 && i !== days.length - 1);
  for (const i of midIdx.filter(i => ["rain", "mixed"].includes(precipKind(days[i])))) {
    const h = takeIndoorForBackup();
    if (h) {
      usedBackup.add(h.name);
      if (queue.includes(h)) queue.splice(queue.indexOf(h), 1);
      reservedByIndex.set(i, h.name);
    } else if (vcName && !usedBackup.has(vcName)) {
      usedBackup.add(vcName);
      reservedByIndex.set(i, vcName);
    }
  }
  const built: import("./plan.js").ItinDay[] | any[] = [];
  const row = (day: any) => { rememberPlaces(`${day.morning || ""} ${day.afternoon || ""} ${day.evening || ""}`); built.push(day); return day; };
  return days.map((d, i) => {
    const kind = precipKind(d); const rain = kind === "rain"; const ski = ((inp as any).presets || []).includes("ski") || ((inp as any).activities || []).includes("ski") || /ski|snowboard/i.test(`${inp.purpose || ""} ${inp.interests || ""}`);
    const wx = `${d.typical ? "Seasonal estimate (not forecast)" : "Open-Meteo forecast"} · ${formatDayWeather(d)}`.trim();
    const driveMin = opts.driveMin ?? 0;
    const drivingLong = (opts.travelMode || resolveTravelMode(inp)) === "driving" && driveMin >= 6 * 60;
    const overnight = drivingLong && driveMin >= 10 * 60;
    const stop = (opts.overnightStop || "").trim();
    const flyNight = isOvernightFlight({ travelMode: opts.travelMode || resolveTravelMode(inp), domestic: opts.domestic, flightHours: opts.flightHours, tzDiffHours: opts.tzDiffHours });
    const lag = jetLagNote(opts.destName || inp.destination, opts.tzDiffHours);
    if (i === 0) {
      const morning = overnight ? overnightDay1Morning(stop, driveMin) : drivingLong ? KIDS_DRIVE_DAY : flyNight ? OVERNIGHT_FLY_DAY1 : "Travel & check in";
      const sunset = isNatureDestination(opts.destName || inp.destination) ? sunsetViewpointLine(sourceHighlights) : "Easy walk around your neighbourhood";
      const camp = !overnight && !drivingLong && !flyNight ? campsiteSetupLine(sourceHighlights, inp.interests || "") : undefined;
      const afternoon = overnight
        ? `Overnight in ${overnightStopName(stop)} — no need to reach ${inp.destination || "your destination"} today`
        : drivingLong
          ? "Check in & rest — skip the neighbourhood walk today"
          : flyNight
            ? "Sleep on the plane — you'll arrive tomorrow"
            : (camp ? ( /sunset/i.test(sunset) ? `${camp}; then ${sunset}` : camp ) : sunset);
      const alt = !flyNight && !overnight ? altitudeNote(opts.elevationM ?? w.elevationM) : "";
      const notes = [overnight && !stop ? "Consider an overnight stop around the midpoint" : "", lag, alt, holidayNote(d.date, opts.countryCode) || ""].filter(Boolean).join(" · ");
      const tag = overnight ? "Drive" : flyNight ? "Fly" : "Arrive";
      return row({ date: d.date, label: `Day 1 · ${fmt(d.date)} · ${tag}`, weather: wx, morning, afternoon, evening: overnight ? `Dinner and an early night in ${overnightStopName(stop)}` : flyNight ? "Overnight on the plane" : dinnerLine("Dinner nearby: ", "Relaxed dinner near your stay"), notes });
    }
    if (overnight && i === 1 && days.length > 2) {
      return row({ date: d.date, label: `Day 2 · ${fmt(d.date)} · Arrive`, weather: wx, morning: overnightDay2Morning(driveMin), afternoon: "Check in & rest — skip the neighbourhood walk today", evening: dinnerLine("Dinner nearby: ", "Relaxed dinner near your stay"), notes: [altitudeNote(opts.elevationM ?? w.elevationM), holidayNote(d.date, opts.countryCode) || ""].filter(Boolean).join(" · ") });
    }
    if (flyNight && i === 1 && days.length > 2) {
      return row({ date: d.date, label: `Day 2 · ${fmt(d.date)} · Arrive`, weather: wx, morning: OVERNIGHT_FLY_DAY2, afternoon: "Check in & rest — keep today light", evening: dinnerLine("Early dinner nearby: ", "Early dinner near your stay"), notes: [lag, altitudeNote(opts.elevationM ?? w.elevationM), holidayNote(d.date, opts.countryCode) || ""].filter(Boolean).join(" · ") });
    }
    if (i === days.length - 1 && days.length > 1) return row({ date: d.date, label: `Day ${i + 1} · ${fmt(d.date)} · Depart`, weather: wx, morning: "Pack & check out", afternoon: departAfternoon(resolveTravelMode(inp)), evening: "Travel home", notes: [isRainy(d) ? "Wet departure — pack a rain layer and allow a little extra time" : "", holidayNote(d.date, opts.countryCode) || ""].filter(Boolean).join(" · ") });
    const unusedPreferred = () => queue.filter(x => interestBrands(inp.interests || "").some(b => matchesBrand(x.name, b)));
    const okPick = (x: Highlight, noTrip = false) => !usedNames.has(x.name) && !(noTrip && farDayTrip(x)) && !isCompetitorPark(x.name, inp.interests || "", unusedPreferred());
    const pick = (pool: Highlight[], noTrip = false) => { const h = pool.find(x => queue.includes(x) && okPick(x, noTrip)) || queue.find(x => okPick(x, noTrip)); if (h) queue.splice(queue.indexOf(h), 1); return h; };
    const slots: string[] = [];
    // A far day trip fills the day on dry days; never on rainy days. Nearby parks (~30 min) are not day trips.
    const trip = !rain && style !== "Slow" ? queue.find(x => farDayTrip(x) && isRealisticDayTrip(x, inp, { name: inp.destination }) && !isCompetitorPark(x.name, inp.interests || "", unusedPreferred())) : undefined;
    const fullDays = days.length - 2;
    const cityLeft = queue.filter(x => !farDayTrip(x)).length;
    if (trip && ((i % 3 === 2 && fullDays >= 3) || cityLeft < Math.min(perDay, 2))) { queue.splice(queue.indexOf(trip), 1); const near = trip.lat != null ? queue.find(x => x !== trip && x.lat != null && dist(x, trip) < 15 && !(kids && isMajorAttraction(x)) && !(isMajorAttraction(trip) && isMajorAttraction(x))) : undefined;
      if (near) queue.splice(queue.indexOf(near), 1);
      const back = driveLabel(trip) ? ` (${driveLabel(trip)} back)` : "";
      const lunch = `${/beach|bay|coast|lake/i.test(trip.type || trip.name) ? "Swim or walk the shore" : /park|mountain|peak|glacier|waterfall|arch/i.test(trip.type || trip.name) ? "Short walk or viewpoint stop" : /winery|vineyard|estate/i.test(trip.type || trip.name) ? "Tasting & long lunch" : "Lunch locally"} at ${trip.name}, then head back${back}`;
      slots.push(label(trip), (near && !(kids && isMajorAttraction(near))) ? `Also nearby: ${near.name}, then head back${back}` : lunch); }
    else for (let k = 0; k < perDay; k++) { const h = rain ? pick(indoor.length ? indoor : hl, true) : pick(inp.interests?.trim() ? hl : outdoorF.length ? outdoorF : hl, true); if (h) slots.push(tidyPlaceName(h.name)); }
    // Each backup is a distinct venue, and is taken out of the queue so it is never scheduled again
    // Prefer extra indoor venues (not on the highlight list), then unscheduled indoor highlights
    const backupBlob = (h: Highlight) => `${h.name} ${h.type || ""} ${h.description || ""}`;
    const safeIndoor = (h: Highlight) => !farDayTrip(h) && isIndoorishBackup(h);
    const nearbyIndoor = (h: Highlight) => safeIndoor(h) && (h.driveMin == null || h.driveMin <= 25);
    const preferBackup = (h: Highlight) => nearbyIndoor(h) && /visitor (centre|center)|museum|gallery|library|studio|junior ranger|hopi house/i.test(backupBlob(h));
    let backup = reservedByIndex.get(i);
    if (!backup) {
      const bh = extraIndoor.find(h => !usedBackup.has(h.name) && preferBackup(h)) || extraIndoor.find(h => !usedBackup.has(h.name) && nearbyIndoor(h)) || indoor.find(h => queue.includes(h) && !h.dayTrip && !h.ski && !usedBackup.has(h.name) && preferBackup(h)) || indoor.find(h => queue.includes(h) && !h.dayTrip && !h.ski && !usedBackup.has(h.name) && nearbyIndoor(h));
      if (bh) { usedBackup.add(bh.name); if (queue.includes(bh)) queue.splice(queue.indexOf(bh), 1); backup = bh.name; }
      else if (kind === "rain" || kind === "mixed") backup = vcName && !usedBackup.has(vcName) ? vcName : vcName;
    }
    const named = kind === "snow" ? undefined : backup;
    const beachPick = kids ? preferredFamilyBeaches(opts.destName || inp.destination || "", opts.countryCode || "").find(n => ![...usedNames].some(u => n.toLowerCase().includes(u.toLowerCase()) || u.toLowerCase().includes(n.toLowerCase()))) : undefined;
    const familyFallback = kids ? (beachPick || hl.find(h => h.name && !usedNames.has(h.name) && /beach|playa|park|aquarium|museum|zoo|ruins|pyramid|snorkel/i.test(`${h.name} ${h.type || ""}`) && !h.ski)?.name) : undefined;
    if (familyFallback) usedNames.add(familyFallback);
    return row({
      date: d.date, label: `Day ${i + 1} · ${fmt(d.date)}`, weather: wx,
      morning: slots[0] || familyFallback || "Free morning — wander a new neighbourhood",
      afternoon: slots.slice(1).join(" → ") || (style === "Slow" ? "Long lunch & downtime" : "Explore a market or local street"),
      evening: dinnerLine("Dinner: ", familyDinnerFallback),
      rainyBackup: itineraryPrecipCopy(kind, ski, named),
      notes: holidayNote(d.date, opts.countryCode) || "",
    });
  });
}

export function timeline(start: string, international: boolean, todayIso?: string, travelMode?: "flying" | "driving"): Task[] {
  const t = (k: number, task: string): Task => ({ id: id(), due: addDays(start, -k), task, done: false });
  const today = todayIso || todayIn();
  const list = [
    t(60, international ? "Make sure everyone's passport is good for 6+ months after you come home (grown-up task)" : "Make sure everyone has a valid photo ID (grown-up task)"),
    t(45, travelMode === "driving" ? "Confirm the route, vehicle and accommodation" : "Book flights/transport and accommodation"),
    t(30, international ? "Buy travel insurance; check vaccinations/health advice (grown-up task)" : "Think about travel insurance in case plans change (grown-up task)"),
    t(21, "Book must-do tickets & any restaurant reservations"),
    t(14, international ? "Tell your bank you're travelling so they don't freeze the card (grown-up task)" : "Tell your bank you're travelling"),
    t(7, "Check the forecast and finish the packing list (grown-up task)"),
    t(3, international ? "Download offline maps, tickets and translation pack" : "Download offline maps and tickets"),
    t(2, "Arrange pet/plant care, hold mail"),
    t(1, travelMode === "driving" ? "Check the car (tyres, fluids, lights), charge or fuel up, pack" : "Online check-in, and make a plan to get to the airport (grown-up task)"),
    t(0, international ? "Departure day — passport, phone, wallet, keys" : "Departure day — ID, phone, wallet, keys"),
  ];
  if (travelMode === "driving") list.splice(list.length - 2, 0, t(3, TIMELINE_DRIVE_EXTRA));
  return list.map(x => x.due < today ? { ...x, due: today, task: x.task + " (overdue — do now)" } : x);
}

