const quiet = typeof process !== "undefined" && process.env && process.env.NODE_TEST_CONTEXT;

export function redactKey(key) {
  const value = String(key || "");
  if (!value) return "(empty)";
  return `${value.slice(0, 4)}… len=${value.length}`;
}

export function credSummary(creds) {
  if (!creds) return { present: false };
  return {
    present: true,
    fromEnv: Boolean(creds.fromEnv),
    keyType: creds.keyType || "master",
    key: redactKey(creds.apiKey),
    binId: creds.binId || "(empty)",
  };
}

export function log(step, detail) {
  if (quiet) return;
  if (arguments.length > 1) console.log("[pulse]", step, detail);
  else console.log("[pulse]", step);
}

export function logWarn(step, detail) {
  if (quiet) return;
  if (arguments.length > 1) console.warn("[pulse]", step, detail);
  else console.warn("[pulse]", step);
}

export function logError(step, err) {
  if (quiet) return;
  console.error("[pulse]", step, err);
}
