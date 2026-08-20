import { addDays, parseISODate, toISODate } from "../js/dates.js";

export function isoRange(fromIso, toIso) {
  const days = [];
  for (let date = parseISODate(fromIso); date <= parseISODate(toIso); date = addDays(date, 1)) {
    days.push(toISODate(date));
  }
  return days;
}

export function habit(id, createdAt, name = "read") {
  return { id, name, createdAt };
}

export function dataFor(habitItem, isos) {
  return {
    habits: [habitItem],
    checks: {
      [habitItem.id]: Object.fromEntries(isos.map((iso) => [iso, true])),
    },
  };
}

export function perfect(id, fromIso, toIso, name) {
  const item = habit(id, fromIso, name);
  return { habit: item, data: dataFor(item, isoRange(fromIso, toIso)) };
}

export function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(String(key));
    },
    clear() {
      map.clear();
    },
  };
}
