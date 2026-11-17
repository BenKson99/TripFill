const MAJOR_PARK = /\b(epcot|magic kingdom|animal kingdom|hollywood studios|islands of adventure|universal studios|universal orlando|disneyland|disney\s*world|disney'?s?\s+(?:hollywood|animal|magic|california|typhoon|blizzard)|seaworld|busch gardens|legoland|six flags|cedar point|knott'?s|hersheypark|theme park|amusement park|water park|wet\s*['’]?n['’]?\s*wild|aquatica|volcano bay|typhoon lagoon|blizzard beach|discovery cove|funway|safari park)\b/i;

const BRANDS: { id: string; test: RegExp; name: RegExp }[] = [
  { id: "disney", test: /\bdisney/i, name: /\b(disney|epcot|magic kingdom|animal kingdom|hollywood studios|typhoon lagoon|blizzard beach|disney\s*springs)\b/i },
  { id: "universal", test: /\buniversal\b/i, name: /\b(universal|islands of adventure|volcano bay|epic universe)\b/i },
  { id: "seaworld", test: /\bsea\s*world\b/i, name: /\b(seaworld|discovery cove|aquatica)\b/i },
  { id: "legoland", test: /\blegoland\b/i, name: /\blegoland\b/i },
];

export function isMajorAttraction(h: { name?: string; type?: string; description?: string } | string): boolean {
  const blob = typeof h === "string" ? h : `${h.name || ""} ${h.type || ""} ${h.description || ""}`;
  return MAJOR_PARK.test(blob);
}

export function interestBrands(interests = ""): string[] {
  return BRANDS.filter(b => b.test.test(interests)).map(b => b.id);
}

export function matchesBrand(name: string, brand: string): boolean {
  const b = BRANDS.find(x => x.id === brand);
  return !!b && b.name.test(name);
}

/** True when this is a competitor park and at least one preferred-brand park is still unused. */
export function isCompetitorPark(name: string, interests: string, unusedPreferred: { name: string }[]): boolean {
  const brands = interestBrands(interests);
  if (!brands.length || !isMajorAttraction(name)) return false;
  if (brands.some(b => matchesBrand(name, b))) return false;
  return unusedPreferred.some(h => brands.some(b => matchesBrand(h.name, b)));
}

function looksLikeChild(m: any): boolean {
  return !!m && (m.child === true || m.profile === "girl" || m.profile === "boy" || m.profile === "infant");
}

export function tripHasKids(input?: any, members?: any[]): boolean {
  const list = members || input?.members || [];
  if (Array.isArray(list) && list.some(looksLikeChild)) return true;
  if ((input?.presets || []).includes("kids")) return true;
  if ((input?.activities || []).includes("family")) return true;
  if (/^family$/i.test(input?.purpose || "")) return true;
  if (Array.isArray(list) && list.some(m => Number.isFinite(m?.age) && m.age <= 17)) return true;
  return false;
}

/** Ages of travelers who look like children. */
export function childAges(input?: any, members?: any[]): number[] {
  const list = members || input?.members || [];
  return (Array.isArray(list) ? list : []).filter(looksLikeChild).map(m => Number(m.age)).filter(n => Number.isFinite(n) && n >= 0);
}

export function hasChildUnder(maxAge: number, input?: any, members?: any[]): boolean {
  const list = members || input?.members || [];
  if (Array.isArray(list) && list.some(m => m?.profile === "infant") && maxAge > 1) return true;
  return childAges(input, members).some(a => a < maxAge);
}

export const HOT_HIKE_C = 32.2; // 90°F

export function isHotDay(d?: { tmax?: number | null } | null, threshold = HOT_HIKE_C): boolean {
  return d != null && Number.isFinite(d.tmax) && (d.tmax as number) >= threshold;
}

export function isCanyonOrCliff(dest?: { name?: string; type?: string } | string): boolean {
  const t = typeof dest === "string" ? dest : `${dest?.name || ""} ${dest?.type || ""}`;
  return /canyon|cliff|gorge|rim|overlook|precipice/i.test(t);
}

export function isNatureDestination(dest?: { name?: string; type?: string; featureCode?: string } | string): boolean {
  const t = typeof dest === "string" ? dest : `${dest?.name || ""} ${dest?.type || ""} ${dest?.featureCode || ""}`;
  return /national park|nature|forest|wilderness|reserve|monument|canyon|cape|reef|safari|wildlife|state park|^PRK$|recreation area/i.test(t);
}

export const HEAT_HIKE_NOTE = "Hot! Walk early or late, rest in shade midday, bring lots of water";
export const CLIFF_NOTE = "Stay behind railings and hold little hands near the edge";
export const EASY_RIM_WALK = "🥾 Short rim or easy walk — keep it short, go early or late";
export const EASY_RIM_AFTERNOON = "Rest in the shade midday; another short easy walk if it's cooler";

export function shouldEaseHikes(input: any, weather?: { days?: { tmax?: number | null }[]; stats?: { avgHigh?: number } }): boolean {
  if (hasChildUnder(6, input)) return true;
  if ((weather?.stats?.avgHigh ?? 0) >= HOT_HIKE_C) return true;
  return (weather?.days || []).some(d => isHotDay(d));
}

export function softenHikesForKidsAndHeat<T extends { date?: string; morning: string; afternoon: string; notes?: string }>(
  days: T[],
  input: any,
  weather?: { days?: { date?: string; tmax?: number | null }[]; stats?: { avgHigh?: number } },
  destName?: string,
): T[] {
  if (!days?.length) return days;
  const ease = shouldEaseHikes(input, weather);
  const canyon = isCanyonOrCliff(destName || input?.destination);
  for (const d of days) {
    const wx = (weather?.days || []).find(x => x.date && d.date && x.date === d.date);
    const hot = isHotDay(wx) || (weather?.stats?.avgHigh ?? 0) >= HOT_HIKE_C;
    if (ease) {
      if (/Day hike|Hike continues/i.test(d.morning || "")) d.morning = EASY_RIM_WALK;
      if (/Day hike|Hike continues/i.test(d.afternoon || "")) d.afternoon = EASY_RIM_AFTERNOON;
    }
    const extra: string[] = [];
    if (hot || (ease && /rim or easy walk|hike|trail|canyon/i.test(`${d.morning} ${d.afternoon}`))) extra.push(HEAT_HIKE_NOTE);
    if (canyon) extra.push(CLIFF_NOTE);
    for (const n of extra) {
      if (n && !(d.notes || "").includes(n)) d.notes = [d.notes, n].filter(Boolean).join(" · ");
    }
  }
  return days;
}

export function sunsetViewpointLine(highlights: { name?: string; type?: string; description?: string }[] = []): string {
  const v = highlights.find(h => /viewpoint|overlook|lookout|sunset|rim point|mather point|yavapai|hopi point|desert view/i.test(`${h.name || ""} ${h.type || ""} ${h.description || ""}`));
  return v?.name ? `Sunset at ${v.name}` : "Sunset at a viewpoint";
}

export function isUsThanksgiving(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  if (m !== 11 || !y || !d) return false;
  // Fourth Thursday in November.
  const first = new Date(Date.UTC(y, 10, 1));
  const firstThu = 1 + ((11 - first.getUTCDay()) % 7);
  return d === firstThu + 21;
}

export function holidayNote(iso: string, countryCode?: string): string | undefined {
  const [, mo, d] = (iso || "").split("-").map(Number);
  if ((mo === 12 && (d === 24 || d === 25 || d === 31)) || (mo === 1 && d === 1)) {
    return "Holiday — check opening hours & book ahead";
  }
  const cc = (countryCode || "").toUpperCase();
  if ((cc === "US" || cc === "UM" || !cc) && isUsThanksgiving(iso)) {
    return "Holiday — check opening hours & book ahead";
  }
  return undefined;
}

const GROWN_UP_PACKING = /passport|photo id|licence|license|vehicle documents|insurance|bookings? & tickets|house keys|medicines?|medication|health supplies|feeding supplies|cash|payment card|thermostat|car emergency|driving|plug adapter|voltage/i;
const GROWN_UP_TASKS = /passport|visa|entry rules|insurance|bank|card issuer|roaming|esim|car:|tyres|tires|fluids|papers|parking|tolls|hold mail|thermostat|lock up|plant & pet|empty the fridge|bookings?|documents|medicines?|feeding|photo id|online check-in|plug adapter|voltage|grown-up task|check voltage|confirm id|forecast|packing list|trail conditions|hut reservations|finalize packing|finalise packing/i;

export function isGrownUpPackingItem(name: string): boolean {
  return GROWN_UP_PACKING.test(name || "");
}

export function isGrownUpTask(task: string): boolean {
  return GROWN_UP_TASKS.test(task || "");
}

export const GROWN_UP_LABEL = "🧑 Grown-up task";

export function farDayTrip(h: { dayTrip?: boolean; driveMin?: number; distanceKm?: number } | null | undefined): boolean {
  if (!h) return false;
  if (h.driveMin != null) return h.driveMin > 60;
  if (h.distanceKm != null) return h.distanceKm > 40;
  return !!h.dayTrip;
}

export const KIDS_DRIVE_DAY = "Drive day: break every 2 hours; check in & rest";

/** Split a long overnight drive into two legs, rounding so the first is the shorter whole hour. */
export function overnightDriveHours(driveMin: number): { firstH: number; secondH: number } {
  const total = Math.max(1, Number(driveMin) / 60);
  const firstH = Math.max(1, Math.floor(total / 2));
  const secondH = Math.max(1, Math.round(total - firstH));
  return { firstH, secondH };
}
export function overnightStopName(stop?: string | null): string {
  const s = (stop || "").trim();
  return s && s !== "a town around the midpoint" ? s : "a midpoint town";
}
export function overnightDay1Morning(stop: string | null | undefined, driveMin: number): string {
  const { firstH } = overnightDriveHours(driveMin);
  return `Drive day — about ${firstH} h to ${overnightStopName(stop)}; overnight there`;
}
export function overnightDay2Morning(driveMin: number): string {
  const { secondH } = overnightDriveHours(driveMin);
  return `Finish the drive (~${secondH} h) and check in`;
}
/** Arrive/depart days, long drive days, and the morning after an overnight midpoint. */
export function isTravelOrLeaveDay(d: { label?: string; morning?: string } | string): boolean {
  const text = typeof d === "string" ? d : `${d.label || ""} ${d.morning || ""}`;
  return /Arrive|Depart|Finish the drive|Drive day|Fly overnight|land the next morning|Get outside in daylight/i.test(text);
}

/** Eastbound long-haul overnight flight: 6h+ in the air and the destination is 4h or more ahead. */
export function isOvernightFlight(opts: { travelMode?: string; domestic?: boolean; flightHours?: number | null; tzDiffHours?: number | null } = {}): boolean {
  if ((opts.travelMode || "flying") !== "flying" || opts.domestic) return false;
  return (opts.flightHours || 0) >= 6 && (opts.tzDiffHours || 0) >= 4;
}

export function jetLagNote(placeName: string | undefined, tzDiffHours: number | null | undefined): string | undefined {
  if (tzDiffHours == null || Math.abs(tzDiffHours) < 4) return undefined;
  const abs = Math.abs(tzDiffHours);
  const n = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace(/\.0$/, "");
  const name = (placeName || "Your destination").trim() || "Your destination";
  return `${name} is ${n} hours ${tzDiffHours > 0 ? "ahead" : "behind"} — you'll feel sleepy at odd times for a day or two`;
}

export const OVERNIGHT_FLY_DAY1 = "Fly overnight — you land the next morning";
export const OVERNIGHT_FLY_DAY2 = "Get outside in daylight, early bedtime";


export const KIDS_POOL_REST = "🏊 Hotel pool or a quiet rest at the hotel";

function stripAlsoNearbyMajor(text: string): string {
  return (text || "").replace(/\s*Also nearby: [\s\S]*$/i, "").trim();
}

/** One major attraction per mid-trip day; afternoon becomes pool/rest if a second major slipped in. */
export function paceItineraryForKids<T extends { morning: string; afternoon: string; evening?: string; notes?: string; label?: string }>(days: T[], input: any): T[] {
  if (!tripHasKids(input) || !days?.length) return days;
  for (const d of days) {
    if (isTravelOrLeaveDay(d)) continue;
    d.afternoon = stripAlsoNearbyMajor(d.afternoon || "");
    const morningMajor = isMajorAttraction(d.morning || "");
    const afternoonMajor = isMajorAttraction(d.afternoon || "");
    const generic = !d.afternoon || /^(Explore a market|Long lunch|Free morning|Easy walk)/i.test(d.afternoon);
    if (morningMajor && (afternoonMajor || generic || /Also nearby:/i.test(d.afternoon || ""))) d.afternoon = KIDS_POOL_REST;
    if (d.evening && !/early dinner/i.test(d.evening)) d.evening = d.evening.replace(/^Dinner:/, "Early dinner:");
    if (!/one main (sight|attraction)/i.test(d.notes || "")) {
      d.notes = d.notes ? `${d.notes} · with kids — one main attraction per day` : "with kids — one main attraction per day";
    }
  }
  const parkDay = days.find(d => isMajorAttraction(`${d.morning} ${d.afternoon}`) && !isTravelOrLeaveDay(d));
  if (parkDay && !/height limits/i.test(days.map(d => d.notes || "").join(" "))) {
    parkDay.notes = parkDay.notes ? `${parkDay.notes} · Some rides have height limits — check with a grown-up` : "Some rides have height limits — check with a grown-up";
  }
  return days;
}

export function applyHolidayNotes<T extends { date: string; notes?: string }>(days: T[], countryCode?: string): T[] {
  for (const d of days) {
    const note = holidayNote(d.date, countryCode);
    if (note && !(d.notes || "").includes("Holiday —")) {
      d.notes = d.notes ? `${d.notes} · ${note}` : note;
    }
  }
  return days;
}

/** After activity scheduling, use leftover interest-matched parks before competitors or weaker fillers. */
export function fillPreferredParks<T extends { morning: string; afternoon: string; label?: string }>(days: T[], highlights: { name: string }[] = [], interests = ""): T[] {
  const brands = interestBrands(interests);
  if (!brands.length || !days?.length) return days;
  const mentioned = (d: T) => `${d.morning || ""} ${d.afternoon || ""}`;
  const used = new Set<string>();
  for (const d of days) for (const h of highlights) if (h?.name && mentioned(d).includes(h.name)) used.add(h.name);
  const leftover = highlights.filter(h => h?.name && brands.some(b => matchesBrand(h.name, b)) && !used.has(h.name));
  for (const d of days) {
    if (isTravelOrLeaveDay(d) || !leftover.length) continue;
    if (brands.some(b => matchesBrand(d.morning || "", b) || matchesBrand(d.afternoon || "", b))) continue;
    const next = leftover.shift()!;
    used.add(next.name);
    const prefix = /^[^A-Za-z0-9"]+/.exec(d.morning || "");
    d.morning = prefix ? `${prefix[0].trimEnd()} ${next.name}` : next.name;
    if (isMajorAttraction(d.afternoon || "")) d.afternoon = KIDS_POOL_REST;
  }
  return days;
}
