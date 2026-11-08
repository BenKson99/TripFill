# TripFill

Enter a destination and dates → get an editable trip plan: weather, local highlights, local restaurants & coffee shops, a weather-aware packing list (with reasons), a day-by-day itinerary with rainy-day backups, a dated pre-trip checklist and a heuristic budget. Free, no API keys required.

## Run
```bash
npm install
npm run dev        # web on http://localhost:5173 (API on :8787, proxied)
```
Production: `npm run build && npm start` → http://localhost:8787 (set `PORT=` to change). The offline/PWA features only run in production builds.

Requires Node 18+ (tested on Node 24).

## Data sources (all free, keyless, fetched server-side with a User-Agent)
- **Open-Meteo** geocoding (place picker when ambiguous), forecast (through today + 14 days where available) and historical archive (later dates: averages of the same dates in the 3 prior years, labelled *typical for this season*). Trips straddling the forecast horizon get a mix, labelled per day.
- **Wikivoyage** – curated sights and restaurant/coffee listings from city and district pages, with links to their original listing pages.
- **Wikipedia / Wikidata** – nearby notable attractions and restaurant/café records, linked to source pages.
- **OpenStreetMap / Overpass** – named restaurants/cafés, cuisine and dietary tags where present. Coverage varies; no hours, ratings or allergy guarantees are invented.
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
- Highlight quality depends on Wikivoyage/Wikipedia coverage; small towns may get fewer or less "touristy" results. Restaurant/coffee coverage and cuisine metadata can be thin or outdated; availability is not verified.
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
- **Share link** — *Copy share link* packs the whole plan into the URL (`#plan=…`, lz-string). New links are always self-contained, including larger plans (up to 100,000 URL characters); beyond that, use JSON export. There is no silent fallback to temporary server storage. Recipients get a read-only view with *Import as my plan*. Links are snapshots — no live collaboration, no sync.
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
3. Build command `npm ci --include=dev && npm run build`; start command `npm start`.
4. Health check path `/healthz`.
5. Environment: `NODE_VERSION=22`, `TRIPFILL_CONTACT=<you@example.com>`, optionally `OPENAI_API_KEY`.

### Notes for the free tier
- **Portable snapshots survive restarts.** New `#plan=` links carry their own compressed, versioned plan; no database or server disk is required. They are not encrypted, and anyone with the full link can read the included details. Avoid sensitive notes. Long links can be truncated by chat/email apps: keep a JSON export as backup. Old `?share=` links still load while their records exist in `TRIPFILL_SHARE_DIR` (default `./data/shares`, then temp/memory fallback); free Render storage is ephemeral. Already-lost short links cannot be recovered. No paid disk/database is needed for the new portable links.
- Free services spin down when idle; the first request after that takes ~30–60 s.
- All build tools (Vite, TypeScript, type packages) are regular `dependencies`, so `npm install` works even if `NODE_ENV=production` is set at build time. Node ≥ 18 (`engines`).
- The service worker/PWA needs HTTPS, which Render provides.

## Quality & portability (v1.6.0)
- **Plan / Packing & Prep / Budget** tabs and the boho-chic light/dark design are preserved.
- **Export JSON** writes `{format:"tripfill",schemaVersion:1,exportedAt,plan}`. **Import trip JSON** is also available before generating a plan, validates before replacement, and supports older raw plan files and older compressed links. It preserves edited itinerary text, budgets, packing ticks, custom prep tasks, timeline checks and preferences. Older plans default to Mix pace / standard walking / no dietary preference; their absent cuisine provenance stays unknown.
- Import/export is capped at **750 KB UTF-8**. Nested shapes, dates, list/depth limits and numbers are checked. Prototype keys are rejected; only HTTP(S) URLs without credentials are retained. The bounded LZ decoder limits output and dictionary size. Strings render as plain text, including map tooltips; HTML is never evaluated.
- **Pace**, free-text **Interests**, **Walking tolerance**, and **Dietary preference** affect generated plans. Interests prioritize matching attraction metadata and add relevant packing. Limited walking caps outings, removes strenuous activities and prioritizes rest over hiking/ski/walking-tour presets; access is **not** verified. High tolerance permits an additional stop at Packed pace. Preferences are per snapshot, persisted/shared/exported. Change them and regenerate to apply; existing edits are not silently rewritten.
- Dietary sorting works on an expanded source pool before final display caps: explicit source tags first, then explicitly unverified name hints; known source-tag conflicts are excluded, unknowns remain labelled. Cuisine preference remains a heuristic within those groups. This cannot establish allergy safety or prevent cross-contact: confirm with the venue. No guarantee of dietary availability.
- Each weather day labels **Open-Meteo forecast** versus **seasonal estimate (not a forecast)**. Known local response receipt times are shown, not invented model-run times. Forecast responses may be cached up to 24 h. Missing temperatures use historical data if available; otherwise generation fails rather than displaying fake zeroes.
- Budget ranges are **rough model bands**, not live prices or confidence intervals. Baseline freshness is unknown; the FX source date is included where known. Your edited figures remain distinct from model ranges. Drive labels distinguish OSRM road routing (no live traffic) from straight-line road-factor estimates. Short-hop estimates in the trip snapshot are explicitly not routed.
- Restaurant entries show original source links, cuisine evidence/inference, collection timestamps and honest unknown freshness/opening-status caveats. Sparse lists are not padded. Collection time is not a source-revision or verification timestamp.

### Automated checks
```bash
npm test          # offline deterministic regression + local production HTTP integration tests
npm run build     # strict TypeScript checks + production Vite bundle
```
Tests include legacy and versioned JSON/URL migration, empty-store restart sharing, malformed/untrusted payloads and bounded decompression, dates/timezones/missing forecasts, preferences and dietary filtering, destination cache isolation, packing/prep/timeline persistence. HTTP tests use temporary directories/ports and clean up their child servers. The suite does not contact paid APIs or depend on upstream source availability. `TRIPFILL_DISABLE_AI=1` explicitly disables the optional description rewriter for local/manual QA.

Browser review is still required: tab keyboard navigation/remembered selection, import/export download controls, read-only shared view and clipboard fallback, actual localStorage reload, print across all tabs (including labels), light/dark mobile layout and map tooltips. Automated tests do not claim screenshots, browser interaction or accessibility certification.

## Packing studio (v1.7.0)

Packing & Prep now has quantities, bags, category progress, search and filters, essentials, last-minute flags, not-needed status, custom items, category moves and undo. Quantities use **all inclusive trip days, per person**. Laundry is opt-in; choose an interval and explicitly **Refresh suggestions**. Refresh keeps edits, checks and removals, updates untouched suggestions and adds missing ones without deleting anything. Bag labels are organization, not airline/security approval. Check official rules and current weather.

**Personal essentials** are explicitly saved/applied/forgotten on this browser only. Applied items are part of a plan, but an unapplied template is never included in sharing or JSON. Do not store sensitive/medical details. Older lists retain checks and names; all legacy items are protected as edited. Exported/shared snapshots omit the local deleted-item undo buffer. Printing includes the whole list, independent of screen filters.

Weather/activity suggestions use available per-day/leg extremes, not only averages. Trips beyond the 14-day weather cap keep full-duration clothing counts but clearly warn about uncovered dates/legs. No laundry facilities or exact clothing needs are assumed; long-trip caps require review. Plan/Budget and the separate prep checklist remain in place. See [Packing acceptance guide](docs/PACKING-QA.md) for rules, limitations and deterministic HTTP/browser checks.
