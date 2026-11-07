import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { ChecklistCheckbox, ChecklistText } from "../src/Checklist.js";

test("print markers reflect current checked state, including disabled shared views", () => {
  for (const checked of [false, true, false]) {
    const html = renderToStaticMarkup(<fieldset disabled><ChecklistCheckbox checked={checked} onChange={() => {}} aria-label="Passport" /></fieldset>);
    assert.ok(html.includes(checked ? ">[x]</span>" : ">[ ]</span>"));
    assert.equal(html.includes('checked=""'), checked);
  }
});
test("long checklist labels have complete wrapping/print text, escaped rather than HTML", () => {
  const label = "Passport (check expiry ≥ 6 months) + any visa/entry documents <b>literal text</b>";
  const html = renderToStaticMarkup(<ChecklistText value={label} onChange={() => {}} />);
  assert.match(html, /<textarea[^>]+class="ed checklist-label"/);
  assert.ok(html.includes('<span class="checklist-print-text">'));
  assert.ok(html.includes("&lt;b&gt;literal text&lt;/b&gt;")); assert.ok(!html.includes("<b>"));
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(css, /@media print\{\s*\.pk \.checklist-input,\.pk textarea\.checklist-label\{display:none!important\}/);
  assert.match(css, /\.pk \.print-check\{display:inline-block!important;color:#000!important/);
  assert.match(css, /@media \(max-width:600px\)\{\.grid\{grid-template-columns:minmax\(0,1fr\)\}\}/);
  assert.match(css, /textarea\.checklist-label\{[^}]*white-space:pre-wrap;overflow-wrap:anywhere/);
});
