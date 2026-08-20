import { MONTHS, WEEKDAYS } from "./constants.js";

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, n) {
  const next = new Date(date);
  next.setDate(next.getDate() + n);
  return startOfDay(next);
}

export function today() {
  return startOfDay(new Date());
}

export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function diffDays(a, b) {
  const aa = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bb = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bb - aa) / 86400000);
}

export function formatClock(date) {
  const wd = WEEKDAYS[date.getDay()];
  const mo = MONTHS[date.getMonth()];
  return `${wd} ${String(date.getDate()).padStart(2, "0")} ${mo} ${date.getFullYear()}`;
}

export function formatShort(date) {
  return `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function mondayOf(date) {
  const dow = date.getDay();
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}
