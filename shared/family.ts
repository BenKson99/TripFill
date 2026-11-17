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
  return false;
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

const GROWN_UP_PACKING = /passport|photo id|licence|license|vehicle documents|insurance|bookings? & tickets|house keys|medicines?|medication|health supplies|feeding supplies|cash|payment card|thermostat|car emergency|driving/i;
const GROWN_UP_TASKS = /passport|visa|entry rules|insurance|bank|card issuer|roaming|esim|car:|tyres|fluids|papers|parking|tolls|hold mail|thermostat|lock up|plant & pet|empty the fridge|bookings?|documents|medicines?|feeding|photo id|online check-in/i;

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
export const KIDS_POOL_REST = "🏊 Hotel pool or a quiet rest at the hotel";

function stripAlsoNearbyMajor(text: string): string {
  return (text || "").replace(/\s*Also nearby: [\s\S]*$/i, "").trim();
}

/** One major attraction per mid-trip day; afternoon becomes pool/rest if a second major slipped in. */
export function paceItineraryForKids<T extends { morning: string; afternoon: string; evening?: string; notes?: string; label?: string }>(days: T[], input: any): T[] {
  if (!tripHasKids(input) || !days?.length) return days;
  for (const d of days) {
    if (/Arrive|Depart/i.test(d.label || "")) continue;
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
  const parkDay = days.find(d => isMajorAttraction(`${d.morning} ${d.afternoon}`) && !/Arrive|Depart/i.test(d.label || ""));
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
    if (/Arrive|Depart/i.test(d.label || "") || !leftover.length) continue;
    if (brands.some(b => matchesBrand(d.morning || "", b) || matchesBrand(d.afternoon || "", b))) continue;
    const next = leftover.shift()!;
    used.add(next.name);
    const prefix = /^[^A-Za-z0-9"]+/.exec(d.morning || "");
    d.morning = prefix ? `${prefix[0].trimEnd()} ${next.name}` : next.name;
    if (isMajorAttraction(d.afternoon || "")) d.afternoon = KIDS_POOL_REST;
  }
  return days;
}
