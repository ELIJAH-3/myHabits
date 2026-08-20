import assert from "node:assert/strict";
import test from "node:test";
import { pinScrollIfReordering } from "../js/ui.js";

test("pinScrollIfReordering restores the locked calendar offset while dragging", () => {
  const wrap = { scrollLeft: 480 };
  assert.equal(pinScrollIfReordering(wrap, 120, true), true);
  assert.equal(wrap.scrollLeft, 120);
});

test("pinScrollIfReordering does not move the calendar when not reordering", () => {
  const wrap = { scrollLeft: 480 };
  assert.equal(pinScrollIfReordering(wrap, 120, false), false);
  assert.equal(wrap.scrollLeft, 480);
  assert.equal(pinScrollIfReordering(wrap, null, true), false);
  assert.equal(wrap.scrollLeft, 480);
});
