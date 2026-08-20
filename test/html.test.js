import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { escapeHtml } from "../js/ui.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_IDS = [
  "setup",
  "setup-title",
  "api-key-input",
  "bin-id-input",
  "setup-error",
  "connect-btn",
  "setup-dismiss",
  "setup-env-note",
  "settings-btn",
  "clock",
  "ring-value",
  "score-value",
  "score-caption",
  "stat-today",
  "stat-streak",
  "stat-count",
  "sync-dot",
  "sync-label",
  "range-label",
  "jump-older",
  "jump-today",
  "jump-newer",
  "grid-wrap",
  "habit-grid",
  "add-toggle",
  "add-form",
  "habit-name",
  "habit-detail",
  "detail-name",
  "detail-score-line",
  "detail-close",
  "chart-score",
  "chart-freq",
  "freq-seg",
  "heatmap",
  "heat-year",
  "heat-prev",
  "heat-next",
  "streak-list",
];

test("index.html keeps the shell contract the app binds to", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  for (const id of REQUIRED_IDS) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
  assert.match(html, /<script type="module" src="js\/main\.js">/);
  assert.match(html, /id="add-toggle"[^>]*class="add-toggle"/);
  assert.equal(html.includes('id="add-toggle" class="btn primary"'), false);
  assert.equal(/<footer\b/i.test(html), false);
  assert.equal(html.includes("frontend only"), false);
  assert.equal(html.includes("click a habit for graphs"), false);
});

test("escapeHtml prevents habit names from injecting markup", () => {
  assert.equal(escapeHtml(`<img src=x onerror="alert(1)">`), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.equal(escapeHtml("A & B"), "A &amp; B");
});
