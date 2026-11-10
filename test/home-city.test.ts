import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { homeGenerateFields, homeLookupQuery, homeTextMatches, placeLabel } from "../shared/homeCity.js";
import { resolveHomeCity } from "../server/home.js";

const detroit = { id: 1, name: "Detroit", admin1: "Michigan", country: "United States", countryCode: "US", lat: 42.33, lon: -83.05 };
const chicago = { id: 2, name: "Chicago", admin1: "Illinois", country: "United States", countryCode: "US", lat: 41.88, lon: -87.63 };

test("v1.12.1: typed Home city is sent for Generate even if lookup has not finished (the incognito race)", () => {
  // Testers typed "Detroit" and pressed Generate before blur/geocode wrote a place into state.
  const body = homeGenerateFields("Detroit", null);
  assert.deepEqual(body, { home: undefined, homeCity: "Detroit" });
  assert.deepEqual(homeLookupQuery("Detroit", null), { query: "Detroit", reuse: null });
});

test("v1.12.1: already-resolved Home city is reused; a changed or cleared field is not silently kept", () => {
  assert.equal(placeLabel(detroit), "Detroit, Michigan, United States");
  assert.ok(homeTextMatches(detroit, "Detroit"));
  assert.ok(homeTextMatches(detroit, "Detroit, Michigan, United States"));
  assert.deepEqual(homeGenerateFields("Detroit, Michigan, United States", detroit).home, detroit);
  assert.equal(homeGenerateFields("Detroit, Michigan, United States", detroit).homeCity, "Detroit, Michigan, United States");
  assert.equal(homeLookupQuery("Chicago", detroit).query, "Chicago");
  assert.equal(homeGenerateFields("Chicago", detroit).home, undefined);
  assert.deepEqual(homeGenerateFields("  ", detroit), { home: undefined, homeCity: undefined });
  assert.deepEqual(homeGenerateFields("", null), { home: undefined, homeCity: undefined });
});

test("v1.12.1: the server geocodes typed homeCity like destination, and errors instead of dropping a bad name", async () => {
  const found = await resolveHomeCity({ homeCity: "Detroit" }, async q => { assert.equal(q, "Detroit"); return [detroit]; });
  assert.equal(found, detroit);
  const reused = await resolveHomeCity({ homeCity: "Detroit", home: detroit }, async () => { throw new Error("must not geocode"); });
  assert.equal(reused, detroit);
  const switched = await resolveHomeCity({ homeCity: "Chicago", home: detroit }, async q => { assert.equal(q, "Chicago"); return [chicago]; });
  assert.equal(switched, chicago);
  await assert.rejects(() => resolveHomeCity({ homeCity: "NotAPlace" }, async () => []), { message: 'Couldn\'t find home city "NotAPlace"', status: 404 });
  assert.equal(await resolveHomeCity({ home: detroit }, async () => { throw new Error("must not geocode"); }), detroit, "older clients that only send home still work");
  assert.equal(await resolveHomeCity({}, async () => { throw new Error("no"); }), undefined);
});

test("v1.12.1: Generate sends the typed Home city; destination stays a live form string (no same race)", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.ok(app.includes("homeGenerateFields(homeText, homeCity)"));
  assert.ok(app.includes("...homeFields"));
  assert.ok(app.includes("setHomeErr"));
  assert.ok(app.includes('text={homeText}'));
  assert.match(app, /JSON\.stringify\(\{ \.\.\.form[\s\S]*destination/);
  assert.match(app, /value=\{form\.destination\} onChange=\{e => setForm/);
});
