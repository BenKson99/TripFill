# TripFill

Enter a destination and dates → get an editable trip plan: weather, local highlights, food to try, a weather-aware packing list (with reasons), a day-by-day itinerary with rainy-day backups, a dated pre-trip checklist and a heuristic budget. Free, no API keys required.

## Run
```bash
npm install
npm run dev        # web on http://localhost:5173 (API on :8787, proxied)
```
Production: `npm run build && npm start` → http://localhost:8787 (set `PORT=` to change). The offline/PWA features only run in production builds.

Requires Node 18+ (tested on Node 24).

## Data sources (all free, keyless, fetched server-side with a User-Agent)
- **Open-Meteo** geocoding (place picker when ambiguous), forecast (≤16 days out) and historical archive (later dates: averages of the same dates in the 3 prior years, labelled *typical for this season*). Trips straddling the 16-day horizon get a mix, labelled per day.
- **Wikivoyage** – curated sights (wikidata-linked sights on the city page and its district pages) and food (Eat sections of city/country pages + "<Country> cuisine" page).
- **Wikipedia / Wikidata** – nearby notable places filtered by Wikidata type and ranked by pageviews + sitelinks; dishes from the country's cuisine article (local name + English gloss).
- **open.er-api.com** (fallback frankfurter.app) – exchange rates for the budget.
- Opening hours and prices are never generated — the UI tells you to check official sites.

## Features
- Packing groups: Documents & Money / Clothing / Toiletries & Health / Electronics / Comfort & Extras + leave-at-home list; each item has a reason ("rain likely Thu", "lows ~8°C").
- Itinerary skeleton paced by style (Slow 1 / Mix 2 / Packed 3 sights a day), indoor sights on rainy days; capped at 14 days.
- Collapsible, reorderable, hideable sections (drag handle, ↑/↓ buttons or keyboard). Layout is saved per device; *Reset layout* restores it. Print follows your order, skips hidden sections and expands collapsed ones (option to print them as summaries).
- °C/°F toggle (defaults to °F in US locales).
- Everything is editable, auto-saved to `localStorage`; print-friendly view (Print / PDF), JSON download & import.

## Optional
Copy `.env.example` to `.env`. If `OPENAI_API_KEY` is set, highlight descriptions are lightly reworded (no new facts). The app works fully without it.

## Limitations
- Budget ranges come from country-level price tiers (World Bank ICP 2021, approximate) — not city- or season-specific, and never quotes.
- Highlight quality depends on Wikivoyage/Wikipedia coverage; small towns may get fewer or less "touristy" results. Food items are parsed from bold terms and may need light editing.
- Plug-type, visa and health items are reminders, not looked-up facts.

## Currency & exchange rates (v0.4)
- Pick your home currency in the trip's **Money** card. It is stored per browser.
- Rates come from `GET /api/fx`, which returns USD-based rates; cross rates are computed in the browser.
- Primary source: [open.er-api.com](https://open.er-api.com) (free, no key, updated daily, about 166 currencies).
- Fallback: [frankfurter.app](https://frankfurter.app) (ECB reference rates, only about 30 currencies).
- Rates are cached for 6 h on the server. `?refresh=1` refetches (rate-limited to once a minute).
- If both sources fail, the last cached rates are used. With no cache, the budget shows a single currency with a note.
- Test the fallback in dev: open `http://localhost:5173/?fxForce=fallback` (or `fail`), or `curl localhost:8787/api/fx?force=fallback`, or set `FX_FORCE=fallback`.
- Rates are mid-market and for guidance only. Card and exchange rates will differ.

## v1.0 features
- **Home city** — set once in the form (geocoded, saved in this browser). Drives domestic vs international (passport/visa, local cash and plug-adapter items only for international trips), an approximate nonstop flight time (great-circle distance; drive estimate for short hops), time difference on your travel dates, your default home currency, and the Trip Snapshot.
- **Share link** — *Copy share link* packs the whole plan into the URL (`#plan=…`, lz-string). Plans over ~16k characters are saved on the TripFill server instead (`data/shares/`, short `?share=` link). Recipients get a read-only view with *Import as my plan*. Links are snapshots — no live collaboration, no sync.
- **Trip types** — multi-select Beach, Hiking, Ski, City, Business, With kids, Road trip. Each adds packing items with reasons and tweaks the itinerary (e.g. hike on the driest day, work mornings, car pick-up).
- **Map** — Leaflet + OpenStreetMap tiles (attribution shown, scroll-zoom off, low tile use). Pins coloured by itinerary day, click for details; a collapsible/reorderable section like the others.
- **Calendar (.ics)** — RFC 5545 file with one all-day event per itinerary day plus open checklist items. Imports into Google Calendar (Settings → Import & export), Apple Calendar and Outlook.
- **Installable / offline (PWA)** — manifest, icons, a service worker caching the app shell and last FX/share responses; your last plan lives in localStorage, so it opens and stays editable offline. Generating needs a connection.
- **Multi-city** — *+ Add another city* with a travel day per city. Weather, highlights, food and budget per leg; itinerary stitched with travel days; packing merged; per-leg budgets plus a grand total in your home currency. Leave it empty for the normal single-city flow.

### More limitations
- Flight times are rough nonstop estimates (0.5 h + distance/800 km/h with routing factor), not schedules.
- Extra multi-city legs auto-pick the best nearby match; use "not it?" in the route strip to switch. Max 14 days total.
- Map pins need Wikidata coordinates; tiles need the network.
- .ics events are floating all-day dates; the date you leave home may differ from Day 1 for long-haul trips.
- Server shares have no deletion endpoint yet (delete files in `data/shares/`).

## Look & feel (v1.1)
Warm "travel-magazine" theme built on CSS variables (`src/styles.css`): sand/off-white background, deep-ink text, terracotta accent, deep-teal secondary. Fraunces (display) + Inter (body) are self-hosted via `@fontsource-variable/*`, so they work offline. Icons come from `lucide-react`. Light / Auto / Dark toggle (Auto follows the system; saved as `tripfill:theme`). Respects `prefers-reduced-motion`; print uses an ink-only palette.

## Deploy to Render (free web service)
TripFill is a single Node service: Express serves the API and the built frontend from `dist/`. It binds to `0.0.0.0:$PORT` (Render sets `PORT`) and exposes `GET /healthz`.

### Option A — Blueprint (uses `render.yaml`)
1. Push this repo to GitHub/GitLab.
2. In Render: **New → Blueprint**, pick the repo. Render reads `render.yaml` (one free web service, Node runtime).
3. When prompted, set `TRIPFILL_CONTACT` (an email or URL; it goes into the User-Agent sent to Wikimedia/Open-Meteo). `OPENAI_API_KEY` is optional — leave blank.
4. **Apply**. The first build takes a few minutes; open the `*.onrender.com` URL when the health check passes.

### Option B — manual web service
1. **New → Web Service**, connect the repo.
2. Runtime **Node**, plan **Free**.
3. Build command `npm install && npm run build`; start command `npm start`.
4. Health check path `/healthz`.
5. Environment: `NODE_VERSION=22`, `TRIPFILL_CONTACT=<you@example.com>`, optionally `OPENAI_API_KEY`.

### Notes for the free tier
- **Share store is ephemeral.** "Copy share link" normally embeds the whole plan in the URL, which needs no server storage and always works. Only plans too big for a URL are stored server-side, in `TRIPFILL_SHARE_DIR` (default `./data/shares`). If that isn't writable it falls back to the OS temp dir, then to memory (last 500 shares). On Render free the disk is wiped on every restart/redeploy/spin-down, so those short `?share=` links stop working afterwards. `/healthz` reports which store is active. For durable short links, attach a persistent disk (paid) and point `TRIPFILL_SHARE_DIR` at it.
- Free services spin down when idle; the first request after that takes ~30–60 s.
- All build tools (Vite, TypeScript, type packages) are regular `dependencies`, so `npm install` works even if `NODE_ENV=production` is set at build time. Node ≥ 18 (`engines`).
- The service worker/PWA needs HTTPS, which Render provides.
