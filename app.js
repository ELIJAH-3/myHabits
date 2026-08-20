(() => {
  const API = "https://api.jsonbin.io/v3";
  const CREDS_KEY = "pulse.creds";
  const CACHE_KEY = "pulse.cache";
  const RING = 2 * Math.PI * 52;

  const CELL_W = 40;
  const NAME_W = 228;
  const TAIL_W = 132;
  const MIN_HISTORY = 90;
  const SCROLL_EXTEND = 90;
  const IDENTITY_HALF_LIFE = 21;
  const IDENTITY_TAU = 45;
  const IDENTITY_ALPHA = 1 - Math.pow(0.5, 1 / IDENTITY_HALF_LIFE);

  const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const MONTHS = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ];
  const HEAT_WD = ["m", "t", "w", "t", "f", "s", "s"];

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
    gridWrap: document.getElementById("grid-wrap"),
    grid: document.getElementById("habit-grid"),
    addForm: document.getElementById("add-form"),
    habitName: document.getElementById("habit-name"),
    detail: document.getElementById("habit-detail"),
    detailName: document.getElementById("detail-name"),
    detailScore: document.getElementById("detail-score-line"),
    chartScore: document.getElementById("chart-score"),
    chartFreq: document.getElementById("chart-freq"),
    heatmap: document.getElementById("heatmap"),
    heatYear: document.getElementById("heat-year"),
    streakList: document.getElementById("streak-list"),
    freqSeg: document.getElementById("freq-seg"),
  };

  const state = {
    timelineStart: addDays(startOfDay(new Date()), -(MIN_HISTORY - 1)),
    data: emptyData(),
    creds: loadCreds(),
    saveTimer: null,
    pushing: false,
    pendingPush: false,
    ignoreScroll: false,
    scoreMemo: new Map(),
    visIndex: -1,
    detailHabitId: null,
    freqUnit: "month",
    heatYear: new Date().getFullYear(),
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

  function diffDays(a, b) {
    const aa = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const bb = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((bb - aa) / 86400000);
  }

  function formatClock(date) {
    const wd = WEEKDAYS[date.getDay()];
    const mo = MONTHS[date.getMonth()];
    return `${wd} ${String(date.getDate()).padStart(2, "0")} ${mo} ${date.getFullYear()}`;
  }

  function formatShort(date) {
    return `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }

  function mondayOf(date) {
    const dow = date.getDay();
    return addDays(date, dow === 0 ? -6 : 1 - dow);
  }

  function weekdayMon0(date) {
    return (date.getDay() + 6) % 7;
  }

  function cleanSecret(value) {
    let v = String(value || "").trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1).trim();
    }
    if (/^bearer\s+/i.test(v)) v = v.replace(/^bearer\s+/i, "").trim();
    return v;
  }

  function cleanBinId(value) {
    let id = cleanSecret(value);
    const fromUrl = id.match(/\/(?:v3\/)?b\/([A-Za-z0-9]+)(?:\/|$)/);
    if (fromUrl) return fromUrl[1];
    const parts = id.split("/").filter(Boolean);
    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      return last === "latest" ? parts[parts.length - 2] : last;
    }
    return id;
  }

  function envCreds() {
    const cfg = window.PULSE_CONFIG || {};
    const apiKey = cleanSecret(cfg.apiKey);
    const binId = cleanBinId(cfg.binId);
    if (!apiKey) return null;
    return { apiKey, binId, keyType: cfg.keyType || "master", fromEnv: true };
  }

  function loadCreds() {
    let local = null;
    try {
      local = JSON.parse(localStorage.getItem(CREDS_KEY) || "null");
    } catch {
      local = null;
    }
    const env = envCreds();
    if (env) {
      return {
        apiKey: env.apiKey,
        binId: env.binId || (local && cleanBinId(local.binId)) || "",
        keyType: env.keyType || "master",
        fromEnv: true,
      };
    }
    if (local) {
      return {
        apiKey: cleanSecret(local.apiKey),
        binId: cleanBinId(local.binId),
      };
    }
    return null;
  }

  function saveCreds(creds) {
    const fromEnv = Boolean(state.creds && state.creds.fromEnv) || Boolean(creds && creds.fromEnv);
    state.creds = Object.assign({}, creds, { fromEnv });
    if (fromEnv) return;
    if (creds) localStorage.setItem(CREDS_KEY, JSON.stringify({ apiKey: creds.apiKey, binId: creds.binId, keyType: creds.keyType }));
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

  function authHeaders(extra, kind) {
    const key = cleanSecret(state.creds.apiKey);
    const headers = Object.assign({}, extra);
    if (kind === "access") headers["X-Access-Key"] = key;
    else headers["X-Master-Key"] = key;
    return headers;
  }

  async function jsonbinRequest(url, options, extraHeaders) {
    const preferred = state.creds.keyType === "access" ? ["access", "master"] : ["master", "access"];
    let lastRes = null;
    for (const kind of preferred) {
      lastRes = await fetch(
        url,
        Object.assign({}, options, { headers: authHeaders(extraHeaders, kind) })
      );
      if (lastRes.ok) {
        state.creds.keyType = kind;
        return lastRes;
      }
      if (lastRes.status !== 401) return lastRes;
    }
    return lastRes;
  }

  async function readRemote() {
    const res = await jsonbinRequest(
      `${API}/b/${cleanBinId(state.creds.binId)}/latest`,
      { cache: "no-store" },
      { "X-Bin-Meta": "false" }
    );
    if (!res.ok) throw new Error(await errorMessage(res));
    const payload = await res.json();
    return payload.record || payload;
  }

  async function createRemote(data) {
    const res = await jsonbinRequest(
      `${API}/b`,
      { method: "POST", body: JSON.stringify(data) },
      {
        "Content-Type": "application/json",
        "X-Bin-Name": "pulse-habit-tracker",
        "X-Bin-Private": "true",
      }
    );
    if (!res.ok) throw new Error(await errorMessage(res));
    const payload = await res.json();
    const id = payload.metadata && payload.metadata.id;
    if (!id) throw new Error("JSONBin did not return a bin id.");
    return id;
  }

  async function updateRemote(data) {
    const res = await jsonbinRequest(
      `${API}/b/${cleanBinId(state.creds.binId)}`,
      { method: "PUT", body: JSON.stringify(data) },
      {
        "Content-Type": "application/json",
        "X-Bin-Versioning": "false",
      }
    );
    if (!res.ok) throw new Error(await errorMessage(res));
  }

  async function errorMessage(res) {
    try {
      const body = await res.json();
      const message = body.message || `JSONBin error ${res.status}`;
      if (/invalid x-master-key|does not belong/i.test(message)) {
        return "JSONBin rejected the key or bin. Use the Master Key from jsonbin.io/api-keys with a Bin ID created on that same account. Paste values without quotes. Keys should start with $2a$ or $2b$.";
      }
      return message;
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

  function forgetScores() {
    state.scoreMemo.clear();
  }

  function toggleCheck(habitId, iso) {
    if (parseISODate(iso) > today()) return;
    const bag = state.data.checks[habitId] || (state.data.checks[habitId] = {});
    if (bag[iso]) delete bag[iso];
    else bag[iso] = true;
    forgetScores();
    schedulePush();
    render();
  }

  function habitStart(habit) {
    let start = startOfDay(parseISODate(habit.createdAt));
    const checks = state.data.checks[habit.id] || {};
    for (const iso of Object.keys(checks)) {
      const d = parseISODate(iso);
      if (d < start) start = d;
    }
    return start;
  }

  function identitySeries(habit, until) {
    const end = until || today();
    const start = habitStart(habit);
    const points = [];
    if (start > end) return points;
    let ema = null;
    let i = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      i += 1;
      const x = habitChecked(habit.id, toISODate(d)) ? 1 : 0;
      ema = ema === null ? x : ema * (1 - IDENTITY_ALPHA) + x * IDENTITY_ALPHA;
      const maturity = 1 - Math.exp(-i / IDENTITY_TAU);
      points.push({
        date: d,
        iso: toISODate(d),
        score: Math.max(0, Math.min(100, ema * maturity * 100)),
      });
    }
    return points;
  }

  function habitScore(habit) {
    const cached = state.scoreMemo.get(habit.id);
    if (cached != null) return cached;
    const series = identitySeries(habit);
    const score = series.length ? Math.round(series[series.length - 1].score) : 0;
    state.scoreMemo.set(habit.id, score);
    return score;
  }

  function identityCaption(score) {
    if (score >= 100) return "second nature";
    if (score >= 90) return "identity";
    if (score >= 70) return "rooted";
    if (score >= 40) return "forming";
    return "spark";
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

  function allStreaks(habit) {
    const start = habitStart(habit);
    const end = today();
    const streaks = [];
    let run = null;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      if (habitChecked(habit.id, toISODate(d))) {
        if (!run) run = { start: d, end: d, length: 1 };
        else {
          run.end = d;
          run.length += 1;
        }
      } else if (run) {
        streaks.push(run);
        run = null;
      }
    }
    if (run) streaks.push(run);
    const currentLen = habitStreak(habit);
    const liveEnd = habitChecked(habit.id, toISODate(today())) ? today() : addDays(today(), -1);
    return streaks
      .map((item) => {
        const isLive = currentLen > 0 && item.length === currentLen && diffDays(item.end, liveEnd) === 0;
        return Object.assign({ live: isLive }, item);
      })
      .sort((a, b) => b.length - a.length || b.end - a.end);
  }

  function longestStreak(habit) {
    const streaks = allStreaks(habit);
    return streaks.length ? streaks[0].length : 0;
  }

  function overallScore() {
    const { habits } = state.data;
    if (!habits.length) return 0;
    const total = habits.reduce((sum, habit) => sum + habitScore(habit), 0);
    return Math.round(total / habits.length);
  }

  function bestStreakAll() {
    return state.data.habits.reduce((max, habit) => Math.max(max, longestStreak(habit)), 0);
  }

  function todayCounts() {
    const iso = toISODate(today());
    const total = state.data.habits.length;
    const done = state.data.habits.filter((habit) => habitChecked(habit.id, iso)).length;
    return { done, total };
  }

  function dataEarliest() {
    let min = today();
    for (const habit of state.data.habits) {
      const start = habitStart(habit);
      if (start < min) min = start;
    }
    return min;
  }

  function timelineDayCount() {
    return diffDays(state.timelineStart, today()) + 1;
  }

  function dateAtIndex(index) {
    return addDays(state.timelineStart, index);
  }

  function ensureTimelineSpan() {
    const floor = addDays(today(), -(MIN_HISTORY - 1));
    const earliest = dataEarliest();
    const need = earliest < floor ? earliest : floor;
    if (need < state.timelineStart) state.timelineStart = need;
  }

  function addHabit(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    state.data.habits.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `h-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: trimmed,
      createdAt: toISODate(today()),
    });
    const first = state.data.habits.length === 1;
    forgetScores();
    schedulePush();
    render(first ? { pinToToday: true } : {});
  }

  function removeHabit(id) {
    state.data.habits = state.data.habits.filter((habit) => habit.id !== id);
    delete state.data.checks[id];
    if (state.detailHabitId === id) closeDetail();
    forgetScores();
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
    els.statStreak.textContent = `${bestStreakAll()}d`;
    els.statCount.textContent = String(total);
    if (!total) els.scoreCaption.textContent = "100% = second nature";
    else if (score >= 100) els.scoreCaption.textContent = "identity locked";
    else els.scoreCaption.textContent = `${total - done} remaining today · 100% = second nature`;
  }

  function visibleRange(scrollLeft, pinToToday) {
    const total = timelineDayCount();
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

  function renderGrid(opts) {
    opts = opts || {};
    ensureTimelineSpan();
    const now = today();
    const nowIso = toISODate(now);
    const pin = Boolean(opts.pinToToday);
    const scrollHint = pin ? 0 : opts.preserveScroll != null ? opts.preserveScroll : els.gridWrap.scrollLeft;
    const { start, count, total } = visibleRange(scrollHint, pin);
    state.visIndex = start;

    els.grid.style.setProperty("--name-w", `${NAME_W}px`);
    els.grid.style.setProperty("--tail-w", `${TAIL_W}px`);
    els.grid.style.setProperty("--cell-w", `${CELL_W}px`);
    els.grid.style.setProperty("--days-w", `${total * CELL_W}px`);

    if (!state.data.habits.length) {
      els.grid.innerHTML = `
        <div class="empty">
          <strong>no protocols initialized</strong>
          add a habit, then scroll the lifetime log
        </div>`;
      els.rangeLabel.textContent = "scroll through days";
      return;
    }

    const leftPad = start * CELL_W;
    const rightPad = Math.max(0, (total - start - count) * CELL_W);
    const days = Array.from({ length: count }, (_, i) => dateAtIndex(start + i));
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
            const on = habitChecked(habit.id, iso);
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
        const score = habitScore(habit);
        const caption = identityCaption(score);
        return `
          <div class="habit-row">
            <div class="col-name">
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

    applyScroll(opts);
  }

  function applyScroll(opts) {
    const wrap = els.gridWrap;
    state.ignoreScroll = true;
    const apply = () => {
      if (opts.pinToToday) wrap.scrollLeft = wrap.scrollWidth;
      else if (opts.preserveScroll != null) wrap.scrollLeft = opts.preserveScroll;
      state.ignoreScroll = false;
    };
    apply();
    requestAnimationFrame(apply);
  }

  function downsample(points, max) {
    if (points.length <= max) return points;
    const step = (points.length - 1) / (max - 1);
    return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
  }

  function lineChart(points) {
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
          <line x1="${l}" x2="${w - r}" y1="${yAt(tick)}" y2="${yAt(tick)}" stroke="rgba(61,255,232,0.12)" />
          <text x="${l - 8}" y="${yAt(tick) + 4}" text-anchor="end" fill="#7d938d" font-size="11" font-family="Oxanium, sans-serif">${tick}</text>`
          )
          .join("")}
        <path d="${area}" fill="rgba(61,255,232,0.12)"></path>
        <path d="${line}" fill="none" stroke="#3dffe8" stroke-width="2.2"></path>
        ${xTicks
          .map((i) => {
            const label = formatShort(series[i].date);
            return `<text x="${xAt(i)}" y="${h - 12}" text-anchor="middle" fill="#7d938d" font-size="11" font-family="Oxanium, sans-serif">${label}</text>`;
          })
          .join("")}
      </svg>`;
  }

  function freqBuckets(habit, unit) {
    const start = habitStart(habit);
    const end = today();
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

    for (let d = start; d <= end; d = addDays(d, 1)) {
      if (!habitChecked(habit.id, toISODate(d))) continue;
      const key = keyFor(d);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return keys.map((key) => ({ key, label: labelFor(key), value: counts.get(key) || 0 }));
  }

  function barChart(buckets, unit) {
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
          <rect x="${x}" y="${y}" width="${barW}" height="${Math.max(bh, item.value ? 2 : 0)}" fill="#3dffe8" opacity="0.88"></rect>
          <text x="${x + barW / 2}" y="${t + ih + 14}" text-anchor="middle" fill="#7d938d" font-size="10" font-family="Oxanium, sans-serif" transform="rotate(-48 ${x + barW / 2} ${t + ih + 14})">${item.label}</text>
          <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" fill="#e7f6f2" font-size="10" font-family="Oxanium, sans-serif">${item.value}</text>`;
      })
      .join("");
    return `
      <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Ticks by ${unit}">
        <line x1="${l}" x2="${w - r}" y1="${t + ih}" y2="${t + ih}" stroke="rgba(61,255,232,0.2)" />
        ${bars}
      </svg>`;
  }

  function heatmapHtml(habit, year) {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const created = habitStart(habit);
    const now = today();
    const origin = mondayOf(start);
    const weeks = [];
    for (let cursor = origin; cursor <= end; cursor = addDays(cursor, 7)) weeks.push(cursor);

    const cols = weeks
      .map((weekStart) => {
        let label = "";
        for (let i = 0; i < 7; i++) {
          const d = addDays(weekStart, i);
          if (d.getFullYear() === year && d.getDate() === 1) label = MONTHS[d.getMonth()].slice(0, 3);
        }
        const cells = Array.from({ length: 7 }, (_, i) => {
          const d = addDays(weekStart, i);
          const iso = toISODate(d);
          if (d.getFullYear() !== year || d > now) return `<div class="heat-cell" title="${iso}"></div>`;
          if (d < created) return `<div class="heat-cell" title="${iso}"></div>`;
          const on = habitChecked(habit.id, iso);
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

  function renderDetail() {
    if (!state.detailHabitId) return;
    const habit = state.data.habits.find((item) => item.id === state.detailHabitId);
    if (!habit) {
      closeDetail();
      return;
    }
    const score = habitScore(habit);
    const current = habitStreak(habit);
    const best = longestStreak(habit);
    els.detailName.textContent = habit.name;
    els.detailScore.innerHTML = `<strong>${score}%</strong> ${identityCaption(score)} · current ${current}d · best ${best}d`;

    const series = identitySeries(habit);
    els.chartScore.innerHTML = lineChart(series);
    els.chartFreq.innerHTML = barChart(freqBuckets(habit, state.freqUnit), state.freqUnit);

    const minYear = habitStart(habit).getFullYear();
    const maxYear = today().getFullYear();
    if (state.heatYear < minYear) state.heatYear = minYear;
    if (state.heatYear > maxYear) state.heatYear = maxYear;
    els.heatYear.textContent = String(state.heatYear);
    els.heatmap.innerHTML = heatmapHtml(habit, state.heatYear);

    const streaks = allStreaks(habit).slice(0, 8);
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
  }

  function openDetail(id) {
    const habit = state.data.habits.find((item) => item.id === id);
    if (!habit) return;
    state.detailHabitId = id;
    state.heatYear = today().getFullYear();
    els.detail.classList.remove("hidden");
    renderDetail();
  }

  function closeDetail() {
    state.detailHabitId = null;
    els.detail.classList.add("hidden");
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function render(opts) {
    opts = opts || {};
    renderClock();
    renderScore();
    if (opts.pinToToday || opts.preserveScroll != null) renderGrid(opts);
    else renderGrid({ preserveScroll: els.gridWrap.scrollLeft });
    if (state.detailHabitId) renderDetail();
    if (state.creds && state.creds.binId && els.syncLabel.textContent === "local cache") {
      setSync("ok", "synced // jsonbin");
    }
  }

  function extendTimelineIfNeeded() {
    if (state.ignoreScroll) return false;
    if (els.gridWrap.scrollLeft >= CELL_W * 12) return false;
    const added = SCROLL_EXTEND;
    state.timelineStart = addDays(state.timelineStart, -added);
    renderGrid({ preserveScroll: els.gridWrap.scrollLeft + added * CELL_W });
    return true;
  }

  function openSetup() {
    els.apiKey.value = (state.creds && state.creds.apiKey) || "";
    els.binId.value = (state.creds && state.creds.binId) || "";
    els.setupError.classList.add("hidden");
    const envNote = document.getElementById("setup-env-note");
    if (envNote) envNote.classList.toggle("hidden", !(state.creds && state.creds.fromEnv));
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
      saveCreds({ apiKey: cleanSecret(apiKey), binId: cleanBinId(binId) });
      if (!state.creds.binId) {
        const id = await createRemote(state.data);
        saveCreds({ apiKey, binId: id });
      } else {
        const remote = await readRemote();
        if (remote && Array.isArray(remote.habits) && remote.checks) {
          state.data = remote;
          forgetScores();
          writeCache();
        } else {
          await updateRemote(state.data);
        }
      }
      setSync("ok", "synced // jsonbin");
      closeSetup();
      render({ pinToToday: true });
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
    ensureTimelineSpan();
    render({ pinToToday: true });

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
        forgetScores();
        writeCache();
      }
      setSync("ok", "synced // jsonbin");
      render({ pinToToday: true });
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
    const open = event.target.closest("[data-open]");
    if (open) {
      openDetail(open.dataset.open);
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

  els.gridWrap.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      els.gridWrap.scrollLeft += event.deltaY;
    },
    { passive: false }
  );

  els.gridWrap.addEventListener("scroll", () => {
    if (state.ignoreScroll) return;
    if (extendTimelineIfNeeded()) return;
    const idx = Math.floor(els.gridWrap.scrollLeft / CELL_W);
    if (Math.abs(idx - state.visIndex) >= 4) {
      renderGrid({ preserveScroll: els.gridWrap.scrollLeft });
    }
  });

  document.getElementById("jump-older").addEventListener("click", () => {
    if (els.gridWrap.scrollLeft < CELL_W * 40) {
      state.timelineStart = addDays(state.timelineStart, -SCROLL_EXTEND);
      renderGrid({ preserveScroll: els.gridWrap.scrollLeft + SCROLL_EXTEND * CELL_W - 30 * CELL_W });
      return;
    }
    els.gridWrap.scrollLeft -= 30 * CELL_W;
  });

  document.getElementById("jump-newer").addEventListener("click", () => {
    els.gridWrap.scrollLeft += 30 * CELL_W;
  });

  document.getElementById("jump-today").addEventListener("click", () => {
    renderGrid({ pinToToday: true });
  });

  els.settingsBtn.addEventListener("click", openSetup);
  els.setupDismiss.addEventListener("click", closeSetup);
  els.connectBtn.addEventListener("click", connect);
  document.getElementById("detail-close").addEventListener("click", closeDetail);
  els.detail.addEventListener("click", (event) => {
    if (event.target === els.detail) closeDetail();
  });

  els.freqSeg.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-freq]");
    if (!btn) return;
    state.freqUnit = btn.dataset.freq;
    renderDetail();
  });

  document.getElementById("heat-prev").addEventListener("click", () => {
    state.heatYear -= 1;
    renderDetail();
  });

  document.getElementById("heat-next").addEventListener("click", () => {
    state.heatYear += 1;
    renderDetail();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!els.detail.classList.contains("hidden")) closeDetail();
    else if (!els.setup.classList.contains("hidden")) closeSetup();
  });

  setInterval(renderClock, 60000);
  boot();
})();
