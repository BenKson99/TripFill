/** Drop cinemas, city theatres, bus-station stalls, sports bars and nameless food stalls from family days. */

const CINEMA = /\b(cinemark|cin[eé]polis|cinemex|amc\b|regal\b|vue\b|odeon\b|cineworld|movie theater|movie theatre|cinema|cinépolis|cinemas?)\b/i;
const CITY_THEATRE = /\b(theatre|theater|teatro)\b/i;
const FAMOUS_THEATRE = /\b(opera house|shakespeare|globe|broadway|west end|teatro alla scala|sydney opera|bolshoi|royal opera|met opera|royal albert hall)\b/i;
const BUS_STATION_FOOD = /\b(bus station|coach station|coach terminal|central camionera|estación de autobuses|terminal de autobuses|bus terminal)\b/i;
const SPORTS_BAR = /\b(sports\s*bar|sport\s*bar|sportsbar|cantina deportiva)\b/i;
const NAMELESS_STALL = /^(food stall|food stall …|food stall\.\.\.|stall)\b/i;
const STREET_STALL = /\b(food stall|street[- ]food stall|taco stand|street stall|stalls?\b|anonymou?s stall)\b/i;
const SIT_DOWN = /\b(restaurant|trattoria|osteria|cantina|taqueria|taquería|brasserie|bistro|ristorante|café|cafe|diner|trattoria|steakhouse|trattoria)\b/i;

export function isCinemaOrCityTheatre(h: { name?: string; type?: string; description?: string; source?: string } | string): boolean {
  const blob = typeof h === "string" ? h : `${h.name || ""} ${h.type || ""} ${h.description || ""}`;
  if (CINEMA.test(blob)) return true;
  if (CITY_THEATRE.test(blob) && !FAMOUS_THEATRE.test(blob)) return true;
  return false;
}

export function isJunkSight(h: { name?: string; type?: string; description?: string; source?: string } | string): boolean {
  return isCinemaOrCityTheatre(h);
}

export function isNamelessFoodStall(e: { name?: string } | string): boolean {
  const name = typeof e === "string" ? e : (e.name || "");
  return !name.trim() || NAMELESS_STALL.test(name.trim()) || /^food stall\b/i.test(name.trim());
}

export function isBusStationFood(e: { name?: string; tag?: string; kind?: string; description?: string } | string): boolean {
  const blob = typeof e === "string" ? e : `${e.name || ""} ${e.tag || ""} ${e.kind || ""} ${e.description || ""}`;
  return BUS_STATION_FOOD.test(blob);
}

export function isSportsBar(e: { name?: string; tag?: string; kind?: string; description?: string } | string): boolean {
  const blob = typeof e === "string" ? e : `${e.name || ""} ${e.tag || ""} ${e.kind || ""} ${e.description || ""}`;
  return SPORTS_BAR.test(blob);
}

export function isStreetFoodStall(e: { name?: string; tag?: string; kind?: string; description?: string; amenity?: string } | string): boolean {
  const blob = typeof e === "string" ? e : `${e.name || ""} ${e.tag || ""} ${e.kind || ""} ${e.description || ""} ${e.amenity || ""}`;
  if (isNamelessFoodStall(e)) return true;
  if (/(amenity=fast_food|fast_food).*(stall|stand)|street[- ]food/i.test(blob) && !SIT_DOWN.test(blob)) return true;
  return STREET_STALL.test(blob) && !SIT_DOWN.test(blob);
}

export function isJunkEat(e: { name?: string; tag?: string; kind?: string; description?: string } | string): boolean {
  return isNamelessFoodStall(e) || isBusStationFood(e) || isCinemaOrCityTheatre(e);
}

/** Prefer sit-down restaurants on family trips abroad, or when an infant or 65+ traveler is present. */
export function preferSitDownDinner(opts: { kids?: boolean; infant?: boolean; senior?: boolean; abroad?: boolean } = {}): boolean {
  return !!(opts.infant || opts.senior || (opts.kids && opts.abroad) || opts.abroad);
}

export function filterDinnerList<T extends { name?: string; tag?: string; kind?: string; description?: string }>(
  list: T[] | undefined,
  opts: { kids?: boolean; infant?: boolean; senior?: boolean; abroad?: boolean } = {},
): T[] {
  if (!list?.length) return [];
  const dropJunk = list.filter(e => !isJunkEat(e) && !isSportsBar(e));
  const sitDown = preferSitDownDinner(opts);
  if (!sitDown) return dropJunk;
  const tables = dropJunk.filter(e => !isStreetFoodStall(e));
  return tables.length ? tables : dropJunk;
}

export function filterHighlightList<T extends { name?: string; type?: string; description?: string; source?: string }>(list: T[] | undefined): T[] {
  if (!list?.length) return [];
  return list.filter(h => !isJunkSight(h));
}

/** Boost beaches, parks, aquariums, museums and tagged attractions when ranking. */
export function familySightScore(h: { name?: string; type?: string; description?: string; source?: string; qid?: string; wikidata?: string; activity?: string }): number {
  const blob = `${h.name || ""} ${h.type || ""} ${h.description || ""} ${h.source || ""} ${h.activity || ""}`;
  if (isJunkSight(h)) return -20;
  let n = 0;
  if (/\b(beach|playa|park|aquarium|museum|gallery|zoo|planetarium|ruins?|pyramid|snorkel|reef)\b/i.test(blob)) n += 6;
  if (/tourism=attraction|wikidata|qid/i.test(blob) || h.qid || h.wikidata || /wikidata/i.test(h.source || "")) n += 4;
  return n;
}

export function preferFamilySights<T extends { name?: string; type?: string; description?: string; source?: string }>(list: T[] | undefined): T[] {
  if (!list?.length) return list || [];
  return [...list].sort((a, b) => familySightScore(b) - familySightScore(a));
}

export function namedIceCream(eats?: { restaurants?: { name?: string }[]; cafes?: { name?: string }[]; iceCream?: { name?: string }[] } | { name?: string }[]): string | undefined {
  const list = Array.isArray(eats)
    ? eats
    : [...(eats?.iceCream || []), ...(eats?.cafes || []), ...(eats?.restaurants || [])];
  const hit = list.find(e => /helad|gelato|ice\s*cream|nieve|paleter|glace|glacé|eisdiele|gelateria/i.test(e.name || ""));
  return hit?.name;
}
