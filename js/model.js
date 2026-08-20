import { IDENTITY_ALPHA, IDENTITY_TAU, MIN_HISTORY } from "./constants.js";
import { addDays, diffDays, parseISODate, startOfDay, toISODate, today } from "./dates.js";

function asOfDay(asOf) {
  if (!asOf) return today();
  if (asOf instanceof Date) return startOfDay(asOf);
  return startOfDay(parseISODate(asOf));
}

export function emptyData() {
  return { habits: [], checks: {} };
}

export function newId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `h-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function habitChecked(data, habitId, iso) {
  return Boolean(data.checks[habitId] && data.checks[habitId][iso]);
}

export function habitStart(data, habit, asOf) {
  let start = habit.createdAt ? startOfDay(parseISODate(habit.createdAt)) : asOfDay(asOf);
  const checks = data.checks[habit.id] || {};
  for (const iso of Object.keys(checks)) {
    const date = parseISODate(iso);
    if (date < start) start = date;
  }
  return start;
}

export function identitySeries(data, habit, until) {
  const end = asOfDay(until);
  const start = habitStart(data, habit, end);
  const points = [];
  if (start > end) return points;
  let ema = null;
  let dayCount = 0;
  for (let date = start; date <= end; date = addDays(date, 1)) {
    dayCount += 1;
    const x = habitChecked(data, habit.id, toISODate(date)) ? 1 : 0;
    ema = ema === null ? x : ema * (1 - IDENTITY_ALPHA) + x * IDENTITY_ALPHA;
    const maturity = 1 - Math.exp(-dayCount / IDENTITY_TAU);
    points.push({
      date,
      iso: toISODate(date),
      score: Math.max(0, Math.min(100, ema * maturity * 100)),
    });
  }
  return points;
}

export function habitScore(data, habit, memo, asOf) {
  if (memo && memo.has(habit.id)) return memo.get(habit.id);
  const series = identitySeries(data, habit, asOf);
  const score = series.length ? Math.round(series[series.length - 1].score) : 0;
  if (memo) memo.set(habit.id, score);
  return score;
}

export function identityCaption(score) {
  if (score >= 100) return "second nature";
  if (score >= 90) return "identity";
  if (score >= 70) return "rooted";
  if (score >= 40) return "forming";
  return "spark";
}

export function habitStreak(data, habit, asOf) {
  let streak = 0;
  let cursor = asOfDay(asOf);
  if (!habitChecked(data, habit.id, toISODate(cursor))) cursor = addDays(cursor, -1);
  while (habitChecked(data, habit.id, toISODate(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function allStreaks(data, habit, asOf) {
  const end = asOfDay(asOf);
  const start = habitStart(data, habit, end);
  const streaks = [];
  let run = null;
  for (let date = start; date <= end; date = addDays(date, 1)) {
    if (habitChecked(data, habit.id, toISODate(date))) {
      if (!run) run = { start: date, end: date, length: 1 };
      else {
        run.end = date;
        run.length += 1;
      }
    } else if (run) {
      streaks.push(run);
      run = null;
    }
  }
  if (run) streaks.push(run);
  const currentLen = habitStreak(data, habit, end);
  const liveEnd = habitChecked(data, habit.id, toISODate(end)) ? end : addDays(end, -1);
  return streaks
    .map((item) => {
      const live = currentLen > 0 && item.length === currentLen && diffDays(item.end, liveEnd) === 0;
      return Object.assign({ live }, item);
    })
    .sort((a, b) => b.length - a.length || b.end - a.end);
}

export function longestStreak(data, habit, asOf) {
  const streaks = allStreaks(data, habit, asOf);
  return streaks.length ? streaks[0].length : 0;
}

export function overallScore(data, memo, asOf) {
  if (!data.habits.length) return 0;
  const total = data.habits.reduce((sum, habit) => sum + habitScore(data, habit, memo, asOf), 0);
  return Math.round(total / data.habits.length);
}

export function bestStreakAll(data, asOf) {
  return data.habits.reduce((max, habit) => Math.max(max, longestStreak(data, habit, asOf)), 0);
}

export function todayCounts(data, asOf) {
  const iso = toISODate(asOfDay(asOf));
  const total = data.habits.length;
  const done = data.habits.filter((habit) => habitChecked(data, habit.id, iso)).length;
  return { done, total };
}

export function dataEarliest(data, asOf) {
  let min = asOfDay(asOf);
  for (const habit of data.habits) {
    const start = habitStart(data, habit, min);
    if (start < min) min = start;
  }
  return min;
}

export function boundedTimelineStart(data, currentStart, asOf) {
  const now = asOfDay(asOf);
  const floor = addDays(now, -(MIN_HISTORY - 1));
  const earliest = dataEarliest(data, now);
  const need = earliest < floor ? earliest : floor;
  return need < currentStart ? need : currentStart;
}

export function reorderHabits(habits, fromId, toId) {
  if (!fromId || !toId || fromId === toId) return habits;
  const list = habits.slice();
  const from = list.findIndex((habit) => habit.id === fromId);
  if (from < 0) return habits;
  const [item] = list.splice(from, 1);
  const to = list.findIndex((habit) => habit.id === toId);
  if (to < 0) return habits;
  list.splice(to, 0, item);
  return list;
}

export function toggleCheck(data, habitId, iso, asOf) {
  if (parseISODate(iso) > asOfDay(asOf)) return data;
  const checks = Object.assign({}, data.checks);
  const bag = Object.assign({}, checks[habitId] || {});
  if (bag[iso]) delete bag[iso];
  else bag[iso] = true;
  checks[habitId] = bag;
  return { habits: data.habits, checks };
}
