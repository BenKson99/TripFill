/** Prefer casual, family-friendly restaurants when kids are on the trip. */

const FINE = /michelin|fine[_\s-]?dining|haute cuisine|high-?end|tasting menu|gordon ramsay|le gavroche|the dorchester|claridge'?s|the savoy|savoy grill|the ritz\b|le bristol|hôtel plaza|four seasons|mandarin oriental|the connaught|the langham|the peninsula|the berkeley|sketch\b|alain ducasse|helene darroze|core by|dinner by|restaurant gordon|bob bob ricard|the wolseley|the ivy\b|le caprice|hibiscus\b|dinner by heston|alain ducasse|cut at 45|the ledbury|maison fran[cç]ois|wild honey|pollen street|sadi?ler'?s wells restaurant|chop\s*houses?|\bau vin\b|\ble coq\b|white[- ]tablecloth|prix[- ]fixe|steak\s*house|chophouse/i;
const CASUAL = /fast[_\s-]?food|pizza|burger|diner|cafe|café|coffee|family|fish and chips|fish & chips|ice cream|gelato|pub|pizz|noodle|dumpling|street food|food court|bakery|sandwich|taco|bbq|barbecue/i;
const HOTEL = /\b(hotel|hilton|marriott|hyatt|sheraton|westin|intercontinental|waldorf|raffles|st\.?\s*regis)\b/i;

export function isFineDining(e: { name?: string; tag?: string; description?: string; cuisineEvidence?: string } | string): boolean {
  const blob = typeof e === "string" ? e : `${e.name || ""} ${e.tag || ""} ${e.description || ""} ${e.cuisineEvidence || ""}`;
  if (FINE.test(blob)) return true;
  const tag = typeof e === "string" ? "" : (e.tag || "");
  if (/^(fine[_\s-]?dining|high-?end|michelin)$/i.test(tag)) return true;
  // Luxury-hotel restaurants often lack a cuisine tag.
  if (HOTEL.test(blob) && /restaurant/i.test(blob) && !CASUAL.test(blob)) return true;
  return false;
}

export function isCasualFamilyEat(e: { name?: string; tag?: string; kind?: string; description?: string } | string): boolean {
  const blob = typeof e === "string" ? e : `${e.name || ""} ${e.tag || ""} ${e.kind || ""} ${e.description || ""}`;
  if (typeof e !== "string" && e.kind === "cafe") return true;
  return CASUAL.test(blob);
}

export function familyEatScore(e: { name?: string; tag?: string; kind?: string; description?: string; cuisineEvidence?: string }): number {
  if (isFineDining(e)) return -8;
  if (isCasualFamilyEat(e)) return 4;
  return 0;
}

export function preferFamilyEats<T extends { name?: string; tag?: string; kind?: string; description?: string }>(list: T[] | undefined | null): T[] {
  if (!list?.length) return list || [];
  return [...list].sort((a, b) => familyEatScore(b) - familyEatScore(a));
}

/** Family itinerary dinners: drop fine dining when any casual option exists; otherwise use a generic line. */
export function familyDinnerList<T extends { name?: string; tag?: string; kind?: string; description?: string }>(list: T[] | undefined, kids: boolean): T[] {
  if (!list?.length) return [];
  if (!kids) return list;
  const ranked = preferFamilyEats(list);
  const casual = ranked.filter(e => !isFineDining(e));
  return casual.length ? casual : [];
}

export const CASUAL_DINNER_FALLBACK = "Casual family dinner near your stay (pizza, a pub or a cafe)";
