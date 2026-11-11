import { precipKind, isRainy } from "./precip.js";
/** One table of vacation activities — packing, prep, itinerary hints and place tags. Easy to extend. */
export const ACTIVITY_IDS = [
  "ski", "hiking", "food", "beach", "sightseeing", "museums", "heritage", "shopping",
  "nightlife", "tasting", "dive", "surf", "boat", "fishing", "cycling", "camping",
  "wildlife", "parks", "golf", "spa", "shows", "photography", "climbing", "scenic", "family",
] as const;
export type ActivityId = typeof ACTIVITY_IDS[number];
export const isActivityId = (v: unknown): v is ActivityId => typeof v === "string" && (ACTIVITY_IDS as readonly string[]).includes(v);

export type PackWho = "all" | "adults" | "children" | "infants" | "notInfant" | "shared";
export type PackFlag = "drivingOnly" | "rentIfFlying" | "warm" | "snow" | "notSnow" | "kids";
export interface ActivityPackItem {
  group: "Activities" | "Clothing" | "Toiletries & Health" | "Electronics" | "Comfort & Extras" | "Documents & Money";
  item: string; reason: string; qty?: number; who?: PackWho; flags?: PackFlag[]; essential?: boolean; bag?: "personal" | "day-bag" | "unassigned"; lastMinute?: boolean;
}
export interface ActivityPrep { task: string; why?: string; daysBefore: number }
export interface ActivityDef {
  id: ActivityId; label: string; emoji: string; popular?: boolean;
  aliases: RegExp;
  legacyPresets?: string[];
  legacyKits?: string[];
  packing: ActivityPackItem[];
  prep: ActivityPrep[];
  /** morning / afternoon / evening preference and how often it may repeat */
  slot: "morning" | "afternoon" | "evening" | "flex";
  weather: "any" | "dry-mild" | "warm-dry" | "snow-ok" | "not-rain" | "evening";
  osm?: string; // highlight type / OSM kind we look for
  mainRepeat?: boolean; // may fill most days when it is a primary activity (ski)
}

export const ACTIVITIES: ActivityDef[] = [
  { id: "ski", label: "Skiing & snowboarding", emoji: "⛷", popular: true,
    aliases: /\b(ski|skiing|snowboard(?:ing)?|ski[- ]?(?:school|lesson|pass|rental)s?|beginner ski)\b/i,
    legacyPresets: ["ski"], legacyKits: ["ski"], slot: "morning", weather: "snow-ok", osm: "ski", mainRepeat: true,
    packing: [
      { group: "Activities", item: "Ski jacket & pants", reason: "Ski activity — weather-appropriate layers" },
      { group: "Activities", item: "Ski socks", reason: "Ski activity — dry spare pairs", qty: 3 },
      { group: "Activities", item: "Goggles & helmet / rental booking", reason: "Ski activity — confirm fit and rentals" },
    ],
    prep: [
      { task: "Buy lift passes online", why: "resort windows often sell out, especially in holiday weeks", daysBefore: 21 },
      { task: "Book ski or snowboard rentals (and beginner lessons if needed)", why: "school slots go early; mention ability level", daysBefore: 21 },
      { task: "Check if the resort is car-free and how you get there from the station or parking", why: "places like Zermatt are reached by train or taxi, not a private car in town", daysBefore: 10 },
    ] },
  { id: "hiking", label: "Hiking", emoji: "🥾", popular: true,
    aliases: /\b(hik(?:e|ing)|trek(?:king)?|trail(?:s)?|day hike|backpacking)\b/i,
    legacyPresets: ["hiking"], legacyKits: ["hiking"], slot: "morning", weather: "not-rain", osm: "trail",
    packing: [
      { group: "Activities", item: "Hiking shoes / trail layers", reason: "Hiking activity — choose gear for the actual route and check conditions" },
      { group: "Activities", item: "Daypack, trail snacks & water capacity", reason: "Hiking activity — tailor water and supplies to the route, not a fixed universal amount" },
      { group: "Activities", item: "Offline trail map & headlamp", reason: "Hiking activity — know your route and daylight limits", who: "shared" },
    ],
    prep: [
      { task: "Pick routes and check trail conditions or hut reservations", why: "weather and closures change; confirm difficulty and daylight", daysBefore: 7 },
    ] },
  { id: "food", label: "Food & dining", emoji: "🍽", popular: true,
    aliases: /\b(food|dining|restaurant|eat(?:ing)?|culinary|foodie|cuisine|gastronom)\b/i,
    slot: "evening", weather: "any", osm: "restaurant",
    packing: [
      { group: "Clothing", item: "Smart-casual dinner outfit", reason: "Food & dining — nicer restaurants often expect a modest dress code" },
    ],
    prep: [
      { task: "Reserve popular restaurants", why: "sought-after rooms book out, especially weekends and holidays", daysBefore: 14 },
    ] },
  { id: "beach", label: "Beach & swimming", emoji: "🏖", popular: true,
    aliases: /\b(beach|beaches|swim(?:ming)?|pool|seaside|snorkel-and-beach)\b/i,
    legacyPresets: ["beach"], legacyKits: ["beach"], slot: "afternoon", weather: "warm-dry", osm: "beach",
    packing: [
      { group: "Activities", item: "Swimwear", reason: "Beach / swimming activity selected", qty: 2 },
      { group: "Activities", item: "Beach towel / sarong", reason: "Check whether accommodation provides one" },
      { group: "Activities", item: "Sandals", reason: "Beach / swimming activity selected" },
      { group: "Toiletries & Health", item: "Reef-safe sunscreen", reason: "Beach days — follow product guidance; reef-safe where required", flags: ["warm"] },
    ],
    prep: [
      { task: "Check beach or pool access and any seasonal lifeguard hours", why: "some shores are unsafe or closed out of season", daysBefore: 5 },
    ] },
  { id: "sightseeing", label: "Sightseeing & city walks", emoji: "🚶", popular: true,
    aliases: /\b(sightseeing|city walk|walking tour|old town|wander|stroll)\b/i,
    legacyPresets: ["city"], slot: "flex", weather: "any", osm: "viewpoint",
    packing: [
      { group: "Toiletries & Health", item: "Blister plasters for city walking", reason: "Sightseeing — long days on pavement" },
    ],
    prep: [
      { task: "Shortlist must-see sights and any timed entries", why: "popular viewpoints and old towns get busy mid-day", daysBefore: 10 },
    ] },
  { id: "museums", label: "Museums & art", emoji: "🖼", popular: true,
    aliases: /\b(museum|museums|art gallery|galleries|art museum|modern art)\b/i,
    slot: "morning", weather: "any", osm: "museum",
    packing: [
      { group: "Comfort & Extras", item: "Small bag that meets museum bag rules", reason: "Museums — large bags often go in a cloakroom" },
    ],
    prep: [
      { task: "Book museum or gallery tickets for timed entry", why: "popular shows often require a slot", daysBefore: 14 },
    ] },
  { id: "heritage", label: "History & heritage sites", emoji: "🏛",
    aliases: /\b(heritage|historic(?:al)?|castle|cathedral|ruin|archaeolog|history site|old fortress)\b/i,
    slot: "morning", weather: "any", osm: "heritage",
    packing: [
      { group: "Clothing", item: "Comfortable closed-toe shoes for heritage sites", reason: "History sites — uneven ground and dress rules at some churches" },
    ],
    prep: [
      { task: "Check opening days and tickets for heritage sites", why: "some close mid-week or need a reserved entry", daysBefore: 10 },
    ] },
  { id: "shopping", label: "Shopping & markets", emoji: "🛍", popular: true,
    aliases: /\b(shopping|market(?:s)?|bazaar|souk|flea market|boutique)\b/i,
    slot: "afternoon", weather: "any", osm: "marketplace",
    packing: [
      { group: "Comfort & Extras", item: "Foldable shopping tote", reason: "Markets and shops — a spare bag beats extra plastic", who: "shared" },
    ],
    prep: [
      { task: "Note market days and hours", why: "weekly markets often run only in the morning", daysBefore: 5 },
    ] },
  { id: "nightlife", label: "Nightlife & bars", emoji: "🍸", popular: true,
    aliases: /\b(nightlife|night life|bars?|cocktails?|club(?:bing)?|nightclub|pub crawl)\b/i,
    slot: "evening", weather: "evening", osm: "nightclub",
    packing: [
      { group: "Clothing", item: "Going-out / dressy outfit", reason: "Nightlife — check dress codes; one outfit is usually enough", who: "adults" },
    ],
    prep: [
      { task: "Check opening hours, dress codes and any guest lists", why: "some venues need ID and a reservation", daysBefore: 5 },
    ] },
  { id: "tasting", label: "Wine, beer & distillery tasting", emoji: "🍷",
    aliases: /\b(wine|winery|wineries|vineyard|tasting|brewery|breweries|beer tasting|distillery|distilleries|whisky|whiskey)\b/i,
    slot: "afternoon", weather: "dry-mild", osm: "winery",
    packing: [
      { group: "Clothing", item: "Light layer for cellar or cave tastings", reason: "Tasting rooms and cellars are often cooler than outside" },
    ],
    prep: [
      { task: "Book winery, brewery or distillery tastings", why: "tours often have limited daily slots", daysBefore: 10 },
    ] },
  { id: "dive", label: "Snorkeling & scuba", emoji: "🤿",
    aliases: /\b(snorkel(?:ling)?|scuba|diving|dive(?:s|r)?|reef)\b/i,
    slot: "morning", weather: "warm-dry", osm: "scuba",
    packing: [
      { group: "Activities", item: "Mask & snorkel (or rental booking)", reason: "Snorkeling / scuba — a familiar mask is nicer; shops also rent" },
      { group: "Toiletries & Health", item: "Reef-safe sunscreen", reason: "In-water days — many reefs require reef-safe formulas", flags: ["warm"] },
      { group: "Documents & Money", item: "Dive certification card (if scuba)", reason: "Operators will ask for it; skip if you are only snorkeling", who: "adults", bag: "personal" },
    ],
    prep: [
      { task: "Confirm dive certification and book operators", why: "bring your card; introductory dives need a slot", daysBefore: 14 },
      { task: "Plan no-fly time after scuba", why: "wait at least 12–24 hours after diving before a flight — check your operator's advice", daysBefore: 2 },
    ] },
  { id: "surf", label: "Surfing", emoji: "🏄",
    aliases: /\b(surf(?:ing|er)?|surfboard|surf lesson)\b/i,
    slot: "morning", weather: "warm-dry", osm: "beach",
    packing: [
      { group: "Activities", item: "Swimwear & rash guard", reason: "Surfing — pack a spare; rent or bring a wetsuit if the water is cool" },
      { group: "Activities", item: "Surfboard (only if driving) or rental booking", reason: "Boards are bulky in the hold — rent at the beach unless you are driving", flags: ["rentIfFlying"] },
    ],
    prep: [
      { task: "Check swell, season and book a lesson or board rental", why: "conditions vary; shops can set you up on arrival", daysBefore: 7 },
    ] },
  { id: "boat", label: "Boating, kayaking & paddleboarding", emoji: "🛶",
    aliases: /\b(boat(?:ing)?|kayak(?:ing)?|canoe|paddleboard(?:ing)?|sup\b|stand-?up paddle)\b/i,
    slot: "morning", weather: "warm-dry", osm: "marina",
    packing: [
      { group: "Activities", item: "Quick-dry layer & water shoes", reason: "Time on the water — expect splash and wet landings" },
      { group: "Electronics", item: "Waterproof phone pouch", reason: "Boats and paddles — keep a phone dry for navigation and photos", who: "shared" },
    ],
    prep: [
      { task: "Book a boat, kayak or paddleboard rental", why: "good-weather slots go quickly in season", daysBefore: 7 },
    ] },
  { id: "fishing", label: "Fishing", emoji: "🎣",
    aliases: /\b(fish(?:ing)?|angler|fly[- ]fish)\b/i,
    slot: "morning", weather: "not-rain", osm: "fishing",
    packing: [
      { group: "Activities", item: "Fishing rod & tackle (only if driving) or rental plan", reason: "Rods travel poorly on a plane — rent locally unless you are driving", flags: ["rentIfFlying"] },
    ],
    prep: [
      { task: "Check fishing licence rules and seasons", why: "rules differ by water and season; buy a licence before you cast", daysBefore: 7 },
    ] },
  { id: "cycling", label: "Cycling & mountain biking", emoji: "🚴",
    aliases: /\b(cycl(?:e|ing)|mountain bik(?:e|ing)|mtb|bike ride|biking)\b/i,
    slot: "morning", weather: "dry-mild", osm: "bicycle_rental",
    packing: [
      { group: "Activities", item: "Cycling helmet & gloves", reason: "Wear a helmet; bring yours if it fits, or rent with the bike" },
      { group: "Activities", item: "Your bike (only if driving) or rental booking", reason: "Bikes are awkward to fly with — rent unless you are driving", flags: ["rentIfFlying"] },
    ],
    prep: [
      { task: "Book bike rentals and check route or trail advice", why: "sizes and e-bikes book out in season", daysBefore: 7 },
    ] },
  { id: "camping", label: "Camping", emoji: "🏕",
    aliases: /\b(camp(?:ing)?|campsite|campground|glamping)\b/i,
    slot: "flex", weather: "dry-mild", osm: "camp_site",
    packing: [
      { group: "Activities", item: "Sleeping layer / liner", reason: "Camping — a familiar liner is lighter than a full kit if the site provides gear" },
      { group: "Activities", item: "Headlamp", reason: "Camping — hands-free light after dark", who: "shared" },
    ],
    prep: [
      { task: "Book the campsite and check fire, bear or gear rules", why: "popular grounds need a reservation; some need your own kit", daysBefore: 21 },
    ] },
  { id: "wildlife", label: "Wildlife & nature / national parks", emoji: "🦌",
    aliases: /\b(wildlife|safari|national park|nature reserve|birdwatch|whale|game drive)\b/i,
    slot: "morning", weather: "dry-mild", osm: "nature_reserve",
    packing: [
      { group: "Activities", item: "Binoculars (if you have them)", reason: "Wildlife — optional, and easy to share", who: "shared" },
      { group: "Toiletries & Health", item: "Insect repellent", reason: "Parks and nature — follow product guidance for the season", flags: ["warm"] },
    ],
    prep: [
      { task: "Check park permits, timed entries or safari reservations", why: "many parks cap daily visitors", daysBefore: 21 },
    ] },
  { id: "parks", label: "Theme & water parks", emoji: "🎢",
    aliases: /\b(theme park|amusement park|water park|waterpark|disney|universal studios)\b/i,
    slot: "morning", weather: "warm-dry", osm: "theme_park",
    packing: [
      { group: "Activities", item: "Swimwear (if a water park)", reason: "Water parks — confirm whether lockers and towels are provided" },
    ],
    prep: [
      { task: "Buy theme or water park tickets", why: "date-specific tickets are often cheaper and required", daysBefore: 21 },
    ] },
  { id: "golf", label: "Golf", emoji: "⛳",
    aliases: /\b(golf|tee time|golf course)\b/i,
    slot: "morning", weather: "dry-mild", osm: "golf_course",
    packing: [
      { group: "Activities", item: "Golf shoes", reason: "Many courses require them; rent a set of clubs if you are flying" },
      { group: "Activities", item: "Golf clubs (only if driving) or rental booking", reason: "Clubs are bulky to fly — book a rental set unless you are driving", flags: ["rentIfFlying"] },
    ],
    prep: [
      { task: "Book tee times and ask about club rental", why: "weekend mornings go early", daysBefore: 14 },
    ] },
  { id: "spa", label: "Spa & wellness / hot springs", emoji: "💆",
    aliases: /\b(spa|wellness|hot spring|hotspring|onsen|thermal bath|massage)\b/i,
    slot: "afternoon", weather: "any", osm: "spa",
    packing: [
      { group: "Activities", item: "Swimwear for spa or hot springs", reason: "Many baths require a suit; some traditional onsen do not — check ahead" },
    ],
    prep: [
      { task: "Book spa, bath or hot-spring slots", why: "treatments and popular springs need a reservation", daysBefore: 7 },
    ] },
  { id: "shows", label: "Live music, shows & festivals", emoji: "🎵",
    aliases: /\b(concert|live music|festival|theatre show|broadway|opera|gig|tickets? to a show)\b/i,
    slot: "evening", weather: "evening", osm: "theatre",
    packing: [
      { group: "Clothing", item: "Evening or dressy outfit for a show", reason: "Theatres and nicer venues often have a dress expectation" },
    ],
    prep: [
      { task: "Buy tickets for concerts, shows or festivals", why: "popular dates sell out", daysBefore: 21 },
    ] },
  { id: "photography", label: "Photography", emoji: "📷",
    aliases: /\b(photograph(?:y|er)?|photo walk|camera)\b/i,
    legacyKits: ["photography"], slot: "flex", weather: "any", osm: "viewpoint",
    packing: [
      { group: "Electronics", item: "Camera, battery & memory card", reason: "Photography interest — verify spare battery transport rules if you fly" },
    ],
    prep: [
      { task: "Check drone or photography rules at sights", why: "some parks and museums restrict gear", daysBefore: 5 },
    ] },
  { id: "climbing", label: "Rock climbing", emoji: "🧗",
    aliases: /\b(rock climb(?:ing)?|climbing gym|bouldering|sport climbing)\b/i,
    slot: "morning", weather: "dry-mild", osm: "climbing",
    packing: [
      { group: "Activities", item: "Climbing shoes (or rental)", reason: "A familiar pair is nicer; gyms and guides also rent", who: "notInfant" },
    ],
    prep: [
      { task: "Book a guide or gym and check weather on the crag", why: "outdoor routes need dry rock; mention experience", daysBefore: 7 },
    ] },
  { id: "scenic", label: "Scenic drives & road trips", emoji: "🛣",
    aliases: /\b(scenic drive|road trip|roadtrip|coastal drive|countryside drive)\b/i,
    legacyPresets: ["roadtrip"], legacyKits: ["roadtrip"], slot: "morning", weather: "dry-mild", osm: "viewpoint",
    packing: [
      { group: "Activities", item: "Driving licence & rental documents", reason: "Road-trip activity — check official licence/permit and insurance rules", who: "shared", essential: true, bag: "personal" },
      { group: "Activities", item: "Car charger / phone mount", reason: "Road-trip activity — navigation", who: "shared" },
    ],
    prep: [
      { task: "Plan the scenic route, parking and any car-free town limits", why: "some centres and alpine resorts do not allow private cars", daysBefore: 10 },
    ] },
  { id: "family", label: "Family & kid attractions", emoji: "👨‍👩‍👧",
    aliases: /\b(zoo|aquarium|family attraction|kids? museum|theme for kids|with (?:the )?kids|child-friendly)\b/i,
    legacyPresets: ["kids"], legacyKits: ["kids"], slot: "morning", weather: "any", osm: "zoo",
    packing: [
      { group: "Activities", item: "Children's spare outfit, wipes & snacks", reason: "Family plans — tailor to age and individual needs", who: "shared" },
      { group: "Activities", item: "Children's entertainment / comfort item", reason: "Family plans — transit and downtime", who: "shared" },
    ],
    prep: [
      { task: "Book zoo, aquarium or family attraction tickets", why: "timed entry is common in school holidays", daysBefore: 14 },
    ] },
];

export const ACTIVITY_BY_ID = Object.fromEntries(ACTIVITIES.map(a => [a.id, a])) as Record<ActivityId, ActivityDef>;
export const POPULAR_IDS = ACTIVITIES.filter(a => a.popular).map(a => a.id);

const PRESET_TO_ACTIVITY: Record<string, ActivityId> = { ski: "ski", hiking: "hiking", beach: "beach", city: "sightseeing", kids: "family", roadtrip: "scenic" };
const ACTIVITY_TO_PRESET: Partial<Record<ActivityId, string>> = { ski: "ski", hiking: "hiking", beach: "beach", sightseeing: "city", family: "kids", scenic: "roadtrip" };
const KIT_TO_ACTIVITY: Record<string, ActivityId> = { ski: "ski", hiking: "hiking", beach: "beach", photography: "photography", kids: "family", roadtrip: "scenic" };

export function detectActivities(text: string): ActivityId[] {
  const t = text || "";
  if (!t.trim()) return [];
  return ACTIVITIES.filter(a => a.aliases.test(t)).map(a => a.id);
}

/** Legacy trip types (presets) and free-text interests become activity ids when `input.activities` is absent. */
export function resolveActivities(input: any = {}): ActivityId[] {
  const raw = input?.activities;
  if (Array.isArray(raw)) {
    const seen = new Set<ActivityId>();
    const out: ActivityId[] = [];
    for (const v of raw) if (isActivityId(v) && !seen.has(v)) { seen.add(v); out.push(v); }
    return out;
  }
  const seen = new Set<ActivityId>();
  const out: ActivityId[] = [];
  const add = (id?: ActivityId) => { if (id && !seen.has(id)) { seen.add(id); out.push(id); } };
  for (const p of input?.presets || []) add(PRESET_TO_ACTIVITY[p]);
  for (const id of detectActivities(`${input?.interests || ""} ${input?.purpose || ""}`)) add(id);
  if (/^family$/i.test(input?.purpose || "")) add("family");
  return out;
}

export function presetsFromActivities(ids: ActivityId[]): string[] {
  const out: string[] = [];
  for (const id of ids) { const p = ACTIVITY_TO_PRESET[id]; if (p && !out.includes(p)) out.push(p); }
  return out;
}

export function activitiesFromKits(kits: string[] | undefined): ActivityId[] {
  if (!Array.isArray(kits)) return [];
  const out: ActivityId[] = [];
  for (const k of kits) { const id = KIT_TO_ACTIVITY[k]; if (id && !out.includes(id)) out.push(id); }
  return out;
}

export function kitsFromActivities(ids: ActivityId[], input: any = {}): string[] {
  const kits: string[] = [];
  const add = (k: string) => { if (!kits.includes(k)) kits.push(k); };
  for (const id of ids) for (const k of ACTIVITY_BY_ID[id]?.legacyKits || []) add(k);
  const text = `${input.purpose || ""} ${input.interests || ""}`.toLowerCase();
  if (/business/.test(text)) add("business");
  if (/celebration/.test(text)) add("celebration");
  return kits;
}

export function syncActivityInput(input: any, ids?: ActivityId[]) {
  const activities = ids || resolveActivities(input);
  const mapped = presetsFromActivities(activities);
  const extra = (input?.presets || []).filter((p: string) => !PRESET_TO_ACTIVITY[p] && !mapped.includes(p));
  return { ...input, activities, presets: [...mapped, ...extra] };
}

export function hasActivity(input: any, id: ActivityId) {
  return resolveActivities(input).includes(id);
}

const CAR_FREE = /\b(zermatt|wengen|mürren|murren|saas-?fee|gimmelwald|braunwald|stoos|bettmeralp|riederalp|venice|venezia|giethoorn|mackinac|hydra|sark|lamu|avoriaz)\b/i;
export const isCarFreePlace = (place: { name?: string } | string | undefined) => CAR_FREE.test(typeof place === "string" ? place : place?.name || "");

/** Skip unrealistic car day trips when flying, or at car-free towns. */
export function isRealisticDayTrip(h: { dayTrip?: boolean; driveMin?: number; distanceKm?: number; name?: string; type?: string }, input: any, dest?: { name?: string; countryCode?: string }) {
  if (!h?.dayTrip && h.driveMin == null && h.distanceKm == null) return true;
  const mins = h.driveMin ?? (h.distanceKm != null ? Math.round(h.distanceKm * 1.4) : 0);
  const driving = input?.travelMode === "driving";
  if (isCarFreePlace(dest) && mins > 25) return false;
  if (!driving && mins > 40) return false;
  return true;
}

export type FitCtx = { avgHigh?: number; minLow?: number; snowy?: boolean; rainyShare?: number; placeName?: string };
/** Client-side `{t:N}` placeholders convert to °C or °F from the user's unit setting. */
export const fitTemp = (c: number) => `{t:${Math.round(c)}}`;

export function fitContextFromWeather(w: any, placeName?: string): FitCtx {
  const days = w?.days || [];
  const snowy = days.some((d: any) => { const k = precipKind(d); return k === "snow" || k === "mixed"; }) || (w?.stats?.snowDays > 0);
  const rainyShare = days.length ? days.filter((d: any) => isRainy(d)).length / days.length : 0;
  return { avgHigh: w?.stats?.avgHigh, minLow: w?.stats?.minLow, snowy, rainyShare, placeName };
}

/** Selected activities that fit this destination and season (all of them when no weather is available). */
export function suitableActivities(input: any, w?: any, placeName?: string): ActivityId[] {
  const ids = resolveActivities(input);
  if (!w?.stats && !w?.days) return ids;
  const ctx = fitContextFromWeather(w, placeName);
  return ids.filter(id => activityFit(id, ctx).ok);
}

export function activityFit(id: ActivityId, ctx: FitCtx): { ok: boolean; note?: string } {
  const name = ctx.placeName || "this destination";
  const high = ctx.avgHigh;
  const low = ctx.minLow;
  if (id === "ski") {
    if (ctx.snowy || (low != null && low <= 2) || (high != null && high <= 8)) return { ok: true };
    return { ok: false, note: `Skiing & snowboarding usually isn't possible in ${name} in this season${high != null ? ` (highs around ${fitTemp(high)})` : ""}. We didn't add ski days — turn the activity off if you don't need the packing list.` };
  }
  if (id === "beach" || id === "surf" || id === "dive") {
    if (high != null && high < 18) return { ok: false, note: `${ACTIVITY_BY_ID[id].label} is a stretch in ${name} with highs around ${fitTemp(high)} — we didn't schedule it as a main outing.` };
    return { ok: true };
  }
  if (id === "golf" && high != null && high < 8) return { ok: false, note: `Golf is likely off-season in ${name} in this weather. We didn't schedule a tee time.` };
  if (id === "parks" && high != null && high < 12) return { ok: false, note: `Outdoor theme or water parks may be closed or chilly in ${name} this season.` };
  return { ok: true };
}

export function weatherAllows(id: ActivityId, day: { tmax?: number; tmin?: number; precipProb?: number | null; precipMm?: number; typical?: boolean; summary?: string; snowCm?: number | null; code?: number | null }, kind?: string) {
  const def = ACTIVITY_BY_ID[id];
  if (!def) return true;
  const rain = kind === "rain";
  const snow = kind === "snow" || kind === "mixed";
  const tmax = day.tmax ?? 20;
  if (def.weather === "warm-dry") return !rain && tmax >= 18;
  if (def.weather === "dry-mild") return !rain;
  if (def.weather === "not-rain") return !rain;
  if (def.weather === "snow-ok") return true;
  if (def.weather === "evening") return true;
  return true;
}

export function packingItemsForActivity(def: ActivityDef, ctx: { driving: boolean; snow: boolean; warm: boolean; cycle: number }): ActivityPackItem[] {
  return def.packing.filter(it => {
    const f = new Set(it.flags || []);
    if (f.has("drivingOnly") && !ctx.driving) return false;
    if (f.has("warm") && !ctx.warm) return false;
    if (f.has("snow") && !ctx.snow) return false;
    if (f.has("notSnow") && ctx.snow) return false;
    return true;
  }).map(it => {
    const flags = new Set(it.flags || []);
    if (flags.has("rentIfFlying") && !ctx.driving) {
      return { ...it, reason: `${it.reason} · flying: plan to rent locally rather than pack bulky gear` };
    }
    return it;
  });
}


/** Famous alpine climbs, high huts and summit-class terrain — not a rest-day outing. */
export function isSeriousPeak(h: { name?: string; type?: string; description?: string; ski?: boolean }) {
  if (h.ski) return false;
  const name = h.name || "";
  const typ = `${h.type || ""} ${h.description || ""}`;
  if (/\b(museum|gallery|viewpoint|lake|village|cable|gondola|funicular|bahn|church|chapel|spa)\b/i.test(`${name} ${typ}`) && !/\b(peak|summit)\b/i.test(typ)) return false;
  if (/\b(peak|summit|four-?thousander)\b/i.test(typ)) return true;
  if (/\b(matterhorn|breithorn|zinalrothorn|gabelhorn|weisshorn|dent blanche|monte rosa|mont rosa|liskamm|lyskamm|t[äa]schhorn|castor|pollux|h[öo]rnli|monte rosa hut|riffelhorn)\b/i.test(name)) return true;
  if (/\b\w+horn\b/i.test(name) && !/\b(museum|gallery|church|village|lake|restaurant|hotel|bar)\b/i.test(`${name} ${typ}`)) return true;
  if (/\b(hut|hütte|refuge|cabane)\b/i.test(name) && /alpin|mountain|glacier|hut/i.test(`${name} ${typ}`)) return true;
  return false;
}

/** In-town or lift-accessible rest-day sights (museums, viewpoints, lakes, villages, cable cars). */
export function isRestDayFriendly(h: { name?: string; type?: string; description?: string; indoor?: boolean; setting?: string; ski?: boolean }) {
  if (h.ski || isSeriousPeak(h) || isAdminOrReligiousOrg(h)) return false;
  const blob = `${h.name || ""} ${h.type || ""} ${h.description || ""}`;
  return h.indoor === true || h.setting === "indoor"
    || /\b(museum|gallery|viewpoint|lake|village|old town|church|chapel|cable|gondola|funicular|bahn|garden|spa|shop|market|promenade|square|plaza|railway|train)\b/i.test(blob);
}

/** A real swimming beach, not a waterfront, harbour or generic bay highlight. */
export function isRealBeach(h: { name?: string; type?: string; activity?: string; description?: string }) {
  if (/\b(waterfront|harbour|harbor|marina|promenade|v\s*&\s*a|victoria\s*&\s*alfred)\b/i.test(h.name || "")) return false;
  if (h.activity === "beach" || h.activity === "surf") return true;
  const typ = (h.type || "").toLowerCase().replace(/_/g, " ");
  if (/(^|\b|,\s*)beach(\b|,|$)/.test(typ) && !/waterfront/.test(typ)) return true;
  if (/\bbeach(es)?\b/i.test(h.name || "") && !/waterfront/i.test(h.name || "")) return true;
  return false;
}

const SKI_SECTOR = /\b(ski\s*(area|resort)|glacier paradise|gornergrat|sunnegga|blauherd|theodul|trockener steg|klein matterhorn|schwarzsee|schwarzee|unterrothorn|riffelalp|findeln|rothorn)\b/i;
export function isSkiSector(h: { name?: string; ski?: boolean }) {
  if (h.ski) return true;
  if (isSeriousPeak(h as any)) return false;
  return SKI_SECTOR.test(h.name || "");
}

/** Dioceses, bishoprics and other administrative or religious organizations — not visitor sights. */
export function isAdminOrReligiousOrg(h: { name?: string; type?: string; description?: string }) {
  const name = h.name || "";
  const blob = `${name} ${h.type || ""} ${h.description || ""}`;
  if (/\b(cathedral|basilica|church|chapel|abbey|mosque|synagogue|temple|shrine|monastery)\b/i.test(name) && !/\b(diocese|archdiocese|bishopric)\b/i.test(name)) return false;
  return /\b(diocese|archdiocese|archbishopric|bishopric|vicariate|eparchy|synod|deanery|curia|episcopal see)\b/i.test(blob)
    || /\b(religious (organization|organisation|order|administration)|administrative (territorial )?entity|civil parish|municipality of|government agency)\b/i.test(blob);
}

/** Drop raw OSM suffixes such as "decauville" from venue and ski-sector names. */
export function cleanVenueName(name: string) {
  return (name || "")
    .replace(/\bdecauville\b/ig, "")
    .replace(/\s*[–—-]\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
