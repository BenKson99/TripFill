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

1. Confirm `/healthz` says **1.13.1**. Open 127.0.0.1:8847, not an older port or `localhost` with existing data. At 390px and desktop width, import `warm-short.json`, select Packing & Prep. All labels/reasons should wrap without horizontal scrolling; try dark mode. Warm fixture: 3 tops, 4 underwear, swimwear, no winter coat. Confirm Everyone / Shared / Traveler tabs; open ⚙ Settings (top right) or “Packing settings…” above the list and confirm the Packing section holds laundry, rewear, spares, traveler names, activity kits, Refresh suggestions and personal essentials (Tab/Shift+Tab stay inside the menu, Escape closes it and returns focus); confirm Essential vs Optional weather reasons, and need-to-buy / ready / packed / departure-day status.
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
2. Switch the mode to Flying on the travel card (or ⚙ Settings → Packing). Travel time should become a nonstop flight estimate without a new weather wait. Your ticks and edited packing rows stay; driving items already added stay until you remove them. The depart-day line should read “head to the airport/station” if you had not edited it.
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
