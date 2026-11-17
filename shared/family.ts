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

const FULL_OR_HALF_DAY = /warner\s*bros|studio tour|wizarding world|legoland|windsor castle|theme park|amusement park|water park|universal studios|magic kingdom|epcot|animal kingdom|hollywood studios|disneyland|disney\s*world|seaworld|busch gardens|islands of adventure|volcano bay|aquatica|safari park|chich[eé]n\s*itz[aá]|tulum archaeological/i;
const BIG_SIGHT = /tower of london|buckingham palace|kensington palace|palace of whitehall|british museum|natural history museum|science museum|victoria and albert|\bv&a\b|national gallery|tate modern|tate britain|westminster abbey|st paul'?s cathedral|madame tussauds|london eye|the shard|colosseum|eiffel|louvre|notre-?dame|statue of liberty|met(?:ropolitan)? museum|smithsonian|\bcastles?\b|\bpalaces?\b|cathedral|acropolis/i;
const LIGHT_ACTIVITY = /platform\s*9|double-?decker|hop-?on hop-?off|playground|play park|hyde park|st\.? james'?s? park|green park|regent'?s park|kensington gardens|short (?:rim |easy )?walk|rim trail|easy walk|market|ice cream|picnic|hotel pool|quiet rest|rest in the shade|set up at (?:your )?camp|sunset at|tower bridge|garden walk|nature trail|boardwalk|tide pools?|paved/i;
const REST_SLOT = /hotel pool|quiet rest|rest in the shade|long lunch|downtime|check in & rest|keep today light/i;

export function slotText(text?: string): string {
  return (text || "").replace(/^[\s\W]*(?:then\s+)?/i, "").trim();
}

export function isFullOrHalfDayAttraction(text?: string): boolean {
  const t = slotText(text);
  return !!t && (FULL_OR_HALF_DAY.test(t) || isMajorAttraction(t));
}

export function isBigSight(text?: string): boolean {
  const t = slotText(text);
  if (!t) return false;
  if (isFullOrHalfDayAttraction(t)) return true;
  if (LIGHT_ACTIVITY.test(t) && !BIG_SIGHT.test(t)) return false;
  return BIG_SIGHT.test(t);
}

export function isLightActivity(text?: string): boolean {
  const t = slotText(text);
  if (!t) return false;
  if (isFullOrHalfDayAttraction(t)) return false;
  if (isBigSight(t) && !LIGHT_ACTIVITY.test(t)) return false;
  return LIGHT_ACTIVITY.test(t) || REST_SLOT.test(t);
}

export function isRestSlot(text?: string): boolean {
  return REST_SLOT.test(slotText(text));
}

export function splitAddOns(text?: string): string[] {
  return (text || "").split(/\s*;\s*then\s+|\s*→\s*/i).map(s => s.trim()).filter(Boolean);
}

export function joinAddOns(parts: string[]): string {
  const clean = parts.map(s => s.trim()).filter(Boolean);
  if (!clean.length) return "";
  return clean.slice(1).reduce((s, p) => `${s}; then ${p}`, clean[0]);
}

export const HIGH_ALT_FT = 6500;

export function elevationFeet(elevationM?: number | null): number | undefined {
  if (elevationM == null || !Number.isFinite(elevationM)) return;
  return elevationM * 3.28084;
}

export function altitudeNote(elevationM?: number | null): string | undefined {
  const ft = elevationFeet(elevationM);
  if (ft == null || ft < HIGH_ALT_FT) return;
  const rounded = Math.max(HIGH_ALT_FT, Math.round(ft / 500) * 500);
  return `You're up high (~${rounded.toLocaleString("en-US")} ft) — drink extra water and take it slow the first day`;
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
  const scored = highlights.map(h => {
    const name = h.name || "";
    const blob = `${name} ${h.type || ""} ${h.description || ""}`;
    if (!/viewpoint|overlook|lookout|sunset|rim point|mather point|yavapai|hopi point|desert view/i.test(blob)) return { h, s: -1 };
    let s = 0;
    if (/\b(point|overlook|lookout)\b/i.test(name)) s += 6;
    if (/\bviewpoint\b/i.test(h.type || "")) s += 4;
    if (/mather point|hopi point|yavapai point|desert view/i.test(name)) s += 4;
    if (/sunset/i.test(blob)) s += 2;
    if (/museum|visitor|studio|geology/i.test(blob) && !/\b(point|overlook|lookout)\b/i.test(name)) s -= 8;
    return { h, s };
  }).filter(x => x.s >= 0).sort((a, b) => b.s - a.s);
  const v = scored[0]?.h;
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

function kidPaceNote(d: { morning: string; afternoon: string }): string {
  const parts = splitAddOns(d.afternoon);
  const lightAfternoon = !d.afternoon || isRestSlot(d.afternoon) || (parts.length <= 1 && isLightActivity(d.afternoon));
  if (isFullOrHalfDayAttraction(d.morning) && isRestSlot(d.afternoon)) return "with kids — one main attraction per day";
  if (isFullOrHalfDayAttraction(d.morning) && lightAfternoon) return "with kids — a half-day outing and a light afternoon";
  if (isBigSight(d.morning) && isRestSlot(d.afternoon)) return "with kids — one main attraction per day";
  if (isBigSight(d.morning) && lightAfternoon) return "with kids — one main attraction and a short add-on";
  if (isBigSight(d.morning) && !isBigSight(d.afternoon)) return "with kids — a big sight and something lighter in the afternoon";
  return "with kids — keep the day light";
}

function replaceKidNote(notes: string | undefined, line: string): string {
  const cleaned = (notes || "").replace(/\s*·\s*with kids — [^·]+/g, "").replace(/^with kids — [^·]+(?:\s*·\s*)?/i, "").trim();
  return cleaned ? `${cleaned} · ${line}` : line;
}

function outdoorLightFrom(highlights: { name?: string; type?: string; description?: string; setting?: string }[], used: Set<string>): string | undefined {
  const hit = highlights.find(h => {
    if (!h.name || used.has(h.name.toLowerCase())) return false;
    const blob = `${h.name} ${h.type || ""} ${h.description || ""}`;
    return /playground|play park|\bpark\b|garden|green|meadow|boardwalk|paved|viewpoint|rim trail/i.test(blob) && !/national park$|bar|nightclub/i.test(blob);
  });
  return hit?.name;
}

/** Pace family days: one full/half-day outing plus rest or a single light add-on; spread extras. */
export function paceItineraryForKids<T extends { morning: string; afternoon: string; evening?: string; notes?: string; label?: string }>(
  days: T[],
  input: any,
  highlights: { name?: string; type?: string; description?: string; setting?: string }[] = [],
): T[] {
  if (!tripHasKids(input) || !days?.length) return days;
  const young = hasChildUnder(8, input);
  const maxAddOns = young ? 1 : 2;
  const leftover: string[] = [];
  const used = new Set<string>();
  const remember = (text?: string) => {
    for (const p of splitAddOns(text)) {
      const n = slotText(p);
      if (n) used.add(n.toLowerCase());
    }
  };

  for (const d of days) {
    if (isTravelOrLeaveDay(d)) continue;
    d.afternoon = stripAlsoNearbyMajor(d.afternoon || "");
    const parts = splitAddOns(d.afternoon);
    const heavyMorning = isFullOrHalfDayAttraction(d.morning);
    if (heavyMorning) {
      const filler = (p: string) => /Explore a market|Long lunch|Free morning|Easy walk around|local street/i.test(p);
      if (isMajorAttraction(d.morning)) {
        leftover.push(...parts.filter(p => !isRestSlot(p) && !filler(p)));
        d.afternoon = KIDS_POOL_REST;
      } else {
        const lights = parts.filter(p => isLightActivity(p) && !isBigSight(p) && !filler(p));
        const keep = lights.slice(0, 1);
        leftover.push(...lights.slice(1), ...parts.filter(p => !keep.includes(p) && !isRestSlot(p) && !isLightActivity(p) && !filler(p)));
        d.afternoon = keep[0] || KIDS_POOL_REST;
      }
    } else if (young && isBigSight(d.morning) && (isBigSight(d.afternoon) || parts.some(p => isBigSight(p)))) {
      leftover.push(...parts.filter(p => isBigSight(p) || isFullOrHalfDayAttraction(p)));
      const light = parts.find(p => isLightActivity(p) && !isBigSight(p)) || outdoorLightFrom(highlights, used);
      d.afternoon = light || KIDS_POOL_REST;
    } else if (parts.length > maxAddOns) {
      d.afternoon = joinAddOns(parts.slice(0, maxAddOns));
      leftover.push(...parts.slice(maxAddOns));
    }
    if (d.evening && !/early dinner/i.test(d.evening)) d.evening = d.evening.replace(/^Dinner:/, "Early dinner:");
    remember(d.morning);
    remember(d.afternoon);
  }

  const uniqueLeft = leftover.filter((p, i, arr) => isLightActivity(p) && arr.findIndex(x => x.toLowerCase() === p.toLowerCase()) === i && !used.has(slotText(p).toLowerCase()));
  for (const item of uniqueLeft) {
    const host = days.find(d => {
      if (isTravelOrLeaveDay(d)) return false;
      if (isFullOrHalfDayAttraction(d.morning)) return false;
      const parts = splitAddOns(d.afternoon);
      const extras = Math.max(0, parts.length - (d.afternoon ? 1 : 0));
      if (extras >= maxAddOns) return false;
      if (isBigSight(d.afternoon) && young) return false;
      return isRestSlot(d.afternoon) || isLightActivity(d.afternoon) || !d.afternoon || /Explore a market|Long lunch|Free morning|Easy walk/i.test(d.afternoon);
    });
    if (!host) break;
    if (!host.afternoon || isRestSlot(host.afternoon) || /Explore a market|Long lunch|Free morning|Easy walk/i.test(host.afternoon)) host.afternoon = item;
    else host.afternoon = joinAddOns([...splitAddOns(host.afternoon), item].slice(0, maxAddOns));
    used.add(slotText(item).toLowerCase());
  }

  for (const d of days) {
    if (isTravelOrLeaveDay(d)) continue;
    d.notes = replaceKidNote(d.notes, kidPaceNote(d));
  }
  const parkDay = days.find(d => isMajorAttraction(`${d.morning} ${d.afternoon}`) && !isTravelOrLeaveDay(d));
  if (parkDay && !/height limits/i.test(days.map(d => d.notes || "").join(" "))) {
    parkDay.notes = parkDay.notes ? `${parkDay.notes} · Some rides have height limits — check with a grown-up` : "Some rides have height limits — check with a grown-up";
  }
  return days;
}

/** Refresh kid-pacing notes after later passes may have changed a day's slots. */
export function applyKidPaceNotes<T extends { morning: string; afternoon: string; notes?: string; label?: string }>(days: T[], input: any, highlights: { name?: string; type?: string; description?: string; setting?: string }[] = []): T[] {
  if (!tripHasKids(input) || !days?.length) return days;
  const young = hasChildUnder(8, input);
  const used = new Set<string>();
  for (const d of days) for (const p of [...splitAddOns(d.morning), ...splitAddOns(d.afternoon)]) if (p) used.add(slotText(p).toLowerCase());
  for (const d of days) {
    if (isTravelOrLeaveDay(d)) continue;
    if (young && isBigSight(d.morning) && isBigSight(d.afternoon) && !isLightActivity(d.afternoon)) {
      d.afternoon = outdoorLightFrom(highlights, used) || KIDS_POOL_REST;
      used.add(slotText(d.afternoon).toLowerCase());
    }
    d.notes = replaceKidNote(d.notes, kidPaceNote(d));
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
const MAIN_THEME_PARK = /magic kingdom|\bepcot\b|hollywood studios|animal kingdom|disneyland(?:\s+park)?|california adventure/i;
const WATER_PARK_DAY = /typhoon lagoon|blizzard beach|discovery cove|aquatica|volcano bay|wet\s*['’]?n['’]?\s*wild/i;

export function fillPreferredParks<T extends { morning: string; afternoon: string; label?: string }>(days: T[], highlights: { name: string }[] = [], interests = ""): T[] {
  const brands = interestBrands(interests);
  if (!brands.length || !days?.length) return days;
  const mentioned = (d: T) => `${d.morning || ""} ${d.afternoon || ""}`;
  const used = new Set<string>();
  for (const d of days) for (const h of highlights) if (h?.name && mentioned(d).includes(h.name)) used.add(h.name);
  const leftover = highlights.filter(h => h?.name && brands.some(b => matchesBrand(h.name, b)) && !used.has(h.name));
  leftover.sort((a, b) => Number(MAIN_THEME_PARK.test(b.name)) - Number(MAIN_THEME_PARK.test(a.name)));
  for (const d of days) {
    if (isTravelOrLeaveDay(d) || !leftover.length) continue;
    const alreadyBrand = brands.some(b => matchesBrand(d.morning || "", b) || matchesBrand(d.afternoon || "", b));
    const waterOnly = WATER_PARK_DAY.test(mentioned(d)) && leftover.some(h => MAIN_THEME_PARK.test(h.name));
    if (alreadyBrand && !waterOnly) continue;
    const next = leftover.shift()!;
    used.add(next.name);
    const prefix = /^[^A-Za-z0-9"]+/.exec(d.morning || "");
    d.morning = prefix ? `${prefix[0].trimEnd()} ${next.name}` : next.name;
    if (isMajorAttraction(next.name) || isMajorAttraction(d.morning)) d.afternoon = KIDS_POOL_REST;
  }
  return days;
}

/** A major theme-park morning always pairs with a pool or rest afternoon. */
export function ensureParkDayRest<T extends { morning: string; afternoon: string; label?: string }>(days: T[]): T[] {
  for (const d of days) {
    if (isTravelOrLeaveDay(d)) continue;
    if (isMajorAttraction(d.morning) && !isRestSlot(d.afternoon)) d.afternoon = KIDS_POOL_REST;
  }
  return days;
}

const SAFETY_NOTE = /lifeguard|beach flag|swim where|railings|hold little hands|altitude|drink extra water|^Hot!|height limits|waterproof|Wet departure|pack a rain layer|never approach or feed|check flags|stay behind/i;
const OPTIONAL_NOTE = /^Optional(?: big day trip)?:/i;

/** At most 3 notes per day: safety first, then the optional trip, then one more. */
export function capDayNotes(notes?: string, max = 3): string {
  const bareToken = /^(beach|beaches|surfing|surf|snorkeling|snorkel|hiking|hike|museums?|tasting|nightlife|boats?|fishing|cycling|camping|dive|food|family|sightseeing)$/i;
  const parts = (notes || "").split(/\s*·\s*/).map(s => s.trim()).filter(s => s && !bareToken.test(s));
  if (!parts.length) return "";
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(p);
  }
  const optionals = uniq.filter(p => OPTIONAL_NOTE.test(p));
  const rest = uniq.filter(p => !OPTIONAL_NOTE.test(p));
  const merged = optionals.length ? [optionals.find(p => /Optional big day trip:/.test(p)) || optionals[0]] : [];
  const safety = rest.filter(p => SAFETY_NOTE.test(p));
  const other = rest.filter(p => !SAFETY_NOTE.test(p));
  return [...safety, ...merged, ...other].filter(Boolean).slice(0, max).join(" · ");
}

export function capItineraryNotes<T extends { notes?: string }>(days: T[], max = 3): T[] {
  for (const d of days) d.notes = capDayNotes(d.notes, max);
  return days;
}
