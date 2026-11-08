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
test("v1.8.2: packing configuration lives in the Settings menu, not the always-visible packing top", async () => {
  const { PackingSettingsPanel } = await import("../src/Packing.js");
  const html = renderToStaticMarkup(<PackingWorkspace plan={fixture()} readOnly={false} onChange={() => {}} T={s => s} openSettings={() => {}} />);
  assert.ok(!html.includes("Laundry plan")); assert.ok(!html.includes("Rewear tops")); assert.ok(!html.includes("Optional activity kits"));
  assert.ok(html.includes('data-testid="packing-settings-open"')); assert.ok(html.includes('type="search"')); assert.ok(html.includes("Add item</button>"));
  const ro = renderToStaticMarkup(<PackingSettingsPanel plan={fixture()} p={fixture().packing} readOnly change={() => { throw new Error("Must not mutate"); }} setMessage={() => {}} />);
  assert.ok(ro.includes('<fieldset disabled="" class="packing-edit">')); assert.ok(ro.includes("Rewear tops")); assert.ok(ro.includes("Refresh suggestions")); assert.ok(!ro.includes("Save essentials"));
  const own = renderToStaticMarkup(<PackingSettingsPanel plan={fixture()} p={fixture().packing} readOnly={false} change={() => {}} setMessage={() => {}} />);
  assert.ok(!own.includes("disabled")); assert.ok(own.includes("Save essentials"));
});
test("v1.8.2: Settings menu is a labelled dialog, closed by default, with theme and temperature", async () => {
  const g = globalThis as any; g.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const { SettingsMenu } = await import("../src/SettingsMenu.js");
  const html = renderToStaticMarkup(<SettingsMenu open={false} setOpen={() => {}} unit="F" setUnit={() => {}} />);
  assert.ok(html.includes('aria-expanded="false"')); assert.ok(/role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="settings-title"[^>]*hidden=""/.test(html));
  assert.ok(html.includes('aria-label="Temperature unit"')); assert.ok(html.includes('aria-label="Colour theme"')); assert.ok(html.includes("noprint"));
});
