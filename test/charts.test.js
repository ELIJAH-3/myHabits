import assert from "node:assert/strict";
import test from "node:test";
import { freqBuckets, heatmapHtml, lineChart } from "../js/charts.js";
import { dataFor, habit } from "./helpers.js";

test("month frequency labels are uppercase month names", () => {
  const item = habit("h", "2026-01-15");
  const data = dataFor(item, ["2026-01-15", "2026-01-16", "2026-02-01"]);
  const buckets = freqBuckets(data, item, "month", "2026-02-01");
  assert.deepEqual(
    buckets.map((bucket) => bucket.label),
    ["JANUARY 2026", "FEBRUARY 2026"]
  );
  assert.equal(buckets[0].value, 2);
  assert.equal(buckets[1].value, 1);
});

test("week buckets start on Monday", () => {
  const item = habit("h", "2026-08-17");
  const data = dataFor(item, ["2026-08-17", "2026-08-18", "2026-08-20"]);
  const buckets = freqBuckets(data, item, "week", "2026-08-20");
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].key, "2026-08-17");
  assert.equal(buckets[0].value, 3);
});

test("heatmap month ticks are uppercase 3-letter names and logged days are marked", () => {
  const item = habit("h", "2026-01-01");
  const data = dataFor(item, ["2026-01-02"]);
  const html = heatmapHtml(data, item, 2026);
  assert.match(html, />JAN</);
  assert.match(html, />AUG</);
  assert.equal(html.includes(">Jan<"), false);
  assert.match(html, /title="2026-01-02 · logged"/);
  assert.match(html, /heat-cell on/);
});

test("line chart renders an empty hint when there is no history", () => {
  assert.match(lineChart([]), /No history yet/);
});
