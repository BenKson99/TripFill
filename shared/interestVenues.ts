/** Curated, free, static interest → famous venue matches, plus keyword hits in place names. */

export type DestRef = { name?: string; country?: string; countryCode?: string; admin1?: string };
export type InterestSlot = { name: string; kind?: "major" | "light" };

type Entry = { interest: RegExp; place: RegExp; slots: InterestSlot[] };

const ENTRIES: Entry[] = [
  { interest: /harry\s*potter|wizarding world|platform\s*9/i, place: /london|leavesden|hertfordshire|united kingdom|^GB$/i, slots: [
    { name: "Warner Bros. Studio Tour London (book ahead)", kind: "major" },
    { name: "Platform 9¾ at King's Cross", kind: "light" },
  ]},
  { interest: /harry\s*potter|wizarding world/i, place: /orlando|florida/i, slots: [
    { name: "The Wizarding World of Harry Potter at Universal Orlando", kind: "major" },
  ]},
  { interest: /harry\s*potter|wizarding world/i, place: /osaka|japan|^JP$/i, slots: [
    { name: "The Wizarding World of Harry Potter at Universal Studios Japan", kind: "major" },
  ]},
  { interest: /harry\s*potter|wizarding world/i, place: /tokyo|japan|^JP$/i, slots: [
    { name: "Warner Bros. Studio Tour Tokyo – The Making of Harry Potter (book ahead)", kind: "major" },
  ]},
  { interest: /double-?decker|hop-?on hop-?off|red bus/i, place: /london|united kingdom|^GB$/i, slots: [
    { name: "Ride a red double-decker bus (route 11 or 15 passes the big sights)", kind: "light" },
  ]},
  { interest: /castles?/i, place: /london|windsor|united kingdom|^GB$/i, slots: [
    { name: "Tower of London", kind: "major" },
    { name: "Windsor Castle", kind: "major" },
  ]},
  { interest: /castles?/i, place: /edinburgh|scotland/i, slots: [
    { name: "Edinburgh Castle", kind: "major" },
  ]},
  { interest: /castles?/i, place: /paris|france|^FR$/i, slots: [
    { name: "Sainte-Chapelle", kind: "light" },
    { name: "Château de Vincennes", kind: "major" },
  ]},
  { interest: /dinosaurs?|t-?rex|fossils?|prehistoric/i, place: /london|united kingdom|^GB$/i, slots: [
    { name: "Natural History Museum", kind: "major" },
  ]},
  { interest: /dinosaurs?|t-?rex|fossils?/i, place: /new york|nyc|manhattan/i, slots: [
    { name: "American Museum of Natural History", kind: "major" },
  ]},
  { interest: /dinosaurs?|t-?rex|fossils?/i, place: /washington|d\.?c\.?/i, slots: [
    { name: "Smithsonian National Museum of Natural History", kind: "major" },
  ]},
  { interest: /dinosaurs?|t-?rex|fossils?/i, place: /paris|france|^FR$/i, slots: [
    { name: "Galerie de Paléontologie et d'Anatomie comparée", kind: "major" },
  ]},
  { interest: /science|planetarium|space|rockets?/i, place: /london|united kingdom|^GB$/i, slots: [
    { name: "Science Museum", kind: "major" },
  ]},
  { interest: /\bzoo|pandas?\b/i, place: /london|united kingdom|^GB$/i, slots: [
    { name: "ZSL London Zoo", kind: "major" },
  ]},
  { interest: /legoland|\blego\b/i, place: /london|windsor|united kingdom|^GB$/i, slots: [
    { name: "LEGOLAND Windsor (book ahead)", kind: "major" },
  ]},
  { interest: /pirates?|cutty sark|ships?|maritime/i, place: /london|greenwich|united kingdom|^GB$/i, slots: [
    { name: "Cutty Sark", kind: "light" },
    { name: "National Maritime Museum", kind: "major" },
  ]},
  { interest: /statue of liberty|ellis island/i, place: /new york|nyc|manhattan/i, slots: [
    { name: "Statue of Liberty (book ahead)", kind: "major" },
  ]},
  { interest: /disney/i, place: /paris|marne|france|^FR$/i, slots: [
    { name: "Disneyland Paris (book ahead)", kind: "major" },
  ]},
];

function destBlob(dest: DestRef | string | undefined) {
  if (!dest) return "";
  if (typeof dest === "string") return dest;
  return `${dest.name || ""} ${dest.admin1 || ""} ${dest.country || ""} ${dest.countryCode || ""}`;
}

export function interestPhrases(interests = ""): string[] {
  return (interests || "").split(/[,;/]+/).map(s => s.trim()).filter(s => s.length >= 3);
}

/** Iconic venues that match this trip's free-text interests and destination. */
export function curatedInterestVenues(interests: string, dest?: DestRef | string): InterestSlot[] {
  const text = interests || "";
  const place = destBlob(dest);
  const out: InterestSlot[] = [];
  const seen = new Set<string>();
  for (const e of ENTRIES) {
    if (!e.interest.test(text) || !e.place.test(place)) continue;
    for (const slot of e.slots) {
      const k = slot.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(slot);
    }
  }
  return out;
}

/** Highlights whose names mention an interest phrase (e.g. "Harry Potter" in the title). */
export function keywordInterestHits<T extends { name?: string; type?: string; description?: string }>(interests: string, highlights: T[] = []): T[] {
  const phrases = interestPhrases(interests).filter(p => p.length >= 4 && !/^(and|the|with|kids?|family|fun)$/i.test(p));
  if (!phrases.length) return [];
  return highlights.filter(h => {
    const blob = `${h.name || ""} ${h.type || ""}`;
    return phrases.some(p => blob.toLowerCase().includes(p.toLowerCase()));
  });
}

const GENERIC_SLOT = /^(?:[🎢🏛👨‍👩‍👧🏰🛍🎵🎾⛳💆🦌📷🧗🛣]*\s*)?(Theme & water parks|Museums & galleries|Family & kid attractions|Heritage & historic sites|Free morning.*|Travel & check in|Explore a market(?: or local street)?|Long lunch(?: & downtime)?|Pick a .+ nearby \(ask a grown-up\))$/i;

export function isGenericSlot(text?: string) {
  return !text || GENERIC_SLOT.test(text.trim());
}

export function isBareCategorySlot(text?: string) {
  return !!text && /^(?:[^\w]*\s*)?(Theme & water parks|Museums & galleries|Family & kid attractions|Heritage & historic sites|Wildlife & nature \/ national parks|Live music, shows & festivals)\s*$/i.test(text.trim());
}

const LIGHT_SIGHT = /museum|gallery|park|aquarium|zoo|playground|garden|castle|palace|market|library|observatory|planetarium|cathedral|bridge|square|plaza/i;

export function isKidAfternoonSight(h: { name?: string; type?: string; setting?: string; description?: string }) {
  const blob = `${h.name || ""} ${h.type || ""} ${h.description || ""}`;
  if (/\b(bar|nightclub|pub|cocktail|wine bar|strip)\b/i.test(blob) && !/museum|park/i.test(blob)) return false;
  return LIGHT_SIGHT.test(blob);
}

function alreadyUsed(days: { morning?: string; afternoon?: string; evening?: string }[], name: string) {
  const n = name.toLowerCase();
  return days.some(d => `${d.morning || ""} ${d.afternoon || ""} ${d.evening || ""}`.toLowerCase().includes(n));
}

/** Put curated/keyword venues into generic or bare-category slots. One named interest per mid-day. */
export function applyInterestVenues<T extends { morning: string; afternoon: string; evening?: string; label?: string }>(
  days: T[],
  interests: string,
  dest: DestRef | string | undefined,
  highlights: { name?: string; type?: string; description?: string }[] = [],
  isTravel?: (d: T) => boolean,
): T[] {
  if (!days?.length) return days;
  const curated = curatedInterestVenues(interests, dest);
  const keyword = keywordInterestHits(interests, highlights).map(h => ({ name: h.name || "", kind: "major" as const }));
  const queue: InterestSlot[] = [];
  const seen = new Set<string>();
  for (const s of [...curated, ...keyword]) {
    const k = s.name.toLowerCase();
    if (!k || seen.has(k) || alreadyUsed(days, s.name)) continue;
    seen.add(k);
    queue.push(s);
  }
  const mid = days.filter(d => !isTravel?.(d));
  for (const d of mid) {
    if (!queue.length) break;
    if (isBareCategorySlot(d.morning) || isGenericSlot(d.morning)) {
      const next = queue.shift()!;
      d.morning = next.name;
    }
  }
  return days;
}

/** Replace repeated "Explore a market or local street" with unused named kid-friendly sights. */
export function fillNamedAfternoons<T extends { morning: string; afternoon: string; evening?: string }>(
  days: T[],
  highlights: { name?: string; type?: string; setting?: string; description?: string }[] = [],
  isTravel?: (d: T) => boolean,
): T[] {
  if (!days?.length) return days;
  const pool = highlights.filter(h => h.name && isKidAfternoonSight(h) && !alreadyUsed(days, h.name!));
  let i = 0;
  for (const d of days) {
    if (isTravel?.(d)) continue;
    if (!isGenericSlot(d.afternoon) && d.afternoon && !/^Explore a market/i.test(d.afternoon)) continue;
    while (i < pool.length && alreadyUsed(days, pool[i].name!)) i++;
    if (i >= pool.length) break;
    const h = pool[i++];
    d.afternoon = h.name!;
  }
  return days;
}

export function itineraryHasWaterPark(days: { morning?: string; afternoon?: string; evening?: string; notes?: string }[] = []): boolean {
  return days.some(d => /water ?park|waterpark|aquatica|volcano bay|typhoon lagoon|blizzard beach|wet\s*['’]?n['’]?\s*wild|discovery cove|schlitterbahn/i.test(`${d.morning || ""} ${d.afternoon || ""} ${d.evening || ""} ${d.notes || ""}`));
}
