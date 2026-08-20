import { HEAT_WD, MONTHS } from "./constants.js";
import { addDays, formatShort, mondayOf, parseISODate, startOfDay, toISODate, today } from "./dates.js";
import { habitChecked, habitStart } from "./model.js";

function downsample(points, max) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

export function lineChart(points) {
  if (!points.length) return `<p class="chart-hint">No history yet.</p>`;
  const series = downsample(points, 420);
  const w = 840;
  const h = 260;
  const l = 44;
  const r = 16;
  const t = 18;
  const b = 40;
  const iw = w - l - r;
  const ih = h - t - b;
  const n = series.length;
  const xAt = (i) => (n === 1 ? l + iw / 2 : l + (i / (n - 1)) * iw);
  const yAt = (v) => t + (1 - v / 100) * ih;
  const line = series
    .map((p, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(p.score).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${xAt(n - 1).toFixed(1)},${(t + ih).toFixed(1)} L${xAt(0).toFixed(1)},${(t + ih).toFixed(1)} Z`;
  const yTicks = [0, 25, 50, 75, 100];
  const xTicks = [0, Math.floor((n - 1) / 3), Math.floor(((n - 1) * 2) / 3), n - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );
  return `
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Identity score over days">
      ${yTicks
        .map(
          (tick) => `
        <line x1="${l}" x2="${w - r}" y1="${yAt(tick)}" y2="${yAt(tick)}" stroke="rgba(228,195,106,0.16)" />
        <text x="${l - 8}" y="${yAt(tick) + 4}" text-anchor="end" fill="#8d8a80" font-size="11" font-family="Figtree, sans-serif">${tick}</text>`
        )
        .join("")}
      <path d="${area}" fill="rgba(228,195,106,0.14)"></path>
      <path d="${line}" fill="none" stroke="#e4c36a" stroke-width="2.2"></path>
      ${xTicks
        .map((i) => {
          const label = formatShort(series[i].date);
          return `<text x="${xAt(i)}" y="${h - 12}" text-anchor="middle" fill="#8d8a80" font-size="11" font-family="Figtree, sans-serif">${label}</text>`;
        })
        .join("")}
    </svg>`;
}

export function freqBuckets(data, habit, unit, until) {
  const end = until ? startOfDay(until instanceof Date ? until : parseISODate(until)) : today();
  const start = habitStart(data, habit, end);
  const keys = [];
  const counts = new Map();

  function keyFor(date) {
    if (unit === "year") return String(date.getFullYear());
    if (unit === "month") return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return toISODate(mondayOf(date));
  }

  function labelFor(key) {
    if (unit === "year") return key;
    if (unit === "month") {
      const [y, m] = key.split("-");
      return `${MONTHS[Number(m) - 1]} ${y}`;
    }
    return formatShort(parseISODate(key));
  }

  function step(date) {
    if (unit === "year") return new Date(date.getFullYear() + 1, 0, 1);
    if (unit === "month") return new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return addDays(date, 7);
  }

  function firstBucket(date) {
    if (unit === "year") return new Date(date.getFullYear(), 0, 1);
    if (unit === "month") return new Date(date.getFullYear(), date.getMonth(), 1);
    return mondayOf(date);
  }

  for (let cursor = firstBucket(start); cursor <= end; cursor = step(cursor)) {
    const key = keyFor(cursor);
    keys.push(key);
    counts.set(key, 0);
  }

  for (let date = start; date <= end; date = addDays(date, 1)) {
    if (!habitChecked(data, habit.id, toISODate(date))) continue;
    const key = keyFor(date);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return keys.map((key) => ({ key, label: labelFor(key), value: counts.get(key) || 0 }));
}

export function barChart(buckets, unit) {
  if (!buckets.length) return `<p class="chart-hint">No ticks yet.</p>`;
  const maxVal = Math.max(unit === "week" ? 7 : unit === "month" ? 31 : 366, ...buckets.map((b) => b.value), 1);
  const barW = 28;
  const gap = 10;
  const l = 36;
  const r = 12;
  const t = 16;
  const b = 64;
  const h = 250;
  const iw = Math.max(480, buckets.length * (barW + gap));
  const w = l + iw + r;
  const ih = h - t - b;
  const bars = buckets
    .map((item, i) => {
      const x = l + i * (barW + gap);
      const bh = (item.value / maxVal) * ih;
      const y = t + ih - bh;
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${Math.max(bh, item.value ? 2 : 0)}" fill="#e4c36a"></rect>
        <text x="${x + barW / 2}" y="${t + ih + 14}" text-anchor="middle" fill="#8d8a80" font-size="10" font-family="Figtree, sans-serif" transform="rotate(-48 ${x + barW / 2} ${t + ih + 14})">${item.label}</text>
        <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" fill="#f4f0e6" font-size="10" font-family="Figtree, sans-serif">${item.value}</text>`;
    })
    .join("");
  return `
    <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Ticks by ${unit}">
      <line x1="${l}" x2="${w - r}" y1="${t + ih}" y2="${t + ih}" stroke="rgba(228,195,106,0.22)" />
      ${bars}
    </svg>`;
}

export function heatmapHtml(data, habit, year) {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const created = habitStart(data, habit);
  const now = today();
  const origin = mondayOf(start);
  const weeks = [];
  for (let cursor = origin; cursor <= end; cursor = addDays(cursor, 7)) weeks.push(cursor);

  const cols = weeks
    .map((weekStart) => {
      let label = "";
      for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i);
        if (date.getFullYear() === year && date.getDate() === 1) label = MONTHS[date.getMonth()].slice(0, 3);
      }
      const cells = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        const iso = toISODate(date);
        if (date.getFullYear() !== year || date > now) return `<div class="heat-cell" title="${iso}"></div>`;
        if (date < created) return `<div class="heat-cell" title="${iso}"></div>`;
        const on = habitChecked(data, habit.id, iso);
        return `<div class="heat-cell ${on ? "on" : "miss"}" title="${iso} · ${on ? "logged" : "missed"}"></div>`;
      }).join("");
      return `<div class="heat-col"><div class="heat-month">${label}</div>${cells}</div>`;
    })
    .join("");

  const wd = HEAT_WD.map((letter, i) => `<span>${i % 2 === 0 && i < 6 ? letter : ""}</span>`).join("");
  return `
    <div class="heat-layout">
      <div class="heat-wd">${wd}</div>
      <div class="heat">${cols}</div>
    </div>
    <div class="heat-legend">
      <span>missed</span><span class="heat-cell miss"></span>
      <span>logged</span><span class="heat-cell on"></span>
    </div>`;
}
