// Regression for v1.3.1: food for a new destination must not reuse another city's cached list.
import assert from "node:assert/strict";
import { foodKey } from "../server/food.js";
import { elsewhere } from "../server/places.js";
const porto = foodKey("Portugal", "pt", ["Francesinha", "Tripas à moda do Porto"]);
const lisbon = foodKey("Portugal", "pt", ["Pastel de nata", "Bifana"]);
assert.notEqual(porto, lisbon, "same-country cities must get separate food cache entries");
assert.equal(foodKey("Portugal", "pt", ["B", "a"]), foodKey("Portugal", "pt", ["A", "b"]), "key ignores order/case");
assert.notEqual(foodKey("Japan", "ja", []), foodKey("Argentina", "es", []));
const fr = { description: "Francesinha is a Portuguese sandwich, originally from Porto, made with..." };
assert.equal(elsewhere(fr, { name: "Lisbon", country: "Portugal" }), true);
assert.equal(elsewhere(fr, { name: "Porto", country: "Portugal" }), false);
assert.equal(elsewhere({ description: "Caldo verde is a popular soup in Portuguese cuisine." }, { name: "Lisbon", country: "Portugal" }), false);
console.log("food-key test: ok");
