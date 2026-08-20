"use strict";

const fs = require("fs");
const path = require("path");

function readEnv(name) {
  return String(process.env[name] || "").trim();
}

const apiKey = readEnv("JSONBIN_API_KEY") || readEnv("JSONBIN_MASTER_KEY");
const binId = readEnv("JSONBIN_BIN_ID");

const body = `window.PULSE_CONFIG = ${JSON.stringify({ apiKey, binId }, null, 2)};\n`;
const out = path.join(__dirname, "config.js");
fs.writeFileSync(out, body, "utf8");

if (apiKey && binId) {
  console.log("Wrote config.js from JSONBIN_API_KEY and JSONBIN_BIN_ID");
} else if (apiKey) {
  console.log("Wrote config.js with JSONBIN_API_KEY only (JSONBIN_BIN_ID is empty)");
} else {
  console.log("Wrote empty config.js (JSONBin environment variables are not set)");
}
