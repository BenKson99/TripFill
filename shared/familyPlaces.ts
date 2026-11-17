import { isHikeInOrInnerCanyon } from "./nationalParks.js";
import { formatShortDuration } from "./distance.js";
import { isNightlifeVenue, isRestaurantLike } from "./activities.js";
import { familyEatScore } from "./familyEats.js";

const KID_GOOD = /\b(playground|play\s*area|kids[_\s-]?area|children'?s?\s*(museum|zoo|garden|theatre|theater|park)|family|zoo|aquarium|theme park|amusement park|water park|splash|legoland|disney|science centre|science center|fairground|carnival|miniature|petting)\b/i;
const KID_FOOD = /\b(pizza|ice\s*cream|gelato|burger|diner|pancake|waffle|family|kids?\s*menu|breakfast|cafe|café|bakery|sandwich|noodle|taco)\b/i;
const NIGHTLIFE = /\b(nightclub|strip\s*club|cocktail\s*bar|wine\s*bar|speakeasy|late\s*night\s*bar|dance\s*club)\b/i;
/** Activity-type only — never use identity, religion, culture or community as a negative signal. */
const BARISH = /\b(nightclub|cocktail bar|wine bar|speakeasy)\b|\b(amenity|tourism)?\s*(nightclub|stripclub)\b/i;

function blob(h: { name?: string; type?: string; description?: string; tag?: string; cuisine?: string; kind?: string }): string {
  return `${h.name || ""} ${h.type || ""} ${h.description || ""} ${h.tag || ""} ${h.cuisine || ""} ${h.kind || ""}`;
}

export function isKidFriendlyPlace(h: { name?: string; type?: string; description?: string; tag?: string }): boolean {
  return KID_GOOD.test(blob(h));
}

export function isKidFriendlyEat(e: { name?: string; tag?: string; description?: string; cuisine?: string; kind?: string }): boolean {
  return KID_FOOD.test(blob(e)) || /family/i.test(e.tag || "");
}

export function isBarStyleVenue(h: { name?: string; type?: string; description?: string; tag?: string; kind?: string }): boolean {
  if (isNightlifeVenue(h as any) && !isRestaurantLike(h as any)) return true;
  const t = blob(h);
  if (NIGHTLIFE.test(t) || BARISH.test(t)) return true;
  // A plain "bar" tag, but not "chocolate bar", family restaurants, or "bar & grill".
  if (/\b(nightclub|cocktail)\b/i.test(t)) return true;
  if (/\bbar\b/i.test(`${h.type || ""} ${h.tag || ""} ${h.kind || ""}`) && !/grill|family|restaurant|pub food/i.test(t)) return true;
  return false;
}

/** Higher is better for a family trip. 0 is neutral. */
export function familyPlaceScore(h: { name?: string; type?: string; description?: string; tag?: string; setting?: string; indoor?: boolean; kind?: string }): number {
  let s = 0;
  if (isKidFriendlyPlace(h) || isKidFriendlyEat(h)) s += 5;
  if (/playground|kids[_\s-]?area/i.test(blob(h))) s += 3;
  if (/zoo|aquarium/i.test(blob(h))) s += 3;
  if (/museum|gallery/i.test(blob(h)) && /child|kids|family/i.test(blob(h))) s += 2;
  if ((h.indoor || h.setting === "indoor") && !isOutdoorFamilyPlace(h)) s += 1;
  if (isBarStyleVenue(h)) s -= 6;
  s += familyEatScore(h);
  return s;
}

export function sortForFamily<T>(list: T[], kids: boolean): T[] {
  if (!kids || !list?.length) return list;
  return [...list].sort((a, b) => familyPlaceScore(b as any) - familyPlaceScore(a as any));
}

/** Gardens, parks, zoos and theme parks are outdoor even if a data source marked them indoor or mixed. */
export function isOutdoorFamilyPlace(h: { name?: string; type?: string; description?: string; tag?: string; setting?: string }): boolean {
  const t = blob(h);
  if (/\bindoor\s+(park|playground|garden|soft\s*play)\b/i.test(t)) return false;
  if (/\b(theme park|amusement park|water park|zoo|botanical garden|nature reserve|arboretum|playground|play\s*area)\b/i.test(t)) return true;
  if (/\b(garden|park|trail|beach)\b/i.test(t) && !/\b(car park|parking|business park|industrial park|trailer park|theme park building)\b/i.test(t)) return true;
  return false;
}

/** Plain reason for a highlight. Never returns raw OSM/Wikidata class lists. */
export function highlightCaveat(h: { name?: string; type?: string; description?: string; driveMin?: number; distanceKm?: number }, opts: { kids?: boolean; smallChild?: boolean } = {}): string {
  if (!(opts.kids || opts.smallChild)) return "";
  if (isHikeInOrInnerCanyon(h)) return "Hike-in only — not for little kids";
  if (opts.smallChild && h.driveMin != null && h.driveMin >= 75) {
    const hours = h.driveMin >= 90 ? `${Math.round(h.driveMin / 60)} h` : formatShortDuration(h.driveMin);
    return `${hours} away`;
  }
  return "";
}

export function highlightReason(h: { name?: string; type?: string; description?: string; setting?: string; indoor?: boolean; driveMin?: number; distanceKm?: number }, kids = false, opts?: { smallChild?: boolean }): string {
  const caveat = highlightCaveat(h, { kids, smallChild: opts?.smallChild });
  const t = blob(h);
  let reason = "";
  if (/playground|play\s*area|kids[_\s-]?area/i.test(t)) reason = "Good for kids: playground";
  else if (/\bzoo\b/i.test(t)) reason = "Good for kids: zoo";
  else if (/aquarium/i.test(t)) reason = "Good for kids: aquarium";
  else if (/children'?s?\s*museum|family\s*museum|science (centre|center)/i.test(t)) reason = "Good for kids: museum";
  else if (/theme park|amusement park|water park/i.test(t)) reason = "A full park day — go early and rest after";
  else if (isBarStyleVenue(h)) reason = kids ? "Evening spot — better for grown-ups" : "Nightlife";
  else if (/uss arizona/i.test(t)) reason = "Boat ride to the memorial — free timed tickets, book ahead";
  else if (/uss missouri|battleship/i.test(t)) reason = "Battleship you can walk through";
  else if (/uss bowfin|submarine/i.test(t)) reason = "Submarine you can walk through";
  else if (isOutdoorFamilyPlace(h)) reason = "Outdoor — check the weather";
  else if (h.indoor || h.setting === "indoor" || h.setting === "mixed") reason = "Indoor — good if it rains";
  else if (h.setting === "outdoor" || /outdoor|park|garden|trail|beach/i.test(t)) reason = "Outdoor — check the weather";
  return [caveat, reason].filter(Boolean).join(" · ");
}

