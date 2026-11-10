import { dietaryEats, preferredHighlights, walkingNotes } from "./preferences.js";
import { geocode, getWeather, dateRange, stats, type Place, type WeatherResult } from "./weather.js";
import { getPlaces } from "./places.js";
import { packing, itinerary, timeline, type TripInput, type ItinDay } from "./plan.js";
import { budget } from "./budget.js";
import { tripFacts, haversineKm } from "./trip.js";
import { resolveTravelMode } from "../shared/travel.js";
import { presetsOf, presetItinerary } from "./presets.js";

export interface LegIn { destination: string; start: string; place?: Place }
const fmt = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** Multi-city plan. Leg 1 = main destination from inp.start; each extra leg starts (travel day) on its own date; last leg ends at inp.end. */
export async function buildMulti(inp: TripInput, first: Place, extra: LegIn[], home: Place | undefined, fxForce?: string, todayIso?: string) {
  const all = dateRange(inp.start, inp.end); let capped = false; let tripEnd = inp.end;
  if (all.length > 14) { tripEnd = all[13]; capped = true; }
  const starts = [inp.start, ...extra.map(l => l.start)];
  for (let i = 1; i < starts.length; i++) if (!(starts[i] > starts[i - 1]) || starts[i] >= inp.end) throw Object.assign(new Error(`Leg ${i + 1} must start after leg ${i} starts and before the trip ends (${inp.end}).`), { status: 400 });
  const places: Place[] = [first]; const alts: Place[][] = [[]];
  for (const l of extra) {
    if (l.place) { places.push(l.place); alts.push([]); continue; }
    const r = await geocode(l.destination);
    if (!r.length) throw Object.assign(new Error(`Couldn't find "${l.destination}"`), { status: 404 });
    // Prefer big places that are near the previous stop (Porto after Lisbon, not Porto Alegre)
    const prev = places[places.length - 1];
    const score = (p: Place) => (p.population || 1) / (1 + haversineKm(prev, p) / 500);
    const sorted = [...r].sort((a, b) => score(b) - score(a));
    places.push(sorted[0]); alts.push(sorted.slice(1, 5));
  }
  // Build legs, dropping any that start after the 14-day cap
  const legs = places.map((place, k) => ({ place, start: starts[k], end: k < places.length - 1 ? starts[k + 1] : tripEnd })).filter(l => l.start <= tripEnd).map(l => ({ ...l, end: l.end > tripEnd ? tripEnd : l.end }));
  const prelim = home ? tripFacts(home, first, inp.start) : null;
  const travelMode = resolveTravelMode(inp, prelim?.distanceKm);
  inp.travelMode = travelMode;
  const travelers = Math.max(1, Number(inp.travelers) || 1); const ps = presetsOf(inp).filter(p => inp.walkingTolerance !== "low" || !["hiking", "ski", "city"].includes(p));
  const built = await Promise.all(legs.map(async (l, k) => {
    const [weather, pl] = await Promise.all([getWeather(l.place, l.start, l.end, false, todayIso), getPlaces(l.place, { ski: presetsOf(inp).includes("ski"), want: inp.style === "Packed" || presetsOf(inp).includes("ski") ? 20 : 14 })]);
    const nights = Math.max(0, dateRange(l.start, l.end).length - 1);
    pl.eats = dietaryEats(pl.eats, inp);
    pl.highlights.forEach(h => (h as any).leg = l.place.name); pl.eats.restaurants.forEach(f => f.leg = l.place.name); pl.eats.cafes.forEach(f => f.leg = l.place.name);
    // Each city has an independent cached source pool; rotate only its own dinner list.
    const prior = legs.slice(0, k).filter(x => x.place.countryCode === l.place.countryCode).reduce((n, x) => n + dateRange(x.start, x.end).length, 0);
    const rot = pl.eats.restaurants.length ? prior % pl.eats.restaurants.length : 0;
    const R0 = pl.eats.restaurants; const legFood = [...R0.slice(rot), ...R0.slice(0, rot)];
    const it = itinerary(inp, weather, pl.highlights, legFood, pl.indoorExtra); presetItinerary(it, ps, weather, preferredHighlights(pl.highlights, inp)); walkingNotes(it, inp);
    const fromPrev = k ? tripFacts(legs[k - 1].place, l.place, l.start, travelMode) : null;
    // Leg 1 carries the round trip from home (open-jaw ≈ round trip); later legs carry the one-way hop from the previous city
    const hop = k ? (fromPrev ? { km: fromPrev.distanceKm, roundTrip: false, from: legs[k - 1].place.name } : undefined) : (home ? { km: tripFacts(home, l.place, l.start, travelMode).distanceKm, roundTrip: true, from: home.name } : undefined);
    const b = await budget(l.place.countryCode, nights, travelers, inp.style || "Mix", fxForce, hop);
    return { ...l, nights, weather, places: pl, it, budget: b, fromPrev };
  }));
  // Stitch itinerary: previous leg's "Depart" + next leg's "Arrive" become one travel day
  const days: (ItinDay & { leg: string })[] = [];
  built.forEach((L, k) => {
    let d = L.it.map(x => ({ ...x, leg: L.place.name }));
    if (k > 0) d = d.slice(1);
    if (k < built.length - 1) {
      d = d.slice(0, -1); const N = built[k + 1]; const arrive = N.it[0];
      days.push(...d);
      const wx = N.weather.days.find(w => w.date === N.start);
      days.push({ date: N.start, leg: N.place.name, label: `Day 0 · ${fmt(N.start)} · Travel ${L.place.name} → ${N.place.name}`, weather: arrive?.weather || (wx ? `${wx.summary}` : ""),
        morning: `Check out in ${L.place.name}; travel to ${N.place.name} — ${N.fromPrev?.flightLabel || "check routes"}`,
        afternoon: inp.walkingTolerance === "low" ? `Arrive in ${N.place.name}, check in; rest or optional short outing using local transport` : `Arrive in ${N.place.name}, check in; easy walk around your new neighbourhood`, evening: arrive?.evening || "Relaxed dinner near your stay", notes: "travel day" });
    } else days.push(...d);
  });
  days.forEach((d, i) => { d.label = d.label.replace(/^Day \d+/, `Day ${i + 1}`); });
  // Merged weather (travel day shows the arrival city)
  const wd = new Map<string, any>();
  for (const L of built) for (const x of L.weather.days) wd.set(x.date, { ...x, leg: L.place.name });
  const mdays = [...wd.values()].sort((a, b) => a.date.localeCompare(b.date));
  const srcs = new Set(built.map(L => L.weather.source));
  const weather: WeatherResult & { legs: any[] } = { source: srcs.size === 1 ? built[0].weather.source : "mixed", note: [...new Set(built.map(L => L.weather.note))].join(" "), days: mdays, stats: stats(mdays),
    legs: built.map(L => ({ name: L.place.name, start: L.start, end: L.end, source: L.weather.source, stats: L.weather.stats })) };
  const domestic = !!home && built.every(L => L.place.countryCode === home.countryCode);
  const countries = [...new Set(built.map(L => L.place.country))];
  const synth: Place = { ...first, country: countries.join(" & ") };
  const totalNights = Math.max(0, dateRange(inp.start, tripEnd).length - 1);
  const pk = packing(inp, weather, synth, totalNights, domestic);
  const eats = { restaurants: built.flatMap(L => L.places.eats.restaurants), cafes: built.flatMap(L => L.places.eats.cafes) };
  return {
    title: built.map(L => L.place.name).join(" → "), capped, place: first, domestic,
    trip: home ? tripFacts(home, first, inp.start, travelMode) : null,
    legs: built.map((L, k) => ({ place: L.place, alternatives: alts[k] || [], start: L.start, end: L.end, nights: L.nights, budget: L.budget, fromPrev: L.fromPrev && { flightLabel: L.fromPrev.flightLabel, distanceKm: L.fromPrev.distanceKm, tzLabel: L.fromPrev.tzLabel, domestic: L.fromPrev.domestic } })),
    weather, highlights: built.flatMap(L => L.places.highlights), eats, sources: [...new Set(built.flatMap(L => L.places.sources))], guideUrl: built[0].places.guideUrl,
    packing: pk, itinerary: days, timeline: timeline(inp.start, !domestic, todayIso, travelMode), budget: built[0].budget,
  };
}
