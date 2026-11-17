import { isLodgingOrStay, isVagueSight, campsiteSetupLine } from "./nationalParks.js";
import { isFullOrHalfDayAttraction, isMajorAttraction, interestBrands, matchesBrand } from "./family.js";
/** Curated, free, static interest → famous venue matches, plus keyword hits in place names. */

export type DestRef = { name?: string; country?: string; countryCode?: string; admin1?: string };
export type InterestSlot = { name: string; kind?: "major" | "light" | "evening"; nearby?: boolean; far?: boolean; note?: string; driveHours?: number };

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
  { interest: /disney/i, place: /orlando|kissimmee|lake buena vista|bay lake|walt disney world/i, slots: [
    { name: "Magic Kingdom", kind: "major" },
    { name: "EPCOT", kind: "major" },
    { name: "Disney's Hollywood Studios", kind: "major" },
    { name: "Disney's Animal Kingdom", kind: "major" },
  ]},
  { interest: /disney/i, place: /anaheim|disneyland/i, slots: [
    { name: "Disneyland Park", kind: "major" },
    { name: "Disney California Adventure", kind: "major" },
  ]},
  { interest: /stars?|stargaz|astronomy|night sky/i, place: /.*/, slots: [
    { name: "Stargazing after dark — bring a flashlight with red light", kind: "evening" },
  ]},
  { interest: /animals?|wildlife|elk|deer|birds?|bison/i, place: /national park|grand canyon|canyon|yellowstone|yosemite|zion|utah|arizona|safari/i, slots: [
    { name: "Watch wildlife from a distance (never approach or feed animals)", kind: "light" },
    { name: "Junior Ranger program at the visitor center", kind: "major" },
  ]},
  { interest: /pyramids?|mayan\s*ruins?|maya\s*ruins?|mayan\s*sites?|chich[eé]n\s*itz[aá]|tulum/i, place: /canc[uú]n|cancun|riviera maya|playa del carmen|yucat[aá]n|quintana roo|cozumel|isla mujeres|^MX$|mexico/i, slots: [
    { name: "Zona Arqueológica El Rey (Hotel Zone)", kind: "major", nearby: true },
    { name: "El Meco archaeological site", kind: "major", nearby: true },
    { name: "Chichén Itzá", kind: "major", far: true, driveHours: 2.5, note: "Long day with a baby — go early, or pick closer El Rey ruins in the Hotel Zone" },
    { name: "Tulum archaeological zone", kind: "major", far: true, driveHours: 2 },
  ]},
  { interest: /snorkel/i, place: /canc[uú]n|cancun|riviera maya|playa del carmen|isla mujeres|cozumel|puerto morelos|^MX$|mexico/i, slots: [
    { name: "Snorkel the reef at Puerto Morelos (calm water, book a guide)", kind: "major" },
    { name: "Isla Mujeres / Playa Norte — calm snorkeling for little kids", kind: "light" },
  ]},
  { interest: /ice\s*cream|helado|gelato/i, place: /.*/, slots: [
    { name: "Ice cream break", kind: "light" },
  ]},
  { interest: /snorkel|beach|swimming/i, place: /honolulu|waikiki|oahu|oʻahu|hawaii/i, slots: [
    { name: "Hanauma Bay Nature Preserve (book ahead — calm snorkeling)", kind: "major" },
    { name: "Waikiki Beach", kind: "light" },
  ]},
  { interest: /snorkel/i, place: /\bmaui\b/i, slots: [
    { name: "Snorkel at Molokini or Turtle Town (book a calm-water trip)", kind: "major" },
  ]},
  { interest: /snorkel|beach/i, place: /big island|kailua-kona|hawaii island/i, slots: [
    { name: "Snorkel at Kahaluu Beach Park (calm, family-friendly)", kind: "light" },
  ]},
  { interest: /beach|swimming/i, place: /miami\b/i, slots: [
    { name: "South Beach (swim where lifeguards are)", kind: "light" },
  ]},
  { interest: /beach|swimming/i, place: /clearwater/i, slots: [
    { name: "Clearwater Beach", kind: "light" },
  ]},
  { interest: /snorkel|beach/i, place: /key west|florida keys/i, slots: [
    { name: "Snorkel at Fort Zachary Taylor or a calm reef trip (book ahead)", kind: "major" },
  ]},
  { interest: /snorkel|beach/i, place: /siesta key|sarasota/i, slots: [
    { name: "Siesta Key Beach", kind: "light" },
  ]},
  { interest: /snorkel|beach/i, place: /nassau|bahamas|paradise island/i, slots: [
    { name: "Snorkel a calm reef or Cabbage Beach (check flags)", kind: "light" },
  ]},
  { interest: /snorkel|beach/i, place: /montego|negril|jamaica/i, slots: [
    { name: "Doctor's Cave Beach — calm swimming", kind: "light" },
  ]},
  { interest: /snorkel|beach/i, place: /punta cana|bavaro|dominican/i, slots: [
    { name: "Bávaro Beach — swim where lifeguards are", kind: "light" },
  ]},
  { interest: /snorkel|beach/i, place: /san juan|puerto rico/i, slots: [
    { name: "Condado Beach or a calm reef snorkel (book a guide)", kind: "light" },
  ]},
  { interest: /snorkel|beach/i, place: /aruba/i, slots: [
    { name: "Eagle Beach or Palm Beach — calm family swimming", kind: "light" },
  ]},
  { interest: /snorkel|beach/i, place: /barbados/i, slots: [
    { name: "Carlisle Bay — calm family swimming and snorkeling", kind: "light" },
  ]},
];

function destBlob(dest: DestRef | string | undefined) {
  if (!dest) return "";
  if (typeof dest === "string") return dest;
  return `${dest.name || ""} ${dest.admin1 || ""} ${dest.country || ""} ${dest.countryCode || ""}`;
}


/** Named indoor rain backups for destinations that often lack OSM indoor highlights. */
export function curatedIndoorBackups(dest?: DestRef | string): { name: string; type: string; indoor: true; setting: "indoor"; source: string; description: string }[] {
  const place = destBlob(dest);
  if (/canc[uú]n|cancun/i.test(place)) {
    return [
      { name: "Museo Maya de Cancún", type: "museum", indoor: true, setting: "indoor", source: "TripFill", description: "Mayan archaeology museum next to the Hotel Zone." },
      { name: "Interactive Aquarium Cancún", type: "aquarium", indoor: true, setting: "indoor", source: "TripFill", description: "An indoor aquarium in the Hotel Zone." },
      { name: "La Isla Shopping Village", type: "mall", indoor: true, setting: "indoor", source: "TripFill", description: "A covered shopping village with food and indoor walking." },
    ];
  }
  return [];
}
export function interestPhrases(interests = ""): string[] {
  return (interests || "").split(/[,;/]+/).map(s => s.trim()).filter(s => s.length >= 3);
}

/** Iconic venues that match this trip's free-text interests and destination. */
export function curatedInterestVenues(interests: string, dest?: DestRef | string, opts?: { youngChild?: boolean }): InterestSlot[] {
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
  if (opts?.youngChild && out.some(s => s.nearby) && out.some(s => s.far)) {
    // Prefer the closer site with little kids; keep far sites as optional notes, not scheduled days.
    return out.filter(s => !s.far);
  }
  return out;
}

/** Far iconic sites held back when a little child is on the trip. */
export function optionalFarInterestNotes(interests: string, dest?: DestRef | string, youngChild = false): string[] {
  if (!youngChild) return [];
  const text = interests || "";
  const place = destBlob(dest);
  const notes: string[] = [];
  const seen = new Set<string>();
  for (const e of ENTRIES) {
    if (!e.interest.test(text) || !e.place.test(place)) continue;
    if (!e.slots.some(s => s.nearby) || !e.slots.some(s => s.far)) continue;
    for (const slot of e.slots.filter(s => s.far)) {
      const k = slot.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      const baby = slot.note ? `. ${slot.note}` : "";
      const hours = slot.driveHours != null
        ? `about ${String(slot.driveHours).replace(/\.0$/, "")} h each way by bus; a grown-up decides`
        : "a big day trip; a grown-up decides";
      notes.push(`Optional: ${slot.name} — ${hours}${baby}`);
    }
  }
  return notes;
}

/** Highlights whose names mention an interest phrase (e.g. "Harry Potter" in the title). */
export function keywordInterestHits<T extends { name?: string; type?: string; description?: string }>(interests: string, highlights: T[] = []): T[] {
  const phrases = interestPhrases(interests).filter(p => p.length >= 4 && !/^(and|the|with|kids?|family|fun)$/i.test(p));
  if (!phrases.length) return [];
  const brands = interestBrands(interests);
  return highlights.filter(h => {
    const blob = `${h.name || ""} ${h.type || ""}`;
    if (phrases.some(p => blob.toLowerCase().includes(p.toLowerCase()))) return true;
    // "Disney World" should still match Magic Kingdom / EPCOT, not only titles that contain those exact words.
    return brands.some(b => matchesBrand(h.name || "", b));
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
  if (isLodgingOrStay(h)) return false;
  if (isFullOrHalfDayAttraction(blob) || isMajorAttraction(blob)) return false;
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

function allInterestSlots(interests: string, dest: DestRef | string | undefined, highlights: { name?: string; type?: string; description?: string }[] = [], opts?: { youngChild?: boolean }): InterestSlot[] {
  const curated = curatedInterestVenues(interests, dest, opts);
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

function interestQueue(interests: string, dest: DestRef | string | undefined, highlights: { name?: string; type?: string; description?: string }[] = [], days: { morning?: string; afternoon?: string; evening?: string }[] = [], opts?: { youngChild?: boolean }): InterestSlot[] {
  return allInterestSlots(interests, dest, highlights, opts).filter(s => !alreadyUsed(days, s.name));
}

function isInterestSlotText(text: string | undefined, queueNames: string[]): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return queueNames.some(n => n && t.includes(n.toLowerCase()));
}

/** Put curated/keyword venues on the itinerary. Majors are guaranteed a mid-day slot. */
export function applyInterestVenues<T extends { morning: string; afternoon: string; evening?: string; label?: string; notes?: string }>(
  days: T[],
  interests: string,
  dest: DestRef | string | undefined,
  highlights: { name?: string; type?: string; description?: string }[] = [],
  isTravel?: (d: T) => boolean,
  opts?: { youngChild?: boolean },
): T[] {
  if (!days?.length) return days;
  const protectedNames = allInterestSlots(interests, dest, highlights, opts).map(s => s.name);
  const queue = interestQueue(interests, dest, highlights, days, opts);
  const majors = queue.filter(s => s.kind !== "light" && s.kind !== "evening");
  const mid = days.filter(d => !isTravel?.(d));
  const appendNote = (d: T, note?: string) => {
    if (!note) return;
    const cur = (d as { notes?: string }).notes || "";
    if (cur.includes(note)) return;
    (d as { notes?: string }).notes = cur ? `${cur} · ${note}` : note;
  };
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
      appendNote(d, next.note);
    }
  }
  for (const note of optionalFarInterestNotes(interests, dest, !!opts?.youngChild)) {
    const host = mid[0] || days[0];
    if (host) appendNote(host, note);
  }
  const evenings = queue.filter(s => s.kind === "evening");
  for (const d of mid) {
    if (!evenings.length) break;
    const next = evenings.shift()!;
    if (isInterestSlotText(d.evening, [next.name])) continue;
    if (!d.evening || /dinner/i.test(d.evening)) d.evening = d.evening && /dinner/i.test(d.evening) ? `${next.name}; ${d.evening}` : next.name;
    else d.evening = `${d.evening}; ${next.name}`;
  }
  const camp = campsiteSetupLine(highlights, interests);
  if (camp && !days.some(d => /set up at .*camp|your campsite|camp at /i.test(`${d.morning || ""} ${d.afternoon || ""} ${d.evening || ""}`))) {
    const d = days[0];
    if (d && !/set up at |campsite|campground/i.test(d.afternoon || "")) {
      const aft = (d.afternoon || "").trim();
      if (!aft || isGenericSlot(aft)) d.afternoon = camp;
      else if (/^sunset /i.test(aft)) d.afternoon = `${camp}; then ${aft}`;
      else d.afternoon = `${camp}; then ${aft}`;
    }
  }
  return days;
}

/** Light interest extras (e.g. a double-decker bus) as a short afternoon add-on, spread across lighter days. */
export function applyInterestAddOns<T extends { morning: string; afternoon: string; evening?: string }>(
  days: T[],
  interests: string,
  dest: DestRef | string | undefined,
  highlights: { name?: string; type?: string; description?: string }[] = [],
  isTravel?: (d: T) => boolean,
  opts: { maxAddOns?: number; youngChild?: boolean; iceCreamName?: string } = {},
): T[] {
  if (!days?.length) return days;
  const maxAddOns = opts.maxAddOns ?? 2;
  const lights = interestQueue(interests, dest, highlights, [], opts).filter(s => s.kind === "light")
    .map(s => s.name === "Ice cream break" && opts.iceCreamName ? { ...s, name: opts.iceCreamName } : s);
  const mid = days.filter(d => !isTravel?.(d));
  const addOnCount = (text?: string) => Math.max(0, (text || "").split(/\s*;\s*then\s+/i).filter(Boolean).length - (text ? 1 : 0));
  const heavyMorning = (text?: string) => /warner\s*bros|studio tour|wizarding world|legoland|windsor castle|theme park|amusement park|water park|day hike|hike continues/i.test(text || "");
  for (const s of lights) {
    if (alreadyUsed(days, s.name)) continue;
    const free = (d: typeof mid[number]) => isBareCategorySlot(d.afternoon) || isGenericSlot(d.afternoon) || !d.afternoon || /^Explore a market/i.test(d.afternoon || "");
    const host = mid.find(d => !heavyMorning(d.morning) && free(d) && !/Hike continues|Day hike/i.test(d.afternoon || ""))
      || mid.find(d => {
        if (heavyMorning(d.morning)) return false;
        if (/Hike continues|Day hike/i.test(d.afternoon || "")) return false;
        return addOnCount(d.afternoon) < maxAddOns;
      })
      || mid.find(d => !heavyMorning(d.morning) && addOnCount(d.afternoon) < maxAddOns);
    if (!host) continue;
    if (!host.afternoon || isGenericSlot(host.afternoon) || /^Explore a market/i.test(host.afternoon)) host.afternoon = s.name;
    else host.afternoon = `${host.afternoon}; then ${s.name}`;
  }
  return days;
}

const VAGUE_NEARBY = /Pick a (?:place|theme park|park or nature place) nearby \(ask a grown-up\)/i;

export function isVagueNearby(text?: string) {
  return !!text && VAGUE_NEARBY.test(text);
}



/** Indoor or indoor-ish buildings that work as a rain backup (museums, visitor centers, Hopi House, studios). */
export function isIndoorishBackup(h: { name?: string; type?: string; description?: string; indoor?: boolean; setting?: string }): boolean {
  const blob = `${h.name || ""} ${h.type || ""} ${h.description || ""}`;
  if (h.setting === "outdoor") return false;
  if (/\b(cinema|cinemark|cin[eé]polis|theatre|theater|teatro)\b/i.test(`${h.name || ""} ${h.type || ""}`)) return false;
  if (/\b(palace|castle|bridge|abbey|cathedral|square|tower of london|buckingham)\b/i.test(h.name || "")) return false;
  if (/phantom ranch|inner canyon|canyon floor|bottom of (the )?canyon|hike-?in|hermit'?s? rest|indian garden|plateau point|wildlife from a distance|stargazing|day hike|rim trail|easy walk|viewpoint|overlook/i.test(blob)) return false;
  if (h.indoor || h.setting === "indoor") return true;
  if (/studio tour|theme park|amusement park|warner\s*bros/i.test(blob)) return false;
  return /visitor (?:centre|center)|museum|gallery|library|junior ranger|hopi house|kolb studio|verkamp|trading post|market hall/i.test(blob);
}

const GENERIC_RAIN_BACKUP = /café, museum or covered market|the visitor center or a nearby museum/i;

export function rainBackupName(text?: string) {
  return (text || "").replace(/^If it rains:\s*/i, "").replace(/^Rain likely — try\s*/i, "").replace(/^Mixed rain and snow — waterproof layers; indoor option:\s*/i, "").trim();
}

export function formatRainBackup(previous: string | undefined, name: string) {
  const bak = previous || "";
  if (/^If it rains/i.test(bak) || !bak) return `If it rains: ${name}`;
  if (/^Rain likely/i.test(bak)) return `Rain likely — try ${name}`;
  if (/^Mixed rain and snow/i.test(bak)) return `Mixed rain and snow — waterproof layers; indoor option: ${name}`;
  return `If it rains: ${name}`;
}

/** Give each day a distinct named indoor backup when an alternative exists; never repeat Yavapai if Hopi House (etc.) is free. */
export function assignUniqueRainBackups<T extends { morning?: string; afternoon?: string; evening?: string; rainyBackup?: string }>(
  days: T[],
  alternatives: { name?: string; type?: string; description?: string; indoor?: boolean; setting?: string }[] = [],
  fallbackName?: string,
): T[] {
  const activityUsed = new Set<string>();
  for (const d of days) {
    const blob = `${d.morning || ""} ${d.afternoon || ""} ${d.evening || ""}`.toLowerCase();
    for (const h of alternatives) if (h.name && blob.includes(h.name.toLowerCase())) activityUsed.add(h.name.toLowerCase());
  }
  const seen = new Set<string>();
  const take = (d: T) => alternatives.find(h => {
    if (!h.name || seen.has(h.name.toLowerCase()) || activityUsed.has(h.name.toLowerCase())) return false;
    if (`${d.morning || ""} ${d.afternoon || ""}`.toLowerCase().includes(h.name.toLowerCase())) return false;
    return isIndoorishBackup(h);
  });
  const GENERIC_LINE = "café, museum or covered market";
  for (const d of days) {
    const bak = d.rainyBackup || "";
    if (!bak) continue;
    const named = rainBackupName(bak);
    const generic = !named || GENERIC_RAIN_BACKUP.test(named);
    const repeat = !!(named && seen.has(named.toLowerCase()));
    const sameDay = !!(named && `${d.morning || ""} ${d.afternoon || ""}`.toLowerCase().includes(named.toLowerCase()));
    if (!generic && !repeat && !sameDay) {
      seen.add(named.toLowerCase());
      continue;
    }
    const next = take(d);
    const fallbackOk = fallbackName && !seen.has(fallbackName.toLowerCase()) && !activityUsed.has(fallbackName.toLowerCase());
    const replacement = next?.name || (fallbackOk ? fallbackName : undefined) || ((repeat || generic || sameDay) ? GENERIC_LINE : named);
    if (replacement && (generic || repeat || sameDay)) {
      d.rainyBackup = formatRainBackup(bak, replacement);
      if (!GENERIC_RAIN_BACKUP.test(replacement)) seen.add(replacement.toLowerCase());
    } else if (!generic && named) {
      seen.add(named.toLowerCase());
    }
  }
  return days;
}

/** If a rain backup is now also a scheduled day slot, point the backup at another indoor place. */
export function reassignUsedRainBackups<T extends { morning: string; afternoon: string; evening?: string; rainyBackup?: string }>(
  days: T[],
  alternatives: { name?: string; type?: string; description?: string; indoor?: boolean; setting?: string }[] = [],
  fallbackName?: string,
): T[] {
  const backupName = (text?: string) => (text || "").replace(/^If it rains:\s*/i, "").trim();
  const inSlots = (name: string) => days.some(d => `${d.morning || ""} ${d.afternoon || ""} ${d.evening || ""}`.toLowerCase().includes(name.toLowerCase()));
  const usedBak = new Set(days.map(d => backupName(d.rainyBackup).toLowerCase()).filter(Boolean));
  for (const d of days) {
    const bak = d.rainyBackup || "";
    const named = backupName(bak);
    if (!named || named.length < 4 || !inSlots(named)) continue;
    usedBak.delete(named.toLowerCase());
    const next = alternatives.find(h => {
      if (!h.name || inSlots(h.name) || usedBak.has(h.name.toLowerCase())) return false;
      return isIndoorishBackup(h);
    });
    const replacement = next?.name || fallbackName || "the visitor center or a nearby museum";
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
      const next = highlights.find(h => h.name && isKidAfternoonSight(h) && !isLodgingOrStay(h) && !isVagueSight(h) && !alreadyUsed(days, h.name, true));
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
  const pool = highlights.filter(h => h.name && isKidAfternoonSight(h) && !isLodgingOrStay(h) && !isVagueSight(h) && !alreadyUsed(days, h.name!, true));
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
