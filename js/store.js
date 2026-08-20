import { API, CACHE_KEY, CREDS_KEY } from "./constants.js";
import { credSummary, log, logError, logWarn, redactKey } from "./log.js";
import { emptyData } from "./model.js";

export function cleanSecret(value) {
  let v = String(value || "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(v)) v = v.replace(/^bearer\s+/i, "").trim();
  return v;
}

export function cleanBinId(value) {
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
  log("read PULSE_CONFIG", {
    hasObject: Boolean(window.PULSE_CONFIG),
    key: redactKey(apiKey),
    binId: binId || "(empty)",
    keyType: cfg.keyType || "master",
  });
  if (!apiKey) {
    log("env creds skipped (no API key in config.js)");
    return null;
  }
  return { apiKey, binId, keyType: cfg.keyType || "master", fromEnv: true };
}

export function loadCreds() {
  log("loadCreds start");
  let local = null;
  try {
    local = JSON.parse(localStorage.getItem(CREDS_KEY) || "null");
    log(
      "localStorage creds",
      local ? { binId: local.binId || "(empty)", key: redactKey(local.apiKey) } : null
    );
  } catch (err) {
    logWarn("localStorage creds parse failed", err);
    local = null;
  }
  const env = envCreds();
  if (env) {
    const creds = {
      apiKey: env.apiKey,
      binId: env.binId || (local && cleanBinId(local.binId)) || "",
      keyType: env.keyType || "master",
      fromEnv: true,
    };
    log("using env creds", credSummary(creds));
    return creds;
  }
  if (local) {
    const creds = {
      apiKey: cleanSecret(local.apiKey),
      binId: cleanBinId(local.binId),
    };
    log("using localStorage creds", credSummary(creds));
    return creds;
  }
  log("no creds found");
  return null;
}

export function saveCreds(previous, next) {
  const fromEnv = Boolean(previous && previous.fromEnv) || Boolean(next && next.fromEnv);
  const creds = Object.assign({}, next, { fromEnv });
  log("saveCreds", credSummary(creds));
  if (!fromEnv) {
    if (next) {
      localStorage.setItem(
        CREDS_KEY,
        JSON.stringify({ apiKey: next.apiKey, binId: next.binId, keyType: next.keyType })
      );
    } else localStorage.removeItem(CREDS_KEY);
  } else {
    log("saveCreds skipped localStorage (env-managed)");
  }
  return creds;
}

export function loadCache() {
  log("loadCache");
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (parsed && Array.isArray(parsed.habits) && parsed.checks) {
      log("cache hit", { habits: parsed.habits.length, checkBags: Object.keys(parsed.checks).length });
      return parsed;
    }
    log("cache empty or invalid");
  } catch (err) {
    logWarn("cache parse failed", err);
  }
  return emptyData();
}

export function writeCache(data) {
  log("writeCache", { habits: data.habits.length });
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

function authHeaders(creds, extra, kind) {
  const key = cleanSecret(creds.apiKey);
  const headers = Object.assign({}, extra);
  if (kind === "access") headers["X-Access-Key"] = key;
  else headers["X-Master-Key"] = key;
  return headers;
}

export async function jsonbinRequest(creds, url, options, extraHeaders) {
  const method = (options && options.method) || "GET";
  const preferred = creds.keyType === "access" ? ["access", "master"] : ["master", "access"];
  log("jsonbin request", { method, url, try: preferred });
  let lastRes = null;
  for (const kind of preferred) {
    try {
      lastRes = await fetch(url, Object.assign({}, options, { headers: authHeaders(creds, extraHeaders, kind) }));
    } catch (err) {
      logError("jsonbin fetch threw", { method, url, kind, err });
      throw err;
    }
    log("jsonbin response", { method, url, kind, status: lastRes.status, ok: lastRes.ok });
    if (lastRes.ok) {
      creds.keyType = kind;
      log("jsonbin auth accepted", { kind });
      return lastRes;
    }
    if (lastRes.status !== 401) return lastRes;
    logWarn("jsonbin 401, trying next key type", { kind });
  }
  return lastRes;
}

export async function errorMessage(res) {
  try {
    const body = await res.json();
    const message = body.message || `JSONBin error ${res.status}`;
    log("jsonbin error body", { status: res.status, message });
    if (/invalid x-master-key|does not belong/i.test(message)) {
      return "JSONBin rejected the key or bin. Use the Master Key from jsonbin.io/api-keys with a Bin ID created on that same account. Paste values without quotes. Keys should start with $2a$ or $2b$.";
    }
    return message;
  } catch {
    return `JSONBin error ${res.status}`;
  }
}

export async function readRemote(creds) {
  const binId = cleanBinId(creds.binId);
  log("readRemote", { binId });
  const res = await jsonbinRequest(
    creds,
    `${API}/b/${binId}/latest`,
    { cache: "no-store" },
    { "X-Bin-Meta": "false" }
  );
  if (!res.ok) throw new Error(await errorMessage(res));
  const payload = await res.json();
  const record = payload.record || payload;
  log("readRemote ok", {
    habits: record && record.habits ? record.habits.length : 0,
    keys: record ? Object.keys(record) : [],
  });
  return record;
}

export async function createRemote(creds, data) {
  log("createRemote", { habits: data.habits.length });
  const res = await jsonbinRequest(creds, `${API}/b`, { method: "POST", body: JSON.stringify(data) }, {
    "Content-Type": "application/json",
    "X-Bin-Name": "pulse-habit-tracker",
    "X-Bin-Private": "true",
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  const payload = await res.json();
  const id = payload.metadata && payload.metadata.id;
  if (!id) throw new Error("JSONBin did not return a bin id.");
  log("createRemote ok", { binId: id });
  return id;
}

export async function updateRemote(creds, data) {
  const binId = cleanBinId(creds.binId);
  log("updateRemote", { binId, habits: data.habits.length });
  const res = await jsonbinRequest(creds, `${API}/b/${binId}`, { method: "PUT", body: JSON.stringify(data) }, {
    "Content-Type": "application/json",
    "X-Bin-Versioning": "false",
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  log("updateRemote ok");
}
