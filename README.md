# PULSE — habit tracker

Static frontend habit tracker. Habits, daily checkboxes, and a habit score. Data is stored on [jsonbin.io](https://jsonbin.io).

## Local preview

Open `index.html` in a browser, or serve the folder:

```bash
npx --yes serve .
```

## JSONBin setup

1. Create a free account at [jsonbin.io](https://jsonbin.io).
2. Copy your API key from [API Keys](https://jsonbin.io/api-keys).
3. Open the app, paste the key, leave **Bin ID** blank, and click **Establish link**.
4. A private bin is created and saved in this browser (`localStorage`).

The API key never leaves the browser except as `X-Master-Key` / `X-Access-Key` to `https://api.jsonbin.io`.

## Deploy on Render

1. Push this repo to GitHub / GitLab / Bitbucket.
2. In Render: **New → Static Site**.
3. Build command: leave empty (or `echo "static site"`).
4. Publish directory: `.`
5. Deploy, then connect JSONBin from the live site (per-browser).

You can also apply `render.yaml` as a Render Blueprint.

## Tracking

The day grid is a lifetime log. Scroll horizontally (or use the mouse wheel over the grid, or **older** / **newer**) to move through history. The timeline grows as you scroll back. Click a habit name or its identity score to open graphs, a heatmap, and best streaks.

## Identity score

Each habit has an identity score from 0–100%. **100% means the habit is second nature** — it has had time to settle and you have been consistently logging it.

The score combines:

- **Consistency** — a recency-weighted record of logged vs missed days (recent weeks count more, but history is not discarded).
- **Maturity** — a new habit cannot be 100% after a few days. The score approaches identity over months of practice.

The ring on the left is the average identity score across all habits.
