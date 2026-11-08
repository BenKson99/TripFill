import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { PackingWorkspace } from "../src/Packing.js";
import { fixture } from "./fixtures.js";
import { packingItems, updatePackingItem } from "../shared/packing.js";
test("read-only packing renders disabled edit controls, no destructive/template actions, but searchable views", () => {
  const html = renderToStaticMarkup(<PackingWorkspace plan={fixture()} readOnly onChange={() => { throw new Error("Must not mutate"); }} T={s => s} />);
  assert.ok(html.includes('<fieldset disabled="" class="packing-edit">')); assert.ok(!html.includes("Save essentials")); assert.ok(!html.includes("Apply essentials")); assert.ok(!html.includes("Add item</button>")); assert.ok(!html.includes(">Remove</button>"));
  assert.ok(html.includes('type="search"')); assert.ok(!/<input[^>]*type="search"[^>]*disabled/.test(html));
});
test("print includes unfiltered complete quantities, names, status, bag, category and literal escaped labels", () => {
  const p = fixture(), first = packingItems(p.packing)[0];
  p.packing = updatePackingItem(p.packing, first.id, { item: "A very long <b>literal</b> personal travel document label", checked: true, quantity: 3, bag: "personal" });
  const html = renderToStaticMarkup(<PackingWorkspace plan={p} readOnly={false} onChange={() => {}} T={s => s} />);
  const print = html.slice(html.indexOf('<div class="packing-print">'));
  assert.ok(print.includes("3 × A very long &lt;b&gt;literal&lt;/b&gt; personal travel document label")); assert.ok(print.includes("[x]")); assert.ok(print.includes("personal · Packed")); assert.ok(print.includes("Documents &amp; Money")); assert.ok(print.includes("Departure day"));
});
