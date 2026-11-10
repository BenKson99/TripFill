import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { TravelerFields, travelerRows, editTraveler, commitName } from "../src/Travelers.js";
import { packingMembers } from "../shared/packing.js";
const values = (html: string) => [...html.matchAll(/aria-label="Name for traveler \d+"[^>]*value="([^"]*)"|value="([^"]*)"[^>]*aria-label="Name for traveler \d+"/g)].map(m => m[1] ?? m[2]);
test("v1.11.1: questionnaire boxes hold real values Traveler 1, Traveler 2, Traveler 3 (not placeholders)", () => {
  const html = renderToStaticMarkup(<TravelerFields idPrefix="form-traveler" members={travelerRows([], 3)} onEdit={() => {}} />);
  assert.deepEqual(values(html), ["Traveler 1", "Traveler 2", "Traveler 3"]);
  assert.ok(!html.includes("placeholder"));
});
test("adding travelers appends sequential defaults and keeps custom names, types and ids", () => {
  let m = editTraveler([], 2, "traveler-1", { name: "Ben" }); m = editTraveler(m, 2, "traveler-2", { type: "infant" });
  const rows = travelerRows(m, 4);
  assert.deepEqual(rows.map(r => [r.id, r.name, r.profile]), [["traveler-1", "Ben", undefined], ["traveler-2", "Traveler 2", "infant"], ["traveler-3", "Traveler 3", "infant"], ["traveler-4", "Traveler 4", "infant"]], "new rows inherit the most common / last chosen type");
  const back = travelerRows(editTraveler(m, 1, "traveler-1", { name: "Ben K" }), 2);
  assert.deepEqual(back.map(r => r.name), ["Ben K", "Traveler 2"]); assert.equal(back[1].profile, "infant", "shrink/re-expand keeps drafts");
});
test("clearing a name: typing blank is not saved, blur/submit falls back to Traveler N; type is kept", () => {
  assert.equal(commitName("", 2, false), null); assert.equal(commitName("   ", 2, false), null);
  assert.equal(commitName("", 2, true), "Traveler 3"); assert.equal(commitName("A", 0, false), "A"); assert.equal(commitName("x".repeat(90), 0, true)!.length, 80);
  assert.deepEqual(packingMembers({ members: [{ id: "traveler-1", name: "  ", profile: "girl" }] }, 1), [{ id: "traveler-1", name: "Traveler 1", profile: "girl" }], "blank name never drops the type");
});
