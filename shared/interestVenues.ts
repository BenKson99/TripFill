import { isLodgingOrStay, isVagueSight, campsiteSetupLine } from "./nationalParks.js";
import { isFullOrHalfDayAttraction, isMajorAttraction, interestBrands, matchesBrand, kidsRestAfternoon, isRestSlot, splitAddOns, joinAddOns, registerDictionaryNotes } from "./family.js";
import { preferFamilySights } from "./junkVenues.js";
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
    { name: "Ride the top deck of a red double-decker bus past Big Ben (any London bus, use a contactless card)", kind: "light" },
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
  { interest: /luau|l[ūu]ʻ?au|hawaiian feast/i, place: /honolulu|hawaii|hawai[iʻ]i|oahu|oʻahu|maui|kauai|kauaʻi|kona|hilo|big island|waikiki/i, slots: [
    { name: "Family luau (book ahead)", kind: "evening" },
  ]},
  { interest: /turtles?|honu\b/i, place: /honolulu|hawaii|hawai[iʻ]i|oahu|oʻahu|waikiki|north shore/i, slots: [
    { name: "Laniakea Beach on the North Shore — view sea turtles from a respectful distance (10 ft)", kind: "major" },
  ]},
  { interest: /surf(?:ing)? lessons?|learn to surf|beginner surf/i, place: /honolulu|waikiki|oahu|oʻahu|hawaii|hawai[iʻ]i/i, slots: [
    { name: "Beginner surf lesson at Waikīkī (book a family lesson)", kind: "major" },
  ]},
  { interest: /volcano(?:es)?|volcanic|caldera|crater/i, place: /honolulu|oahu|oʻahu|waikiki/i, slots: [
    { name: "Diamond Head hike / crater (book ahead)", kind: "major", note: "Diamond Head is an old volcano crater. The active volcano park (Hawaiʻi Volcanoes) is on the Big Island, a short flight away" },
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
      { name: "Plaza Kukulcán", type: "mall", indoor: true, setting: "indoor", source: "TripFill", description: "A covered shopping mall in the Hotel Zone." },
      { name: "Plaza Las Américas", type: "mall", indoor: true, setting: "indoor", source: "TripFill", description: "A large indoor shopping centre in downtown Cancún." },
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

/** Far iconic sites held back when a little child is on the trip — one merged optional-trip line. */
export function optionalFarInterestNotes(interests: string, dest?: DestRef | string, youngChild = false): string[] {
  if (!youngChild) return [];
  const text = interests || "";
  const place = destBlob(dest);
  const trips: string[] = [];
  const seen = new Set<string>();
  for (const e of ENTRIES) {
    if (!e.interest.test(text) || !e.place.test(place)) continue;
    if (!e.slots.some(s => s.nearby) || !e.slots.some(s => s.far)) continue;
    for (const slot of e.slots.filter(s => s.far)) {
      const k = slot.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      const short = slot.name.replace(/\s+archaeological zone$/i, "").replace(/\s+archaeological site$/i, "");
      const n = slot.driveHours != null ? String(slot.driveHours).replace(/\.0$/, "") : "";
      const byBus = trips.length === 0 && slot.driveHours != null;
      const hours = n ? ` (~${n} h${byBus ? " by bus" : ""})` : "";
      trips.push(`${short}${hours}`);
    }
  }
  if (!trips.length) return [];
  return [`Optional big day trip: ${trips.join(" or ")} — a grown-up decides`];
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
      if (isMajorAttraction(next.name)) d.afternoon = kidsRestAfternoon(typeof dest === "string" ? dest : dest?.name);
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
  attachCuratedInterestNotes(days, interests, dest);
  return days;
}

/** Light interest extras (e.g. a double-decker bus) as a short afternoon add-on, spread across lighter days. */
export function applyInterestAddOns<T extends { morning: string; afternoon: string; evening?: string; notes?: string }>(
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
    const isRest = (text?: string) => /hotel pool|quiet rest at the hotel/i.test(text || "");
    const genericAfternoon = (d: typeof mid[number]) => isBareCategorySlot(d.afternoon) || isGenericSlot(d.afternoon) || !d.afternoon || /^Explore a market/i.test(d.afternoon || "");
    const host = mid.find(d => genericAfternoon(d) && !/Hike continues|Day hike/i.test(d.afternoon || ""))
      || mid.find(d => !heavyMorning(d.morning) && isRest(d.afternoon) && !/Hike continues|Day hike/i.test(d.afternoon || ""))
      || mid.find(d => {
        if (/Hike continues|Day hike/i.test(d.afternoon || "")) return false;
        if (isRest(d.afternoon)) return false;
        return addOnCount(d.afternoon) < maxAddOns;
      });
    if (!host) continue;
    if (!host.afternoon || isGenericSlot(host.afternoon) || /^Explore a market/i.test(host.afternoon)) host.afternoon = s.name;
    else if (isRest(host.afternoon)) (host as T & { notes?: string }).notes = [(host as T & { notes?: string }).notes, `Short add-on: ${s.name}`].filter(Boolean).join(" · ");
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
  if (/private house|house tour|historic home|mansion tour|residence tour|home tour/i.test(blob)) return false;
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

/** Give each day a distinct named indoor backup when an alternative exists; if uniques run out, reuse a real indoor place rather than a generic line. */
export function assignUniqueRainBackups<T extends { morning?: string; afternoon?: string; evening?: string; rainyBackup?: string }>(
  days: T[],
  alternatives: { name?: string; type?: string; description?: string; indoor?: boolean; setting?: string }[] = [],
  fallbackName?: string,
): T[] {
  alternatives = preferFamilySights(alternatives);
  const sameDay = (d: T, name?: string) => !!(name && `${d.morning || ""} ${d.afternoon || ""}`.toLowerCase().includes(name.toLowerCase()));
  const seen = new Set<string>();
  const order: string[] = [];
  const take = (d: T, reuse = false) => {
    const pool = alternatives.filter(h => h.name && isIndoorishBackup(h) && !sameDay(d, h.name));
    if (!reuse) return pool.find(h => !seen.has(h.name!.toLowerCase()));
    // Cycle the least-recently used named indoor place, never the same day's activity.
    const ranked = [...pool].sort((a, b) => {
      const ia = order.lastIndexOf(a.name!.toLowerCase());
      const ib = order.lastIndexOf(b.name!.toLowerCase());
      return ia - ib;
    });
    return ranked[0];
  };
  const GENERIC_LINE = "café, museum or covered market";
  const hasRealIndoor = alternatives.some(h => h.name && isIndoorishBackup(h));
  for (const d of days) {
    const bak = d.rainyBackup || "";
    if (!bak) continue;
    const named = rainBackupName(bak).replace(/\s*\([^)]*\)\s*$/, "").trim();
    const generic = !named || GENERIC_RAIN_BACKUP.test(named);
    const repeat = !!(named && seen.has(named.toLowerCase()));
    const clash = sameDay(d, named);
    if (!generic && !repeat && !clash) {
      seen.add(named.toLowerCase());
      order.push(named.toLowerCase());
      continue;
    }
    const next = take(d) || (hasRealIndoor ? take(d, true) : undefined);
    const fallbackOk = fallbackName && !sameDay(d, fallbackName) && (!seen.has(fallbackName.toLowerCase()) || !next);
    const replacement = next?.name || (fallbackOk ? fallbackName : undefined) || ((repeat || generic || clash) && !hasRealIndoor ? GENERIC_LINE : (!generic && !clash ? named : GENERIC_LINE));
    if (replacement && (generic || repeat || clash)) {
      d.rainyBackup = formatRainBackup(bak, replacement);
      if (!GENERIC_RAIN_BACKUP.test(replacement)) {
        const k = replacement.toLowerCase();
        seen.add(k);
        order.push(k);
      }
    } else if (!generic && named) {
      seen.add(named.toLowerCase());
    }
  }
  return days;
}


const KID_HINTS: { re: RegExp; hint: string }[] = [
  { re: /uss arizona/i, hint: "boat ride to the memorial — free timed tickets, book ahead" },
  { re: /uss missouri|battleship/i, hint: "battleship you can walk through" },
  { re: /uss bowfin|submarine/i, hint: "submarine you can walk through" },
  { re: /aquarium/i, hint: "see sea animals indoors" },
  { re: /museo maya|mayan?.{0,20}museum/i, hint: "Mayan artefacts indoors" },
  { re: /museum|museo|visitor (?:centre|center)/i, hint: "indoor exhibits" },
  { re: /isla shopping|shopping village|\bmall\b|plaza kukul|plaza las am[eé]ricas/i, hint: "covered shops and snacks" },
  { re: /hopi house/i, hint: "indoor craft shop and rest" },
  { re: /kolb studio/i, hint: "indoor gallery" },
  { re: /planetarium/i, hint: "stars indoors" },
  { re: /\bzoo\b/i, hint: "see animals" },
];
const HINT_SKIP = /dinner\s*:|hotel pool|quiet rest|airport|arriv|depart|explore a market|café, museum or covered market|check in|free morning|long lunch/i;

/** Short kid-friendly what-it-is phrase, or undefined when the name already explains itself. */
export function kidPlaceHint(name: string, meta?: { type?: string; description?: string }): string | undefined {
  const bare = (name || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (!bare || HINT_SKIP.test(bare) || /\(/.test(name || "")) return undefined;
  const blob = `${bare} ${meta?.type || ""} ${meta?.description || ""}`;
  const hit = KID_HINTS.find(h => h.re.test(blob));
  return hit?.hint;
}

export function withKidHint(name: string, meta?: { type?: string; description?: string }): string {
  const hint = kidPlaceHint(name, meta);
  return hint ? `${name.replace(/\s*\([^)]*\)\s*$/, "").trim()} (${hint})` : name;
}

export function applyKidPlaceHints<T extends { morning?: string; afternoon?: string; evening?: string; rainyBackup?: string }>(
  days: T[],
  highlights: { name?: string; type?: string; description?: string }[] = [],
): T[] {
  const metaOf = (text?: string) => {
    const bare = rainBackupName(text).replace(/\s*\([^)]*\)\s*$/, "").trim();
    return highlights.find(h => (h.name || "").toLowerCase() === bare.toLowerCase());
  };
  const slot = (text?: string, kind?: "evening" | "backup" | "slot") => {
    if (!text) return text;
    if (kind === "evening" && /dinner/i.test(text)) return text;
    if (kind === "backup") {
      const named = rainBackupName(text);
      if (!named || GENERIC_RAIN_BACKUP.test(named)) return text;
      const hinted = withKidHint(named, metaOf(named));
      return hinted === named ? text : formatRainBackup(text, hinted);
    }
    if (HINT_SKIP.test(text) || /\(/.test(text)) return text;
    const bare = text.replace(/^[^A-Za-z0-9"]+/, "").trim();
    const hinted = withKidHint(bare, metaOf(bare));
    if (hinted === bare) return text;
    return text.replace(bare, hinted);
  };
  for (const d of days) {
    if (d.morning) d.morning = slot(d.morning, "slot")!;
    if (d.afternoon) d.afternoon = slot(d.afternoon, "slot")!;
    if (d.evening) d.evening = slot(d.evening, "evening")!;
    if (d.rainyBackup) d.rainyBackup = slot(d.rainyBackup, "backup")!;
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
  const pool = preferFamilySights(highlights.filter(h => h.name && isKidAfternoonSight(h) && !isLodgingOrStay(h) && !isVagueSight(h) && !alreadyUsed(days, h.name!, true)));
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


const INTEREST_STOP = /^(and|the|with|kids?|family|fun|beach|beaches|swimming|lessons?)$/i;


/** Attach dictionary notes to the day that already holds the matching venue (e.g. Diamond Head placed as a hike). */
export function attachCuratedInterestNotes<T extends { morning?: string; afternoon?: string; evening?: string; notes?: string }>(
  days: T[],
  interests: string,
  dest?: DestRef | string,
): T[] {
  const slots = curatedInterestVenues(interests, dest).filter(s => s.note && s.name);
  registerDictionaryNotes(slots.map(s => s.note!).concat([
    "Diamond Head is an old volcano crater. The active volcano park (Hawaiʻi Volcanoes) is on the Big Island, a short flight away",
  ]));
  const appendNote = (d: T, note: string) => {
    const cur = d.notes || "";
    if (cur.includes(note)) return;
    d.notes = cur ? `${cur} · ${note}` : note;
  };
  for (const s of slots) {
    const host = days.find(d => alreadyUsed([d], s.name) || `${d.morning || ""} ${d.afternoon || ""} ${d.evening || ""}`.toLowerCase().includes(s.name.toLowerCase().replace(/\s*\([^)]*\)\s*$/, "").slice(0, 24)));
    if (host) appendNote(host, s.note!);
  }
  return days;
}

const PEARL_HARBOR = /uss arizona|uss missouri|uss bowfin|pacific aviation museum|pearl harbor national memorial|ford island|pearl harbor/i;

export const PEARL_HARBOR_MORNING = "Pearl Harbor — USS Arizona Memorial boat ride (free timed tickets, book ahead)";
export const PEARL_HARBOR_ALSO = "Optional: also tour the USS Missouri or USS Bowfin";

function pearlPiece(text?: string): string | undefined {
  const t = (text || "").trim();
  if (!t) return undefined;
  // A slot or add-on that is a Pearl Harbor site.
  for (const part of t.split(/\s*;\s*then\s+/i)) {
    if (PEARL_HARBOR.test(part)) return part.trim();
  }
  return undefined;
}

/** Schedule one Pearl Harbor morning when any of the sites exist in the days or highlights. */
export function clusterPearlHarbor<T extends { morning?: string; afternoon?: string; evening?: string; notes?: string; rainyBackup?: string; label?: string }>(
  days: T[],
  isTravel?: (d: T) => boolean,
  dest?: string,
  highlights: { name?: string }[] = [],
): T[] {
  const mid = days.filter(d => !isTravel?.(d));
  if (!mid.length) return days;
  const blob = mid.map(d => `${d.morning || ""} ${d.afternoon || ""} ${d.evening || ""}`).join(" \n ");
  const hlNames = highlights.map(h => h.name || "").filter(Boolean);
  const hasSites = PEARL_HARBOR.test(blob) || hlNames.some(n => PEARL_HARBOR.test(n));
  if (!hasSites) return days;

  const host = mid.find(d => PEARL_HARBOR.test(d.morning || ""))
    || mid.find(d => !PEARL_HARBOR.test(d.morning || "") && !isMajorAttraction(d.morning || "") && !isFullOrHalfDayAttraction(d.morning || "") && !/beach|playa|surf/i.test(d.morning || ""))
    || mid.find(d => PEARL_HARBOR.test(`${d.morning || ""} ${d.afternoon || ""}`))
    || mid.find(d => !isMajorAttraction(d.morning || "") && !isFullOrHalfDayAttraction(d.morning || ""))
    || mid[0];

  const pool = `${blob} ${hlNames.join(" ")}`;
  const offerAlso = /uss missouri|uss bowfin/i.test(pool) || /pearl harbor/i.test(pool);

  for (const d of mid) {
    for (const slot of ["morning", "afternoon"] as const) {
      if (d === host) continue;
      if (!PEARL_HARBOR.test(d[slot] || "")) continue;
      d[slot] = slot === "afternoon" ? kidsRestAfternoon(dest) : "Free morning — wander a new neighbourhood";
    }
  }

  host.morning = PEARL_HARBOR_MORNING;
  const leftovers = splitAddOns(host.afternoon).filter(p => !PEARL_HARBOR.test(p) && !isRestSlot(p));
  host.afternoon = kidsRestAfternoon(dest);
  if (offerAlso && !(host.notes || "").includes("USS Missouri")) {
    host.notes = [host.notes, PEARL_HARBOR_ALSO].filter(Boolean).join(" · ");
  }
  for (const item of leftovers) {
    const other = mid.filter(d => d !== host);
    const beachy = /beach|playa|snorkel|waik[iī]k[iī]/i.test(item);
    const slotHost = (beachy ? other.find(d => !d.morning || /free morning|wander a new/i.test(d.morning || "")) : undefined)
      || other.find(d => isRestSlot(d.afternoon) || !d.afternoon || /explore a market|free morning/i.test(d.afternoon || ""))
      || other.find(d => splitAddOns(d.afternoon).length < 2 && !/luau/i.test(d.evening || ""));
    if (!slotHost) continue;
    if (beachy && (!slotHost.morning || /free morning|wander a new/i.test(slotHost.morning || ""))) slotHost.morning = item;
    else if (!slotHost.afternoon || isRestSlot(slotHost.afternoon) || /explore a market|free morning/i.test(slotHost.afternoon || "")) slotHost.afternoon = item;
    else slotHost.afternoon = joinAddOns([...splitAddOns(slotHost.afternoon), item].slice(0, 2));
  }
  return days;
}

/** Don't pair a luau evening with a full Pearl Harbor day when a lighter day exists. */
export function avoidHeavyEveningOnPearlHarbor<T extends { morning?: string; afternoon?: string; evening?: string; label?: string }>(
  days: T[],
  isTravel?: (d: T) => boolean,
): T[] {
  const host = days.find(d => /Pearl Harbor — USS Arizona/i.test(d.morning || ""));
  if (!host || !/luau|l[ūu]ʻ?au/i.test(host.evening || "")) return days;
  const mid = days.filter(d => d !== host && !isTravel?.(d));
  const lighter = mid.find(d => !/pearl harbor|uss arizona/i.test(d.morning || "") && !/luau|l[ūu]ʻ?au/i.test(d.evening || "") && (!d.evening || /dinner/i.test(d.evening || "")) && !/warner\s*bros|studio tour|day hike/i.test(d.morning || ""))
    || mid.find(d => !/luau|l[ūu]ʻ?au/i.test(d.evening || "") && (!d.evening || /dinner/i.test(d.evening || "")));
  if (!lighter) return days;
  const swap = lighter.evening;
  lighter.evening = host.evening;
  host.evening = swap && !/luau|l[ūu]ʻ?au/i.test(swap) ? swap : "Early dinner near your stay";
  return days;
}


/** Interests from the form that never landed in a slot or note, with a short try-this hint. */
export function unplacedInterestNotes(interests: string, days: { morning?: string; afternoon?: string; evening?: string; notes?: string; rainyBackup?: string }[] = [], dest?: DestRef | string): string[] {
  const phrases = (interests || "").split(/[,;/]+/).map(s => s.trim()).filter(s => s.length >= 3 && !INTEREST_STOP.test(s));
  if (!phrases.length) return [];
  const blob = days.map(d => `${d.morning || ""} ${d.afternoon || ""} ${d.evening || ""} ${d.notes || ""} ${d.rainyBackup || ""}`).join(" \n ").toLowerCase();
  const destText = typeof dest === "string" ? dest : `${dest?.name || ""} ${dest?.admin1 || ""} ${dest?.country || ""}`;
  const curated = curatedInterestVenues(interests, dest).concat(
    // include far slots in the "placed" check via notes
  );
  const out: string[] = [];
  for (const phrase of phrases) {
    const key = phrase.toLowerCase();
    const stem = key.replace(/ies\b/, "y").replace(/ses\b/, "s").replace(/s\b/, "");
    const stemRe = stem.length >= 4 ? new RegExp(`\\b${stem.replace(/[^a-z0-9]+/g, "\\b\\w*\\b")}s?\\b`, "i") : null;
    const hint = curated.find(s => s.name.toLowerCase().includes(key) || (stem.length >= 4 && s.name.toLowerCase().includes(stem)) || new RegExp(key.replace(/[^a-z0-9\s]/gi, "").split(/\s+/).filter(w => w.length >= 4).join("|") || "a^", "i").test(s.name));
    const hintPlaced = !!(hint && (blob.includes(hint.name.toLowerCase()) || blob.includes(hint.name.toLowerCase().slice(0, 18).toLowerCase())));
    const placed = blob.includes(key)
      || !!(stemRe && stemRe.test(blob))
      || hintPlaced
      || /harry potter|wizarding|hogwarts/i.test(phrase) && /warner\s*bros|studio tour|platform\s*9|wizarding|harry potter/i.test(blob)
      || /castles?/i.test(phrase) && /castle|tower of london|palace/i.test(blob)
      || /museums?/i.test(phrase) && /museum|gallery|tussauds/i.test(blob)
      || /double-?decker|bus tour/i.test(phrase) && /double-?decker|hop-?on|top deck/i.test(blob)
      || /volcano/i.test(phrase) && /diamond head|volcanoes national park/i.test(blob)
      || /turtles?/i.test(phrase) && /laniakea|turtle/i.test(blob)
      || /luau|l[ūu]ʻ?au/i.test(phrase) && /luau/i.test(blob)
      || /surf/i.test(phrase) && /surf/i.test(blob);
    if (placed) continue;
    const tryThis = hint?.name
      || (/luau/i.test(phrase) ? "a Family luau (book ahead)" : "")
      || (/turtle/i.test(phrase) ? "Laniakea Beach on the North Shore" : "")
      || (/surf/i.test(phrase) ? "a beginner surf lesson at Waikīkī" : "")
      || (/volcano/i.test(phrase) ? "Diamond Head on Oʻahu, or Hawaiʻi Volcanoes National Park on the Big Island" : "");
    out.push(tryThis ? `We couldn't fit: ${phrase} — try ${tryThis}` : `We couldn't fit: ${phrase}`);
  }
  return out;
}
