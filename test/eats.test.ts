// v1.4.0: restaurants/coffee shops replace dish lists.
import assert from "node:assert/strict";
import { eatsKey, rankEats, migrateEats, CHAIN, type Eat } from "../server/eats.js";
assert.notEqual(eatsKey({ name: "Porto", lat: 41.15, lon: -8.61 }), eatsKey({ name: "Lisbon", lat: 38.72, lon: -9.14 }), "per-city cache keys");
assert.match(eatsKey({ name: "Porto", lat: 41.15, lon: -8.61 }), /^eats\|v2\|/);
const e = (name: string, kind: Eat["kind"], s: number, lat = 41.15, lon = -8.61): any => ({ name, kind, source: "OpenStreetMap", lat, lon, _s: s });
const r = rankEats([e("Café Majestic", "cafe", 5), e("Cafe Majestic", "cafe", 3), e("Brasão", "restaurant", 4), e("Tasca X", "restaurant", 2, 41.2, -8.6)]);
assert.equal(r.cafes.length, 1, "accent/case near-duplicates collapse");
assert.deepEqual(r.restaurants.map(x => x.name), ["Brasão", "Tasca X"], "ranked by score");
assert.equal(rankEats([e("Café Âncora d'Ouro", "cafe", 5), e("Café Piolho / Âncora d'Ouro", "cafe", 4)]).cafes.length, 1, "slash aliases collapse");
assert.ok(!("_s" in r.restaurants[0]));
assert.ok(CHAIN.test("Starbucks Coffee") && !CHAIN.test("Café Majestic"));
assert.ok(CHAIN.test("Chicken Licken"), "SA fast-food chain");
assert.deepEqual(migrateEats({ food: [{ name: "Francesinha" }] }), { restaurants: [], cafes: [] }, "old plans don't crash");
console.log("eats test: ok");
