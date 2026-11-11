# Changelog

## 1.14.2 — Place quality and activity slot balance

- Activity venues still use one Overpass request, but each kind now has its own result cap and a 35 km beach radius, so beaches are not dropped by a global 80-element limit. Timeouts are longer, and Wikidata SPARQL fills in beaches, museums, bars and wineries when Overpass is slow or empty (Camps Bay, Clifton, Muizenberg, Zeitz MOCAA, Iziko).
- Beach is no longer pre-filled on half the mid-trip afternoons. Slots are balanced across the selected activities; tasting stays in the afternoon; nightlife names a real bar or club when one is found.
- A museum slot must be an actual museum or gallery, not a waterfront whose description happens to contain “art”. The same place is not used twice in one day. Snorkeling never uses an aquarium; if no dive site is found the line is “guided snorkel or dive trip (book an operator)”.
- Dioceses and other administrative or religious organizations are filtered from all sights. Ski rest days are not the same as that morning’s sector; they prefer museums, lakes, villages, viewpoints or a Gornergrat railway ride, and peaks appear only as “views of …”. Raw OSM names such as “Riffelalp decauville” are cleaned up.
- When Food is selected, “Book must-do tickets & any restaurant reservations” and “Reserve popular restaurants” merge into one timeline task.
- The first Simple mode switch defers mounting the lists by a frame, so the toggle can paint before grouping hundreds of rows.

## 1.14.1 — Activity scheduling and Simple mode fixes

- Unsuitable activities (for example beach in Zermatt in January) are no longer scheduled, packed or prepped; the note stays, and temperatures use the user's °C/°F setting.
- Beach slots use real OSM beaches (Camps Bay, Clifton), not waterfronts; if none are found the day says “Beach time at a nearby beach”.
- Every selected, suitable activity gets at least one slot when days allow — tasting in the afternoon, nightlife in the evening, snorkeling or diving in the morning — using Overpass places when we have them.
- Activity prep tasks appear once, on the dated timeline, instead of also repeating in the Before you leave checklist.
- Ski days rotate between found sectors, or vary the wording when only one is known. Rest days prefer museums, viewpoints, lakes and villages; serious peaks become “views of …”.
- Simple mode no longer rebuilds the hidden detailed list (memoized pane, lazy bag/owner/status selects, content-visibility). Target: under 300ms after the first paint.

## 1.14.0 — Vacation activities

- A compact **What do you want to do?** picker lists the 25 most common vacation activities (Skiing & snowboarding through Family & kid attractions). The eight most popular show first, with **Show all 25**. Free-text Interests stay, and obvious phrases such as “beginner ski lessons” or “wine” tick the matching activity.
- Each activity has a shared definition for packing, timed prep (lift passes, lessons, dive certification, tee times, tickets, permits, restaurant reservations, fishing licences, campsites) and itinerary placement, including a gentle note when the activity doesn’t fit the place or season.
- Place lookups reuse one combined OpenStreetMap query alongside the existing sources — not 25 extra calls. Day trips stay realistic: flying and car-free towns (for example Zermatt) no longer get long “~2h drive” rest-day suggestions.
- The legacy Ski (and other) trip types still work in old plans and share links. Activities are stored on the plan, in share links and in JSON import/export, and can be changed later in Packing settings without a weather refetch; Refresh suggestions keeps edits and ticks.
- Simple mode’s first toggle no longer rebuilds the hidden detailed list (memoized pane), so large groups stay snappy.

## 1.13.1 — Snow labels, umbrellas, ranges, faster Simple toggle

- Snow and mixed itinerary notes no longer sit under an ☔ backup label. They use a ❄️ snow or ❄️ mixed label; rainy days still use ☔ backup.
- When snow is expected, packing now suggests **Insulated snow boots** instead of “Waterproof boots with grip”. Refresh still follows the existing rules: unedited suggestions are renamed in place and ticks, skips and owners are kept; edited rows are left alone.
- A **Compact umbrella** is suggested again as an optional shared item for rainy, non-snow trips (for example light rain or drizzle in a city). This is not a 1.13.0 regression: the umbrella last appeared in pre-1.7 packing and was dropped when the packing studio replaced that list with a waterproof shell. Snow trips still do not get an umbrella.
- Broad region and range entities (mountain ranges, massifs, names like “Swiss Alps”, country-scale areas) are filtered out of highlights and day-trip candidates, so they no longer appear as “🚐 Day trip: Swiss Alps”. Specific peaks, museums and in-town sights are kept. The places cache key is now v13.
- Toggling Simple mode no longer tears down or rebuilds the full detailed packing list (hundreds of rows for a large group). Each view is mounted the first time you need it and then hidden, and Simple still only renders people lists when a row is expanded, so the toggle should feel instant.

## 1.13.0 — Big groups, snow vs rain, set everyone

- Simple packing mode now collapses identical personal items in a group (Adults or Kids) into one row, such as “Passport ×16”, with a compact “5/16 packed” count, an expand-to-tick-people control, and “Mark all packed”. Ticks still update each traveler’s underlying item, so detailed mode, export and share stay consistent. Shared items stay as single rows. Toggling Simple with a large group is instant. Detailed mode has a “Show only” / “My list” focus. Shared quantities such as plug adapters scale with group size (about one per three travelers).
- Weather treats freezing precipitation as snow: Open-Meteo `snowfall_sum` is read from the existing forecast and archive requests, and otherwise a temperature heuristic is used (mean at or below about 1°C, or high ≤ about 2°C, counts as snow; up to about 4°C is mixed). Summaries and icons say “Snowy” / “Snow likely” instead of “Often wet” and rain. For ski trips, snow is good news (“Fresh snow, great for skiing; dress warm”) and does not trigger the indoor rain backup. Packing suggests a waterproof shell and snow boots, not an umbrella. Warm-day rain behaviour is unchanged.
- In “Who’s traveling?” and ⚙ Settings → Packing, a compact **Set everyone to** control applies a traveler type to every visible row, keeping names. New rows added by raising the count inherit the most common type (ties go to the last chosen type) instead of “Not set”. After a plan exists, Settings still asks you to Refresh suggestions, as before.

## 1.12.1 — Home city on Generate

- Pressing Generate now uses whatever is typed in Home city, even if the lookup has not finished. The typed name is sent and resolved on the server, the same way Destination is. If the city cannot be found, an error is shown in the form and under the Home city field, instead of building a plan with no home.

## 1.12.0 — Flying or Driving

- The Plan form has a **How are you getting there?** choice: Flying or Driving. It is saved with the plan, including share links and JSON import/export. Old plans without a choice default to Driving when the home–destination distance is under about 300 km, otherwise Flying. With no home city the default is Flying, matching previous behaviour.
- Travel time, multi-city hop labels, the depart-day itinerary line, the pre-trip timeline and the Before you leave checklist all follow the choice. Driving shows an approximate unrouted drive time. Flying wording is unchanged.
- You can change the mode after generating a plan on the travel card or in ⚙ Settings → Packing, with no new weather fetch. Labels and packing suggestions update; your edits, checks, removals and custom itinerary notes are kept. Existing flying prep tasks are not deleted.
- Packing for Driving uses Day bag, Car / trunk, Cooler and Unassigned instead of airline bag names, adapts the “carry-on only” preference and the packing disclaimer, and adds road-trip items (licence and vehicle documents, phone mount/charger, snacks and water, a car emergency kit, and entertainment when children are on the trip). Infant notes no longer mention gate-check. Flying packing is unchanged.
- Budget is unchanged.

## 1.11.1 — Default traveler names

- Name boxes in “Who’s traveling?” and ⚙ Settings → Packing start filled with real, editable values: Traveler 1, Traveler 2, Traveler 3 and so on. Added rows continue the sequence. Custom names, types and IDs are kept, including when you lower the count and raise it again.
- Fix: clearing a name used to snap straight back to the default on every keystroke and, in the questionnaire, dropped that traveler’s type. You can now clear a name and type a new one naturally. A blank name is never saved; it becomes “Traveler N” when you leave the box or press Enter, and the type is kept.

## 1.11.0 — “Who’s traveling?” in the trip questionnaire

- The Plan form now has a **Who’s traveling?** section under Travelers: one row per traveler with an optional name and a Traveler type (Not set, Man, Woman, Girl, Boy, Infant). The first generated plan builds each person’s packing list from those rows, so infants get baby basics right away and no Refresh is needed. No other personal details are asked.
- Same editor and data as ⚙ Settings → Packing. Once a plan exists, its traveler settings are the source of truth. Editing them in Settings updates the questionnaire, and old, imported or shared plans prefill it from their packing settings. Questionnaire edits apply only when you press Generate; they never change the current plan before that.
- Lowering the count hides rows but keeps their names and types, so raising it again brings them back. On an existing plan, a smaller count never deletes items or checks; they move to the last remaining traveler, as before. Generating again builds a new plan, as it always has. Shared plans hide the questionnaire and stay read-only.

## 1.10.0 — Traveler types and full per-traveler lists

- Each traveler now has a **Traveler type** in ⚙ Settings → Packing: Not set (general), Man, Woman, Girl, Boy or Infant. Nothing is guessed from names. Man and Woman get the same defaults, because gender never changes the list. Girl and Boy get the core kids’ list without adult items like payment cards, phones or deodorant, plus an entertainment/comfort item. Infant gets ID, weather layers, baby outfits, sleepwear, diapers, wipes and changing basics, feeding supplies “as you feed” (no assumption about formula or breastfeeding), bibs, a carrier/stroller and a comfort item instead of an adult wardrobe. Everything stays editable.
- Girl, Boy and Infant show under Kids in Simple mode; Man, Woman and Not set show under Adults. The 1.9.0 `child` flag still works, and an explicit type takes priority. Exports, imports and share links keep the type, and invalid values are rejected.
- Fix: plans saved before 1.8 put every personal item on Traveler 1, and later travelers stayed empty until a manual Refresh. On load, any traveler with no items and no removals on record now gets their own suggested list. Shared supplies aren’t duplicated, existing rows, checks, statuses and edits are untouched, and it never runs twice.
- Changing a traveler type takes effect when you press Refresh suggestions. It adds the new items and keeps every existing item, check and edit, so remove any that no longer apply.

## 1.9.1 — Trip actions at the bottom

- Import trip JSON, Copy share link, Print / PDF, Export JSON, Install app, Calendar (.ics) and Clear moved from under the hero to a trip actions row at the bottom of the page, after the active tab’s content. The row scrolls with the page (not fixed or sticky) and wraps on mobile. With no plan yet, only Import trip JSON shows there. The share-link message now appears under that row.
- Settings, the hero, the main tabs, the shared-plan banner, read-only rules (no Copy share link or Clear in shared view), print exclusion and saved data are unchanged.

## 1.9.0 — Simple packing mode

- A Simple mode switch sits at the top of Packing & Prep. When it’s on, the tab shows just an Adults checklist and a Kids checklist (only when there are kids), with quantity, item name, a checkbox and a small owner or “Shared” label. Categories, bags, status, filters and edit controls are hidden. The pre-trip timeline is hidden, and Before you leave folds into a small disclosure.
- Kids come only from an explicit “Child” checkbox per traveler (⚙ Settings → Packing) plus the shared children’s-kit items. Ages are never guessed from names. Plans without child flags show everything under Adults, including shared essentials like keys and chargers.
- The mode is a view only. It uses the same items, so checks in Simple mode show immediately in Detailed mode. Toggling never regenerates, merges or migrates anything. Not-needed items stay visible, marked, and can’t be ticked. Simple mode always shows the whole list, ignoring the detailed search and filters. Shared read-only plans can switch the view, but their checkboxes are disabled.
- The choice is remembered in this browser only (`tripfill:packingMode`) and is never put in the trip or share links. Printing in Simple mode lists Adults and Kids with [x] / [ ] / [–] and quantities. Detailed print is unchanged.

## 1.8.3 — Settings menu keyboard fix

- Tab and Shift+Tab now stay inside the Settings menu, including the packing settings. Before, Tab from “Forget template” escaped to the page because those controls are rendered through a portal whose key events never reached the menu’s handler. The trap now uses a document-level listener and skips disabled, hidden and unrendered controls in page order. Escape still closes the menu and returns focus to the Settings button. Theme and temperature stay usable on shared plans.

## 1.8.2 — Settings menu

- Theme and temperature toggles moved from the top bar and toolbar into one Settings menu (top right), closed by default. It closes with Escape, the × button or a click outside, and returns focus to the Settings button. It scrolls on small screens and is left out of print.
- On Packing & Prep, laundry, rewear, spares, traveler names, activity kits, Refresh suggestions and personal essentials now live in a Packing section of that menu, opened from “Packing settings” above the list. Progress, list tabs, search, filters, checkboxes, add and undo stay on the page. Settings values and Refresh behaviour are unchanged; shared plans stay view-only.

## 1.8.1 — Clothing note fix

- Tops and bottoms notes now match the rewear setting: “Change daily” says one per day instead of “rewear if comfortable”, and other settings show the days ÷ rewear interval (between washes when laundry is arranged) that produced each traveler’s quantity. Existing unedited rows pick up the new note after Refresh suggestions; edited rows, checks, status and owners are unchanged.

## 1.8.0 — Traveler packing lists

- Packing now builds an individual list for each traveler plus a shared-supplies list. Rename travelers in settings, switch lists from the tab bar, and move any item between shared and a person.
- Clothing preferences control how often tops and bottoms are reworn and whether a spare pair of underwear and socks is added. Laundry planning is unchanged: nothing is assumed until you arrange a wash interval and refresh.
- Activity kits (beach, hiking, ski, business, celebration, family, road trip, photography) start from the trip’s purpose and interests, and can be turned off or on before the next refresh.
- Weather-dependent suggestions now say Essential or Optional in their reason. They are Essential only when a forecast clearly supports them; seasonal, mixed, or partial weather stays Optional and notes the uncertainty.
- Track each item as need-to-buy, ready, or packed, and flag departure-day items. Progress counts packed rows; filters cover the new statuses. Older packed and last-minute items migrate without losing ticks.
- Saved and shared plans migrate in place. Refresh still protects edits, checks and removals, and never deletes older items. Budget, Plan, and the existing portable schema version are unchanged.


## 1.7.1 — Headline copy

- Hero headline now reads “Your next adventure, beautifully planned.” No other product changes.

## 1.7.0 — Packing studio

- Replaced implicit-laundry packing and quantity-in-name strings with a deterministic, shared packing engine and structured per-item quantities. Uses the full inclusive date range, per-person scope, opt-in wash interval, cautious caps, activity/purpose suggestions, and available climate extremes across all supplied legs (including departure-city stats).
- Packing workspace: overall and category progress, packed/not-needed status, essentials and last-minute flags, search/category/status/bag filters, explicit bag assignments, readable wrapping labels, custom items, category moves, editing, removal and one-step persisted undo. Preparation tasks stay separate.
- Explicit suggestion refresh protects every edited item, checks, skipped rows and removed suggestions. Refresh updates untouched suggestions and adds missing ones; it never automatically deletes items. Settings save without silently changing the list.
- Browser-local personal essentials: intentional save/apply/forget, deduplicating apply and no copied checkmarks. Templates never enter snapshots unless applied; sensitive/medical details are not needed.
- Packing model v2 validation/migration inside the existing schema-1 portable format; old IDs/names/checks retained with separated trailing quantities and safe defaults. Shared views disable all packing mutations while permitting filters. JSON and both share paths omit the deleted-item undo buffer. Print includes the entire list, quantity, category, bag and status even when screen filters are active.
- Removed obsolete preset packing generator and unsupported universal passport/medicine/liquid guidance from new suggestions. Bag assignments are not airline/security approval; entry, plug, voltage, transport and health requirements must be checked independently.
- Added 15 packing-focused behavior/render/integration tests (29 total tests), including four seeded production HTTP scenarios. Deterministic QA tooling is documented in `docs/PACKING-QA.md`.
- Scope: Plan and Budget are unchanged. No accounts, paid services, auto template application, separate blank-list mode, weight calculator, reminders, or invented weather for uncovered trip days.

## 1.6.0
- QA follow-up: print checklist completion as explicit [x]/[ ] text instead of background-dependent custom controls; packing/prep/timeline labels wrap and print in full. Narrow screens use a single packing column. Version remains 1.6.0 pending deployment.
- Portable sharing: new links always embed compressed versioned snapshots; oversized links ask for JSON export instead of silently storing on Render's ephemeral disk. Retained legacy short-link reads, with clear unrecoverable-record errors.
- Versioned JSON export/import with raw-plan migration, 750 KB UTF-8 and complexity limits, nested shape/date checks, prototype-key rejection, safe URLs and bounded decompression. Import is available without an existing plan and preserves edited text, budgets, packing/prep/timeline checks and preferences. Unreadable browser data is retained with a recovery download rather than overwritten.
- Weather cards and itinerary days distinguish forecasts from seasonal history; known HTTP receipt timestamps are shown without implying model freshness. Fixed all-null/missing forecast and empty historical cases so they cannot become fake 0° days. Validated real calendar dates at the API boundary and used traveller-local today in timeline calculations.
- Budget explains rough model bands, unknown baseline freshness and known FX date; road times disclose OSRM (without traffic) versus straight-line factor assumptions, including short-hop snapshot travel estimates.
- Restaurant/coffee provenance links, metadata inference and collection-age caveats; honest sparse states and current availability/allergy disclaimers. Expanded the source candidate pool before preference filtering. Legacy entries without provenance remain unknown, not newly certified.
- Pace/interests/walking tolerance/dietary controls influence actual itinerary selection/intensity, packing and restaurant sorting/filtering. Limited walking takes priority over strenuous presets; unknown dietary data stays explicitly unknown. Preferences persist through browser saves, JSON and links. Source caches are cloned before preference/leg mutations to avoid cross-request contamination.
- Source strings and imported HTML remain text, including Leaflet tooltips; only HTTP(S) details links are used. Updated caches/User-Agent/version surfaces and added `npm test` regression + production HTTP restart tests. Added optional `TRIPFILL_DISABLE_AI=1` QA/free-only switch.
- Preserved boho-chic design, Plan / Packing & Prep / Budget tabs, PWA, editable saves, multi-city and print. Actual browser/mobile/print review remains a separate manual release gate.

## 1.5.2
- Restaurants: local-cuisine ranking — dishes matching the destination country get a boost, clearly foreign cuisines are demoted and capped at 2 per list.
- Small towns: restaurant/coffee search widens 2.5 → 6 → 15 km (OSM + Wikidata) until there are ≥5 restaurants and ≥3 cafés.
- Geocoding: populated places (towns/cities) ranked ahead of islands, glaciers and other natural features; Tromsø now resolves straight to the city.
- Past start dates: inline warning on the form, confirm before planning; the API rejects past starts unless confirmed.
- "Today" uses the traveller's local timezone (sent by the browser), else the destination's — no more UTC rollover in the evening. Form defaults use local dates too.
- Coffee shops: cinemas, theatres, hotels, clubs and similar venues filtered out.
- Caches bumped (eats v4, places v10).

## 1.5.1
- Weather: last forecast-horizon day no longer shows 0°/blank (Open-Meteo nulls now filled from typical); forecast window trimmed to 14 days.
- Highlights: exact duplicate names removed (e.g. "Blackwell School" twice in Marfa).
- Restaurants: shops/stores (e.g. "Portuel Kosher Store") filtered out.
- Eats/places caches versioned (eats v3, places v9) so stale lists refresh after deploy.

## 1.5.0
- Visual refresh: **boho chic** — cream/sand paper backgrounds with a soft linen noise texture, terracotta + dusty-rose accents, sage/olive secondary, soft charcoal ink (no pure black).
- Warmer Fraunces display titles (italic accent on hero), airier spacing, softer rounded cards with gentle warm shadows, curated pill/rounded tab bar and gradient primary buttons.
- Dark mode retuned to warm espresso/earth tones (terracotta accents, sage secondary) instead of cool blue-gray.
- PWA theme/background colors updated to match; service-worker cache bumped to tripfill-v1.5.0.
- No feature changes — Plan / Packing & Prep / Budget tabs, packing ticks, share, print and PWA behaviour unchanged.
- Retest fix: drop "Chicken Licken" (and keep other SA chains filtered) from restaurant lists; eats cache key bumped to v2.


## 1.4.0
- Plan tab: "Food to try" dish lists replaced by **Restaurants** (up to 8) and **Coffee shops** (up to 6) near the destination.
- Source: OpenStreetMap via Overpass (free, no key), boosted/backed up by Wikivoyage Eat/Drink listings. Ranked by notability (Wikidata/Wikipedia/website tags, guide listing) and distance from centre; chains (brand tags + known names) and fast food dropped; near-duplicates merged; max 2 per street.
- Each place shows type (e.g. café, bakery, seafood), distance from centre/neighbourhood, and a map link.
- Day-by-day dinners now name real restaurants. "Local drinks" line removed.
- Cache keyed by city + coordinates (eats|v1, places|v8); old food caches are not reused.
- Plans saved before 1.4 load fine and show a "regenerate" hint in this section.

## 1.3.1
- Fix: food didn't change when switching to another city in the same country (e.g. Porto → Lisbon showed Porto's list). The food lookup was cached per country only, so the first city's list was reused; it is now keyed by country + that city's guide dishes, and old caches are invalidated.
- Dishes described as another city's speciality ("originally from Porto") move to the end of the list.
- Added `npm test` regression check for the food cache key.

## 1.3.0
- Three tabs: **Plan** (form, trip overview, weather, highlights, map, food, day by day), **Packing & Prep** (packing list, new "Before you leave" checklist, pre-trip timeline) and **Budget** (money/exchange-rate card, home currency picker, budget rows incl. flights estimate and totals).
- Accessible tabs: role=tablist/tab/tabpanel, arrow keys / Home / End, roving focus; the active tab is remembered. Packing & Budget are disabled until a plan exists. Sticky, thumb-sized tab bar on mobile; printing includes all tabs.
- "Before you leave" checklist: passport/visa, insurance, bank notice, eSIM, plug adapter for the destination's socket types, offline maps, home prep (mail, plants/pets, fridge, thermostat). Checkable, editable, saved with the plan; older saved/shared plans get it automatically.
- /healthz reads the version from package.json.

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
