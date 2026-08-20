import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function runBuild(overrides) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-build-"));
  fs.copyFileSync(path.join(root, "build-config.js"), path.join(dir, "build-config.js"));
  const result = spawnSync(process.execPath, ["build-config.js"], {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...process.env,
      JSONBIN_API_KEY: "",
      JSONBIN_MASTER_KEY: "",
      JSONBIN_ACCESS_KEY: "",
      JSONBIN_BIN_ID: "",
      ...overrides,
    },
  });
  const configPath = path.join(dir, "config.js");
  const source = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
  return { result, source, dir };
}

function readConfig(source) {
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.PULSE_CONFIG;
}

test("build-config.js writes sanitized env values into PULSE_CONFIG", () => {
  const { result, source } = runBuild({
    JSONBIN_API_KEY: '"$2a$master-key-value"',
    JSONBIN_BIN_ID: "https://api.jsonbin.io/v3/b/abc999/latest",
  });
  assert.equal(result.status, 0, result.stderr);
  const config = readConfig(source);
  assert.equal(config.apiKey, "$2a$master-key-value");
  assert.equal(config.binId, "abc999");
  assert.equal(config.keyType, "master");
  assert.equal(result.stdout.includes("$2a$master-key-value"), false);
});

test("an access key is preferred when no master key is set", () => {
  const { result, source } = runBuild({
    JSONBIN_ACCESS_KEY: "$2a$access-only",
    JSONBIN_BIN_ID: "bin1",
  });
  assert.equal(result.status, 0, result.stderr);
  const config = readConfig(source);
  assert.equal(config.apiKey, "$2a$access-only");
  assert.equal(config.keyType, "access");
});
