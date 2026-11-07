import { validDate } from "../shared/portable.js";
import { dietaryEats, normalizePreferences, preferredHighlights, walkingNotes } from "./preferences.js";
import { readFileSync as __rf } from "node:fs";
const APP_VERSION: string = JSON.parse(__rf(new URL("../package.json", import.meta.url), "utf8")).version;
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { geocode, getWeather, dateRange, todayIn, isPopulated, type Place } from "./weather.js";
import { getPlaces } from "./places.js";
import { packing, itinerary, timeline, type TripInput } from "./plan.js";
import { budget } from "./budget.js";
import { getFx } from "./fx.js";
import { tripFacts } from "./trip.js";
import { mountShare, shareStore } from "./share.js";
import { buildMulti } from "./multi.js";
import { presetsOf, presetPacking, presetItinerary } from "./presets.js";

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
      if (!matches.length) return res.status(404).json({ error: `Couldn't find "${inp.destination}"` });
      // Prefer real towns/cities over islands, glaciers and other natural features (Tromsø)
      const towns = matches.filter(isPopulated);
      const distinct = (towns.length ? towns : matches).filter(m => (m.population ?? 0) > 0 || matches.length === 1 || towns.length === 1);
      // Ask unless the top match dwarfs EVERY other one (Queenstown ZA 119k vs Queenstown NZ 10k is not decisive)
      const runnerUp = Math.max(0, ...distinct.slice(1).map(m => m.population || 0));
      if (distinct.length > 1 && !(distinct[0].population && distinct[0].population > 20 * runnerUp)) return res.json({ needsChoice: true, matches });
      place = (distinct[0] || matches[0]); (inp as any)._matches = matches;
    }
    let home = inp.home as Place | undefined;
    if (!home && (inp as any).homeCity) home = (await geocode((inp as any).homeCity))[0];
    const facts = home ? tripFacts(home, place, inp.start) : null;
    const domestic = !!facts?.domestic;
    const fxForce = process.env.NODE_ENV === "production" ? undefined : (req.body as any).fxForce;
    const extra = ((inp as any).legs || []).filter((l: any) => l && (l.destination || l.place) && l.start);
    if (extra.length) {
      const m = await buildMulti(inp, place, extra, home, fxForce, todayIso);
      if (m.highlights.length) await polish(m.highlights);
      return res.json({ input: { ...inp, _matches: undefined }, matches: (inp as any)._matches || [], generatedAt: new Date().toISOString(), ...m });
    }
    const [weather, places] = await Promise.all([getWeather(place, inp.start, end, false, todayIso), getPlaces(place, { ski: presetsOf(inp).includes("ski"), want: inp.style === "Packed" || presetsOf(inp).includes("ski") ? 20 : 14 })]);
    const nights = Math.max(0, all.length - 1); const travelers = Math.max(1, Number(inp.travelers) || 1);
    const aiPolished = await polish(places.highlights);
    places.eats = dietaryEats(places.eats, inp);
    const ps = presetsOf(inp).filter(p => inp.walkingTolerance !== "low" || !["hiking", "ski", "city"].includes(p));
    const pk = packing(inp, weather, place, nights, domestic); presetPacking(pk.groups, ps, weather, pk.leaveAtHome);
    const it = itinerary(inp, weather, places.highlights, places.eats.restaurants, places.indoorExtra); presetItinerary(it, ps, weather, preferredHighlights(places.highlights, inp)); walkingNotes(it, inp);
    res.json({
      input: { ...inp, _matches: undefined }, matches: (inp as any)._matches || [], place, capped, generatedAt: new Date().toISOString(), aiPolished, trip: facts,
      weather, highlights: places.highlights, eats: places.eats, sources: places.sources, guideUrl: places.guideUrl,
      packing: pk,
      itinerary: it,
      timeline: timeline(inp.start, !domestic, todayIso),
      budget: await budget(place.countryCode, nights, travelers, inp.style || "Mix", process.env.NODE_ENV === "production" ? undefined : (req.body as any).fxForce, facts ? { km: facts.distanceKm, roundTrip: true, from: facts.home.name } : undefined),
    });
  } catch (e: any) { console.error(e); res.status(e.status || 502).json({ error: e.message || "Generation failed" }); }
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
