import assert from "node:assert/strict";
import { rankEats, cuisineClass, NOT_CAFE } from "../server/eats.js";
import { sortPlaces, todayIn, isPopulated } from "../server/weather.js";
const e = (name: string, tag: string, s: number, kind: any = "restaurant"): any => ({ name, tag, kind, source: "OpenStreetMap", lat: 38.72 + s / 1000, lon: -9.14, _s: s });
const r = rankEats([e("Tibet Kitchen", "tibetan", 9), e("Poke Bowl", "poke", 8.5), e("Pasta Casa", "italian", 8), e("Sushi X", "sushi", 7.9), e("Tasca do Zé", "portuguese", 5), e("Marisqueira", "seafood", 4.5), e("Cervejaria", "restaurant", 4)], undefined, "PT");
assert.equal(r.restaurants[0].name, "Tasca do Zé", "local cuisine leads");
assert.ok(r.restaurants.filter(x => cuisineClass(x.tag, "PT") === "foreign").length <= 2, "foreign capped at 2");
assert.equal(cuisineClass("ramen", "JP"), "local"); assert.equal(cuisineClass("uyghur", "JP"), "foreign");
assert.ok(NOT_CAFE.test("Cinema Ideal") && !NOT_CAFE.test("Café A Brasileira"));
assert.equal(rankEats([e("Cinema Ideal", "café", 9, "cafe"), e("Fábrica Coffee", "café", 3, "cafe")]).cafes.length, 1, "cinema dropped");
const P = (name: string, fc: string, pop?: number): any => ({ id: 1, name, country: "Norway", countryCode: "NO", lat: 0, lon: 0, featureCode: fc, population: pop });
assert.equal(sortPlaces([P("Tromsøya", "ISL", 40000), P("Tromsdalsbreen", "GLCR"), P("Tromsø", "PPLA", 77000)])[0].name, "Tromsø");
assert.ok(!isPopulated(P("x", "ISL", 5)));
// 23:30 EST Nov 4 = 04:30Z Nov 5
const late = new Date("2026-11-05T04:30:00Z");
assert.equal(todayIn("America/Detroit", late), "2026-11-04"); assert.equal(todayIn("Asia/Tokyo", late), "2026-11-05");
console.log("v1.5.2 test: ok");
