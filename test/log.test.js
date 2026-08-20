import assert from "node:assert/strict";
import test from "node:test";
import { credSummary, redactKey } from "../js/log.js";

test("redactKey never prints the rest of a JSONBin key", () => {
  const key = "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789";
  const redacted = redactKey(key);
  assert.equal(redacted, `$2a$… len=${key.length}`);
  assert.equal(redacted.includes("abcdefgh"), false);
  assert.equal(redactKey(""), "(empty)");
  assert.equal(redactKey(null), "(empty)");
});

test("credSummary exposes only a redacted key", () => {
  const summary = credSummary({
    apiKey: "$2a$super-secret-value",
    binId: "bin123",
    fromEnv: true,
    keyType: "master",
  });
  assert.equal(summary.present, true);
  assert.equal(summary.binId, "bin123");
  assert.equal(summary.key.includes("super-secret"), false);
  assert.equal(summary.key.startsWith("$2a$"), true);
  assert.deepEqual(credSummary(null), { present: false });
});
