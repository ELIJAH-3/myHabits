import { CELL_W, NAME_W, RING, TAIL_W, WEEKDAYS, MONTHS } from "./constants.js";
import { addDays, diffDays, formatClock, formatShort, toISODate, today } from "./dates.js";
import { credSummary, log } from "./log.js";
import {
  allStreaks,
  bestStreakAll,
  habitChecked,
  habitScore,
  habitStart,
  habitStreak,
  identityCaption,
  identitySeries,
  longestStreak,
  overallScore,
  todayCounts,
} from "./model.js";
import { barChart, freqBuckets, heatmapHtml, lineChart } from "./charts.js";

export function qs(id) {
  return document.getElementById(id);
}

export function bindElements() {
  const els = {
    setup: qs("setup"),
    apiKey: qs("api-key-input"),
    binId: qs("bin-id-input"),
    setupError: qs("setup-error"),
    connectBtn: qs("connect-btn"),
    setupDismiss: qs("setup-dismiss"),
    settingsBtn: qs("settings-btn"),
    clock: qs("clock"),
    ring: qs("ring-value"),
    scoreValue: qs("score-value"),
    scoreCaption: qs("score-caption"),
    statToday: qs("stat-today"),
    statStreak: qs("stat-streak"),
    statCount: qs("stat-count"),
    syncDot: qs("sync-dot"),
    syncLabel: qs("sync-label"),
    rangeLabel: qs("range-label"),
    gridWrap: qs("grid-wrap"),
    grid: qs("habit-grid"),
    addForm: qs("add-form"),
    addToggle: qs("add-toggle"),
    habitName: qs("habit-name"),
    detail: qs("habit-detail"),
    detailName: qs("detail-name"),
    detailScore: qs("detail-score-line"),
    chartScore: qs("chart-score"),
    chartFreq: qs("chart-freq"),
    heatmap: qs("heatmap"),
    heatYear: qs("heat-year"),
    streakList: qs("streak-list"),
    freqSeg: qs("freq-seg"),
  };
  const missing = Object.keys(els).filter((key) => !els[key]);
  if (missing.length) console.warn("[pulse] missing DOM nodes", missing);
  else log("DOM nodes bound", Object.keys(els).length);
  return els;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function setSync(els, kind, label) {
  log("sync status", { kind, label });
  els.syncDot.className = `sync-dot ${kind}`;
  els.syncLabel.textContent = label;
}

export function renderClock(els) {
  const now = new Date();
  els.clock.dateTime = now.toISOString();
  els.clock.textContent = formatClock(now);
}

function renderScore(els, data, memo) {
  const score = overallScore(data, memo);
  els.scoreValue.textContent = String(score);
  els.ring.style.strokeDasharray = String(RING);
  els.ring.style.strokeDashoffset = String(RING * (1 - score / 100));
  const { done, total } = todayCounts(data);
  els.statToday.textContent = `${done}/${total}`;
  els.statStreak.textContent = `${bestStreakAll(data)}d`;
  els.statCount.textContent = String(total);
  if (!total) els.scoreCaption.textContent = "100% = second nature";
  else if (score >= 100) els.scoreCaption.textContent = "identity locked";
  else els.scoreCaption.textContent = `${total - done} remaining today · 100% = second nature`;
}

function timelineDayCount(timelineStart) {
  return diffDays(timelineStart, today()) + 1;
}

function dateAtIndex(timelineStart, index) {
  return addDays(timelineStart, index);
}

function visibleRange(els, timelineStart, scrollLeft, pinToToday) {
  const total = timelineDayCount(timelineStart);
  const inner = els.gridWrap.clientWidth || 800;
  const daysWidth = Math.max(160, inner - NAME_W - TAIL_W);
  const vis = Math.ceil(daysWidth / CELL_W) + 10;
  let start;
  if (pinToToday) start = Math.max(0, total - vis);
  else start = Math.max(0, Math.floor((scrollLeft || 0) / CELL_W) - 5);
  let count = vis;
  if (start + count > total) count = Math.max(0, total - start);
  return { start, count, total };
}

function dayHeadHtml(date, nowIso) {
  const iso = toISODate(date);
  const isToday = iso === nowIso;
  const month = date.getDate() === 1 ? MONTHS[date.getMonth()].slice(0, 3) : "";
  return `
    <div class="day-slot day-head ${isToday ? "today" : ""}">
      <span class="day-month">${month}</span>
      <span class="day-num">${date.getDate()}</span>
      <span>${WEEKDAYS[date.getDay()].slice(0, 2)}</span>
    </div>`;
}

function applyScroll(els, opts) {
  const wrap = els.gridWrap;
  const flag = typeof opts.ignoreScroll === "function" ? opts.ignoreScroll : () => {};
  flag(true);
  const apply = () => {
    if (opts.pinToToday) wrap.scrollLeft = wrap.scrollWidth;
    else if (opts.preserveScroll != null) wrap.scrollLeft = opts.preserveScroll;
    flag(false);
  };
  apply();
  requestAnimationFrame(apply);
}

export function renderGrid(els, state, opts) {
  opts = opts || {};
  const now = today();
  const nowIso = toISODate(now);
  const pin = Boolean(opts.pinToToday);
  const scrollHint = pin ? 0 : opts.preserveScroll != null ? opts.preserveScroll : els.gridWrap.scrollLeft;
  const { start, count, total } = visibleRange(els, state.timelineStart, scrollHint, pin);
  state.visIndex = start;
  log("renderGrid", { pin, start, count, total, habits: state.data.habits.length });

  els.grid.style.setProperty("--name-w", `${NAME_W}px`);
  els.grid.style.setProperty("--tail-w", `${TAIL_W}px`);
  els.grid.style.setProperty("--cell-w", `${CELL_W}px`);
  els.grid.style.setProperty("--days-w", `${total * CELL_W}px`);

  if (!state.data.habits.length) {
    els.grid.innerHTML = `
      <div class="empty">
        <strong>no habits yet</strong>
        add one below, then tick the days
      </div>`;
    els.rangeLabel.textContent = "scroll through days";
    return;
  }

  const leftPad = start * CELL_W;
  const rightPad = Math.max(0, (total - start - count) * CELL_W);
  const days = Array.from({ length: count }, (_, i) => dateAtIndex(state.timelineStart, start + i));
  const first = days[0];
  const last = days[days.length - 1];
  els.rangeLabel.textContent = first && last ? `${formatShort(first)}  →  ${formatShort(last)}` : "lifetime";

  const pad = (width) => (width ? `<div style="flex:0 0 ${width}px;width:${width}px"></div>` : "");
  const heads = `${pad(leftPad)}${days.map((date) => dayHeadHtml(date, nowIso)).join("")}${pad(rightPad)}`;

  const rows = state.data.habits
    .map((habit, index) => {
      const cells = days
        .map((date) => {
          const iso = toISODate(date);
          const future = date > now;
          const on = habitChecked(state.data, habit.id, iso);
          const isToday = iso === nowIso;
          return `
            <div class="day-slot ${isToday ? "today" : ""}">
              <button
                class="check ${on ? "on" : ""}"
                type="button"
                role="checkbox"
                aria-checked="${on}"
                aria-label="${habit.name}, ${iso}"
                data-habit="${habit.id}"
                data-date="${iso}"
                ${future ? "disabled" : ""}
              ></button>
            </div>`;
        })
        .join("");
      const score = habitScore(state.data, habit, state.scoreMemo);
      const caption = identityCaption(score);
      return `
        <div class="habit-row" data-habit-row="${habit.id}">
          <div class="col-name">
            <button class="drag-handle" type="button" draggable="true" data-drag="${habit.id}" aria-label="Reorder ${escapeHtml(habit.name)}">⋮⋮</button>
            <button class="habit-link" type="button" data-open="${habit.id}" aria-haspopup="dialog">
              <span class="habit-index">${String(index + 1).padStart(2, "0")}</span>
              <strong>${escapeHtml(habit.name)}</strong>
            </button>
          </div>
          <div class="col-days">${pad(leftPad)}${cells}${pad(rightPad)}</div>
          <div class="col-tail">
            <button class="score-chip ${score >= 100 ? "max" : ""}" type="button" data-open="${habit.id}" title="Identity score. 100% means this habit is second nature.">
              ${score}%<small>${caption}</small>
            </button>
            <button class="icon-btn" type="button" data-delete="${habit.id}" aria-label="Remove ${escapeHtml(habit.name)}">×</button>
          </div>
        </div>`;
    })
    .join("");

  els.grid.innerHTML = `
    <div class="grid-header">
      <div class="col-name">habit</div>
      <div class="col-days">${heads}</div>
      <div class="col-tail">identity</div>
    </div>
    ${rows}`;

  applyScroll(els, {
    pinToToday: opts.pinToToday,
    preserveScroll: opts.preserveScroll,
    ignoreScroll: opts.ignoreScroll,
  });
}

export function renderDetail(els, state) {
  if (!state.detailHabitId) return;
  log("renderDetail", { habitId: state.detailHabitId, freqUnit: state.freqUnit, heatYear: state.heatYear });
  const habit = state.data.habits.find((item) => item.id === state.detailHabitId);
  if (!habit) return false;
  const score = habitScore(state.data, habit, state.scoreMemo);
  const current = habitStreak(state.data, habit);
  const best = longestStreak(state.data, habit);
  els.detailName.textContent = habit.name;
  els.detailScore.innerHTML = `<strong>${score}%</strong> ${identityCaption(score)} · current ${current}d · best ${best}d`;
  els.chartScore.innerHTML = lineChart(identitySeries(state.data, habit));
  els.chartFreq.innerHTML = barChart(freqBuckets(state.data, habit, state.freqUnit), state.freqUnit);

  const minYear = habitStart(state.data, habit).getFullYear();
  const maxYear = today().getFullYear();
  if (state.heatYear < minYear) state.heatYear = minYear;
  if (state.heatYear > maxYear) state.heatYear = maxYear;
  els.heatYear.textContent = String(state.heatYear);
  els.heatmap.innerHTML = heatmapHtml(state.data, habit, state.heatYear);

  const streaks = allStreaks(state.data, habit).slice(0, 8);
  if (!streaks.length) {
    els.streakList.innerHTML = `<li><span class="streak-range">No streaks yet. Tick consecutive days to start one.</span></li>`;
  } else {
    els.streakList.innerHTML = streaks
      .map(
        (item, index) => `
        <li class="${item.live ? "live" : ""}">
          <span class="streak-len">${item.length}d ${index === 0 ? "best" : ""} ${item.live ? "live" : ""}</span>
          <span class="streak-range">${formatShort(item.start)} → ${formatShort(item.end)}</span>
        </li>`
      )
      .join("");
  }
  for (const btn of els.freqSeg.querySelectorAll("button")) {
    btn.classList.toggle("on", btn.dataset.freq === state.freqUnit);
  }
  return true;
}

export function render(els, state, opts) {
  opts = opts || {};
  log("render", {
    pinToToday: Boolean(opts.pinToToday),
    habits: state.data.habits.length,
    creds: credSummary(state.creds),
  });
  renderClock(els);
  renderScore(els, state.data, state.scoreMemo);
  if (opts.pinToToday || opts.preserveScroll != null) renderGrid(els, state, opts);
  else renderGrid(els, state, Object.assign({}, opts, { preserveScroll: els.gridWrap.scrollLeft }));
  if (state.detailHabitId && renderDetail(els, state) === false) {
    state.detailHabitId = null;
    els.detail.classList.add("hidden");
  }
}

export function maxScrollLeft(els) {
  return Math.max(0, els.gridWrap.scrollWidth - els.gridWrap.clientWidth);
}

export function scrollByDays(els, days) {
  const next = els.gridWrap.scrollLeft + days * CELL_W;
  const max = maxScrollLeft(els);
  const clamped = Math.max(0, Math.min(max, next));
  log("scrollByDays", { days, from: els.gridWrap.scrollLeft, to: clamped, max });
  els.gridWrap.scrollLeft = clamped;
}

export function openSetup(els, creds) {
  log("openSetup", credSummary(creds));
  els.apiKey.value = (creds && creds.apiKey) || "";
  els.binId.value = (creds && creds.binId) || "";
  els.setupError.classList.add("hidden");
  const envNote = qs("setup-env-note");
  if (envNote) envNote.classList.toggle("hidden", !(creds && creds.fromEnv));
  els.setup.classList.remove("hidden");
  els.apiKey.focus();
}

export function closeSetup(els) {
  log("closeSetup");
  els.setup.classList.add("hidden");
}

export function openDetail(els, state, id) {
  log("openDetail", { id });
  const habit = state.data.habits.find((item) => item.id === id);
  if (!habit) return;
  state.detailHabitId = id;
  state.heatYear = today().getFullYear();
  els.detail.classList.remove("hidden");
  renderDetail(els, state);
}

export function closeDetail(els, state) {
  log("closeDetail");
  state.detailHabitId = null;
  els.detail.classList.add("hidden");
}
