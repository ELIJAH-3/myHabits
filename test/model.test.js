import assert from "node:assert/strict";
import test from "node:test";
import { IDENTITY_TAU, MIN_HISTORY } from "../js/constants.js";
import { addDays, parseISODate, toISODate } from "../js/dates.js";
import {
  allStreaks,
  boundedTimelineStart,
  emptyData,
  habitScore,
  habitStreak,
  identityCaption,
  identitySeries,
  longestStreak,
  newId,
  overallScore,
  reorderHabits,
  todayCounts,
  toggleCheck,
} from "../js/model.js";
import { dataFor, habit, isoRange, perfect } from "./helpers.js";

function maturityScore(dayCount) {
  return Math.round((1 - Math.exp(-dayCount / IDENTITY_TAU)) * 100);
}

test("empty data has no habits and no checks", () => {
  assert.deepEqual(emptyData(), { habits: [], checks: {} });
});

test("newId returns unique values", () => {
  const ids = new Set(Array.from({ length: 20 }, () => newId()));
  assert.equal(ids.size, 20);
});

test("perfect attendance score equals the maturity curve, not a raw percentage", () => {
  const asOf = "2026-03-16";
  const { habit: item, data } = perfect("h1", "2026-01-01", asOf);
  const days = isoRange("2026-01-01", asOf).length;
  assert.equal(days, 75);
  assert.equal(habitScore(data, item, null, asOf), maturityScore(days));
  assert.equal(habitScore(data, item, null, asOf), 81);
});

test("a new habit cannot reach 100% in the first weeks", () => {
  const { habit: week, data: weekData } = perfect("n1", "2026-08-01", "2026-08-07");
  const { habit: month, data: monthData } = perfect("n2", "2026-07-01", "2026-07-30");
  assert.equal(habitScore(weekData, week, null, "2026-08-07"), 14);
  assert.ok(habitScore(weekData, week, null, "2026-08-07") < 50);
  assert.equal(habitScore(monthData, month, null, "2026-07-30"), 49);
  assert.ok(habitScore(monthData, month, null, "2026-07-30") < 100);
});

test("100% second nature needs a long mature run, not a short perfect streak", () => {
  const short = perfect("s", "2026-01-01", "2026-01-21");
  const long = perfect("l", "2025-01-01", "2026-01-01");
  assert.ok(habitScore(short.data, short.habit, null, "2026-01-21") < 40);
  assert.equal(habitScore(long.data, long.habit, null, "2026-01-01"), 100);
  assert.equal(identityCaption(100), "second nature");
});

test("missed days pull the score below a perfect run of the same length", () => {
  const asOf = "2026-01-21";
  const { habit: item, data: perfectData } = perfect("p", "2026-01-01", asOf);
  const sparse = dataFor(
    item,
    isoRange("2026-01-01", asOf).filter((_, index) => index % 2 === 0)
  );
  assert.ok(habitScore(sparse, item, null, asOf) < habitScore(perfectData, item, null, asOf));
});

test("identity series is clamped to 0–100 and one point per day", () => {
  const { habit: item, data } = perfect("h", "2026-01-01", "2026-01-10");
  const series = identitySeries(data, item, "2026-01-10");
  assert.equal(series.length, 10);
  assert.equal(series[0].iso, "2026-01-01");
  assert.equal(series.at(-1).iso, "2026-01-10");
  for (const point of series) {
    assert.ok(point.score >= 0 && point.score <= 100);
  }
});

test("score memo returns the cached value even if checks change", () => {
  const { habit: item, data } = perfect("h", "2026-01-01", "2026-01-10");
  const memo = new Map();
  const first = habitScore(data, item, memo, "2026-01-10");
  data.checks.h["2026-01-10"] = false;
  assert.equal(habitScore(data, item, memo, "2026-01-10"), first);
});

test("identity captions follow the published thresholds", () => {
  assert.equal(identityCaption(0), "spark");
  assert.equal(identityCaption(39), "spark");
  assert.equal(identityCaption(40), "forming");
  assert.equal(identityCaption(70), "rooted");
  assert.equal(identityCaption(90), "identity");
  assert.equal(identityCaption(100), "second nature");
});

test("current streak counts consecutive days ending today or yesterday", () => {
  const item = habit("h", "2026-01-01");
  const live = dataFor(item, ["2026-01-08", "2026-01-09", "2026-01-10"]);
  const endedYesterday = dataFor(item, ["2026-01-08", "2026-01-09"]);
  const broken = dataFor(item, ["2026-01-08", "2026-01-10"]);
  assert.equal(habitStreak(live, item, "2026-01-10"), 3);
  assert.equal(habitStreak(endedYesterday, item, "2026-01-10"), 2);
  assert.equal(habitStreak(broken, item, "2026-01-10"), 1);
});

test("allStreaks ranks by length and marks the live run", () => {
  const item = habit("h", "2026-01-01");
  const data = dataFor(item, [
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
    "2026-01-05",
    "2026-01-08",
    "2026-01-09",
    "2026-01-10",
  ]);
  const streaks = allStreaks(data, item, "2026-01-10");
  assert.equal(longestStreak(data, item, "2026-01-10"), 3);
  assert.equal(streaks[0].length, 3);
  assert.equal(toISODate(streaks[0].start), "2026-01-08");
  assert.equal(streaks[0].live, true);
  assert.equal(streaks[1].length, 3);
  assert.equal(streaks[1].live, false);
});

test("overall score averages habits and todayCounts only looks at asOf", () => {
  const a = habit("a", "2026-01-01");
  const b = habit("b", "2026-01-01");
  const data = {
    habits: [a, b],
    checks: {
      a: { "2026-01-10": true },
      b: {},
    },
  };
  assert.deepEqual(todayCounts(data, "2026-01-10"), { done: 1, total: 2 });
  assert.deepEqual(todayCounts(data, "2026-01-09"), { done: 0, total: 2 });
  assert.equal(overallScore(emptyData()), 0);
});

test("timeline stays bounded: 90 days back, or earlier real data, and never shrinks", () => {
  const asOf = parseISODate("2026-08-20");
  const floor = addDays(asOf, -(MIN_HISTORY - 1));
  assert.equal(toISODate(floor), "2026-05-23");

  const fromToday = boundedTimelineStart(emptyData(), asOf, asOf);
  assert.equal(toISODate(fromToday), "2026-05-23");

  const alreadyOpen = boundedTimelineStart(emptyData(), floor, asOf);
  assert.equal(toISODate(alreadyOpen), "2026-05-23");

  const item = habit("h", "2026-01-01");
  const historic = dataFor(item, ["2026-01-01"]);
  const expanded = boundedTimelineStart(historic, asOf, asOf);
  assert.equal(toISODate(expanded), "2026-01-01");

  const frozenPast = parseISODate("2025-01-01");
  const kept = boundedTimelineStart(emptyData(), frozenPast, asOf);
  assert.equal(toISODate(kept), "2025-01-01");
});

test("reorderHabits moves the dragged row onto the drop target", () => {
  const habits = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(
    reorderHabits(habits, "a", "c").map((item) => item.id),
    ["b", "a", "c"]
  );
  assert.deepEqual(
    reorderHabits(habits, "c", "a").map((item) => item.id),
    ["c", "a", "b"]
  );
  assert.equal(reorderHabits(habits, "a", "a"), habits);
});

test("toggleCheck is immutable, ignores future days, and flips the same day", () => {
  const asOf = "2026-08-20";
  const start = emptyData();
  const on = toggleCheck(start, "h", "2026-08-20", asOf);
  assert.equal(start.checks.h, undefined);
  assert.equal(on.checks.h["2026-08-20"], true);
  const off = toggleCheck(on, "h", "2026-08-20", asOf);
  assert.equal(off.checks.h["2026-08-20"], undefined);
  const future = toggleCheck(start, "h", "2026-08-21", asOf);
  assert.equal(future, start);
});
