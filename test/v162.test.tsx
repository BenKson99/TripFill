import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { packingItems, simpleLists, groupSimpleRows, simpleGroupLabel, startHereItems } from "../shared/packing.js";
import { localizeEn } from "../shared/enLocale.js";
import { friendlyError } from "../shared/friendlyError.js";

const saved = JSON.parse(readFileSync(new URL("./orlando-family-saved.json", import.meta.url), "utf8"));

test("v1.16.2: grouping and labels for the stored Orlando plan stay well under the toggle budget", () => {
  const p = saved.plan.packing;
  const items = packingItems(p);
  assert.ok(items.length >= 90, `expected ~92 packing items, got ${items.length}`);
  const samples: number[] = [];
  let groups = 0;
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    const lists = simpleLists(p);
    const adults = groupSimpleRows(lists.adults);
    const kids = lists.kids ? groupSimpleRows(lists.kids) : null;
    const starter = startHereItems(p);
    const labels = [...adults.groups, ...(kids?.groups || [])].map(g => localizeEn(simpleGroupLabel(g), "us"));
    const startNames = starter.map(it => localizeEn(it.item, "us"));
    const ms = performance.now() - t0;
    samples.push(ms);
    groups = labels.length;
    assert.ok(labels.some(l => /Mom|Dad|people/.test(l)) || startNames.length, "labels or start-here should be populated");
    void startNames;
  }
  const mid = [...samples].sort((a, b) => a - b)[10];
  assert.ok(groups > 0);
  assert.ok(mid < 25, `grouping+labels median ${mid.toFixed(2)}ms, samples ${samples.map(x => x.toFixed(2)).join(", ")}`);
});

test("v1.16.2: localizeEn caches repeats so dictionary work is not redone per render", () => {
  const phrase = "Driving licence and Diapers / nappies, a jumper, a neighbourhood walk, check the tyres.";
  localizeEn(phrase, "us"); // warm
  const t0 = performance.now();
  let last = "";
  for (let i = 0; i < 20000; i++) last = localizeEn(phrase, "us");
  const ms = performance.now() - t0;
  assert.equal(last, "Driver's license and Diapers, a sweater, a neighborhood walk, check the tires.");
  assert.ok(ms < 20, `20k cached localizeEn calls took ${ms.toFixed(2)}ms`);
});

test("v1.16.2: checklist labels share one ResizeObserver and batch height writes, and T is stable", () => {
  const checklist = readFileSync(new URL("../src/Checklist.tsx", import.meta.url), "utf8");
  assert.match(checklist, /scheduleChecklistResize/);
  assert.match(checklist, /flushChecklistResize/);
  assert.match(checklist, /requestAnimationFrame/);
  assert.ok(!/el\.style\.height = "auto".*scrollHeight/.test(checklist.split("export function ChecklistText")[1] || ""), "ChecklistText must not force a reflow inline in the effect or observer");
  assert.match(checklist, /sharedObserver/);
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /const T = useCallback\(/);
  const packing = readFileSync(new URL("../src/Packing.tsx", import.meta.url), "utf8");
  assert.match(packing, /<StartHere[^>]*T=\{tFn\}/);
});

test("v1.16.2: unknown-city errors keep the typed name in the friendly sentence", () => {
  assert.equal(friendlyError('Couldn\'t find "Zzqxhome"'), 'We couldn\'t find "Zzqxhome". Check the spelling or try a bigger city nearby.');
  assert.equal(friendlyError('Couldn\'t find home city "Zzqxhome"'), 'We couldn\'t find "Zzqxhome". Check the spelling or try a bigger city nearby.');
  const home = readFileSync(new URL("../src/Home.tsx", import.meta.url), "utf8");
  assert.match(home, /setState\(friendlyError\(`Couldn't find "\$\{t\}"`\)\)/);
});
