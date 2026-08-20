# PULSE

Static habit tracker. Habits, a bounded day grid, and an identity score (0–100%, where 100% means the habit is second nature). Data lives in a private JSONBin.

## Stack

HTML, CSS, and ES modules. No backend. Render hosts the static site; `node build-config.js` injects `JSONBIN_API_KEY` and `JSONBIN_BIN_ID` into `config.js` at build time.

## Local

Open `index.html` in a browser, or serve the folder. Connect a JSONBin API key in settings, or continue locally (browser cache only).

## Tests

Regression tests use Node’s built-in runner (Node 18+). No extra packages.

```bash
npm test
```

They lock identity scoring (new habits cannot hit 100% quickly), the bounded timeline, date formatting, JSONBin key handling, and the HTML shell.

## Render

Set `JSONBIN_API_KEY` and `JSONBIN_BIN_ID`. Build command: `node build-config.js`. Publish directory: `.`
