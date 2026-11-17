/** Curated, free, static interest → famous venue matches, plus keyword hits in place names. */

export type DestRef = { name?: string; country?: string; countryCode?: string; admin1?: string };
export type InterestSlot = { name: string; kind?: "major" | "light" | "evening" };

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
  { interest: /stars?|stargaz|astronomy|night sky/i, place: /.*/, slots: [
    { name: "Stargazing after dark — bring a flashlight with red light", kind: "evening" },
  ]},
  { interest: /animals?|wildlife|elk|deer|birds?|bison/i, place: /national park|grand canyon|canyon|yellowstone|yosemite|zion|utah|arizona|safari/i, slots: [
    { name: "Watch wildlife from a distance (never approach or feed animals)", kind: "light" },
    { name: "Junior Ranger program at the visitor center", kind: "major" },
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

const GENERIC_SLOT = /^(?:[^\w]*\s*)?(Theme & water parks|Museums & galleries|Family & kid attractions|Heritage & historic sites|Free morning.*|Travel & check in|Explore a market(?: or local street)?|Long lunch(?: & downtime)?|Pick a .+ nearby \(ask a grown-up\))$/i;

export function isGenericSlot(text?: string) {
  return !text || GENERIC_SLOT.test(text.trim());
}

export function isBareCategorySlot(text?: string) {
  return !!text && /^(?:[^\w]*\s*)?(Theme & water parks|Museums & galleries|Family & kid attractions|Heritage & historic sites|Wildlife & nature \/ national parks|Live music, shows & festivals)\s*$/i.test(text.trim());
}

const LIGHT_SIGHT = /museum|gallery|park|aquarium|zoo|playground|garden|castle|palace|market|library|observatory|planetarium|cathedral|bridge|square|plaza|visitor (?:centre|center)|studio|watchtower|viewpoint/i;

export function isKidAfternoonSight(h: { name?: string; type?: string; setting?: string; description?: string; dayTrip?: boolean; driveMin?: number }) {
  const blob = `${h.name || ""} ${h.type || ""} ${h.description || ""}`;
  if (/\b(bar|nightclub|pub|cocktail|wine bar|strip)\b/i.test(blob) && !/museum|park/i.test(blob)) return false;
  if (/phantom ranch|inner canyon|canyon floor|bottom of (the )?canyon|hike-?in/i.test(blob)) return false;
  if (h.dayTrip && typeof h.driveMin === "number" && h.driveMin > 60) return false;
  return LIGHT_SIGHT.test(blob);
}

function alreadyUsed(days: { morning?: string; afternoon?: string; evening?: string; rainyBackup?: string }[], name: string, includeBackup = false) {
  const n = name.toLowerCase();
  return days.some(d => `${d.morning || ""} ${d.afternoon || ""} ${d.evening || ""}${includeBackup ? ` ${d.rainyBackup || ""}` : ""}`.toLowerCase().includes(n));
}

export function namedCampground(highlights: { name?: string; type?: string; description?: string }[] = []): string {
  const h = highlights.find(x => /camp_?site|campground|camp site|camping/i.test(`${x.name || ""} ${x.type || ""} ${x.description || ""}`) && x.name);
  return h?.name ? `Camp at ${h.name}` : "Your campsite (a grown-up books it)";
}

function allInterestSlots(interests: string, dest: DestRef | string | undefined, highlights: { name?: string; type?: string; description?: string }[] = []): InterestSlot[] {
  const curated = curatedInterestVenues(interests, dest);
  if (/camping|campsite|campground/i.test(interests || "")) {
    curated.push({ name: namedCampground(highlights), kind: "major" });
  }
  const keyword = keywordInterestHits(interests, highlights).map(h => ({ name: h.name || "", kind: "major" as const }));
  const out: InterestSlot[] = [];
  const seen = new Set<string>();
  for (const s of [...curated, ...keyword]) {
    const k = (s.name || "").toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function interestQueue(interests: string, dest: DestRef | string | undefined, highlights: { name?: string; type?: string; description?: string }[] = [], days: { morning?: string; afternoon?: string; evening?: string }[] = []): InterestSlot[] {
  return allInterestSlots(interests, dest, highlights).filter(s => !alreadyUsed(days, s.name));
}

function isInterestSlotText(text: string | undefined, queueNames: string[]): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return queueNames.some(n => n && t.includes(n.toLowerCase()));
}

/** Put curated/keyword venues on the itinerary. Majors are guaranteed a mid-day slot. */
export function applyInterestVenues<T extends { morning: string; afternoon: string; evening?: string; label?: string }>(
  days: T[],
  interests: string,
  dest: DestRef | string | undefined,
  highlights: { name?: string; type?: string; description?: string }[] = [],
  isTravel?: (d: T) => boolean,
): T[] {
  if (!days?.length) return days;
  const protectedNames = allInterestSlots(interests, dest, highlights).map(s => s.name);
  const queue = interestQueue(interests, dest, highlights, days);
  const majors = queue.filter(s => s.kind !== "light" && s.kind !== "evening");
  const mid = days.filter(d => !isTravel?.(d));
  // First fill empty/generic/bare mornings, then evict a non-interest morning so every major gets a day.
  // Never evict a morning that already holds an interest match (including one placed earlier in the pipeline).
  for (const preferGeneric of [true, false]) {
    for (const d of mid) {
      if (!majors.length) break;
      const taken = isInterestSlotText(d.morning, protectedNames);
      const generic = isBareCategorySlot(d.morning) || isGenericSlot(d.morning);
      if (taken) continue;
      if (preferGeneric && !generic) continue;
      const next = majors.shift()!;
      d.morning = next.name;
    }
  }
  const evenings = queue.filter(s => s.kind === "evening");
  for (const d of mid) {
    if (!evenings.length) break;
    const next = evenings.shift()!;
    if (isInterestSlotText(d.evening, [next.name])) continue;
    if (!d.evening || /dinner/i.test(d.evening)) d.evening = d.evening && /dinner/i.test(d.evening) ? `${next.name}; ${d.evening}` : next.name;
    else d.evening = `${d.evening}; ${next.name}`;
  }
  return days;
}

/** Light interest extras (e.g. a double-decker bus) as a short afternoon add-on. */
export function applyInterestAddOns<T extends { morning: string; afternoon: string; evening?: string }>(
  days: T[],
  interests: string,
  dest: DestRef | string | undefined,
  highlights: { name?: string; type?: string; description?: string }[] = [],
  isTravel?: (d: T) => boolean,
): T[] {
  if (!days?.length) return days;
  const lights = interestQueue(interests, dest, highlights, []).filter(s => s.kind === "light");
  const mid = days.filter(d => !isTravel?.(d));
  for (const s of lights) {
    if (alreadyUsed(days, s.name)) continue;
    const host = mid.find(d => d.afternoon && !isBareCategorySlot(d.afternoon) && !isGenericSlot(d.afternoon) && !/Hike continues|Day hike/i.test(d.afternoon))
      || mid.find(d => !isTravel?.(d));
    if (!host) break;
    if (!host.afternoon || isGenericSlot(host.afternoon) || /^Explore a market/i.test(host.afternoon)) host.afternoon = s.name;
    else host.afternoon = `${host.afternoon}; then ${s.name}`;
  }
  return days;
}

const VAGUE_NEARBY = /Pick a (?:place|theme park|park or nature place) nearby \(ask a grown-up\)/i;

export function isVagueNearby(text?: string) {
  return !!text && VAGUE_NEARBY.test(text);
}


/** If a rain backup is now also a scheduled day slot, point the backup at another indoor place. */
export function reassignUsedRainBackups<T extends { morning: string; afternoon: string; evening?: string; rainyBackup?: string }>(
  days: T[],
  alternatives: { name?: string; type?: string; description?: string; indoor?: boolean; setting?: string }[] = [],
): T[] {
  const backupName = (text?: string) => (text || "").replace(/^If it rains:\s*/i, "").trim();
  const inSlots = (name: string) => days.some(d => `${d.morning || ""} ${d.afternoon || ""} ${d.evening || ""}`.toLowerCase().includes(name.toLowerCase()));
  const usedBak = new Set(days.map(d => backupName(d.rainyBackup).toLowerCase()).filter(Boolean));
  for (const d of days) {
    const bak = d.rainyBackup || "";
    const named = backupName(bak);
    if (!named || named.length < 4 || !inSlots(named)) continue;
    usedBak.delete(named.toLowerCase());
    const next = alternatives.find(h => h.name && !inSlots(h.name) && !usedBak.has(h.name.toLowerCase()) && /visitor (?:centre|center)|museum|gallery|library|studio|junior ranger|hopi house/i.test(`${h.name} ${h.type || ""} ${h.description || ""}`));
    const replacement = next?.name || "the visitor center or a nearby museum";
    d.rainyBackup = /^If it rains/i.test(bak) ? `If it rains: ${replacement}` : replacement;
    usedBak.add(replacement.toLowerCase());
  }
  return days;
}

/** Never leave "Pick a place nearby (ask a grown-up)" when a named sight or campsite is possible. */
export function replaceVagueNearbySlots<T extends { morning: string; afternoon: string; evening?: string }>(
  days: T[],
  highlights: { name?: string; type?: string; setting?: string; description?: string; dayTrip?: boolean; driveMin?: number }[] = [],
  interests = "",
  isTravel?: (d: T) => boolean,
): T[] {
  if (!days?.length) return days;
  const campWanted = /camping|campsite|campground/i.test(interests || "");
  const usedCamp = () => days.some(d => /camp at |your campsite/i.test(`${d.morning || ""} ${d.afternoon || ""} ${d.evening || ""}`));
  for (const d of days) {
    if (isTravel?.(d)) continue;
    for (const slot of ["morning", "afternoon"] as const) {
      const text = d[slot];
      if (!isVagueNearby(text) && !isBareCategorySlot(text) && !isGenericSlot(text)) continue;
      if (slot === "morning" && text && !isVagueNearby(text) && !isBareCategorySlot(text) && !isGenericSlot(text)) continue;
      const next = highlights.find(h => h.name && isKidAfternoonSight(h) && !alreadyUsed(days, h.name, true));
      if (next?.name) { d[slot] = next.name; continue; }
      if (campWanted && !usedCamp()) { d[slot] = namedCampground(highlights); continue; }
      if (slot === "afternoon") d.afternoon = "Rest in the shade midday";
      else if (isVagueNearby(text) || isBareCategorySlot(text)) d.morning = "Short easy walk nearby";
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
    while (i < pool.length && alreadyUsed(days, pool[i].name!, true)) i++;
    if (i >= pool.length) break;
    const h = pool[i++];
    d.afternoon = h.name!;
  }
  return days;
}

export function itineraryHasWaterPark(days: { morning?: string; afternoon?: string; evening?: string; notes?: string }[] = []): boolean {
  return days.some(d => /water ?park|waterpark|aquatica|volcano bay|typhoon lagoon|blizzard beach|wet\s*['’]?n['’]?\s*wild|discovery cove|schlitterbahn/i.test(`${d.morning || ""} ${d.afternoon || ""} ${d.evening || ""} ${d.notes || ""}`));
}
