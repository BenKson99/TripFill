# Packing studio v1.8.0 — acceptance guide

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
npx tsx scripts/packing-qa.ts seed /workspace/tripfill-v1.8.0-qa
NODE_ENV=production HOST=127.0.0.1 PORT=8847 TRIPFILL_DISABLE_AI=1 \
  TRIPFILL_CACHE_DIR=/workspace/tripfill-v1.8.0-qa/http-cache \
  TRIPFILL_SHARE_DIR=/workspace/tripfill-v1.8.0-qa/local-shares npm start
# In another shell:
npx tsx scripts/packing-qa.ts verify /workspace/tripfill-v1.8.0-qa http://127.0.0.1:8847
```

The generated `*-link.txt` files open read-only snapshots. The `.json` files import as editable trips (use **Import trip JSON**). Import can replace the current plan; do not do this on the live site with an unexported personal trip. `report.json` records HTTP assertions.

**All fixture weather, places and prices are synthetic QA data, not real travel advice or actual recommendations.** The injected cache is in a separate local directory, never committed or deployed. Cache seed data expires after 24h: reseed before rerunning. The optional `dist/packing-qa.html` handoff index is generated locally only and is not a deployment artifact.

## Focused browser acceptance (parent runs; executor did no browser automation)

1. Confirm `/healthz` says **1.8.0**. Open 127.0.0.1:8847, not an older port or `localhost` with existing data. At 390px and desktop width, import `warm-short.json`, select Packing & Prep. All labels/reasons should wrap without horizontal scrolling; try dark mode. Warm fixture: 3 tops, 4 underwear, swimwear, no winter coat. Confirm Everyone / Shared / Traveler tabs, clothing rewear and activity-kit settings, Essential vs Optional weather reasons, and need-to-buy / ready / packed / departure-day status.
2. Tick an item; edit a different item's name/quantity; choose a bag and move it to Activities. Mark an item Not needed: it leaves the active denominator. Search, category, bag, Still to pack, Essentials, Last-minute and Not needed filters should intersect correctly. Category count reflects its entire category, not just search matches. Clear filters to restore all rows.
3. Add “My journal”, mark it Essential. Remove another item, use Undo: name, quantity, bag and tick return. Remove it again and refresh suggestions: it must not resurrect. Reload: edits, settings, checks, not-needed status, removals and the last removal undo survive. Only the latest removal is undoable; older removed suggestions remain dismissed.
4. Settings: choose wash every 2 days and carry-on only. Quantities must stay unchanged until **Refresh suggestions**. After refresh, untouched clothing changes; edited rows/checks/skips stay. Existing obsolete rows are never deleted. Existing manually assigned bags stay protected. No bag labels imply airline approval.
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
