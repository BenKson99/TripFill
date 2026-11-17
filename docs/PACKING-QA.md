# Packing studio v1.9.0 — acceptance guide

## Automated checks

```bash
npm ci --include=dev
npm test
npm run build
```

35 tests pass, including a seeded production HTTP test with synthetic Cape Town, Tromso, a two-continent mixed-climate trip, and 30 days in Porto. The original 14 regression tests still pass. HTTP coverage invokes the real `/api/generate`, `/api/share`, `/api/share/:id`, `/healthz`, production HTML and JS assets, portable share encode/decode and JSON validation. Packing refresh leaves the returned itinerary and budget unchanged. No external or paid APIs are called by fixtures.

## Fresh local production server

Use a new origin to avoid old service-worker builds. The handoff server uses **http://127.0.0.1:8847**. To recreate it, from the repo:

```bash
npx tsx scripts/packing-qa.ts seed /workspace/tripfill-v1.9.0-qa
NODE_ENV=production HOST=127.0.0.1 PORT=8847 TRIPFILL_DISABLE_AI=1 \
  TRIPFILL_CACHE_DIR=/workspace/tripfill-v1.9.0-qa/http-cache \
  TRIPFILL_SHARE_DIR=/workspace/tripfill-v1.9.0-qa/local-shares npm start
# In another shell:
npx tsx scripts/packing-qa.ts verify /workspace/tripfill-v1.9.0-qa http://127.0.0.1:8847
```

The generated `*-link.txt` files open read-only snapshots. The `.json` files import as editable trips (use **Import trip JSON**). Import can replace the current plan; do not do this on the live site with an unexported personal trip. `report.json` records HTTP assertions.

**All fixture weather, places and prices are synthetic QA data, not real travel advice or actual recommendations.** The injected cache is in a separate local directory, never committed or deployed. Cache seed data expires after 24h: reseed before rerunning. The optional `dist/packing-qa.html` handoff index is generated locally only and is not a deployment artifact.

## Focused browser acceptance (parent runs; executor did no browser automation)

1. Confirm `/healthz` says **1.14.1**. Open 127.0.0.1:8847, not an older port or `localhost` with existing data. At 390px and desktop width, import `warm-short.json`, select Packing & Prep. All labels/reasons should wrap without horizontal scrolling; try dark mode. Warm fixture: 3 tops, 4 underwear, swimwear, no winter coat. Confirm Everyone / Shared / Traveler tabs; open ⚙ Settings (top right) or “Packing settings…” above the list and confirm the Packing section holds laundry, rewear, spares, traveler names, activities (and optional business/celebration kits), Refresh suggestions and personal essentials (Tab/Shift+Tab stay inside the menu, Escape closes it and returns focus); confirm Essential vs Optional weather reasons, and need-to-buy / ready / packed / departure-day status.
2. Tick an item; edit a different item's name/quantity; choose a bag and move it to Activities. Mark an item Not needed: it leaves the active denominator. Search, category, bag, Still to pack, Essentials, Last-minute and Not needed filters should intersect correctly. Category count reflects its entire category, not just search matches. Clear filters to restore all rows.
3. Add “My journal”, mark it Essential. Remove another item, use Undo: name, quantity, bag and tick return. Remove it again and refresh suggestions: it must not resurrect. Reload: edits, settings, checks, not-needed status, removals and the last removal undo survive. Only the latest removal is undoable; older removed suggestions remain dismissed.
4. Settings (⚙ Settings menu → Packing section, Packing tab only): choose wash every 2 days and carry-on only. Quantities must stay unchanged until **Refresh suggestions**. After refresh, untouched clothing changes; edited rows/checks/skips stay. Existing obsolete rows are never deleted. Existing manually assigned bags stay protected. No bag labels imply airline approval.
5. Save essentials; import `cold-rainy.json` (six days, cold/rain/hiking/ski gear). Previously packed/custom items must not leak into this new trip. **Apply essentials** intentionally adds saved selections as unpacked, without duplicate matching items or reset checks. Saving alone must not add the template to a share/JSON. Test overwrite and forget confirmations. No medical details are needed.
6. Import `mixed-multi.json`: one deduplicated list with both warm-weather gear and insulated layers. Rain shell and activity reasons must be present. Plan/Budget tabs remain usable with two legs.
7. Import `long-laundry.json`: 30 inclusive days, weather/itinerary capped at 14, wash interval 7, tops 7, underwear/socks 8; no claimed later weather. Change to no laundry, refresh, and read the long-trip cap/resupply warning. Edited items stay yours.
8. Export and reimport; quantity, flags, bag, categories, checks and settings survive. Copy a portable share link and open a fresh browser tab: filters work, but item editing, add/remove, undo, settings mutation and personal-template controls cannot mutate the shared trip. Your own local plan stays untouched when the shared view closes. Deleted-item undo text must not appear in distributed snapshots.
9. With a search/filter active, Print/PDF: all packing categories/items print, not only the visible subset. Verify quantities, readable long names, `[x]` / `[ ]` / `[–]`, bag and essential/last-minute labels. Prep/timeline and Plan/Budget still print with their existing layout rules. If a section is collapsed, expand it or turn off “Print collapsed sections as one-line summaries”.
10. Import `legacy-checked.json` if supplied: old trailing × quantities separate correctly; existing checks, names, notes and prep remain. Legacy items are considered edited to protect prior manual work. Refresh may add new missing suggestions; it must not silently rewrite old content.

## Deliberate boundaries

- Packing belongs to the existing trip, not a separate manual blank-list application. It works offline once a trip has been loaded.
- Personal items are listed once per traveler; shared supplies have their own list. Clothing quantities are for that traveler and include clothes worn in transit. Progress counts active rows, not individual units.
- Laundry is never assumed. Tops cap at 14, underwear/socks at 31, bottoms at 7; long trips need washing/rewear/resupply planning or manual quantities (up to 99).
- Only available weather is used, including all supplied leg extremes. TripFill still caps generated itinerary/weather at 14 days; unmodeled later legs are explicitly unverified.
- Editing any detail protects the whole item from automatic refresh. Packed/not-needed status alone does not protect generated quantities. Refresh never deletes old items. Legacy items are all protected.
- Essential and last-minute are organizational flags, not safety guarantees. No medical, entry, security, airline, power or voltage advice is guaranteed.
- Template storage is per browser/device. Trip storage remains the existing single saved-plan slot; import/generation replaces it. JSON backups and portable snapshots work as before.

## Simple mode (1.9.0)

Synthetic samples (generated, not real people): `/workspace/tripfill-v1.9.0-qa/family-2-adults-2-kids-SYNTHETIC.json` (Kid C and Kid D are flagged Child; Passport ticked, Sleepwear not needed, Socks need-to-buy for Adult A) and `/workspace/tripfill-v1.9.0-qa/adults-only-2-SYNTHETIC.json`.

1. Import the family sample → Packing & Prep → turn on **Simple mode** (switch, Space/Enter works). You should see an Adults list (Adult A/B items plus Shared items such as House keys) and a Kids list (Kid C/D items plus shared Children’s kit). There are no bags, categories, filters or timeline, and Before you leave is a closed disclosure.
2. Tick an item in Simple mode, switch it off, and the same row is packed in Detailed mode. Untick it in Detailed mode and Simple mode follows. Sleepwear shows “Not needed” and can’t be ticked.
3. In Detailed mode, type a search that hides most items, then switch to Simple mode: the full lists still show. Switch back and the search is still there.
4. Reload: the mode is remembered. Import the adults-only sample: no Kids list.
5. Print preview in Simple mode shows Adults and Kids lists with [x]/[ ]/[–] and quantities and no controls. Detailed print is unchanged.
6. Share link → open it: the Simple switch works, but all checkboxes are disabled.
7. At 390px wide, long names wrap with no horizontal scroll.

## Traveler types (1.10.0)

Synthetic samples: `/workspace/tripfill-v1.10.0-qa/legacy-only-traveler1-SYNTHETIC.json` (pre-1.8 shape, 3 travelers, all rows on Traveler 1; Tops ×5 and My lucky scarf ticked) and `/workspace/tripfill-v1.10.0-qa/family-5-profiles-SYNTHETIC.json` (Man, Woman, Girl, Boy and Infant; Girl G Tops packed, Diapers need-to-buy).

1. Import the legacy sample. The tabs read roughly Traveler 1 2/11 packed (Tops ×5 and the scarf ticked), Traveler 2 and 3 about 17 items each, and Shared 2. Reload or export and reimport: the counts don't change.
2. Import the family sample: every traveler has a list. Infant I has diapers, feeding supplies and baby outfits but no Tops or payment card. In Simple mode the Kids list holds Girl G, Boy B and Infant I.
3. In ⚙ Settings → Packing, change Adult Woman to Infant. A message says Refresh is needed. Press Refresh suggestions: baby items are added and the existing items and ticks stay.
4. Open a share link: the Traveler type selects are disabled.

## Who’s traveling? (1.11.0)

1. Start with no plan (Clear). Set Travelers to 5. Five rows appear under “Who’s traveling?”. Name them and choose Man, Woman, Girl, Boy and Infant, then Generate (Porto, any dates). Packing & Prep shows five named lists right away: the Infant has Diapers / nappies and no Tops, and Simple mode Kids lists Girl, Boy and Infant. No Refresh is needed.
2. Change Travelers to 2 and then back to 5: the names and types return. Changing them doesn’t alter the current plan until you Generate.
3. In ⚙ Settings → Packing, rename Traveler 2. The Plan questionnaire row updates to match.
4. Import `/workspace/tripfill-v1.11.0-qa/old-plan-5-profiles-SYNTHETIC.json` (a 1.10 export with no questionnaire data): the questionnaire prefills Adult Man … Infant I. The legacy `legacy-only-traveler1-SYNTHETIC.json` prefills Traveler 1–3.
5. Open a share link: the questionnaire is hidden and nothing is editable.
6. At 390px the rows stack without horizontal scrolling.

## Flying or Driving (1.12.0)

1. Start with no plan. Confirm **How are you getting there?** sits under Home city, with Flying selected by default. Choose Driving, set a home city (e.g. Detroit) and generate Porto (or any far destination). The travel card should show an approximate drive time and say it is not a road route. Packing should list a Car emergency kit, Road snacks, a phone mount, and Day bag / Car / trunk / Cooler labels (no Carry-on). Infant trips should mention car-seat laws, not gate-check. Before you leave should include car, route, fuel/charging, parking and tolls — not airport check-in.
2. Switch the mode to Flying on the travel card (or ⚙ Settings → Packing). Travel time should become a nonstop flight estimate without a new weather wait. Your ticks and edited packing rows stay; driving items already added stay until you remove them. The depart-day line should read “head to the airport” if you had not edited it.
3. Generate a new Flying trip and confirm packing, bags, the airport disclaimer and “Online check-in / confirm transport to the airport” match the previous app.
4. Import an older JSON that has a home distance under 300 km and no travelMode: it should open as Driving. A plan with no home city should open as Flying.
5. At 390px the Flying / Driving buttons wrap without sideways scrolling. Keyboard: the choice is a radiogroup (arrow keys). Shared links show the choice but cannot change it.


## Big groups, snow vs rain, set everyone (1.13.0)

1. Start with no plan. Set Travelers to 16. Use **Set everyone to: Woman**. Confirm all 16 rows say Woman and names are unchanged. Generate **once**: Zermatt, Jan 3–9 2027, flying from Ann Arbor (or Detroit if Ann Arbor is not found), purpose or interests “ski”.
2. Weather should read snowy (snow icons, “Often snowy” / “Snow likely”), not “Often wet” with rain icons, at highs around freezing and colder lows. Mid-days should say “Fresh snow, great for skiing; dress warm”, not “Rain likely — indoor…”. Packing should mention a waterproof shell and snow boots, not an umbrella.
3. In Packing & Prep, turn **Simple mode** on — it should switch instantly. Identical items are one row (e.g. Passport ×16) with “0/16 packed”. Shared items stay single rows. Expand “Show people”, tick one person, and confirm detailed mode / a person’s tab shows that tick. Use “Mark all packed” and confirm every traveler’s Passport is packed. In detailed mode, **Show only: My list** focuses the first traveler without a new Generate.
4. Optional second Generate (warm rain check): a mild rainy city (e.g. Porto in November, or any destination with highs well above 40°F / 4°C and rain). Confirm rain icons, “Rain likely — indoor…”, and unchanged rain packing (shell for wet weather). Or skip this Generate and use the warm-short fixture if it includes rain.
5. At 390px, grouped Simple rows and “Set everyone to” wrap with no sideways scroll. A shared link shows the lists and types read-only.


## QA leftovers (1.13.1)

1. After a Zermatt ski Generate: mid-day itinerary lines should still say “Fresh snow, great for skiing; dress warm”, but the slot label should be **❄️ snow** (or ❄️ mixed), not ☔ backup. Packing should list **Insulated snow boots**, not “Waterproof boots with grip”. No compact umbrella on a snow trip.
2. Optional second Generate: London, Nov 13–17 (or any mild rainy forecast). Packing should include an optional **Compact umbrella** plus the packable shell, and should not add snow boots. Rain days keep the ☔ backup label.
3. Zermatt highlights and day-by-day should not offer “Swiss Alps” (or other whole ranges) as a 🚐 day trip, including under “or a rest day”. Named peaks, museums and in-town sights can still appear. A previously generated 1.13.0 plan will not change until you Generate again (places cache is v13).
4. On the 16-traveler Zermatt list, toggle Simple mode — it should feel instant (well under 500 ms). Grouped rows stay collapsed until you press Show people. Toggling back to detailed should also be instant after the detailed list has been shown once.


## Vacation activities (1.14.0)

Confirm `/healthz` says **1.14.1**. On the Plan form, the trip-type chips are replaced by **What do you want to do?** (popular 8 + Show all 25) and the Interests field remains. Typing “beginner ski lessons” should tick Skiing; “wine” should tick tasting. Generate once for a warm coastal city with several activities (beach, food, snorkeling, hiking, museums). Check packing kits, prep tasks (reservations, tickets, no-fly-after-diving if snorkeling/scuba is on), itinerary spread, and any suitability notes. Change activities in ⚙ Settings → Packing and Refresh suggestions without a new Generate; ticks and edits should stay. A second Generate can exercise a ski trip or a Zermatt flying plan to confirm long drive day trips are gone and legacy Ski still works.



## Production start (1.19.2)

Confirm `/healthz` says **1.19.2**. `npm run build` now also writes `dist/server.js`, and `npm start` is `node dist/server.js` (not `tsx`). The server should print “TripFill listening” within a few seconds, well under Render's 512 MB cap. Budget is unchanged.

## Honolulu and London leftovers (1.19.1)

Confirm `/healthz` says **1.19.1**. On a **cold cache**, generate Seattle → Honolulu, Flying, 1–8 Jul 2027, Mom, Dad, Girl 10, Boy 8, Grandparent, interests “volcano, turtles, surfing lessons, luau, beach”. Diamond Head should carry the note that it is an old volcano crater and Hawaiʻi Volcanoes National Park is on the Big Island (not a silent drop, and not only a “We couldn’t fit” line). Dinners should not use Tiki’s Grill & Bar, and at most one Zippy’s branch. “Hike continues” must not appear on a surf-lesson or beach morning. USS Arizona Memorial should mention the boat ride and timed tickets, not indoor exhibits; Pearl Harbor stops should sit on one day (1–2 visits) with the rest optional. Then Chicago → London, Flying, 10–17 Jul 2027, boy 10 and twin 7-year-olds, interests Harry Potter / castles / double-decker / museums. A red double-decker should be a short add-on past Big Ben (no unused route numbers), dinners should name a real family place when one exists and say “family-friendly pub,” and afternoons should be a quiet hotel or park rest — not a hotel pool. Budget is unchanged.

## Honolulu family leftovers (1.19.0)

Confirm `/healthz` says **1.19.0**. On a **cold cache**, generate Seattle → Honolulu, Flying, 1–8 Jul 2027, Mom, Dad, Girl 10, Boy 8, Grandparent, interests “volcano, turtles, surfing lessons, luau, beach”. The destination must be the city of Honolulu, not Honolulu Stadium State Park. Mid days should include a family luau (book ahead), Laniakea Beach turtles (10 ft), a beginner surf lesson at Waikīkī, and Diamond Head (with a Big Island volcano note) — or a plain “We couldn’t fit” line. Dinners must not be Bar Leather Apron, must not repeat, and Leonard’s Bakery should not be dinner. Beaches should be Waikīkī, Kailua, Hanauma Bay, Ko Olina or Ala Moana rather than Keʻehi Lagoon or Kalaeloa. Ships are not “indoor exhibits”. July weather should use “Usually sunny” / “quick showers are common but short” rather than “rained on about almost all of these days”. Day notes cap at three with no stray “beach” token; beach safety appears once. Then Detroit → Cancún (same infant family as 1.18.2): “Baby needs their own passport” is visible in the default Before you leave view, and “artifacts” (not “artefacts”) in US wording. Budget is unchanged.

## Live QA leftovers: weather, backups, passport, dinners (1.18.2)

Confirm `/healthz` says **1.18.2**. On a **cold cache**, regenerate Detroit → Cancún, Flying, 20–27 Mar 2027, Mom, Dad, Girl 10, Grandparent, Infant 1. Weather should read as a plain wet-chance line (not “33% usually dry”). Day 4 should not schedule Nichupté Vehicular Bridge. Every mid-trip rain backup should name a real indoor place, with a short kid hint where useful. Day notes should be at most three, with one merged optional Chichén Itzá / Tulum line. Prep and/or the infant packing row should show that the baby needs their own passport. Then Detroit → Orlando (Disney family as in 1.18.1): every major park day should have a pool or rest afternoon, Holy Land Experience should be absent from Local highlights, and dinner slots should not use Le Coq Au Vin or Kres Chophouse. Budget is unchanged.

## Orlando Disney regression and wet-day consistency (1.18.1)

Confirm `/healthz` says **1.18.1**. On a **cold cache**, generate Detroit → Orlando, Driving, 20–27 Dec 2026, Mom, Dad, Girl 10, Boy 6, Infant 1, interests “Disney World, theme parks, princesses, rides” (Theme & water parks ticked). Expect one major park per day with pool rest, Magic Kingdom / EPCOT / Hollywood Studios / Animal Kingdom preferred, no Holy Land Experience, and no Champions Sports Bar on the restaurants list. Then Detroit → Cancún (same family dates as 1.18.0). Optional Chichén Itzá / Tulum notes should use the real drive times and not repeat “(ask a grown-up)”. Rain backups should name Museo Maya de Cancún or an aquarium/mall when available. Wet-day summary, day labels and rain-jacket wear should agree; a wet depart day should have a short rain note. Prep for a US home should say “neighbor”, and an infant on an international trip should get “Baby needs their own passport”. Budget is unchanged.

## Cancún family travel and Grand Canyon leftovers (1.18.0)

Confirm `/healthz` says **1.18.0**. On a **cold cache**, generate Detroit → Cancún, Flying, 20–27 Mar 2027, Mom, Dad, Girl 10, Grandma (Woman, 65+ or Grandparent), Infant 1, interests “beach, swimming, snorkeling, pyramids, ice cream”. Expect closer Mayan ruins (El Rey / El Meco), Chichén Itzá as an optional big day trip with the baby note, a named snorkel spot, an ice cream break, preferred family beaches without “Playa … | Playa …” duplicates, a beach-safety note, bottled-water / mosquito / sit-down food notes, Mexican pesos and a few Spanish phrases, “Same plugs as home — no adapter needed”, infant passport and 2-day carry-on diapers, a hotel nap break, and gentle pacing for Grandma. The depart day should say “head to the airport”. Wet-day wording should match “Wet days ~N” (or usually dry). Start here should not lead with a waterproof shell on a hot, mostly-dry trip.

Then Phoenix → Grand Canyon, Driving, 14–18 Jun 2027, Girl 10 / Boy 4. Mather Point should not appear as a standalone hike on a later day if sunset or the Rim Trail already named it. Rain backups should be unique named indoor places (not the same museum twice, and not a generic café line when Hopi House or the visitor center is free). Every itinerary day should show What to wear. Budget is unchanged.

## Kid pacing, packing wording, and national-park specifics (1.17.2)

Confirm `/healthz` says **1.17.2**. Cold-cache generate the London family fixture (Chicago → London, UK, Flying, 10–17 Jul 2027, boy 10 and girls 7, 7, Harry Potter / castles / double-decker / museums). Warner Bros. should be a morning with only rest or one light afternoon — Platform 9¾ and the bus should sit on lighter days, not all stacked after the studio tour. Days should not pair two big indoor sights (e.g. Windsor + V&A). The kids note should match the day. A “Rain likely” day should name an indoor backup. Then Phoenix → Grand Canyon, Driving, 14–18 Jun 2027, Girl 10 / Boy 4. Day 1 should mention “Set up at your campsite” (not as a later morning activity), a sunset or rim walk, and an altitude note if elevation is above ~6,500 ft. No Maswik Lodge or Grand Canyon Lodge Dining Room mixed in from the North Rim; dinners stay near the South Rim. No slot should be just “Grand Canyon National Park”. Packing (Simple and detailed, including print) must show “Driver's license”, never “Driving licence”. What to wear should mention a sun hat in the heat. Wupatki / Phantom Ranch in Highlights should show a distance or hike-in caveat. Budget is unchanged.

## Kid and heat safety, guaranteed interests (1.17.1)

Confirm `/healthz` says **1.17.1**. Generate Chicago → London, UK (Flying, 10–17 Jul 2027, family with a 10-year-old and twin 7-year-olds, interests Harry Potter / castles / double-decker / museums) on a **cold cache**. Warner Bros. Studio Tour London must appear in a mid-day slot (not only Suggestions), a double-decker should be an afternoon add-on, and dinners must be casual — not The Dorchester, Le Gavroche, Restaurant Gordon Ramsay, Bob Bob Ricard or The Wolseley. Plug prep should not mention “GB type G”. Then generate Phoenix → Grand Canyon, Driving, 14–18 Jun 2027, Mom/Dad/Girl 10/Boy 4, interests hiking/camping/animals/stars, highs around 96–100°F. Day 1 should be a sunset viewpoint, hikes should be short rim/easy walks with heat and railing notes, no Wupatki-length side trip, rain backup a visitor center or museum (never Phantom Ranch), Start here should feature sun/water not a rain shell, and packing should include ~1 gallon of water per person per day. Typing “Grand Canyon” should plan Grand Canyon National Park without a blocking chooser (at most four alternatives). Budget is unchanged.

## Kid-friendliness batch 4 (1.17.0)

Confirm `/healthz` says **1.17.0**. Generate Chicago → London, Flying, 10–17 Jul 2027, Family, Mix, interests “Harry Potter, castles, double-decker bus, museums”, with Mom, Dad, a 10-year-old boy and twin 7-year-old girls. Day 1 should be an overnight flight (land the next morning) with a jet-lag note (London is 6 hours ahead). Day 2 should be a light arrival day. Mid days should name Warner Bros. Studio Tour / Platform 9¾, a red double-decker, or the Tower of London — never a bare “Theme & water parks” slot, and no water-park swimwear unless a water park is on the itinerary. Dinners should be casual, not The Dorchester. “What to wear” should appear once for the mild hoodie-and-rain-jacket stretch, not seven identical shorts lines. Prep should say “UK plugs have 3 big prongs” and use US wording for a US home (traveling, neighbor). At 390–512px (or 250% zoom) the tab bar must not overflow the page. Budget is unchanged.

## Faster first Simple toggle (1.16.2)

Confirm `/healthz` says **1.16.2**. On the Orlando family plan (5 travelers, ~92 items), the first Simple-mode toggle should feel instant — under about 300ms even with 6× CPU throttle — and stay comparable to 1.14.4 or better. A typo in Home city such as `Zzqxhome` should read: We couldn't find "Zzqxhome". Check the spelling or try a bigger city nearby. Budget is unchanged.

## Kid-friendliness batch 3 (1.16.1)

Confirm `/healthz` says **1.16.1**. Generate the Orlando family fixture, then reload: the plan must come back (not a blank page). “Day by day ↓” should land on the Day by day heading. Day 1 should be an overnight drive to the midpoint (e.g. Knoxville) and Day 2 should finish the drive with no major park. US wording should appear (Driver’s license, diapers not “nappies”). Date mistakes should show an inline hint. Budget is unchanged.

## Kid-friendliness batch 2 (1.16.0)

Confirm `/healthz` says **1.16.0**. Use the same Orlando family fixture as 1.15.0 (Detroit → Orlando, Driving, 20–27 Dec 2026, Family, Mix, Disney interests, Mom, Dad, a 10-year-old girl, a 6-year-old boy and an infant). Packing should open with a short “Start here” list and a friendly progress message (not “0 of 92 active items packed”). “My stuff” should filter to one traveler with large tick boxes. Grouped clothing rows should name the people when there are four or fewer. Before you leave should be grouped by timing, with grown-up tasks first. Settings should be the same panel on every tab (Display, Travelers, Packing details), with laundry as No laundry / Once mid-trip / Every few days / Custom and advanced controls behind a disclosure. Highlights should show a plain “Good for kids / Indoor” reason, not raw OSM types. Weather days should include “What to wear”. Budget is unchanged.

## Kid-friendliness batch 1 (1.15.0)

Confirm `/healthz` says **1.15.0**. Generate Detroit → Orlando, Driving, 20–27 Dec 2026, Family, Mix, interests “Disney World, theme parks, princesses, rides”, with Mom, Dad, a 10-year-old girl, a 6-year-old boy and an infant. The travel card should use a road-route drive time in miles (no “great-circle” or border warning). Day 1 should be a drive/rest day with an overnight-stop suggestion. Mid days should have one Disney park each and a pool/hotel rest, not a second Universal park. Dec 24 and 25 should note the holiday. Diapers should scale (e.g. ~8 a day × 8 days). Budget is unchanged.

## Named beach when one is available (1.14.5)

Confirm `/healthz` says **1.14.5**. Generate Cape Town, Flying, 20–25 Nov 2026, with Beach, Food, Hiking, Snorkeling, Museums, Tasting, Nightlife and Sightseeing. The beach afternoon should name a real beach (Camps Bay, Clifton or Muizenberg), not “Beach time at a nearby beach”. That beach should not also appear as that morning’s leftover highlight or on another day. Museum, tasting and nightlife slots should still name real venues. A Zermatt ski plan should still rotate sectors.

## Faster first Simple toggle and unique sights (1.14.4)

Confirm `/healthz` says **1.14.4**. Generate Cape Town, Flying, 20–25 Nov 2026, with Beach, Food, Hiking, Snorkeling, Museums, Tasting, Nightlife and Sightseeing. Lion’s Head (or any other named sight) must not appear on two different days, including a “Hike continues … then …” follow-up or a rain backup. Nightlife should still name a real bar. A Zermatt ski plan should still rotate sectors, keep unique rest-day options, and stay free of dioceses.

On Packing & Prep, the first Simple mode toggle should feel as snappy as later ones (a local store, not a full App re-render). Timeline hides and Before you leave becomes a disclosure, as before.

## Named nightlife and first Simple toggle (1.14.3)

Confirm `/healthz` says **1.14.3**. Generate Cape Town, Flying, 20–25 Nov 2026, with Beach, Food, Hiking, Snorkeling, Museums, Tasting, Nightlife and Sightseeing. The nightlife evening should name a real bar or pub (for example Foresters Arms), not “Nightlife & bars”, and should not reuse that day’s restaurant. A ski town such as Zermatt should still generate cleanly if Nightlife is off, or use a real bar / the generic line if no venue is found.

On Packing & Prep, the first Simple mode toggle should feel as snappy as later ones (lists are warmed during idle; print copy is deferred).

## Place quality and slot balance (1.14.2)

Confirm `/healthz` says **1.14.2**. Generate Cape Town, Flying, 20–25 Nov 2026, with Beach, Food, Hiking, Snorkeling, Museums, Tasting, Nightlife and Sightseeing. Mid-trip days should name real beaches (Camps Bay, Clifton or Muizenberg), a real museum (Zeitz MOCAA or Iziko) rather than V&A Waterfront, a named bar for nightlife, tasting in the afternoon, and snorkeling as a dive operator or snorkel beach — not Two Oceans Aquarium. The same place should not appear twice on one day. Food prep should be a single “tickets and reserve popular restaurants” timeline task.

Generate Zermatt, Flying, 3–9 Jan 2027, Skiing (Beach may also be selected; it should be omitted in January). Rest-day options should not be a diocese, that morning’s ski sector, or a climbing peak as a visit (peaks only as “views of …”). Prefer the Matterhorn Museum, a lake, a village, a viewpoint or a Gornergrat railway ride. “Riffelalp decauville” should be cleaned to Riffelalp.

Optional: the first Simple mode toggle should feel closer to later toggles (lists mount on the first switch, but the print copy waits until print).

## Activity scheduling fixes (1.14.1)

Confirm `/healthz` says **1.14.1**. At most two Generates:

1. Cape Town, Flying, ~6 days, eight activities including beach, snorkeling, tasting and nightlife. Beach days should name a real beach (Camps Bay or Clifton), not the V&A Waterfront. Snorkeling should appear in a morning, tasting in an afternoon, nightlife in an evening. In Packing & Prep, activity tasks (tickets, reservations, dive notes) should appear once on the timeline, not also in the checklist. Switch Simple mode: the first toggle should feel instant (well under a second).
2. Zermatt in January, Flying, Skiing and Beach. The beach note should use your temperature unit and beach must not appear on any day, packing list or prep. Ski mornings should rotate between sectors (or vary the wording if only one is found). Rest-day options should be easy in-town or lift-accessible sights, or “views of” a peak, not a Matterhorn climb.
