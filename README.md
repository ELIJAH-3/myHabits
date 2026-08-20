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

## Score

Each habit is scored as completion rate over the last 30 days (from the day it was created). The overall habit score is the average of per-habit scores. Streak is consecutive checked days ending today (or yesterday if today is still open).
