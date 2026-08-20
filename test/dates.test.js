import assert from "node:assert/strict";
import test from "node:test";
import { MONTHS, WEEKDAYS } from "../js/constants.js";
import {
  addDays,
  diffDays,
  formatClock,
  formatShort,
  mondayOf,
  parseISODate,
  toISODate,
} from "../js/dates.js";

test("toISODate and parseISODate round-trip local calendar days", () => {
  const date = parseISODate("2026-08-20");
  assert.equal(toISODate(date), "2026-08-20");
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 7);
  assert.equal(date.getDate(), 20);
});

test("addDays crosses month and year boundaries", () => {
  assert.equal(toISODate(addDays(parseISODate("2026-01-31"), 1)), "2026-02-01");
  assert.equal(toISODate(addDays(parseISODate("2026-12-31"), 1)), "2027-01-01");
  assert.equal(toISODate(addDays(parseISODate("2024-02-28"), 1)), "2024-02-29");
});

test("diffDays is signed and timezone-safe", () => {
  assert.equal(diffDays(parseISODate("2026-08-01"), parseISODate("2026-08-20")), 19);
  assert.equal(diffDays(parseISODate("2026-08-20"), parseISODate("2026-08-01")), -19);
});

test("month names are uppercase in clock and short formats", () => {
  const date = parseISODate("2026-08-20");
  assert.equal(WEEKDAYS[date.getDay()], "THU");
  assert.equal(formatClock(date), "THU 20 AUGUST 2026");
  assert.equal(formatShort(date), "20 AUGUST 2026");
  for (const month of MONTHS) {
    assert.match(month, /^[A-Z]+$/);
  }
});

test("mondayOf maps Sunday back to the previous Monday", () => {
  assert.equal(toISODate(mondayOf(parseISODate("2026-08-16"))), "2026-08-10");
  assert.equal(toISODate(mondayOf(parseISODate("2026-08-17"))), "2026-08-17");
  assert.equal(toISODate(mondayOf(parseISODate("2026-08-20"))), "2026-08-17");
});
