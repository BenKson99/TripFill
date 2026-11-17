/** Kid-friendly specifics for major US national parks, plus helpers to avoid lodging and vague destination slots. */

export type ParkSight = {
  name: string;
  description?: string;
  indoor?: boolean;
  setting?: "indoor" | "outdoor" | "mixed";
  type?: string;
};

const PARKS: { test: RegExp; sights: ParkSight[] }[] = [
  { test: /grand canyon/i, sights: [
    { name: "Walk the Rim Trail between Mather Point and Yavapai Point (flat, paved)", setting: "outdoor", type: "trail", description: "A short, paved rim walk with railings and big views." },
    { name: "Grand Canyon Visitor Center", indoor: true, setting: "indoor", type: "visitor centre", description: "Maps, restrooms, and the Junior Ranger desk." },
    { name: "Yavapai Geology Museum", indoor: true, setting: "indoor", type: "museum", description: "A small museum on the rim with window views into the canyon." },
    { name: "Mather Point", setting: "outdoor", type: "viewpoint", description: "A railed lookout a short walk from the visitor center." },
  ]},
  { test: /yellowstone/i, sights: [
    { name: "Watch Old Faithful from the boardwalk", setting: "outdoor", type: "boardwalk", description: "Stay on the boardwalk and watch from a safe distance." },
    { name: "Grand Prismatic Spring overlook", setting: "outdoor", type: "viewpoint", description: "A short walk to a colorful overlook; keep to the path." },
    { name: "Yellowstone Visitor Center", indoor: true, setting: "indoor", type: "visitor centre" },
    { name: "Junior Ranger program at the visitor center", indoor: true, setting: "indoor", type: "visitor centre" },
  ]},
  { test: /yosemite/i, sights: [
    { name: "Easy walk in Yosemite Valley (Cook's Meadow or the valley loop)", setting: "outdoor", type: "trail", description: "Flat valley paths with views of the cliffs and falls." },
    { name: "Bridalveil Fall viewpoint", setting: "outdoor", type: "viewpoint" },
    { name: "Yosemite Valley Visitor Center", indoor: true, setting: "indoor", type: "visitor centre" },
    { name: "Junior Ranger program at the visitor center", indoor: true, setting: "indoor", type: "visitor centre" },
  ]},
  { test: /\bzion\b/i, sights: [
    { name: "Riverside Walk", setting: "outdoor", type: "trail", description: "A paved, mostly flat walk along the river." },
    { name: "Zion Canyon Visitor Center", indoor: true, setting: "indoor", type: "visitor centre" },
    { name: "Junior Ranger program at the visitor center", indoor: true, setting: "indoor", type: "visitor centre" },
  ]},
  { test: /great smoky|smoky mountains/i, sights: [
    { name: "Sugarlands Visitor Center", indoor: true, setting: "indoor", type: "visitor centre" },
    { name: "Easy walk to a quiet stream or the Fighting Creek nature trail", setting: "outdoor", type: "trail" },
    { name: "Junior Ranger program at the visitor center", indoor: true, setting: "indoor", type: "visitor centre" },
  ]},
  { test: /rocky mountain/i, sights: [
    { name: "Sprague Lake easy loop", setting: "outdoor", type: "trail", description: "A flat, short loop with mountain views." },
    { name: "Rocky Mountain National Park Visitor Center", indoor: true, setting: "indoor", type: "visitor centre" },
    { name: "Junior Ranger program at the visitor center", indoor: true, setting: "indoor", type: "visitor centre" },
  ]},
  { test: /\bacadia\b/i, sights: [
    { name: "Jordan Pond path", setting: "outdoor", type: "trail", description: "A mostly easy path around the pond; skip rocky bits with little kids." },
    { name: "Sand Beach", setting: "outdoor", type: "beach" },
    { name: "Hulls Cove Visitor Center", indoor: true, setting: "indoor", type: "visitor centre" },
    { name: "Junior Ranger program at the visitor center", indoor: true, setting: "indoor", type: "visitor centre" },
  ]},
  { test: /\bolympic\b/i, sights: [
    { name: "Hurricane Ridge visitor center and short viewpoint walks", setting: "mixed", type: "visitor centre" },
    { name: "Hoh Rain Forest hall of mosses boardwalk", setting: "outdoor", type: "boardwalk" },
    { name: "Ruby Beach tide pools (stay back from big waves)", setting: "outdoor", type: "beach" },
    { name: "Junior Ranger program at the visitor center", indoor: true, setting: "indoor", type: "visitor centre" },
  ]},
  { test: /grand teton/i, sights: [
    { name: "Teton viewpoint at the Snake River overlook or Schwabacher Landing", setting: "outdoor", type: "viewpoint" },
    { name: "Jenny Lake Visitor Center", indoor: true, setting: "indoor", type: "visitor centre" },
    { name: "Colter Bay visitor plaza and easy lakeshore walk", setting: "mixed", type: "visitor centre" },
    { name: "Junior Ranger program at the visitor center", indoor: true, setting: "indoor", type: "visitor centre" },
  ]},
  { test: /\bglacier\b/i, sights: [
    { name: "Apgar Visitor Center", indoor: true, setting: "indoor", type: "visitor centre" },
    { name: "Easy walk along Lake McDonald", setting: "outdoor", type: "trail" },
    { name: "Junior Ranger program at the visitor center", indoor: true, setting: "indoor", type: "visitor centre" },
  ]},
];

export type ParkBase = { name: string; lat: number; lon: number };

/** Visitor-center / village coordinates so weather, elevation and drives use the stay area, not a canyon or park centroid. */
const PARK_BASES: { test: RegExp; north?: RegExp; base: ParkBase; northBase?: ParkBase }[] = [
  { test: /grand canyon/i, north: /north rim/i, base: { name: "Grand Canyon Village", lat: 36.0544, lon: -112.1391 }, northBase: { name: "Grand Canyon North Rim", lat: 36.197, lon: -112.052 } },
  { test: /yellowstone/i, base: { name: "Old Faithful", lat: 44.4604, lon: -110.8288 } },
  { test: /yosemite/i, base: { name: "Yosemite Valley", lat: 37.7459, lon: -119.5969 } },
  { test: /\bzion\b/i, base: { name: "Zion Canyon Visitor Center", lat: 37.2003, lon: -112.9864 } },
  { test: /great smoky|smoky mountains/i, base: { name: "Sugarlands Visitor Center", lat: 35.6853, lon: -83.5380 } },
  { test: /rocky mountain/i, base: { name: "Beaver Meadows Visitor Center", lat: 40.3653, lon: -105.5632 } },
  { test: /\bacadia\b/i, base: { name: "Hulls Cove Visitor Center", lat: 44.4163, lon: -68.2586 } },
  { test: /\bolympic\b/i, base: { name: "Hurricane Ridge Visitor Center", lat: 47.9685, lon: -123.4986 } },
  { test: /grand teton/i, base: { name: "Craig Thomas Discovery Center", lat: 43.6516, lon: -110.7317 } },
  { test: /\bglacier\b/i, base: { name: "Apgar Visitor Center", lat: 48.5293, lon: -113.9909 } },
];

export function preferredParkBase(dest?: { name?: string; admin1?: string; lat?: number; lon?: number } | string): ParkBase | undefined {
  const blob = destBlob(dest);
  const hit = PARK_BASES.find(p => p.test.test(blob));
  if (!hit) return;
  if (hit.north && hit.north.test(blob) && hit.northBase) return hit.northBase;
  return hit.base;
}

/** Known far-area names that do not belong with the resolved park base (e.g. North Rim dinners on a South Rim trip). */
export function isOffParkBase(name: string | undefined, dest?: { name?: string; admin1?: string } | string): boolean {
  const n = name || "";
  const blob = destBlob(dest);
  if (!n || !/grand canyon/i.test(blob)) return false;
  if (/north rim/i.test(blob)) {
    return /south rim|maswik|bright angel|el tovar|yavapai|mather|desert view|arizona room/i.test(n);
  }
  return /north rim|grand canyon lodge/i.test(n) && !/south rim|maswik|bright angel|el tovar|yavapai|mather|arizona room/i.test(n);
}

export function destBlob(dest?: { name?: string; admin1?: string; country?: string; countryCode?: string } | string): string {
  if (!dest) return "";
  if (typeof dest === "string") return dest;
  return `${dest.name || ""} ${dest.admin1 || ""} ${dest.country || ""} ${dest.countryCode || ""}`;
}

function norm(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** True when a scheduled name is just the trip destination, not a specific sight. */
export function isDestinationItself(name: string | undefined, dest?: { name?: string } | string): boolean {
  const n = norm(name || "");
  const d = norm(typeof dest === "string" ? dest : dest?.name || "");
  if (!n || !d) return false;
  if (n === d) return true;
  const specific = /visitor|museum|trail|point|rim|falls|fall|lodge|village|overlook|lookout|boardwalk|beach|meadow|canyon visitor|studio|watchtower|house|ranch|bridge/i.test(name || "");
  if (specific) return false;
  if (d.startsWith(n) && (d === `${n} national park` || d.startsWith(`${n} national `) || d === `${n} park`)) return true;
  if (n.startsWith(d) && !specific && n.length - d.length < 18) return n === `${d} national park` || n === d;
  return false;
}

/** Lodging, campsites and hotels should not fill activity slots (dinners are fine). */
export function isLodgingOrStay(h: { name?: string; type?: string; description?: string } | string): boolean {
  const blob = typeof h === "string" ? h : `${h.name || ""} ${h.type || ""} ${h.description || ""}`;
  if (/dining room|restaurant|cafe|café|pizza|tavern|pub|bar\b/i.test(blob) && !/camp/i.test(blob)) return false;
  if (/\bski(?:ing)?\s+(area|resort|field|station)|\bpiste\b|\bslopes\b/i.test(blob)) return false;
  return /\b(hotel|motel|hostel|inn|resort|guest\s*house|bed and breakfast|\bb&b\b|campground|campsite|camp site|tourism=camp_site|your campsite|set up at your campsite|camp at )\b/i.test(blob)
    || /\b(maswik|kashina|thunderbird|bright angel)?\s*lodge\b/i.test(blob);
}

/** Vague ensemble or “the park itself” names, when a more specific alternative exists. */
export function isVagueSight(h: { name?: string; type?: string; description?: string } | string): boolean {
  const blob = typeof h === "string" ? h : `${h.name || ""} ${h.type || ""}`;
  return /architectural ensemble|historic district|\bbuildings$/i.test(blob)
    || /^(the )?(national park|park itself)$/i.test((typeof h === "string" ? h : h.name || "").trim());
}

export function curatedParkSights(dest?: { name?: string; admin1?: string } | string): ParkSight[] {
  const blob = destBlob(dest);
  const hit = PARKS.find(p => p.test.test(blob));
  return hit ? hit.sights.map(s => ({ ...s })) : [];
}

export function visitorCenterName(highlights: { name?: string; type?: string; description?: string }[] = [], dest?: { name?: string } | string): string | undefined {
  const fromHl = highlights.find(h => /visitor (?:centre|center)/i.test(`${h.name || ""} ${h.type || ""} ${h.description || ""}`) && h.name);
  if (fromHl?.name) return fromHl.name;
  const curated = curatedParkSights(dest).find(s => /visitor (?:centre|center)/i.test(s.name) && !/junior ranger/i.test(s.name));
  return curated?.name;
}

export const NEAR_BASE_MI = 40;
export const NEAR_BASE_KM = NEAR_BASE_MI * 1.609344;
export const NEAR_BASE_MIN = 90;
export const NEAR_BASE_MIN_YOUNG = 60;

/** Keep scheduled days and dinners near the resolved base (≈40 mi, or ≈1 h with small kids). */
export function isNearBase(h: { driveMin?: number; distanceKm?: number; km?: number } | null | undefined, opts: { smallChild?: boolean } = {}): boolean {
  if (!h) return true;
  const capMin = opts.smallChild ? NEAR_BASE_MIN_YOUNG : NEAR_BASE_MIN;
  if (h.driveMin != null && Number.isFinite(h.driveMin)) return h.driveMin <= capMin;
  const km = h.distanceKm ?? h.km;
  if (km != null && Number.isFinite(km)) return km <= NEAR_BASE_KM;
  return true;
}

export function isHikeInOrInnerCanyon(h: { name?: string; type?: string; description?: string } | string): boolean {
  const blob = typeof h === "string" ? h : `${h.name || ""} ${h.type || ""} ${h.description || ""}`;
  return /phantom ranch|inner canyon|canyon floor|bottom of (the )?canyon|hike-?in only|hike-?in\b|indian garden|plateau point trail to the river/i.test(blob);
}

export function campsiteSetupLine(highlights: { name?: string; type?: string; description?: string }[] = [], interests = ""): string | undefined {
  if (!/camping|campsite|campground/i.test(interests || "")) return;
  const named = highlights.find(h => /camp_?site|campground|camp site/i.test(`${h.name || ""} ${h.type || ""} ${h.description || ""}`) && h.name && !isDestinationItself(h.name));
  return named?.name ? `Set up at ${named.name}` : "Set up at your campsite";
}
