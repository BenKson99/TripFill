import test from "node:test";
import assert from "node:assert/strict";
import { isTabbable, tabbables, trapTarget } from "../src/SettingsMenu.js";
const el = (name: string, o: { disabled?: boolean; hidden?: boolean; tabindex?: string; rendered?: boolean } = {}) => ({
  name, matches: (s: string) => s === ":disabled" && !!o.disabled, closest: (_: string) => o.hidden ? {} : null,
  getAttribute: (n: string) => n === "tabindex" ? o.tabindex ?? null : null, getClientRects: () => ({ length: o.rendered === false ? 0 : 1 }),
});
test("v1.8.3 focus trap: forward Tab on last control wraps to first; Shift+Tab on first wraps to last", () => {
  const close = el("close"), theme = el("theme"), forget = el("Forget template");
  const list = [close, theme, forget];
  assert.equal(trapTarget(list, forget, false), close);
  assert.equal(trapTarget(list, close, true), forget);
  assert.equal(trapTarget(list, theme, false), null);
  assert.equal(trapTarget(list, theme, true), null);
  assert.equal(trapTarget(list, { name: "Copy share link" }, false), close, "focus outside is pulled back in");
  assert.equal(trapTarget([], close, false), null);
});
test("v1.8.3 focus trap ignores disabled, hidden, tabindex=-1 and unrendered controls, keeps DOM order", () => {
  const nodes = [el("close"), el("°F"), el("refresh-ro", { disabled: true }), el("hiddenBtn", { hidden: true }), el("skip", { tabindex: "-1" }), el("gone", { rendered: false }), el("last")];
  assert.ok(!isTabbable(nodes[2]) && !isTabbable(nodes[3]) && !isTabbable(nodes[4]) && !isTabbable(nodes[5]));
  const list = tabbables({ querySelectorAll: () => nodes as any }) as any[];
  assert.deepEqual(list.map(n => n.name), ["close", "°F", "last"]);
  assert.equal(trapTarget(list, list[2], false).name, "close", "read-only: last enabled control wraps even when settings are disabled");
});
