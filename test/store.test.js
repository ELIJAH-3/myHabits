import assert from "node:assert/strict";
import test from "node:test";
import { CACHE_KEY, CREDS_KEY } from "../js/constants.js";
import {
  cleanBinId,
  cleanSecret,
  createRemote,
  jsonbinRequest,
  loadCache,
  loadCreds,
  readRemote,
  saveCreds,
  writeCache,
} from "../js/store.js";
import { memoryStorage } from "./helpers.js";

function jsonRes(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test("cleanSecret strips quotes, whitespace, and a Bearer prefix", () => {
  assert.equal(cleanSecret('  "$2a$abc"  '), "$2a$abc");
  assert.equal(cleanSecret("'$2b$xyz'"), "$2b$xyz");
  assert.equal(cleanSecret("Bearer $2a$key"), "$2a$key");
  assert.equal(cleanSecret("bearer   $2a$key"), "$2a$key");
});

test("cleanBinId accepts a raw id or a jsonbin URL", () => {
  assert.equal(cleanBinId("68a1b2c3d4e5f6a7b8c9d0e1"), "68a1b2c3d4e5f6a7b8c9d0e1");
  assert.equal(cleanBinId("https://api.jsonbin.io/v3/b/abc123/latest"), "abc123");
  assert.equal(cleanBinId("https://jsonbin.io/app/a/abc123"), "abc123");
  assert.equal(cleanBinId('"abc123"'), "abc123");
});

test("env config wins over localStorage and does not write the key back", () => {
  globalThis.window = globalThis;
  globalThis.localStorage = memoryStorage();
  window.PULSE_CONFIG = { apiKey: "$2a$env", binId: "envbin", keyType: "master" };
  localStorage.setItem(CREDS_KEY, JSON.stringify({ apiKey: "$2a$local", binId: "localbin" }));

  const creds = loadCreds();
  assert.equal(creds.apiKey, "$2a$env");
  assert.equal(creds.binId, "envbin");
  assert.equal(creds.fromEnv, true);

  saveCreds(creds, { apiKey: "$2a$changed", binId: "newbin", fromEnv: true });
  const stored = JSON.parse(localStorage.getItem(CREDS_KEY));
  assert.equal(stored.apiKey, "$2a$local");
});

test("localStorage creds are used when env config has no key", () => {
  globalThis.window = globalThis;
  globalThis.localStorage = memoryStorage();
  window.PULSE_CONFIG = { apiKey: "", binId: "" };
  localStorage.setItem(CREDS_KEY, JSON.stringify({ apiKey: '"$2a$local"', binId: "https://api.jsonbin.io/v3/b/bin9" }));

  const creds = loadCreds();
  assert.equal(creds.apiKey, "$2a$local");
  assert.equal(creds.binId, "bin9");
  assert.equal(creds.fromEnv, undefined);
});

test("saveCreds persists local keys and loadCache rejects invalid payloads", () => {
  globalThis.window = globalThis;
  globalThis.localStorage = memoryStorage();
  window.PULSE_CONFIG = { apiKey: "", binId: "" };

  saveCreds(null, { apiKey: "$2a$k", binId: "b1", keyType: "master" });
  assert.deepEqual(JSON.parse(localStorage.getItem(CREDS_KEY)), {
    apiKey: "$2a$k",
    binId: "b1",
    keyType: "master",
  });

  assert.deepEqual(loadCache(), { habits: [], checks: {} });
  localStorage.setItem(CACHE_KEY, "{not json");
  assert.deepEqual(loadCache(), { habits: [], checks: {} });
  localStorage.setItem(CACHE_KEY, JSON.stringify({ habits: [], nope: true }));
  assert.deepEqual(loadCache(), { habits: [], checks: {} });

  const data = { habits: [{ id: "h", name: "x", createdAt: "2026-01-01" }], checks: { h: {} } };
  writeCache(data);
  assert.deepEqual(loadCache(), data);
});

test("jsonbinRequest retries the other key header after 401", async () => {
  const headers = [];
  const creds = { apiKey: "$2a$key", keyType: "master" };
  globalThis.fetch = async (_url, options) => {
    headers.push(options.headers);
    if (options.headers["X-Master-Key"]) return jsonRes(401, { message: "Unauthorized" });
    return jsonRes(200, { ok: true });
  };
  const res = await jsonbinRequest(creds, "https://api.jsonbin.io/v3/b/x", { method: "GET" }, { Accept: "application/json" });
  assert.equal(res.ok, true);
  assert.equal(creds.keyType, "access");
  assert.equal(headers[0]["X-Master-Key"], "$2a$key");
  assert.equal(headers[1]["X-Access-Key"], "$2a$key");
});

test("readRemote returns the record payload and createRemote reads the bin id", async () => {
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith("/latest")) {
      return jsonRes(200, { record: { habits: [{ id: "h" }], checks: {} } });
    }
    if (options.method === "POST") {
      return jsonRes(200, { metadata: { id: "newbin" } });
    }
    return jsonRes(500, { message: "nope" });
  };
  const remote = await readRemote({ apiKey: "$2a$k", binId: "abc", keyType: "master" });
  assert.equal(remote.habits[0].id, "h");
  const id = await createRemote({ apiKey: "$2a$k", keyType: "master" }, { habits: [], checks: {} });
  assert.equal(id, "newbin");
});
