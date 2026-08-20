# PULSE — habit tracker

Static frontend habit tracker. Habits, daily checkboxes, and a habit score. Data is stored on [jsonbin.io](https://jsonbin.io).

## Local preview

Open `index.html` in a browser, or serve the folder:

```bash
npx --yes serve .
```

## JSONBin setup

Create a free account at [jsonbin.io](https://jsonbin.io) and copy your API key from [API Keys](https://jsonbin.io/api-keys). Create a private bin (or leave Bin ID blank in the local app to create one).

### Local

Open the app and paste the API key and Bin ID, or generate `config.js`:

```bash
JSONBIN_API_KEY=your_key JSONBIN_BIN_ID=your_bin_id node build-config.js
```

### Render (build-time environment variables)

Static sites only see env vars during the **build**. `node build-config.js` writes them into `config.js`.

1. Render Dashboard → your static site → **Environment**.
2. Add:
   - `JSONBIN_API_KEY` — JSONBin master key (or access key)
   - `JSONBIN_BIN_ID` — the bin id
3. Save with **Save, rebuild, and deploy**.
4. Build command: `node build-config.js`
5. Publish directory: `.`

The Master Key and Bin ID must belong to the **same** JSONBin account. Paste them with no quotes. A valid key starts with `$2a$` or `$2b$`.

`config.js` is generated at build time and is not committed. Anyone who can view the live site can also read that file, so treat this as a personal app.

## Tracking

The day grid is a lifetime log. Scroll horizontally (or use the mouse wheel over the grid, or **older** / **newer**) to move through history. The timeline grows as you scroll back. Click a habit name or its identity score to open graphs, a heatmap, and best streaks.

## Identity score

Each habit has an identity score from 0–100%. **100% means the habit is second nature** — it has had time to settle and you have been consistently logging it.

The score combines:

- **Consistency** — a recency-weighted record of logged vs missed days (recent weeks count more, but history is not discarded).
- **Maturity** — a new habit cannot be 100% after a few days. The score approaches identity over months of practice.

The ring on the left is the average identity score across all habits.
