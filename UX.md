# Optihol — UX review and redesign (v2.4)

## 1. Empathize: who's holding the phone, and where

| Moment | Context | What they need |
|---|---|---|
| **At the bar** | Dim light, loud, phone in one hand and a glass in the other, friends talking, 2–4 drinks in. Glances of about 5 seconds. | Log a drink in **one tap**. Answer **"can I have another?"** at a glance. |
| **Mid-night check** | A quiet moment, bathroom queue, walking between places | Say how they feel. Log water. |
| **The morning after** | Sofa, coffee, curious, plenty of time | Rate the morning. Relive the night. Maybe share it. |
| **Over the weeks** | Occasional, reflective | Am I drifting? Where's my sweet spot? Trophies. |

The bar moment matters most and is the hardest one. It sets the bar (pun intended) for the Now screen.

## 2. Define: what the v2.3 audit found

Measured on a 375 × 812 phone during an active night:

| # | Problem | Evidence |
|---|---|---|
| P1 | **Logging has no single home.** The most frequent action is scattered. | 8 separate drink/water logging buttons on one screen. The quick-log row sits below the fold (~900 px). |
| P2 | **The key answer is fragmented.** "Can I have another?" is split across the gauge trend, a guidance card, a water tip and the stats. | 283 words on the Now screen. The guidance card alone has a headline, a sentence, a bell, a tip, two buttons and a link. |
| P3 | **Everything shouts.** Rarely changed settings get prime space. | Now is 3.2 screens long. The stomach selector is a full card. |
| P4 | **History buries the nights.** | The first night card is 2.3 screens down. History is 5.3 screens long. |
| P5 | **Primary actions are out of thumb reach.** | Logging buttons sit mid-screen. The floating button covers content. |
| P6 | **Low contrast in a dark room.** | The "faint" text colour is 3.0–3.3:1 on dark backgrounds and 2.4–2.6:1 in the light theme. |

## 3. Principles

1. **One glance, one answer.** The top of the screen says where you are *and* whether the next drink fits, in one sentence.
2. **Thumb first.** Everything you do at the bar lives in a dock at the bottom of the screen.
3. **One home per action.** Drinks and water are logged from the dock and nowhere else.
4. **Show, don't tell.** Use state on the controls (a water dot, a bell) instead of extra paragraphs.
5. **Progressive disclosure.** Tonight's details sit below the fold, grouped, and quiet.
6. **Night-proof.** 44 px+ touch targets, ≥ 4.5:1 text contrast, short words.
7. **Reflection is its own space.** History is split by intent: Nights, Trends, Trophies.

## 4. What changed

**Now screen**
- **Verdict inside the hero.** Gauge, status, likely range, trend, and below a hairline the verdict: "✓ Next drink fits now", "⏱ Next drink at 7:28 · in 1 h 12 min" (with a bell toggle), "💧 Time for water", or "🌙 Done for tonight". The separate guidance card and its buttons are gone.
- **Action dock** fixed above the tab bar: your recent drinks as one-tap chips, 💧 Water, and **＋** for everything else. It replaces the floating button, the one-tap row and the "Log Beer / Other" buttons, so 8 entry points become 1. When you're two drinks past your last water, the water chip gets a dot instead of a text tip.
- **Check-in** is a single compact row: "How do you feel?" with 🌱 🎯 🌀.
- **Tonight card.** Four stats, the timeline and the stomach setting live together in one card. "Done for tonight" and the breathalyzer reading move to the footer of the drink list.

**History**
- Three tabs: **Nights** (streak strip + the list, first night visible without scrolling), **Trends** (feel zone, calendar, weekly drinks), **Trophies** (shelf, streaks, dry weeks).

**Polish**
- "Faint" text raised to ≥ 4.5:1 in both themes. Icon buttons are 44 px. Shorter copy throughout.

## 5. How to judge it

Measured on a 375 × 812 phone with the same test data, before and after:

| Measure | v2.3 | Target | v2.4 |
|---|---|---|---|
| Taps to log your usual drink | 1, but you had to find it | 1, always in the same place | 1, in the dock |
| Logging buttons inside the Now page | 8 | 0 (dock only) | **0** |
| Now screen length during a night | 3.2 screens | ≤ 2.2 screens | **2.3** |
| Words on Now | 283 | ≤ 180 | **175** |
| Scroll to first night in History | 1,909 px | above the fold | **302 px** |
| History length (Nights tab) | 5.3 screens | — | **3.2** |
| Faint text contrast on page / card (dark · light) | 3.3 / 3.0 · 2.4 / 2.6 : 1 | ≥ 4.5 : 1 | **5.2 / 4.7 · 5.1 / 5.7 : 1** |

What's left to try with real people: whether the dock's first chip should be your usual
drink or water, and whether the check-in nudge (a pulse after 45 min) helps or annoys.

---

# Gamification review (v2.6)

## Audit (11 test nights)

| # | Problem | Evidence |
|---|---|---|
| G1 | **Rewards are invisible.** Nothing tells you when you earn something. | 0 reward moments on the Now screen apart from the in-zone pulse. Badges sit 2 taps deep (History → Trophies). |
| G2 | **A trivial badge devalues the shelf.** | 🌙 Early night ×11 out of 11 nights. |
| G3 | **The streak is unwinnable and points the wrong way.** It counts drinking nights in a row, so it only grows by drinking, and one slip resets it to 0. | Streak 0, best 1 after 11 nights. |
| G4 | **No progression.** A badge earned once is just a counter. | "×11" means nothing. "7 of 9 collected" is the only long-term goal. |
| G5 | **Not drinking is barely rewarded.** | Only 🍃 for light nights. Dry weeks are counted but earn nothing. |
| G6 | **No autonomy.** The player can't set their own goals. | — |

## Principles: an ethical game for a drinking app

1. **Reward how, never how much or how often.** Nothing scales with grams, drink count or drinking nights.
2. **Not drinking always counts as winning.** Alcohol-free days fill goals, and dry weeks win streaks automatically.
3. **Weekly, not nightly.** Streaks run on weeks, so one rough night doesn't erase months, and there's no pull to drink tonight to keep a run alive.
4. **You set the goals.** Alcohol-free days per week, never over your zone, and optionally a weekly drink cap.
5. **Celebrate at the moment of earning.** Badges pop when they're earned, and the night's recap is revealed the morning after.
6. **Mastery over collection.** Badges have Bronze, Silver and Gold tiers (1 / 5 / 15) with visible progress.
7. **Reward stopping.** 🌙 *Called it* replaces Early night: tap "Done for tonight" and stick to it.

## What changed

- **Weekly goals** (Settings): alcohol-free days (default 4), never over the zone (on), and an optional weekly standard-drink cap.
- **This week** card on Now when you're not drinking: Mon–Sun dots, a checklist for each goal, and plain advice ("keep tonight free to lock it in").
- **Week streak** 🔥: consecutive weeks where every goal was met. Dry weeks count. It replaces the nightly streak.
- **Tonight's goals** row during a night: 💧 water x/y, 🧘 check-ins x/2, 🧊 cool head on track, 🌙 call it. These are good behaviours only, and each gets a toast the moment it's earned.
- **Night reveal**: the next time you open the app, a "Last night" card shows the score, new badges and tier-ups, plus the morning rating. Opening the recap animates the ring and pops the badges, and shows your personal best and average.
- **Trophies**: tiered badges with progress bars and how to earn each one, plus "Next up" (the closest tier-ups) and the week streak and goal weeks.
- New: 🌙 Called it, 🗓️ Goal week, 🌿 Dry week. Removed: Early night (it was trivial).

---

# First open, first night, first habit (v2.7)

## Audit: a brand-new user today (measured)

| Moment | Today | Problem |
|---|---|---|
| Welcome | 103 words, 2 separate checkboxes | Slow, and nothing to see yet |
| Zone | "Mellow 0.30–0.50 ‰" | Abstract: nobody new knows what 0.5 ‰ means in drinks |
| First Now screen | 8 actions in: a 0.00 gauge and one personal line ("a beer peaks at 0.23 ‰") | The aha needs you to be drinking. Most first opens happen at home, so the aha is postponed to some unknown evening |
| Between sessions | Nothing invites you back | No plan, no calendar, no trigger. Return depends on chance |
| Nights 1–3 | Calibration, feel zone and sweet spot unlock silently | The reward for sticking with it is never promised, so there's no reason to invest |

## The journey we design for (Hook model: trigger → action → reward → investment)

1. **Open → aha in under a minute, without drinking.** One consent tap, the profile, then a zone chosen in *drinks* ("≈ 2 beers to get there"). The first screen is the answer to the question everyone actually has: **"how much, and when?"**
2. **Plan tonight.** A planner turns your zone into a schedule: *20:00 beer, 20:50 beer, 22:05 beer → peak 0.62 ‰, sober by 03:40*. It's useful on day 0 and is itself the aha.
3. **A bridge to session 2.** "Add to calendar" puts the plan in your calendar with a link back, which is an external trigger with no server or push needed. On the night itself the plan card says "starts in 20 min · Start now".
4. **Three nights to know you.** A short checklist with *endowed progress* (profile already ✓), where every step promises what it unlocks: plan a night → your schedule; first night → your score; rate the morning → your sweet spot; tap 🎯 → your real zone; add to home screen → one tap away. Investing makes the app more personal, which is the reason to keep going.
5. **Welcome back.** After a few days away: "Welcome back 👋 — 4 alcohol-free days since your last night." The return is recognised and rewarded, never guilted.

Ethics: the planner never schedules a drink that would overshoot your zone, shows the cautious sober time and the "never drive" line, and caps out at 8 drinks.

## Result (measured on a fresh profile, same method as the audit)

| | v2.6 | v2.7 |
|---|---|---|
| Words on the welcome screen | 103 | 65 |
| Actions to the first real screen | 8 | 7 (one consent tap; the cursor lands in Weight) |
| Zone choice | "0.30–0.50 ‰" | "≈ 2 beers / 3 h" per preset, plus "For you, 2 beers get you there, then one every ~2 h 20 min keeps you there" |
| Something to do without drinking | Nothing | Plan a night: schedule, curve, likely and cautious sober time |
| Bridge to session 2 | None | Saved plan card on Now + "Add to calendar" (.ics with alarm and link) |
| Sessions 2–4 | Unlocks hidden | Getting-to-know-you checklist (6 steps, profile pre-ticked), each step names its reward. Disappears after 4 nights |
| Return after days away | Silent | "Welcome back 👋 5 alcohol-free days since you were last here" |

Not measurable without analytics, which we deliberately don't collect: actual day-1, day-7 and day-30 return rates.
The next learning step is five people, one evening each, watched or interviewed the morning after.
