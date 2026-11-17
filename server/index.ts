import { friendlyError } from "../shared/friendlyError.js";
import { validDate } from "../shared/portable.js";
import { dietaryEats, normalizePreferences, preferredHighlights, walkingNotes } from "./preferences.js";
import { readFileSync as __rf } from "node:fs";
const APP_VERSION: string = JSON.parse(__rf(new URL("../package.json", import.meta.url), "utf8")).version;
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { geocode, getWeather, dateRange, todayIn, type Place } from "./weather.js";
import { getPlaces, annotateDriveTimes } from "./places.js";
import { packing, itinerary, timeline, type TripInput } from "./plan.js";
import { budget } from "./budget.js";
import { getFx } from "./fx.js";
import { tripFacts, applyRoadRoute } from "./trip.js";
import { roadRoute } from "./route.js";
import { resolveTravelMode } from "../shared/travel.js";
import { resolveHomeCity } from "./home.js";
import { mountShare, shareStore } from "./share.js";
import { buildMulti } from "./multi.js";
import { presetsOf } from "./presets.js";
import { osmActivities, mergeActivityPlaces } from "./osmActivities.js";
import { runActivitySchedule, activityNotes } from "./activityItinerary.js";
import { resolveActivities, syncActivityInput } from "../shared/activities.js";
import { tripHasKids, hasChildUnder } from "../shared/family.js";
import { curatedInterestVenues } from "../shared/interestVenues.js";
import { curatedParkSights, isNearBase, preferredParkBase, isOffParkBase } from "../shared/nationalParks.js";
import { preferFamilyEats, familyDinnerList } from "../shared/familyEats.js";
import { dropUnusedWaterParkSwimwear } from "../shared/packing.js";
import { rankPlaceMatches } from "../shared/placeQuery.js";
import { mergeActivityTimeline } from "../shared/activityPrep.js";

// Minimal .env loader (no dependency)
try { for (const l of fs.readFileSync(".env", "utf8").split("\n")) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch { /* no .env */ }

const app = express();
mountShare(app);
app.use(express.json({ limit: "1mb" }));

app.get("/api/geocode", async (req, res) => {
  try { res.json({ results: await geocode(String(req.query.q || "")) }); }
  catch (e: any) { res.status(502).json({ error: e.message }); }
});

app.get("/api/fx", async (req, res) => {
  const force = process.env.NODE_ENV === "production" ? undefined : (req.query.force as string | undefined);
  res.set("Cache-Control", "no-store");
  res.json(await getFx({ refresh: req.query.refresh === "1", force }));
});

async function polish(highlights: any[]): Promise<boolean> {
  const key = process.env.TRIPFILL_DISABLE_AI === "1" ? undefined : process.env.OPENAI_API_KEY; if (!key || !highlights.length) return false;
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", response_format: { type: "json_object" }, messages: [
        { role: "system", content: "Rewrite each description as one friendly traveller-facing sentence (max 30 words). Use ONLY facts in the input. Never add opening hours, prices or new facts. Return {\"d\":[...]} in the same order." },
        { role: "user", content: JSON.stringify(highlights.map(h => `${h.name}: ${h.description}`)) }] }),
    });
    const j: any = await r.json(); const d = JSON.parse(j.choices[0].message.content).d;
    if (Array.isArray(d) && d.length === highlights.length) { d.forEach((t: string, i: number) => { highlights[i].description = t; }); return true; }
  } catch (e) { console.warn("OpenAI polish skipped:", (e as Error).message); }
  return false;
}

app.post("/api/generate", async (req, res) => {
  try {
    const inp = req.body as TripInput & { place?: Place };
    Object.assign(inp, normalizePreferences(inp));
    Object.assign(inp, syncActivityInput(inp));
    if (!validDate(inp.start) || !validDate(inp.end) || inp.end < inp.start || Number(inp.end.slice(0, 4)) - Number(inp.start.slice(0, 4)) > 2) return res.status(400).json({ error: "Valid start and end dates required" });
    const clientTz = typeof (inp as any).tz === "string" ? (inp as any).tz : undefined;
    const clientToday = validDate((inp as any).today) ? (inp as any).today : undefined;
    const todayIso = clientToday || (clientTz ? todayIn(clientTz) : undefined);
    if (inp.start < (todayIso || todayIn(inp.place?.timezone)) && !(inp as any).allowPast) return res.status(400).json({ error: `Start date ${inp.start} is in the past (today is ${todayIso || todayIn(inp.place?.timezone)}).`, pastDate: true });
    let end = inp.end; const all = dateRange(inp.start, inp.end); let capped = false;
    if (all.length > 14) { end = all[13]; capped = true; }
    let place = inp.place;
    if (!place) {
      const matches = await geocode(inp.destination);
      if (!matches.length) return res.status(404).json({ error: friendlyError(`Couldn't find "${inp.destination}"`) });
      // Preselect the best match (national parks, cities, big places) and generate with it.
      // Keep a short alternative list so the user can switch if we guessed wrong.
      const ranked = rankPlaceMatches(matches, 4);
      place = ranked[0] || matches[0]; (inp as any)._matches = ranked;
    }
    const home = await resolveHomeCity(inp);
    const prelim = home ? tripFacts(home, place, inp.start) : null;
    const travelMode = resolveTravelMode(inp, prelim?.distanceKm);
    inp.travelMode = travelMode;
    let facts = home ? tripFacts(home, place, inp.start, travelMode) : null;
    if (facts && home && travelMode === "driving") {
      try { facts = applyRoadRoute(facts, await roadRoute(home, place, true)); } catch { /* keep unrouted label */ }
    }
    const domestic = !!facts?.domestic;
    const fxForce = process.env.NODE_ENV === "production" ? undefined : (req.body as any).fxForce;
    const extra = ((inp as any).legs || []).filter((l: any) => l && (l.destination || l.place) && l.start);
    if (extra.length) {
      const m = await buildMulti(inp, place, extra, home, fxForce, todayIso);
      if (m.highlights.length) await polish(m.highlights);
      return res.json({ input: { ...inp, _matches: undefined, members: undefined }, matches: (inp as any)._matches || [], generatedAt: new Date().toISOString(), ...m });
    }
    const acts = resolveActivities(inp);
    const skiOn = acts.includes("ski") || presetsOf(inp).includes("ski");
    const parkBase = preferredParkBase(place);
    const origin = parkBase ? { ...place, lat: parkBase.lat, lon: parkBase.lon } : place;
    const [weather, places] = await Promise.all([
      getWeather(origin, inp.start, end, false, todayIso),
      getPlaces(place, { ski: skiOn, want: inp.style === "Packed" || skiOn ? 20 : 14 }),
    ]);
    // After Wikipedia/Wikidata place lookups, so the activity SPARQL is not crowded out.
    const osm = await osmActivities(place, acts);
    places.highlights = mergeActivityPlaces(places.highlights, osm);
    const nights = Math.max(0, all.length - 1); const travelers = Math.max(1, Number(inp.travelers) || 1);
    const aiPolished = await polish(places.highlights);
    places.eats = dietaryEats(places.eats, inp);
    if (tripHasKids(inp)) {
      const restaurants = familyDinnerList(places.eats.restaurants, true);
      const cafes = familyDinnerList(places.eats.cafes, true);
      places.eats = {
        ...places.eats,
        restaurants: restaurants.length ? restaurants : preferFamilyEats(places.eats.restaurants),
        cafes: cafes.length ? cafes : preferFamilyEats(places.eats.cafes),
      };
    }
    const extraVenues = curatedInterestVenues(inp.interests || "", place)
      .filter(v => !places.highlights.some((h: any) => (h.name || "").toLowerCase() === v.name.toLowerCase()))
      .map(v => {
        const indoor = /studio tour|museum|gallery|visitor (?:centre|center)|junior ranger|library|platform\s*9/i.test(v.name)
          && !/stargaz|wildlife from a distance|double-decker|sunset|day hike/i.test(v.name);
        return { name: v.name, description: "A well-known place that matches your interests.", source: "TripFill", indoor, setting: (indoor ? "indoor" : "outdoor") as "indoor" | "outdoor", type: "attraction" as const };
      });
    if (extraVenues.length) places.highlights = [...extraVenues, ...places.highlights];
    for (const s of curatedParkSights(place)) {
      if (!places.highlights.some((h: any) => (h.name || "").toLowerCase() === s.name.toLowerCase())) {
        places.highlights.unshift({ name: s.name, description: s.description || "A kid-friendly stop in the park.", source: "TripFill", indoor: !!s.indoor, setting: s.setting, type: s.type } as any);
      }
    }
    try {
      places.highlights = await annotateDriveTimes(origin, places.highlights);
      places.eats.restaurants = await annotateDriveTimes(origin, places.eats.restaurants || []);
      places.eats.cafes = await annotateDriveTimes(origin, places.eats.cafes || []);
    } catch { /* keep unannotated */ }
    const youngDrive = hasChildUnder(6, inp);
    const nearRest = (places.eats.restaurants || []).filter((e: any) => isNearBase(e, { smallChild: youngDrive }) && !isOffParkBase(e?.name, place));
    if (nearRest.length) places.eats.restaurants = nearRest;
    const nearCafes = (places.eats.cafes || []).filter((e: any) => isNearBase(e, { smallChild: youngDrive }) && !isOffParkBase(e?.name, place));
    if (nearCafes.length) places.eats.cafes = nearCafes;
    const ps = presetsOf(inp).filter(p => inp.walkingTolerance !== "low" || !["hiking", "ski", "city"].includes(p));
    const it = itinerary(inp, weather, places.highlights, places.eats.restaurants, places.indoorExtra, { domestic, travelMode, driveMin: facts?.driveMin, overnightStop: facts?.overnightStop, countryCode: place.countryCode, flightHours: facts?.flightHours, tzDiffHours: facts?.tzDiffHours, destName: place.name, elevationM: weather.elevationM }); runActivitySchedule(it, inp, weather, preferredHighlights(places.highlights, inp), ps, place.name); walkingNotes(it, inp);
    const pk = dropUnusedWaterParkSwimwear(packing(inp, weather, place, nights, domestic), it);
    res.json({
      input: { ...inp, _matches: undefined, members: undefined }, matches: (inp as any)._matches || [], place, capped, generatedAt: new Date().toISOString(), aiPolished, trip: facts,
      weather, highlights: places.highlights, eats: places.eats, sources: places.sources, guideUrl: places.guideUrl,
      packing: pk,
      itinerary: it,
      timeline: mergeActivityTimeline(timeline(inp.start, !domestic, todayIso, travelMode), { input: inp }, todayIso),
      activityNotes: activityNotes(inp, weather, place.name),
      budget: await budget(place.countryCode, nights, travelers, inp.style || "Mix", process.env.NODE_ENV === "production" ? undefined : (req.body as any).fxForce, facts ? { km: facts.distanceKm, roundTrip: true, from: facts.home.name } : undefined),
    });
  } catch (e: any) { console.error(e); res.status(e.status || 502).json({ error: friendlyError(e) }); }
});

app.get("/healthz", (_q, r) => r.json({ ok: true, version: APP_VERSION, uptime: Math.round(process.uptime()), shareStore: shareStore() }));

if (process.env.NODE_ENV === "production") {
  const dist = path.resolve("dist");
  if (!fs.existsSync(path.join(dist, "index.html"))) console.warn("dist/index.html missing — run `npm run build` first");
  app.use(express.static(dist, { index: false, setHeaders: (res, f) => { if (f.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable"); else res.setHeader("Cache-Control", "no-cache"); } }));
  app.get("*", (_q, r) => { r.setHeader("Cache-Control", "no-cache"); r.sendFile(path.join(dist, "index.html")); });
}
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "0.0.0.0";
app.listen(port, host, () => console.log(`TripFill listening on http://${host}:${port} (${process.env.NODE_ENV || "development"})`));
