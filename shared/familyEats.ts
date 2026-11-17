/** Prefer casual, family-friendly restaurants when kids are on the trip. */

const FINE = /michelin|fine[_\s-]?dining|haute cuisine|high-?end|tasting menu|gordon ramsay|le gavroche|the dorchester|claridge'?s|the savoy|savoy grill|the ritz\b|le bristol|hôtel plaza|four seasons|mandarin oriental|the connaught|the langham|the peninsula|the berkeley|sketch\b|alain ducasse|helene darroze|core by|dinner by|restaurant gordon/i;
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
