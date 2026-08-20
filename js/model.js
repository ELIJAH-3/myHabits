import { IDENTITY_ALPHA, IDENTITY_TAU, MIN_HISTORY } from "./constants.js";
import { addDays, diffDays, parseISODate, startOfDay, toISODate, today } from "./dates.js";

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

export function habitStart(data, habit) {
  let start = habit.createdAt ? startOfDay(parseISODate(habit.createdAt)) : today();
  const checks = data.checks[habit.id] || {};
  for (const iso of Object.keys(checks)) {
    const date = parseISODate(iso);
    if (date < start) start = date;
  }
  return start;
}

export function identitySeries(data, habit, until) {
  const end = until || today();
  const start = habitStart(data, habit);
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

export function habitScore(data, habit, memo) {
  if (memo && memo.has(habit.id)) return memo.get(habit.id);
  const series = identitySeries(data, habit);
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

export function habitStreak(data, habit) {
  let streak = 0;
  let cursor = today();
  if (!habitChecked(data, habit.id, toISODate(cursor))) cursor = addDays(cursor, -1);
  while (habitChecked(data, habit.id, toISODate(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function allStreaks(data, habit) {
  const start = habitStart(data, habit);
  const end = today();
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
  const currentLen = habitStreak(data, habit);
  const liveEnd = habitChecked(data, habit.id, toISODate(today())) ? today() : addDays(today(), -1);
  return streaks
    .map((item) => {
      const live = currentLen > 0 && item.length === currentLen && diffDays(item.end, liveEnd) === 0;
      return Object.assign({ live }, item);
    })
    .sort((a, b) => b.length - a.length || b.end - a.end);
}

export function longestStreak(data, habit) {
  const streaks = allStreaks(data, habit);
  return streaks.length ? streaks[0].length : 0;
}

export function overallScore(data, memo) {
  if (!data.habits.length) return 0;
  const total = data.habits.reduce((sum, habit) => sum + habitScore(data, habit, memo), 0);
  return Math.round(total / data.habits.length);
}

export function bestStreakAll(data) {
  return data.habits.reduce((max, habit) => Math.max(max, longestStreak(data, habit)), 0);
}

export function todayCounts(data) {
  const iso = toISODate(today());
  const total = data.habits.length;
  const done = data.habits.filter((habit) => habitChecked(data, habit.id, iso)).length;
  return { done, total };
}

export function dataEarliest(data) {
  let min = today();
  for (const habit of data.habits) {
    const start = habitStart(data, habit);
    if (start < min) min = start;
  }
  return min;
}

export function boundedTimelineStart(data, currentStart) {
  const floor = addDays(today(), -(MIN_HISTORY - 1));
  const earliest = dataEarliest(data);
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

export function toggleCheck(data, habitId, iso) {
  if (parseISODate(iso) > today()) return data;
  const checks = Object.assign({}, data.checks);
  const bag = Object.assign({}, checks[habitId] || {});
  if (bag[iso]) delete bag[iso];
  else bag[iso] = true;
  checks[habitId] = bag;
  return { habits: data.habits, checks };
}
