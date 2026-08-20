"use strict";

const fs = require("fs");
const path = require("path");

function clean(value) {
  let v = String(value || "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function cleanBinId(value) {
  let id = clean(value);
  const fromUrl = id.match(/\/(?:v3\/)?b\/([A-Za-z0-9]+)(?:\/|$)/);
  if (fromUrl) return fromUrl[1];
  const parts = id.split("/").filter(Boolean);
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    return last === "latest" ? parts[parts.length - 2] : last;
  }
  return id;
}

const accessKey = clean(process.env.JSONBIN_ACCESS_KEY);
const masterKey = clean(process.env.JSONBIN_API_KEY) || clean(process.env.JSONBIN_MASTER_KEY);
const apiKey = accessKey || masterKey;
const keyType = accessKey && !masterKey ? "access" : "master";
const binId = cleanBinId(process.env.JSONBIN_BIN_ID);

const body = `window.PULSE_CONFIG = ${JSON.stringify({ apiKey, binId, keyType }, null, 2)};\n`;
fs.writeFileSync(path.join(__dirname, "config.js"), body, "utf8");

const prefix = apiKey.slice(0, 4);
console.log(
  `Wrote config.js keyType=${keyType} keyLength=${apiKey.length} keyPrefix=${prefix || "(empty)"} binLength=${binId.length}`
);
if (apiKey && !apiKey.startsWith("$2")) {
  console.log(
    "Warning: JSONBin keys usually start with $2a$ or $2b$. If yours does not, quotes or $ may have been stripped in Render."
  );
}
