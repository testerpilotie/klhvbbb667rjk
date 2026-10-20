# Optihol 2

Track your drinks, see your estimated BAC live, and get a next-drink time that keeps
you inside the range you chose. Installable on a phone, works offline, and stores
everything on the device: no account, no server, no tracking.

This replaces the Flask prototype (tagged `v1-flask` in git). See [PLAN.md](PLAN.md) for
what changed and why, and [UX.md](UX.md) for the design reasoning.

## Run locally

It's a set of static files in `public/` with no build step and no dependencies.

```bash
python -m http.server 8080 --directory public
```

Open http://localhost:8080. The service worker is only registered over HTTPS on a
non-localhost host, so local edits always show up on reload.

## Test

The BAC model is plain JS with Node tests (Node 18+):

```bash
npm test
```

## Deploy

Only `public/` is served. Everything else (tests, docs) stays private.

**Production: optihol.com on the Hetzner box.**
- The repo is checked out at `/home/optihol/klhvbbb667rjk` (owned by user `optihol`).
- Caddy runs as the standalone `sites-caddy-1` container (`/home/scaffold/sites`, which
  also serves jokulu.ee). That checkout is mounted read-only at `/srv/optihol-sock`, and
  the `optihol.com` block in `/home/scaffold/sites/Caddyfile` serves
  `/srv/optihol-sock/public` with `file_server`.

**Releasing is automatic.**
1. Bump `CACHE` in `public/sw.js` whenever `public/` changes.
2. Open a pull request. GitHub runs the tests and checks the version bump.
3. Merge it.

Within about 2 minutes the `sites-deployer-1` container on the server fetches `main`, re-runs the tests, checks the bump, and fast-forwards the checkout as the `optihol` user. Check the result at https://optihol.com/deploy-status.json (`live`, `deployed`, or `blocked` with the reason). Nothing to run on the server, no sudo, no Caddy reload. This works from a phone: a Claude cloud session opens the PR, and you merge it in the GitHub app.

Caddy sends `Cache-Control: no-cache` on every file, and the service worker installs each version atomically, so users never get a mix of old and new files.

Server pieces, all in `/home/scaffold/sites` (owned by `scaffold`):
- `Caddyfile`
- `docker-compose.yml` (services `caddy` and `deployer`)
- `deployer/` (Dockerfile and `deploy.sh`)

Logs: `docker logs sites-deployer-1`.

The same origin matters: on first launch v2 reads v1's IndexedDB (`OptiholDB`), so
existing users keep their profile and drink history.

`public/_headers` carries the same security headers for Cloudflare Pages or Netlify, if
it's ever moved there.

## Files

| Path | What |
|---|---|
| `public/index.html` | Shell. Loads `css/app.css` and `js/app.js` |
| `public/js/model.js` | BAC model: body water, absorption, elimination, likely range, calibration, sessions, next-drink search. No DOM |
| `public/js/app.js` | Controller: derived state, actions, events, reminders, install prompt, deep links |
| `public/js/ui/*.js` | Views: `now`, `history`, `settings`, `onboarding`, `sheets` (add / custom / edit / breathalyzer), `common` |
| `public/js/score.js` | Zone score, badges + tiers, weekly goals + week streak, live goals, calendar, sweet spot. No DOM |
| `public/js/feel.js` | Subjective check-ins: personal feel zone, agreement with the model, trend, zone suggestion. No DOM |
| `public/js/plan.js` | Night planner (paced schedule, zone recipe in drinks) and .ics export. No DOM |
| `public/js/invite.js` | Crew invite links: encode/decode/validate, no server. No DOM |
| `public/js/share.js` | Canvas recap image + Web Share |
| `public/js/chart.js` | SVG gauge and interactive timeline |
| `public/js/store.js` | localStorage persistence, export/import, v1 migration |
| `public/js/drinks.js` | Drink presets and glass icons |
| `public/js/format.js` | Number, time and unit formatting |
| `public/sw.js`, `manifest.webmanifest`, `icons/` | PWA: offline cache, install metadata, home-screen shortcuts, icons |
| `public/_headers` | Security headers (CSP, nosniff, frame-deny…) for Cloudflare Pages / Netlify. On nginx, set the same headers in the server block |
| `tests/*.test.js` | Model and scoring tests (`node --test`) |

## Model in one paragraph

Volume of distribution is Watson total body water ÷ 0.80. Each drink is sipped evenly
over a typical time (pint 25 min … shot 0), and each sip absorbs first-order: 4/h on an empty stomach, 3/h after a snack, 2/h after a meal, with
bioavailability 1.0 / 0.95 / 0.85. Elimination is Michaelis–Menten (Km 0.05 ‰): it runs
at about 0.15 ‰/h by default (adjustable) and slows near zero. The curve is integrated
per minute. A lighter and a heavier body variant give the *likely range* (±12% volume,
±20% burn-off; halved after calibration), and "sober by" and the driving-limit time use
the cautious end. Breathalyzer readings fit a personal body factor, and with two readings ≥ 45 min apart on
one night also your burn-off rate. The next-drink time is the earliest minute at which adding your usual
drink keeps the projected peak at or below your zone's upper bound.

Home-screen shortcuts open `./?log=pint`, `./?log=long`, `./?log=wine12` or `./?log=water`,
which log the drink and clean up the URL.

It's an estimate. The app says so during onboarding, next to every driving-related
number, and in Settings.
