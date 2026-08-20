(() => {
  const DAYS = 7;
  const SCORE_WINDOW = 30;
  const API = "https://api.jsonbin.io/v3";
  const CREDS_KEY = "pulse.creds";
  const CACHE_KEY = "pulse.cache";
  const RING = 2 * Math.PI * 52;

  const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  const els = {
    setup: document.getElementById("setup"),
    apiKey: document.getElementById("api-key-input"),
    binId: document.getElementById("bin-id-input"),
    setupError: document.getElementById("setup-error"),
    connectBtn: document.getElementById("connect-btn"),
    setupDismiss: document.getElementById("setup-dismiss"),
    settingsBtn: document.getElementById("settings-btn"),
    clock: document.getElementById("clock"),
    ring: document.getElementById("ring-value"),
    scoreValue: document.getElementById("score-value"),
    scoreCaption: document.getElementById("score-caption"),
    statToday: document.getElementById("stat-today"),
    statStreak: document.getElementById("stat-streak"),
    statCount: document.getElementById("stat-count"),
    syncDot: document.getElementById("sync-dot"),
    syncLabel: document.getElementById("sync-label"),
    rangeLabel: document.getElementById("range-label"),
    grid: document.getElementById("habit-grid"),
    addForm: document.getElementById("add-form"),
    habitName: document.getElementById("habit-name"),
  };

  const state = {
    endDate: startOfDay(new Date()),
    data: emptyData(),
    creds: loadCreds(),
    saveTimer: null,
    pushing: false,
    pendingPush: false,
  };

  function emptyData() {
    return { habits: [], checks: {} };
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, n) {
    const next = new Date(date);
    next.setDate(next.getDate() + n);
    return startOfDay(next);
  }

  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseISODate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function today() {
    return startOfDay(new Date());
  }

  function formatClock(date) {
    const wd = WEEKDAYS[date.getDay()];
    const mo = MONTHS[date.getMonth()];
    return `${wd} ${String(date.getDate()).padStart(2, "0")} ${mo} ${date.getFullYear()}`;
  }

  function windowDays() {
    return Array.from({ length: DAYS }, (_, i) => addDays(state.endDate, i - (DAYS - 1)));
  }

  function loadCreds() {
    try {
      return JSON.parse(localStorage.getItem(CREDS_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveCreds(creds) {
    state.creds = creds;
    if (creds) localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
    else localStorage.removeItem(CREDS_KEY);
  }

  function loadCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (parsed && Array.isArray(parsed.habits) && parsed.checks) return parsed;
    } catch {
      /* ignore */
    }
    return emptyData();
  }

  function writeCache() {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state.data));
  }

  function authHeaders(extra) {
    return Object.assign({ "X-Master-Key": state.creds.apiKey }, extra);
  }

  async function readRemote() {
    const res = await fetch(`${API}/b/${state.creds.binId}/latest`, {
      cache: "no-store",
      headers: authHeaders({ "X-Bin-Meta": "false" }),
    });
    if (!res.ok) throw new Error(await errorMessage(res));
    const payload = await res.json();
    return payload.record || payload;
  }

  async function createRemote(data) {
    const res = await fetch(`${API}/b`, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
        "X-Bin-Name": "pulse-habit-tracker",
        "X-Bin-Private": "true",
      }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await errorMessage(res));
    const payload = await res.json();
    const id = payload.metadata && payload.metadata.id;
    if (!id) throw new Error("JSONBin did not return a bin id.");
    return id;
  }

  async function updateRemote(data) {
    const res = await fetch(`${API}/b/${state.creds.binId}`, {
      method: "PUT",
      headers: authHeaders({
        "Content-Type": "application/json",
        "X-Bin-Versioning": "false",
      }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await errorMessage(res));
  }

  async function errorMessage(res) {
    try {
      const body = await res.json();
      return body.message || `JSONBin error ${res.status}`;
    } catch {
      return `JSONBin error ${res.status}`;
    }
  }

  function setSync(kind, label) {
    els.syncDot.className = `sync-dot ${kind}`;
    els.syncLabel.textContent = label;
  }

  function schedulePush() {
    writeCache();
    if (!state.creds || !state.creds.binId) {
      setSync("local", "local cache");
      return;
    }
    setSync("busy", "writing…");
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(pushRemote, 550);
  }

  async function pushRemote() {
    if (!state.creds || !state.creds.binId) return;
    if (state.pushing) {
      state.pendingPush = true;
      return;
    }
    state.pushing = true;
    try {
      await updateRemote(state.data);
      setSync("ok", "synced // jsonbin");
    } catch (err) {
      setSync("err", err.message || "sync failed");
    } finally {
      state.pushing = false;
      if (state.pendingPush) {
        state.pendingPush = false;
        pushRemote();
      }
    }
  }

  function habitChecked(habitId, iso) {
    return Boolean(state.data.checks[habitId] && state.data.checks[habitId][iso]);
  }

  function toggleCheck(habitId, iso) {
    if (parseISODate(iso) > today()) return;
    const bag = state.data.checks[habitId] || (state.data.checks[habitId] = {});
    if (bag[iso]) delete bag[iso];
    else bag[iso] = true;
    schedulePush();
    render();
  }

  function eligibleDays(habit) {
    const created = startOfDay(parseISODate(habit.createdAt));
    const end = today();
    const start = addDays(end, -(SCORE_WINDOW - 1));
    const from = created > start ? created : start;
    const days = [];
    for (let d = from; d <= end; d = addDays(d, 1)) days.push(toISODate(d));
    return days;
  }

  function habitScore(habit) {
    const days = eligibleDays(habit);
    if (!days.length) return 100;
    const done = days.filter((iso) => habitChecked(habit.id, iso)).length;
    return Math.round((done / days.length) * 100);
  }

  function habitStreak(habit) {
    let streak = 0;
    let cursor = today();
    if (!habitChecked(habit.id, toISODate(cursor))) cursor = addDays(cursor, -1);
    while (habitChecked(habit.id, toISODate(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function overallScore() {
    const { habits } = state.data;
    if (!habits.length) return 0;
    const total = habits.reduce((sum, habit) => sum + habitScore(habit), 0);
    return Math.round(total / habits.length);
  }

  function bestStreak() {
    return state.data.habits.reduce((max, habit) => Math.max(max, habitStreak(habit)), 0);
  }

  function todayCounts() {
    const iso = toISODate(today());
    const total = state.data.habits.length;
    const done = state.data.habits.filter((habit) => habitChecked(habit.id, iso)).length;
    return { done, total };
  }

  function addHabit(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    state.data.habits.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `h-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: trimmed,
      createdAt: toISODate(today()),
    });
    schedulePush();
    render();
  }

  function removeHabit(id) {
    state.data.habits = state.data.habits.filter((habit) => habit.id !== id);
    delete state.data.checks[id];
    schedulePush();
    render();
  }

  function renderClock() {
    const now = new Date();
    els.clock.dateTime = now.toISOString();
    els.clock.textContent = formatClock(now);
  }

  function renderScore() {
    const score = overallScore();
    els.scoreValue.textContent = String(score);
    els.ring.style.strokeDasharray = String(RING);
    els.ring.style.strokeDashoffset = String(RING * (1 - score / 100));
    const { done, total } = todayCounts();
    els.statToday.textContent = `${done}/${total}`;
    els.statStreak.textContent = `${bestStreak()}d`;
    els.statCount.textContent = String(total);
    if (!total) els.scoreCaption.textContent = "no habits yet";
    else if (done === total) els.scoreCaption.textContent = "all protocols complete";
    else els.scoreCaption.textContent = `${total - done} remaining today`;
  }

  function renderGrid() {
    const days = windowDays();
    const now = today();
    els.rangeLabel.textContent = `${formatClock(days[0])}  →  ${formatClock(days[DAYS - 1])}`;

    if (!state.data.habits.length) {
      els.grid.innerHTML = `
        <div class="empty">
          <strong>no protocols initialized</strong>
          add a habit below, then tick the date cells
        </div>`;
      return;
    }

    const head = days
      .map((date) => {
        const iso = toISODate(date);
        const isToday = iso === toISODate(now);
        return `<div class="day-head ${isToday ? "today" : ""}">${WEEKDAYS[date.getDay()]}<span>${date.getDate()}</span></div>`;
      })
      .join("");

    const rows = state.data.habits
      .map((habit, index) => {
        const cells = days
          .map((date) => {
            const iso = toISODate(date);
            const future = date > now;
            const on = habitChecked(habit.id, iso);
            const isToday = iso === toISODate(now);
            return `
              <div class="${isToday ? "col-today" : ""}">
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
        const score = habitScore(habit);
        const streak = habitStreak(habit);
        return `
          <div class="habit-row">
            <div class="habit-name">
              <span class="habit-index">${String(index + 1).padStart(2, "0")}</span>
              <strong>${escapeHtml(habit.name)}</strong>
            </div>
            ${cells}
            <div class="score-chip">${score}<small>${streak}d streak</small></div>
            <button class="icon-btn" type="button" data-delete="${habit.id}" aria-label="Remove ${escapeHtml(habit.name)}">×</button>
          </div>`;
      })
      .join("");

    els.grid.innerHTML = `
      <div class="grid-header">
        <div>habit</div>
        ${head}
        <div style="text-align:right">score</div>
        <div></div>
      </div>
      ${rows}`;
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function render() {
    renderClock();
    renderScore();
    renderGrid();
    if (state.creds && state.creds.binId && els.syncLabel.textContent === "local cache") {
      setSync("ok", "synced // jsonbin");
    }
  }

  function shiftWindow(days) {
    const next = addDays(state.endDate, days);
    const max = today();
    state.endDate = next > max ? max : next;
    render();
  }

  function openSetup() {
    els.apiKey.value = (state.creds && state.creds.apiKey) || "";
    els.binId.value = (state.creds && state.creds.binId) || "";
    els.setupError.classList.add("hidden");
    els.setup.classList.remove("hidden");
    els.apiKey.focus();
  }

  function closeSetup() {
    els.setup.classList.add("hidden");
  }

  async function connect() {
    const apiKey = els.apiKey.value.trim();
    const binId = els.binId.value.trim();
    els.setupError.classList.add("hidden");
    if (!apiKey) {
      els.setupError.textContent = "API key is required.";
      els.setupError.classList.remove("hidden");
      return;
    }

    els.connectBtn.disabled = true;
    els.connectBtn.textContent = "linking…";
    try {
      saveCreds({ apiKey, binId });
      if (!state.creds.binId) {
        const id = await createRemote(state.data);
        saveCreds({ apiKey, binId: id });
      } else {
        const remote = await readRemote();
        if (remote && Array.isArray(remote.habits) && remote.checks) {
          state.data = remote;
          writeCache();
        } else {
          await updateRemote(state.data);
        }
      }
      setSync("ok", "synced // jsonbin");
      closeSetup();
      render();
    } catch (err) {
      els.setupError.textContent = err.message || "Could not connect.";
      els.setupError.classList.remove("hidden");
      setSync("err", "link failed");
    } finally {
      els.connectBtn.disabled = false;
      els.connectBtn.textContent = "Establish link";
    }
  }

  async function boot() {
    state.data = loadCache();
    render();

    if (!state.creds || !state.creds.apiKey) {
      openSetup();
      setSync("local", "local cache");
      return;
    }

    if (!state.creds.binId) {
      openSetup();
      setSync("local", "local cache");
      return;
    }

    setSync("busy", "loading…");
    try {
      const remote = await readRemote();
      if (remote && Array.isArray(remote.habits) && remote.checks) {
        state.data = remote;
        writeCache();
      }
      setSync("ok", "synced // jsonbin");
      render();
    } catch (err) {
      setSync("err", err.message || "offline cache");
    }
  }

  els.grid.addEventListener("click", (event) => {
    const del = event.target.closest("[data-delete]");
    if (del) {
      const habit = state.data.habits.find((item) => item.id === del.dataset.delete);
      const label = habit ? habit.name : "this habit";
      if (confirm(`Remove “${label}” and its history?`)) removeHabit(del.dataset.delete);
      return;
    }
    const check = event.target.closest(".check");
    if (check && !check.disabled) toggleCheck(check.dataset.habit, check.dataset.date);
  });

  els.addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addHabit(els.habitName.value);
    els.habitName.value = "";
    els.habitName.focus();
  });

  document.getElementById("shift-day-back").addEventListener("click", () => shiftWindow(-1));
  document.getElementById("shift-day-fwd").addEventListener("click", () => shiftWindow(1));
  document.getElementById("shift-week-back").addEventListener("click", () => shiftWindow(-7));
  document.getElementById("shift-week-fwd").addEventListener("click", () => shiftWindow(7));
  document.getElementById("jump-today").addEventListener("click", () => {
    state.endDate = today();
    render();
  });

  els.settingsBtn.addEventListener("click", openSetup);
  els.setupDismiss.addEventListener("click", closeSetup);
  els.connectBtn.addEventListener("click", connect);

  setInterval(renderClock, 60000);
  boot();
})();
