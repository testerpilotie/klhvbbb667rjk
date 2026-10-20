# Optihol v2 — plan

## What v1 was (C:\gem-cli\Optihol, Sep–Nov 2025)

A Flask app + vanilla JS page that tracks drinks and estimates BAC against a
0.5–0.7‰ target zone. It worked as a prototype but wasn't something people
would keep on their phone:

| Problem | Why it matters |
|---|---|
| Unstyled page: Arial, default buttons, inline-styled table, emoji buttons | Looks like a dev tool, not an app |
| Every refresh POSTs the whole drink log to the server | Breaks the "data stays on your device" promise; no offline use; needs a running Python server |
| Elimination modelled as first-order (`e^(−0.65·t)`) | Removes ~0.65‰/h at 1‰ (≈4× too fast) and never actually reaches zero at low BAC |
| Volume of distribution = total body water (no blood-water factor) | Overestimates every drink by ~25% |
| "Next drink" logic admits it doesn't handle the below-zone case | The headline feature gave vague advice |
| No undo / delete / edit of drinks, no history, no stats | Most beta-tester feedback items still open |
| Not mobile-first, not installable | It's used at a bar, on a phone |

## What v2 is

A **static, installable PWA**. No backend, no build step, no dependencies.
All math runs on the device; all data lives in the browser. Host it anywhere
that serves files (Cloudflare Pages, Netlify, nginx on the Hetzner box).

### Product

1. **Onboarding** (first run): 18+ / estimate-only acknowledgement → body
   profile. Zone starts at 0.5–0.7 ‰ and is changed in Settings. Under a minute.
2. **Now screen**
   - Big live BAC readout + status (below / in zone / above / well above)
   - Next-drink guidance: *"Next drink at 21:40"* computed so your usual drink
     won't push you over the zone; *"Wait — still rising to 0.78‰"* otherwise
   - Peak (value + time), "below driving limit at", "sober at"
   - Timeline chart: past + projected curve, zone band, now line, drink markers,
     touch-scrub readout
   - Food toggle (empty / snack / meal) for the current session
3. **Add drink sheet**: preset grid (beer, long drink, cider, wine, shot,
   cocktail) + your own custom drinks, "when" slider for drinks you forgot to
   log, and a live *"peak would be X at HH:MM"* preview before you commit.
   One-tap re-add of the last drink from the Now screen. Undo toast.
4. **Session log**: every drink of the session, tap to delete.
5. **History**: sessions auto-split when you were back to 0‰; per session:
   date, duration, drinks, grams, peak, time in zone.
6. **Settings**: profile, zone, driving limit (0.2 / 0.5 / 0.8‰ or off),
   units (‰ or %BAC), elimination rate (advanced), custom drinks, theme,
   export / import / erase data.
7. **Safety rails** baked in, not bolted on: estimate disclaimers on the
   driving line, a "well above zone — switch to water" state, zone max capped
   at 1.0‰, guidance never suggests a drink that would overshoot.

### Model (js/model.js)

- Distribution volume: Watson total body water ÷ 0.80 (blood water fraction)
  → BAC in g/L ≈ ‰. For 95 kg / 180 cm / 40 y male that's r ≈ 0.66, in line
  with Widmark.
- Absorption: first-order per drink, rate depends on food
  (empty 4/h, snack 3/h, meal 2/h) with bioavailability 1.0 / 0.95 / 0.85 —
  a meal lowers a typical evening's peak by ~30%.
- Elimination: zero-order, default 0.15‰/h (adjustable 0.10–0.25).
- Simulated numerically at 1-minute resolution; everything else (peak, sober
  time, guidance, time-in-zone) is derived from the simulated curve.
- Covered by `node --test`.

### Migration

v2 reads v1's IndexedDB (`OptiholDB`) once on first launch, so anyone who
used optihol.com keeps their profile and drink history when the new version
is deployed on the same domain.

## v2.1 — making people keep using it

Checked against GitHub (testerpilotie/klhvbbb667rjk @ 2058f55, same as local). The one
thing there that v2.0 lacked was the security headers from the uncommitted `app.py`
change; they're now in `_headers` plus a CSP meta tag. The rest of the v1 roadmap
(Michaelis–Menten, uncertainty, session comparison, hourly breakdown) informed this list:

| Why people drop a tracker | What v2.1 does |
|---|---|
| Logging is a chore at the bar | One-tap row of your recent drinks + water; home-screen shortcuts (long-press icon → Beer); install prompt |
| Mistakes are annoying to fix | Tap any drink to move its time (±5/10/30 min) with a live preview, or delete it |
| "Is this number even right?" | Likely range (e.g. 0.41–0.71) instead of false precision; breathalyzer calibration that learns your body and narrows the range |
| Safety numbers felt too exact | "Sober by" and "under the limit by" use the cautious end of the range |
| Slow burn-off near zero ignored | Michaelis–Menten elimination |
| No reason to come back next week | Standard drinks per week (8/10/12/14 g, set per country), sparkline per session |
| You forget when it's time | Opt-in next-drink reminder (works while the app is open or backgrounded) |
| Harm reduction felt preachy | Water logging, a quiet "3 drinks since your last water" nudge |

## v2.2 — the fun layer

Everything here rewards precision, pacing, water and alcohol-free days. Nothing rewards
drinking more: a night that never reaches the zone gets no score (🍃 "Took it easy"), and it
never breaks a streak.

- **Zone score (0–100)** per night: share of your "up" time spent inside the zone, minus
  points for time above it; capped at 40 if you went well over. Grades: Bullseye, Dialed in,
  A bit wobbly, Overshot, Patchy. Shown live on the Now screen too.
- **"You're in the zone" moment**: the first time a night enters the zone, the gauge pops and a ring pulses (once per night).
- **Night recap** (tap any night): score ring, curve, stats, badges, a name ("Sauna with
  the crew"), the morning-after rating, the drink list, and **Share recap**, which makes a
  1080×1350 image for stories and chats (Web Share, or a download).
- **Badges + trophy shelf**: 🎯 Bullseye, 🧊 Cool head, 💧 Hydrated, 🐢 Slow sipper,
  🌙 Early night, 🍃 Easy does it, 📏 Scientist, 🌅 Fresh morning. Locked ones show greyed out.
- **Morning check-in**: the day after, the Now screen asks how you feel (😵 → 😎).
  After three ratings, History shows **your sweet spot**: the peak above which your
  mornings get worse.
- **Insights**: current/best streak of nights without going over, alcohol-free days this
  week, best score this month.
- **12-week calendar**: each day coloured by that night's peak; alcohol-free days counted.

## v2.3 — how you actually feel

- **Check-in on the Now screen** during a night: 🌱 Not yet · 🎯 In the zone · 🌀 Too much.
  Each tap is stored with its time; the app pairs it with the model's BAC at that moment
  (recomputed, so later calibration improves old check-ins too). Undo via the toast.
  The 🎯 button gently pulses if you haven't checked in for 45 minutes.
- Check-ins appear as pins on the live timeline and on the night recap's curve, where
  each can be removed.
- **History → Your feel zone** (after three 🎯 check-ins): the middle half of your 🎯 BACs,
  tightened by 🌱/🌀 taps; a strip plot of every check-in against your set zone; a one-tap
  **Use as my zone** suggestion (rounded to 0.05 ‰, undoable); and how often your feeling
  agrees with the estimate (below 60% → suggests a breathalyzer reading).
- **Trend** (after four nights with 🎯): per-night median, least-squares line, and a plain
  verdict: steady, down ("you feel it sooner"), or up ("that's how tolerance shows up").
- New badge: 🧘 Tuned in (two check-ins in a night).

## v2.5 — logic review

Probed the model and the app's bookkeeping with real scenarios. What was wrong and what changed:

| Problem (measured) | Fix |
|---|---|
| **Burn-off was never learned**, yet it dominates: the same 3 pints are "sober" after 6.0 h at 0.20 ‰/h and 11.8 h at 0.10 ‰/h. Readings only tuned body size. | `fitCalibration` fits body size from one reading, and **body size + burn-off rate** from two readings ≥ 45 min apart on the same night (grid 0.08–0.30 ‰/h). Learned rate shows in Settings (slider locked) and narrows the likely range further. Verified: recovers a true 0.20 ‰/h and +10% body factor exactly. |
| **Food was applied retroactively**: switching to "Meal" after 3 pints dropped the current estimate 0.69 → 0.46 ‰, as if you'd eaten first. That's an underestimate, the dangerous direction. | Changing the stomach setting only affects drinks still in your stomach (started within the last hour) and later ones. |
| **Food leaked between nights**: last week's "Meal" applied to tonight. | Each night starts on an empty stomach (the cautious assumption). |
| **Drinks were treated as downed instantly**: a pint logged as you start it put 0.15 ‰ in your blood within 10 minutes. | Drinks are sipped evenly over a typical time (pint 25 min, wine 20, cocktail 15, shot 0). Closed-form absorption; older entries are migrated. Peak lands about 12 min later, as it should. |
| **Night identity broke on edits**: name, rating and celebration were keyed to the first drink, so moving or deleting it orphaned them. | A night is identified by whichever of its drinks carries its data; deleting that drink hands it to a sibling. Check-ins are matched by night, not drink. |
| Weekly totals put a Saturday night's 1 am drink into the next week. | Weeks follow drinking days (before 6 am counts as the night before). |
| The morning check-in fired after a single light drink. | Only asks after nights that peaked at 0.2 ‰ or more. |

Safety invariant re-tested: following the next-drink advice never overshoots the zone,
now also with sipped drinks and after a meal (34 tests).

## v2.6 — gamification, redesigned

Audit, principles and changes are in UX.md ("Gamification review"). In short:

| Before | After |
|---|---|
| Nightly "never over" streak: grew only by drinking, reset to 0 by one slip (0 / best 1 after 11 nights) | **Weekly goals + week streak** 🔥: your own targets (alcohol-free days, never over, optional drink cap). A dry week always wins. |
| Rewards invisible (0 reward moments on Now) | **Live badges** during a night with a toast when earned; **"Last night" reveal** with score, new badges and tier-ups; recap ring animation and badge pops. |
| 🌙 Early night earned 11/11 nights | Replaced by **🌙 Called it**: tap "Done for tonight" and stick to it. |
| Badges were one-off counters | **Bronze / Silver / Gold** tiers (1 / 5 / 15) with progress bars and **Next up**. |
| Little reward for not drinking | **This week** card on non-drinking days; 🌿 Dry week and 🗓️ Goal week achievements. |
| Score without context | Personal best 🏆 and "your average is N" in the recap. |

The ethics are tested in code: the weekly goal logic, tier maths and live goals have unit tests,
and no reward scales with grams, drink count or drinking nights.

## Later

- True push reminders when the app is closed (needs a push service)
- Share a session summary card
- Playwright smoke test of the main flows
