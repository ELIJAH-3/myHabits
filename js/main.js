import { CELL_W, VERSION } from "./constants.js";
import { addDays, toISODate, today } from "./dates.js";
import { credSummary, log, logError, logWarn } from "./log.js";
import {
  boundedTimelineStart,
  emptyData,
  newId,
  reorderHabits,
  toggleCheck,
} from "./model.js";
import {
  cleanBinId,
  cleanSecret,
  createRemote,
  loadCache,
  loadCreds,
  readRemote,
  saveCreds,
  updateRemote,
  writeCache,
} from "./store.js";
import {
  bindElements,
  closeDetail,
  closeSetup,
  openDetail,
  openSetup,
  render,
  pinScrollIfReordering,
  renderClock,
  renderGrid,
  scrollByDays,
  setSync,
} from "./ui.js";

log("app modules loaded", { href: location.href, readyState: document.readyState, version: VERSION });

const els = bindElements();
for (const el of document.querySelectorAll("[data-app-version]")) {
  el.textContent = `v${VERSION}`;
}

const state = {
  timelineStart: addDays(today(), -89),
  data: emptyData(),
  creds: loadCreds(),
  saveTimer: null,
  pushing: false,
  pendingPush: false,
  ignoreScroll: false,
  scoreMemo: new Map(),
  visIndex: -1,
  dragHabitId: null,
  dragScrollLeft: null,
  detailHabitId: null,
  freqUnit: "month",
  heatYear: new Date().getFullYear(),
};

function forgetScores() {
  state.scoreMemo.clear();
}

function ignoreScroll(value) {
  state.ignoreScroll = value;
}

function viewOpts(extra) {
  return Object.assign({ ignoreScroll }, extra);
}

function pinCalendarScroll() {
  return pinScrollIfReordering(els.gridWrap, state.dragScrollLeft, state.dragScrollLeft != null);
}

function beginReorder(id) {
  state.dragHabitId = id;
  state.dragScrollLeft = els.gridWrap.scrollLeft;
  els.gridWrap.classList.add("is-reordering");
  log("beginReorder", { id, scrollLeft: state.dragScrollLeft });
}

function endReorder() {
  const left = state.dragScrollLeft;
  state.dragHabitId = null;
  state.dragScrollLeft = null;
  els.gridWrap.classList.remove("is-reordering");
  if (left != null) {
    ignoreScroll(true);
    els.gridWrap.scrollLeft = left;
    ignoreScroll(false);
  }
  return left;
}

function schedulePush() {
  log("schedulePush");
  writeCache(state.data);
  if (!state.creds || !state.creds.binId) {
    log("schedulePush using local cache only");
    setSync(els, "local", "local cache");
    return;
  }
  setSync(els, "busy", "writing…");
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(pushRemote, 550);
}

async function pushRemote() {
  log("pushRemote");
  if (!state.creds || !state.creds.binId) {
    log("pushRemote aborted (no bin)");
    return;
  }
  if (state.pushing) {
    log("pushRemote queued (already writing)");
    state.pendingPush = true;
    return;
  }
  state.pushing = true;
  try {
    await updateRemote(state.creds, state.data);
    setSync(els, "ok", "synced · jsonbin");
  } catch (err) {
    logError("pushRemote failed", err);
    setSync(els, "err", err.message || "sync failed");
  } finally {
    state.pushing = false;
    if (state.pendingPush) {
      state.pendingPush = false;
      log("pushRemote running queued write");
      pushRemote();
    }
  }
}

function paint(opts) {
  state.timelineStart = boundedTimelineStart(state.data, state.timelineStart);
  render(els, state, viewOpts(opts));
  if (state.creds && state.creds.binId && els.syncLabel.textContent === "local cache") {
    setSync(els, "ok", "synced · jsonbin");
  }
}

function addHabit(name) {
  const trimmed = name.trim();
  log("addHabit", { name: trimmed });
  if (!trimmed) {
    log("addHabit ignored (empty name)");
    return;
  }
  state.data.habits.push({
    id: newId(),
    name: trimmed,
    createdAt: toISODate(today()),
  });
  const first = state.data.habits.length === 1;
  forgetScores();
  schedulePush();
  els.addForm.classList.add("hidden");
  paint(first ? { pinToToday: true } : {});
}

function removeHabit(id) {
  log("removeHabit", { id });
  state.data.habits = state.data.habits.filter((habit) => habit.id !== id);
  delete state.data.checks[id];
  if (state.detailHabitId === id) closeDetail(els, state);
  forgetScores();
  schedulePush();
  paint();
}

async function connect() {
  log("connect clicked");
  const apiKey = els.apiKey.value.trim();
  const binId = els.binId.value.trim();
  log("connect values", { key: apiKey ? "set" : "empty", binId: cleanBinId(binId) || "(empty)" });
  els.setupError.classList.add("hidden");
  if (!apiKey) {
    els.setupError.textContent = "API key is required.";
    els.setupError.classList.remove("hidden");
    return;
  }
  els.connectBtn.disabled = true;
  els.connectBtn.textContent = "linking…";
  try {
    state.creds = saveCreds(state.creds, { apiKey: cleanSecret(apiKey), binId: cleanBinId(binId) });
    if (!state.creds.binId) {
      const id = await createRemote(state.creds, state.data);
      state.creds = saveCreds(state.creds, { apiKey: cleanSecret(apiKey), binId: id });
    } else {
      const remote = await readRemote(state.creds);
      if (remote && Array.isArray(remote.habits) && remote.checks) {
        state.data = remote;
        forgetScores();
        writeCache(state.data);
      } else {
        await updateRemote(state.creds, state.data);
      }
    }
    setSync(els, "ok", "synced · jsonbin");
    closeSetup(els);
    paint({ pinToToday: true });
    log("connect ok", credSummary(state.creds));
  } catch (err) {
    logError("connect failed", err);
    els.setupError.textContent = err.message || "Could not connect.";
    els.setupError.classList.remove("hidden");
    setSync(els, "err", "link failed");
  } finally {
    els.connectBtn.disabled = false;
    els.connectBtn.textContent = "Connect";
  }
}

async function boot() {
  log("boot start", credSummary(state.creds));
  state.data = loadCache();
  state.timelineStart = boundedTimelineStart(state.data, state.timelineStart);
  paint({ pinToToday: true });

  if (!state.creds || !state.creds.apiKey) {
    log("boot: no API key, opening setup");
    openSetup(els, state.creds);
    setSync(els, "local", "local cache");
    return;
  }
  if (!state.creds.binId) {
    log("boot: no bin id, opening setup");
    openSetup(els, state.creds);
    setSync(els, "local", "local cache");
    return;
  }

  log("boot: fetching jsonbin");
  setSync(els, "busy", "loading…");
  try {
    const remote = await readRemote(state.creds);
    if (remote && Array.isArray(remote.habits) && remote.checks) {
      log("boot: applying remote data");
      state.data = remote;
      forgetScores();
      writeCache(state.data);
    } else {
      logWarn("boot: remote payload missing habits/checks", remote);
    }
    setSync(els, "ok", "synced · jsonbin");
    paint({ pinToToday: true });
    log("boot complete");
  } catch (err) {
    logError("boot remote failed, using cache", err);
    setSync(els, "err", err.message || "offline cache");
  }
}

els.grid.addEventListener("click", (event) => {
  log("grid click", { target: event.target && event.target.className });
  const del = event.target.closest("[data-delete]");
  if (del) {
    const habit = state.data.habits.find((item) => item.id === del.dataset.delete);
    const label = habit ? habit.name : "this habit";
    if (confirm(`Remove “${label}” and its history?`)) removeHabit(del.dataset.delete);
    return;
  }
  const open = event.target.closest("[data-open]");
  if (open) {
    openDetail(els, state, open.dataset.open);
    return;
  }
  const check = event.target.closest(".check");
  if (check && !check.disabled) {
    log("toggleCheck", { habitId: check.dataset.habit, iso: check.dataset.date });
    state.data = toggleCheck(state.data, check.dataset.habit, check.dataset.date);
    forgetScores();
    schedulePush();
    paint();
  }
});

els.grid.addEventListener("dragstart", (event) => {
  const handle = event.target.closest("[data-drag]");
  if (!handle) {
    event.preventDefault();
    return;
  }
  event.dataTransfer.setData("text/plain", handle.dataset.drag);
  event.dataTransfer.effectAllowed = "move";
  const row = handle.closest(".habit-row");
  if (row) row.classList.add("dragging");
  beginReorder(handle.dataset.drag);
});

function onReorderDragOver(event) {
  if (state.dragHabitId == null) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  pinCalendarScroll();
  const row = event.target.closest && event.target.closest(".habit-row");
  if (!row) return;
  for (const item of els.grid.querySelectorAll(".habit-row.drag-over")) item.classList.remove("drag-over");
  if (row.dataset.habitRow !== state.dragHabitId) row.classList.add("drag-over");
}

els.grid.addEventListener("dragover", onReorderDragOver);
els.gridWrap.addEventListener("dragover", onReorderDragOver, true);
document.addEventListener(
  "dragover",
  (event) => {
    if (state.dragScrollLeft == null) return;
    pinCalendarScroll();
    if (els.gridWrap.contains(event.target)) event.preventDefault();
  },
  true
);

els.grid.addEventListener("drop", (event) => {
  const row = event.target.closest(".habit-row");
  if (!row || !state.dragHabitId) return;
  event.preventDefault();
  const toId = row.dataset.habitRow;
  const fromId = state.dragHabitId;
  log("drop", { fromId, toId });
  state.data.habits = reorderHabits(state.data.habits, fromId, toId);
  const left = state.dragScrollLeft;
  schedulePush();
  paint(left != null ? { preserveScroll: left } : {});
});

els.grid.addEventListener("dragend", () => {
  const left = endReorder();
  for (const item of els.grid.querySelectorAll(".habit-row.dragging, .habit-row.drag-over")) {
    item.classList.remove("dragging", "drag-over");
  }
  log("dragend", { scrollLeft: left });
});

els.addToggle.addEventListener("click", () => {
  const open = els.addForm.classList.contains("hidden");
  els.addForm.classList.toggle("hidden");
  log("add form toggle", { open });
  if (open) els.habitName.focus();
});

els.addForm.addEventListener("submit", (event) => {
  log("add form submit");
  event.preventDefault();
  addHabit(els.habitName.value);
  els.habitName.value = "";
});

els.gridWrap.addEventListener(
  "wheel",
  (event) => {
    if (state.dragScrollLeft != null) {
      event.preventDefault();
      pinCalendarScroll();
      return;
    }
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    els.gridWrap.scrollLeft += event.deltaY;
  },
  { passive: false }
);

els.gridWrap.addEventListener("scroll", () => {
  if (state.dragScrollLeft != null) {
    pinCalendarScroll();
    return;
  }
  if (state.ignoreScroll) return;
  const idx = Math.floor(els.gridWrap.scrollLeft / CELL_W);
  if (Math.abs(idx - state.visIndex) >= 4) {
    renderGrid(els, state, viewOpts({ preserveScroll: els.gridWrap.scrollLeft }));
  }
});

document.getElementById("jump-older").addEventListener("click", () => {
  log("jump older");
  scrollByDays(els, -30);
});
document.getElementById("jump-newer").addEventListener("click", () => {
  log("jump newer");
  scrollByDays(els, 30);
});
document.getElementById("jump-today").addEventListener("click", () => {
  log("jump today");
  renderGrid(els, state, viewOpts({ pinToToday: true }));
});

els.settingsBtn.addEventListener("click", () => openSetup(els, state.creds));
els.setupDismiss.addEventListener("click", () => closeSetup(els));
els.connectBtn.addEventListener("click", connect);
document.getElementById("detail-close").addEventListener("click", () => closeDetail(els, state));
els.detail.addEventListener("click", (event) => {
  if (event.target === els.detail) closeDetail(els, state);
});
els.freqSeg.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-freq]");
  if (!btn) return;
  state.freqUnit = btn.dataset.freq;
  paint();
});
document.getElementById("heat-prev").addEventListener("click", () => {
  state.heatYear -= 1;
  paint();
});
document.getElementById("heat-next").addEventListener("click", () => {
  state.heatYear += 1;
  paint();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!els.detail.classList.contains("hidden")) closeDetail(els, state);
  else if (!els.setup.classList.contains("hidden")) closeSetup(els);
});

window.addEventListener("error", (event) => {
  logError("window error", event.error || event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  logError("unhandled promise rejection", event.reason);
});
window.addEventListener("resize", () => {
  if (!state.data.habits.length) return;
  renderGrid(els, state, viewOpts({ preserveScroll: els.gridWrap.scrollLeft }));
});

setInterval(() => renderClock(els), 60000);
log("calling boot()");
boot();
