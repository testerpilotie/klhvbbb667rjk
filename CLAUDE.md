# Optihol

Installable BAC tracker that paces drinks to keep you in a chosen zone. Static PWA: no
backend, no build step, no dependencies. Everything runs and stays on the user's device.

## Layout

- `public/`: the whole app, served as-is at https://optihol.com. Entry `index.html` → `js/app.js`.
- `public/js/model.js`: BAC maths (pure). `score.js`, `feel.js`, `plan.js`, `invite.js`: pure logic.
- `public/js/ui/*.js`: views (HTML strings). `public/sw.js`: offline service worker.
- `tests/`: `node --test` (Node 22+), no dependencies. `UX.md` / `PLAN.md`: design reasoning and history.

## Releasing (read this before every change)

1. **If anything in `public/` changes, bump `const CACHE` in `public/sw.js`** (e.g. `optihol-v2.9.1` → `optihol-v2.9.2`).
   Without it, installed copies never update. The server refuses to deploy, and the PR check fails.
2. Run `npm test` (or `node --test`). All tests must pass.
3. Open a pull request against `main`. Never push to `main` directly.
4. Merging to `main` deploys automatically: the server checks GitHub every 2 minutes, re-runs the
   tests and fast-forwards. Result: https://optihol.com/deploy-status.json (`live` / `deployed` / `blocked` + reason).

There is nothing to do on the server for a normal release.

## Rules that must not break

- **Privacy:** no network calls, analytics, accounts or uploads. Data lives in `localStorage` only.
  Crew invites are link-only (`?crew=`): no server.
- **Safety:** next-drink guidance never schedules a drink that would push the projected peak above the
  zone (tested). "Sober" means below 0.05 ‰ (`SOBER_BAC`). The driving-limit time uses the cautious end
  of the likely range. Always say estimates are not a reason to drive.
- **Gamification** rewards precision, pacing, water, stopping and alcohol-free days. Never amount or frequency.
- **Never mix versions:** `sw.js` installs a version atomically (`cache: 'reload'`) and serves app files
  only from that version's cache. Don't reintroduce stale-while-revalidate for app files.

## Style

Plain ES modules, 2-space indent, single quotes, small pure functions with JSDoc where it helps.
Views return template strings; escape user text with `F.esc`. Match surrounding code and comment density.
