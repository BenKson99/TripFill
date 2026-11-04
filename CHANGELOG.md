# Changelog

## 1.2.3
- Speed: Wikipedia/Wikidata/OSRM answers cached in memory + on disk for 24 h (`.cache/http`, `TRIPFILL_CACHE_DIR`); whole-place and per-country food results cached too. Throttled or partial results are never cached. Lookups run in parallel (food alongside sights, batched wbgetentities, drive times alongside pageviews), with Overpass capped at ~4 s (mirrors raced, optional), SPARQL at 7 s, and per-host concurrency limits. A 429 with a short Retry-After is retried; a long one fails fast.
- Drive times: still one batched OSRM table call; the estimate fallback uses a 2.0 mountain-road factor for ski fields, peaks and parks.
- Alcoholic drinks moved out of the dishes and dinners into a "🍷 Local drinks" line.
- Near-duplicates (e.g. Table Mountain vs Table Mountain National Park) deduped; the shorter landmark name is kept.
- Budget: rough flight/long-distance estimate from home (distance bands, round-trip; multi-city legs get one-way hops), labelled "rough estimate, editable".
- Food: thin local lists no longer padded with generic international foods; more neighbouring cuisines filtered.
- Budget inputs widen to fit 5+ digit amounts.

## 1.2.2
- Real drive times from OSRM (free, no key); falls back to straight-line x1.4 estimate labelled "est." when a point snaps >2 km from a road.
- Day trips over ~2.5 h each way are dropped; labels show "~Xh Ym drive each way".
- Rainy-day backups pull extra indoor venues from Wikipedia nearcoord, Wikidata SPARQL and OSM Overpass (best-effort); no repeats, max one place of worship; generic text only when none exist.
- Filtered event-type entries (e.g. massacres), border checkpoints; wineries count as mixed indoor/outdoor.
- Beach/hike presets no longer overwrite day-trip days.
- Fixed "1h 60m" rounding.

## 1.2.1 — 2026-11-04
- Day-trip afternoons are specific: a named sight nearby, or a suggestion that fits the place (shore walk, viewpoint, tasting lunch), plus a round-trip drive estimate.
- Ski rest-day options name a real unscheduled sight or day trip instead of "Explore a market or local street".
- Food: cheeses, wines and other ingredients that aren't dishes are dropped (e.g. Reggianito); so are dishes that name another cuisine first or jointly (e.g. Chocolate salami, Migas).
- Ski fields: only alpine resorts and fields; cross-country, terrain-park, heli-ski and snowfield entries are excluded (e.g. Snow Farm, Snow Park).

## 1.2.0 — 2026-11-04
- Highlights: suburbs, localities, towns and border checkpoints are filtered out; a wider (up to 120 km) Wikipedia nearcoord search adds day-trip attractions, labelled "🚐 Day trip (~N km)".
- Ski preset: nearby ski fields (e.g. The Remarkables, Coronet Peak, Cardrona, Treble Cone) are listed first and each ski day names a field.
- Packed pace: up to 20 highlights; day trips fill a day when city sights run out, so no filler days.
- Food: picks must be described as local to the destination country; dishes tied to other cuisines are dropped. Same-country legs rotate dinners instead of repeating.
- Rainy-day backups are unique venues and are never scheduled again elsewhere.
- Money: shared symbols are disambiguated (ARS$, CLP$, NZ$, CA$; USD shows US$ when home uses another $ currency).

## 1.1.1 — 2026-11-04
- Fix: food picks use the destination country's cuisine article; cleaner dish names; no people or guide warnings listed as dishes; same-country legs share one lookup.
- Fix: ambiguous names such as Queenstown now ask which one is meant.
- Fix: no beach time scheduled on the hike day.
- Fix: typical-weather days no longer say "Usually dry" and "Rain likely" at the same time.
- Fix: cross-border short hops note that the drive time is a straight-line estimate.
- Fix: editing the budget total keeps exactly the typed amount.

## 1.1.0 — 2026-11-04
### Changed — visual design pass (no functional changes)
- Design tokens (palette, spacing, radii, shadows) as CSS variables. Warm sand background, ink text, terracotta accent, teal secondary.
- Fraunces + Inter, self-hosted with @fontsource and precached by the service worker for offline use.
- Landing hero with an inline SVG illustration; restyled form, inputs, date pickers and trip-type chips.
- Trip header with kicker, display title, date range and stat tiles (days, travelers, avg temps, budget).
- Section cards with lucide icons, a grip handle, icon controls and pill-style collapsed summaries; smoother collapse.
- Weather day tiles with condition icons; numbered highlight cards; checklist-style packing with an animated check; itinerary as a timeline; budget bar chart.
- Map border, popups and controls themed (tiles dimmed in dark mode).
- Light/Auto/Dark theme toggle (follows system by default).
- Mobile: no horizontal overflow at 390px (was 9px wider than the screen before); single-column form on phones.
- Print: ink-only palette, no hero/toolbar/controls.
- PWA: new terracotta icons, theme colors for light/dark, SW cache version tripfill-v1.1.0.

## 1.0.0 — 2026-11-04
### 1.0.0
- Release bundling home city, share links, trip-type presets, map, calendar export, offline PWA and multi-city (0.5–0.11).
- README documents all v1 features and limitations.

## 0.11.0 — 2026-11-04
### Added — multi-city trips
- "+ Add another city" in the form: each extra city has its own travel day; trip start/end stay the outer dates. Single-city flow unchanged when no city is added.
- Per-leg weather (with per-leg averages), highlights, food and budget; itinerary stitched across legs with "Travel A → B" days and travel-time estimates between cities.
- Packing merged across legs (plug adapters listed for every country); grand total converted to your home currency.
- Route strip in the header with "not it?" alternatives per leg; map centres on all cities with a dashed route line.
- Extra-leg geocoding prefers places near the previous stop (Porto after Lisbon, not Porto Alegre).
### Fixed
- Sub-hour travel times read "~55m" instead of "~0h 55m".

## 0.10.0 — 2026-11-04
- **Installable PWA:** web manifest, 192/512 icons plus a maskable icon and an Apple touch icon, theme color, and an "📲 Install app" button when the browser offers one. Chrome reports no installability errors.
- **Service worker** (`public/sw.js`, production builds only):
  - It precaches the app shell and the hashed JS/CSS read from index.html.
  - Page loads are network-first with the cached shell as fallback.
  - `/api/fx` and `/api/share/:id` are network-first, and the last good response is served offline, flagged "cached (offline)".
  - Generate/geocode always need the network.
  - OSM map tiles and other cross-origin requests are never cached.
- **Offline use:** the last plan (in localStorage) opens fully offline, in a reload or a new tab, and you can still edit and save it. An offline banner appears and Generate is disabled until you're back online.

## 0.9.0 — 2026-11-04
- **📅 Calendar (.ics)** button. It exports one all-day event per itinerary day, with weather, morning/afternoon/evening, rain backup and notes in the description, plus one all-day event per open (not done) pre-trip checklist item.
- **RFC 5545 output:** CRLF line endings, lines folded at 75 octets (UTF-8 aware), escaped text, stable UIDs (so re-importing updates events instead of duplicating them), DTSTAMP in UTC, and `DTSTART;VALUE=DATE` with an exclusive DTEND of the next day.
- **Dates:** they are floating all-day dates. Itinerary days are destination-local dates and checklist dates are home-local dates, so they land on the right calendar day whatever the viewer's zone.
- **Importing:** Google Calendar (Settings → Import & export), Apple Calendar and Outlook.

## 0.8.0 — 2026-11-04
- **🗺 Map section** using Leaflet 1.9 with OpenStreetMap tiles. It is collapsible, reorderable and hideable like the other sections.
- **Pins:** every highlight with Wikidata coordinates is pinned and colored by the itinerary day it's scheduled on; unscheduled sights are grey. Each pin has a hover tooltip and a click popup showing the day, the slot and a Wikipedia link. There is a destination dot and a legend.
- **OSM tile policy:** standard tile URL, visible "© OpenStreetMap contributors" attribution, maxZoom 19, no prefetching or bulk download, and tiles are never cached by the app's service worker. The browser sends its own User-Agent and Referer. Scroll-wheel zoom is off so the page scrolls normally.

## 0.7.0 — 2026-11-04
- **Trip-type presets** (multi-select chips): 🏖 Beach, 🥾 Hiking, ⛷ Ski, 🏙 City, 💼 Business, 🧒 With kids, 🚗 Road trip. They are saved with the form.
- **Packing:** each preset adds specific items with reasons, using the forecast where it helps (e.g. "ski trip, lows ~−13 °C", "beach trip but highs only ~X — sea likely cool"). With kids adds a Kids group and Road trip adds a Car & Road group. Overlapping generic items are replaced and duplicates removed.
- **Itinerary tweaks:**
  - Business: morning work blocks.
  - Ski: slopes in the mornings, or afternoon skiing when combined with Business.
  - Hiking: a day hike on the driest full day.
  - Beach: beach afternoons on warm, dry days.
  - Road trip: a scenic-drive day on a different day from the hike, plus car pick-up on arrival.
  - City: an orientation walking tour.
  - With kids: rest/playground breaks and early dinners.
  - Tweaked days are tagged in Notes.

## 0.6.0 — 2026-11-04
- **🔗 Copy share link**, no account needed. The plan is compressed with lz-string into the URL `#fragment`. Fragments are never sent to a server, so links up to 16,000 characters carry the whole plan (a typical 1-week trip is about 11k).
- **Bigger plans** go to a small file-based share store on the Express server instead: `POST /api/share` and `GET /api/share/:id`. Each plan is saved as `data/shares/<random 72-bit id>.json` and gets a short `?share=<id>` link.
- **Opening a shared link** shows a read-only view in which all inputs are disabled. You can **Import as my plan** or **Close**; your own saved plan isn't touched until you import. Damaged or truncated links and unknown ids show a clear error.
- **Not included:** live collaboration. A link is a snapshot.
- **Dev-only test hook:** `?shareMax=<n>` forces the server fallback.

## 0.5.0 — 2026-11-04
- **Home city** (optional) on the form. It is geocoded with Open-Meteo, you can pick another match, and it is saved in localStorage as `tripfill:homeCity`.
- **Trip snapshot:** shows where you start from, whether the trip is domestic or international (same country code), and an approximate nonstop flight time. Flight time is great-circle distance × 1.05 at 800 km/h plus 30 min. Under 300 km it shows drive time instead; under 700 km it adds drive time. It also shows the time-zone difference on the start date, from the IANA time zones that Open-Meteo returns. All of this is labeled approximate.
- **Domestic trips:** packing uses "Government photo ID" in place of passport/visa and leaves out the plug adapter and local cash. The pre-trip timeline drops the visa, currency, vaccination and translation-pack steps.
- **Home currency default:** your explicit picker choice wins, then the home city's country, then the browser locale.

## 0.4.0 — 2026-11-04
- Home-currency picker (searchable, ~50 ISO currencies with names/symbols). Default comes from the browser locale (en-US → USD) and is saved in localStorage (`tripfill:homeCurrency`).
- "Money" card in the trip header: two-way rate (e.g. `1 USD = 0.893 EUR · 1 EUR = 1.119 USD`), source, last-updated time, ↻ refresh.
- Budget: ranges, totals and per-person in local currency ≈ home currency. Each line and the total can be edited in either currency; editing the total rescales the lines proportionally.
- FX: new `GET /api/fx`. It uses open.er-api.com, falls back to frankfurter.app (ECB), and caches for 6 h. If both fail, it uses the last cached rates; with no cache it shows local currency only, with a note.
- When home and local currency are the same (e.g. a US trip for a US user), the conversion is hidden.
- Dev-only test hook: `?fxForce=fallback|fail` in the page URL, or `FX_FORCE` env / `/api/fx?force=` (ignored in production).

## 0.3.0 — 2026-11-04
- **Collapsible sections:** every results section (Weather, Highlights, Food, Packing, Itinerary, Timeline, Budget) has a clickable header with a chevron and a smooth expand/collapse. When collapsed it shows a one-line summary (e.g. "25 items, 3 packed"). Added *Collapse all* / *Expand all*.
- **Rearrange:** drag sections by the ⠿ handle (@dnd-kit; mouse, touch and keyboard: focus the handle, Space, arrows, Space) or use the ↑/↓ buttons. Sections can be hidden (✕) and brought back from the *Hidden sections* menu.
- **Layout memory:** collapsed state, order, hidden sections and the print choice are saved per device in `localStorage` (`tripfill:layout:v1`), separate from trip data. *Reset layout* restores the defaults.
- **Print/PDF:** follows your section order, skips hidden sections, and prints collapsed sections expanded by default. Tick "Print collapsed sections as one-line summaries" to print them collapsed instead.
- Food to try is now its own section.

## 0.2.0 — 2026-11-04
- **Budget:** destination-aware estimate ranges. A US mid-range baseline is scaled by a bundled per-country price-level table (approximate tiers based on World Bank ICP 2021 price-level ratios, PA.NUS.PPPC.RF), trip length, travelers (2 per room) and pace. Shown in local currency with USD equivalent via open.er-api.com (falls back to frankfurter.app, then USD only). Always labelled as an estimate.
- **Highlights:** Wikidata instance-of (P31) class checks drop non-attractions (stock exchanges, office towers, banks, government offices, stations, universities, demolished sites…). Ranked by Wikipedia 30-day pageviews + sitelink count. Each sight is tagged indoor / outdoor / mixed from its Wikidata type (palaces, castles, shrines → mixed); rainy days prefer indoor, then mixed.
- **Food:** candidates come from the country's "<X> cuisine" Wikipedia article plus Wikivoyage mentions, validated as real dishes/drinks via their Wikidata short description, with generic ingredients removed (chicken, rice, tea, organic…). Ranked by pageviews with a boost for Wikivoyage mentions and country ties. Shows the local-language name plus a short English gloss.
- **Units:** °C/°F toggle (defaults to °F for US locales) applied to weather, packing reasons and itinerary; choice remembered.

## 0.1.0
- First version: weather, highlights, packing, itinerary, timeline, budget placeholders, print/JSON export.
