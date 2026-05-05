# NOVA Gamification System — Design Document v1.0

## Research Summary: What the Evidence Says

Before defining anything, here's what the research establishes as ground truth:

**What works:**
- Tying XP/rewards to actions that *directly produce the desired behavior* (not just app usage)
- Multiple progression pathways so users don't feel stuck
- Real-time feedback — the moment of action is the moment of reward
- Satisfying autonomy and competence needs, not just dopamine loops
- Weekly check-in cadence for finance apps outperforms daily (less guilt, more sustainable)
- Loss aversion on streaks is genuinely powerful — people work to *not break* a chain

**What fails catastrophically:**
- Daily streaks in a finance context cause burnout and shame spirals when life interrupts
- Rewarding app opens instead of meaningful actions (inflated XP for nothing)
- Virtual stickers that feel hollow — rewards must feel proportional to the effort
- Over-simplifying the financial picture to make the game feel winnable (Robinhood's mistake — resulted in regulatory action)
- Streaks that reset to zero on a miss — this causes users to abandon the app entirely when they slip

**The Ingress model applied here:**
Ingress uses a strict 5-tier system (Bronze → Silver → Gold → Platinum → Onyx) where each badge tracks one focused behavior, thresholds scale non-linearly (each tier is roughly 4–5× harder than the last), and higher tiers automatically satisfy lower requirements. Badges double as level-up currency for agent rank. That's the structural DNA we're borrowing.

**The third variable insight:**
The best badge systems combine a *frequency count* (how many times you did the thing), a *cumulative magnitude metric* (how much of the thing you did), and a *quality/consistency metric* (did you do it well, or at the right time, or without breaking the chain). The third variable is what makes badges feel earned rather than farmed. It should be the hardest of the three to satisfy.

---

## Section 1: XP Framework

### Guiding Principle
XP should reflect *financial importance and behavioral rarity*, not just click count. Getting paid and moving money is rare, high-impact, and deserves outsized reward. Logging groceries is frequent, low-friction, and should feel like steady accumulation rather than big bursts.

### XP Event Table

| Action | XP | Rationale |
|---|---|---|
| **Confirm paycheck on day-of (same calendar day as expected)** | **200 XP** | Highest-value financial behavior. Rare (2×/month), requires intentionality |
| Reach / exceed savings goal milestone (each 25% of goal) | 150 XP | Outcome-based reward, not behavior-based |
| Confirm paycheck (not same-day, within 48hr) | 75 XP | Still good. Late confirmation better than none |
| Mark a bill paid (on time, before due date) | 60 XP | Protects credit/cash flow — important habit |
| Week ends under grocery budget | 75 XP | Discipline reward — the whole week paid off |
| Log a savings deposit / split allocation confirmed | 50 XP | You moved money intentionally |
| Mark a bill paid (after due date) | 25 XP | Still tracked, still counts, just reduced |
| Log business income (entrepreneur mode) | 40 XP | Running real numbers on a side hustle |
| Log business expense (entrepreneur mode) | 30 XP | Expense awareness matters for P&L |
| Log business mileage | 20 XP | Tax-relevant tracking behavior |
| Log grocery spending entry | 10 XP | Frequent (2–3×/week), small but consistent |
| Confirm balance (balance confirmation event) | 15 XP | The lowest-effort but most habit-forming action |
| Open calendar and view a projection | 8 XP | Passive awareness, capped at 1×/day |
| Add a manual transaction | 10 XP | Manual tracking signals intentionality |
| Complete monthly cycle (any activity in 3+ weeks of a month) | 50 XP | Cycle-level engagement bonus |
| First-time configure income split | 40 XP | Setup actions that improve the whole system |
| Add/configure a scheduled income event | 35 XP | Planning ahead gets rewarded |
| Complete onboarding | 100 XP | One-time welcome bonus |

### XP Design Notes
- **No XP for passive app opens.** The calendar view check is the lowest passive action and is capped daily.
- **Same-day paycheck confirm is intentionally large (200 XP).** This single action is worth more than 20 grocery logs. The user should feel that showing up on payday is *significant*.
- **Outcome bonuses (savings goal milestone, green cycle-end) are one-time per threshold** — you can't farm them by resetting.
- **Entrepreneur mode unlocks its own XP events** — non-entrepreneur users never see these, keeping the system clean.

---

## Section 2: Badge Catalog

### Structure
Every badge follows this template:
- **Name** + flavor tagline
- **Behavior it reinforces**
- **Variable 1**: Action count (how many times)
- **Variable 2**: Cumulative XP from that category (how much total effort)
- **Variable 3**: Quality/consistency metric (the hard one — varies per badge)
- **Five tiers**: Bronze / Silver / Gold / Platinum / Onyx — all three variables must be satisfied to advance

Badge tiers do NOT reset. Higher tiers automatically satisfy all lower tiers (Ingress convention).

---

### BADGE 1: PAYDAY ORACLE
*"You showed up when it mattered."*
Reinforces: Confirming income on the day it arrives. The single most important financial behavior in the app.

| Tier | V1: Same-day confirms | V2: Income XP earned | V3: Consecutive paychecks confirmed on time |
|---|---|---|---|
| Bronze | 2 | 300 XP | 2 in a row |
| Silver | 8 | 1,200 XP | 4 in a row |
| Gold | 20 | 3,500 XP | 8 in a row |
| Platinum | 50 | 9,000 XP | 16 in a row |
| Onyx | 100 | 20,000 XP | 26 in a row (~1 year) |

> V3 note: A "missed" same-day confirm doesn't break the chain if the user confirms within 48 hours. It only breaks if the paycheck passes unacknowledged. This prevents the streak-rage-quit pattern.

---

### BADGE 2: VAULT GUARDIAN
*"Building the thing you said you would."*
Reinforces: Consistent savings deposits and goal progress.

| Tier | V1: Savings deposits made | V2: Total dollars deposited (cumulative) | V3: % of savings goal reached |
|---|---|---|---|
| Bronze | 3 | $50 | 10% of goal |
| Silver | 10 | $300 | 25% of goal |
| Gold | 25 | $1,000 | 50% of goal |
| Platinum | 60 | $3,500 | 75% of goal |
| Onyx | 100 | $8,000 | 100% (goal fully reached) |

> V3 note: Goal completion unlocks Onyx regardless of timing. This makes the Onyx feel like a real life achievement, not just accumulated clicking.

---

### BADGE 3: BILL SLAYER
*"Recurring obligations don't scare you."*
Reinforces: Paying bills on time and building the habit of proactive bill management.

| Tier | V1: Bills paid on time | V2: Bill-related XP | V3: Consecutive months with zero late bills |
|---|---|---|---|
| Bronze | 5 | 200 XP | 1 month |
| Silver | 20 | 800 XP | 3 months |
| Gold | 50 | 2,000 XP | 6 months |
| Platinum | 120 | 5,500 XP | 12 months |
| Onyx | 300 | 15,000 XP | 24 months |

> V3 note: "Zero late bills" for a month means every scheduled bill was marked paid before or on its due date. This distinguishes someone who pays bills eventually from someone who has genuinely broken the late-payment habit.

---

### BADGE 4: GROCERY SENTINEL
*"The most frequent battlefield in your budget."*
Reinforces: Tracking grocery spending and staying within the weekly limit.

| Tier | V1: Weeks ended under budget | V2: Grocery XP earned | V3: Consecutive weeks under limit |
|---|---|---|---|
| Bronze | 2 | 80 XP | 2 in a row |
| Silver | 8 | 350 XP | 4 in a row |
| Gold | 20 | 1,000 XP | 8 in a row |
| Platinum | 52 | 3,000 XP | 18 in a row (~4 months) |
| Onyx | 104 | 7,500 XP | 32 in a row (~8 months) |

> V3 note: This is intentionally the hardest Onyx to get. Eight consecutive months under grocery budget is a legitimate behavioral transformation — it should feel legendary.

---

### BADGE 5: LEDGER KEEPER
*"The habit of looking."*
Reinforces: Regular balance confirmations — the lowest-friction, highest-consistency behavior.

| Tier | V1: Balance confirmations logged | V2: Confirmation XP | V3: Distinct weeks with at least 1 confirmation |
|---|---|---|---|
| Bronze | 5 | 75 XP | 3 weeks |
| Silver | 25 | 375 XP | 10 weeks |
| Gold | 75 | 1,125 XP | 26 weeks |
| Platinum | 200 | 3,000 XP | 52 weeks (1 full year) |
| Onyx | 500 | 7,500 XP | 100 weeks |

> V3 note: Weekly consistency (not daily) is intentional. One confirmation per week over a year is 52 small decisions to stay informed. That's the behavior we want.

---

### BADGE 6: CYCLE CLOSER
*"You finished the month with your eyes open."*
Reinforces: Monthly engagement and — critically — ending cycles in the green.

| Tier | V1: Cycles with 3+ active weeks | V2: Total XP in any single cycle (best cycle) | V3: Cycles ending in green variance state |
|---|---|---|---|
| Bronze | 2 | 150 XP peak | 1 green cycle-end |
| Silver | 6 | 400 XP peak | 3 green cycle-ends |
| Gold | 12 | 800 XP peak | 6 green cycle-ends |
| Platinum | 24 | 1,500 XP peak | 12 green cycle-ends |
| Onyx | 48 | 2,500 XP peak | 24 green cycle-ends |

> V3 note: This is the only badge that directly rewards financial health outcomes. Ending a cycle green means NOVA's variance engine confirmed you had more than you needed. This badge is the closest thing to "you are actually winning at money" represented as a trophy.

---

### BADGE 7: INCOME ARCHITECT
*"Every dollar had a destination before it arrived."*
Reinforces: Configuring and using the paycheck split feature — a setup behavior that pays dividends forever.

| Tier | V1: Paychecks with an active split in place | V2: Split XP earned | V3: % of paycheck allocated to specific purpose (split coverage) |
|---|---|---|---|
| Bronze | 2 | 120 XP | Any split configured |
| Silver | 8 | 500 XP | 2 active splits |
| Gold | 20 | 1,500 XP | 75% of paycheck allocated |
| Platinum | 50 | 4,000 XP | 90% allocated |
| Onyx | 100 | 10,000 XP | 100% allocated — every dollar placed |

> V3 note: The Onyx tier ("every dollar placed") is NOVA's version of zero-based budgeting. This badge rewards users who go all the way.

---

### BADGE 8: VARIANCE ANALYST
*"You didn't just see yellow. You understood it."*
Reinforces: Engaging with NOVA's variance system — checking it, recovering from yellow, and achieving sustained green.

| Tier | V1: Variance screens visited | V2: Variance-related XP | V3: Yellow→Green recoveries within a cycle |
|---|---|---|---|
| Bronze | 5 | 100 XP | 1 recovery |
| Silver | 20 | 400 XP | 3 recoveries |
| Gold | 60 | 1,200 XP | 8 recoveries |
| Platinum | 150 | 3,500 XP | 20 recoveries |
| Onyx | 400 | 9,000 XP | 40 recoveries |

> V3 note: A "recovery" is defined as: variance state is yellow at some point during a cycle, and the user ends the cycle green. This rewards corrective behavior — not just watching the numbers, but responding to them.

---

### BADGE 9: ENTREPRENEUR *(unlocks only with Entrepreneur Mode enabled)*
*"Real numbers on a real hustle."*
Reinforces: Complete business tracking — income, expenses, mileage. Not just logging income.

| Tier | V1: Business transactions logged | V2: Total business income tracked | V3: Months with both income AND expenses logged (complete P&L) |
|---|---|---|---|
| Bronze | 5 | $100 | 1 full month |
| Silver | 20 | $500 | 3 months |
| Gold | 60 | $2,000 | 6 months |
| Platinum | 150 | $7,500 | 12 months |
| Onyx | 400 | $25,000 | 24 months |

> V3 note: "Complete P&L month" = at least one income entry AND one expense entry in the same calendar month. This distinguishes the person tracking everything from the person only logging wins.

---

### BADGE 10: NOVA AGENT *(the master progression badge)*
*"You're not just using an app. You're building a practice."*
Reinforces: Sustained, cross-category engagement — the holistic user.

| Tier | V1: Total XP | V2: Distinct active days | V3: Weeks with XP earned in 3+ different categories |
|---|---|---|---|
| Bronze | 500 XP | 14 days | 4 cross-category weeks |
| Silver | 2,500 XP | 45 days | 12 weeks |
| Gold | 8,000 XP | 120 days | 30 weeks |
| Platinum | 22,000 XP | 300 days | 65 weeks |
| Onyx | 60,000 XP | 600 days | 130 weeks |

> This is NOVA's version of Ingress agent level. The V3 requirement (multiple categories per week) is what stops someone from grinding one action type to inflate XP. It requires genuine multi-dimensional engagement.

---

## Section 3: Streak System

### Design Philosophy
No daily streaks. Personal finance is not a daily activity — it's a *weekly practice* with periodic spikes. Daily streaks in this context create shame when life happens. Weekly cadence matches how money actually moves.

**Critical mechanic:** Streaks should never reset to zero on a single miss. They *pause* (not increment) and allow recovery. Losing a 47-week streak because of one bad week is the single most common reason users abandon habit apps.

---

### Streak 1: WEEKLY ACTIVE STREAK *(primary, always visible)*
**Definition:** Any calendar week (Sun–Sat) where the user logged at least one meaningful action (any XP-earning event)

**Display:** Prominent counter — "X week streak" — on the main header or home screen

**Grace mechanic:** Missing a week drops the counter to zero, but a "best streak" record is always preserved separately. Users can see "current: 3 weeks | best: 14 weeks" — this creates recovery motivation instead of abandonment.

**Milestone acknowledgments:**
- 4 weeks: "One month of showing up"
- 12 weeks: "A quarter in"
- 26 weeks: "Half a year — this is a habit now"
- 52 weeks: "Full year. Most people never get here."
- 104 weeks: "Two years. You're different now."

---

### Streak 2: PAYDAY STREAK *(high-prestige, embedded in Payday Oracle badge)*
**Definition:** Consecutive paychecks confirmed within 24 hours of expected arrival date

**Mechanic:** Each paycheck is either "on time" or "missed." On-time = streak increments. Missed = streak pauses, does not reset until two consecutive misses. One grace period per rolling 6-paycheck window.

**Why this matters:** Showing up on payday is the highest-value action in the app. Streaking this behavior is a direct proxy for "this person has their financial life together." The Payday Oracle badge tracks it numerically; this streak tracks it as a live counter.

---

### Streak 3: GROCERY DISCIPLINE STREAK *(embedded in Grocery Sentinel badge)*
**Definition:** Consecutive weeks ending under the grocery budget limit

**Mechanic:** Rolls over on Sunday. If the week ends under budget, the streak increments. If over, streak pauses (grace: if within 10% of budget, no increment but no reset). Two consecutive over-budget weeks reset the streak.

**Why the grace mechanic here:** A holiday week, a birthday, a stocked pantry run should not nuke a 12-week streak. The 10% grace window keeps users from rage-quitting after Thanksgiving.

---

### Streaks + Badges Interaction
The streaks feed directly into badge V3 variables. The Streak counter is the live display; the Badge is the permanent record.

- **Short-term motivation:** *"Don't break my current streak"*
- **Long-term motivation:** *"I'm 6 more consecutive paychecks away from Gold Payday Oracle"*

Both are visible simultaneously — dual-loop engagement, which research identifies as the most effective retention design.

---

## Section 4: What This System Deliberately Does NOT Do

Conscious exclusions, not oversights:

1. **No leaderboards.** Personal finance is private. Competition with strangers creates anxiety. Competition with your own past self (streaks, badge progress) is healthier.
2. **No daily check-in bonus.** This would reward opening the app, not using it. Every XP-earning event requires a real action.
3. **No XP decay.** You never lose XP. Punishing inactivity causes abandonment. Progress is permanent.
4. **No artificial level gating.** The Nova Agent badge IS the level system. No gate that prevents users from accessing features.
5. **No push notification pressure around streaks.** Informational nudges ("Your grocery week ends Sunday, you're $18 under budget") are fine. "YOU'RE ABOUT TO LOSE YOUR STREAK" is not — research shows this increases anxiety and churns users.

---

## Section 5: Implementation Stages for the Coding Agent

Each stage is self-contained and designed to be fed sequentially to a coding agent.

---

### Stage 1 — XP Foundation
**Scope:** Infrastructure only. No badges, no UI beyond a number.

- Create `XP_EVENTS` constants object in a new `src/config/xp.config.js` — maps every action key to its XP value
- Add `xpTotal` to store (already present), add `xpHistory` array (entries: `{ eventType, xp, timestamp }`) with a rolling 90-day cap to keep storage light
- Hook `awardXP(eventType)` call into every relevant store action — confirmed payday, bill paid, grocery logged, balance confirmed, etc.
- Display `xpTotal` as a small number in the Settings > About section

**Verification:** Log a grocery entry, confirm a paycheck, check balance — each should increment `xpTotal` by the correct amount.

---

### Stage 2 — Action Counters and Event Metadata
**Scope:** Track the raw data that badges will need.

- Add `actionCounts` object to store:
  ```
  {
    paycheckConfirmedSameDay, paycheckConfirmedLate,
    billsPaidOnTime, billsPaidLate,
    groceryEntriesLogged, weeksUnderBudget,
    balanceConfirmations, savingsDeposits,
    businessTransactions, cyclesCompleted,
    varianceChecks, ...
  }
  ```
- Add `streakData` object:
  ```
  {
    weeklyActive: { current, best, lastActiveWeek },
    paydayStreak: { current, consecutiveOnTime, graceUsedInWindow },
    groceryStreak: { current, best }
  }
  ```
- Increment the relevant counter inside each store action that awards XP
- Add `weeklyActiveCheck()` function: called on any meaningful action, checks if the current week differs from `lastActiveWeek`, increments `weeklyActive.current` if so
- All internal plumbing — no UI change yet

---

### Stage 3 — Badge Evaluation Engine
**Scope:** The logic that computes badge states from action counters.

- Create `src/config/badges.config.js` — defines all 10 badges, their variable definitions, and 5-tier thresholds as a pure data structure
- Create `src/utils/badgeEngine.js` — `evaluateBadges(actionCounts, xpTotal, streakData, accounts)` pure function returning:
  ```
  { badgeId: { tier: 'bronze'|'silver'|'gold'|'platinum'|'onyx'|null, progress: { v1, v2, v3 } } }
  ```
- Call `evaluateBadges` inside `recomputeVariance` (already fires after every meaningful action) — store result in `badgeState`
- When a badge tier advances, push entry to `pendingUnlocks` array in store — this drives the unlock animation in Stage 5

**Verification:** Manually set action counts to threshold values in dev tools, confirm badge tiers advance correctly.

---

### Stage 4 — Streak Finalization
**Scope:** Full streak logic with grace mechanics.

- **Weekly Active:** `weeklyActiveCheck()` runs on every XP-earning action. Week boundaries are Sunday midnight. Missing a week clears `current` but not `best`.
- **Payday Streak:** Hook into paycheck confirmation flow. Compare confirmation timestamp to `nextPaycheckDate`. Within 24hr = on-time increment. 24–48hr = late increment. Missed entirely = apply grace if `graceUsedInWindow < 1`, otherwise reset.
- **Grocery Streak:** Hook into Sunday budget reset (already exists in `checkGroceryWeekReset`). Under budget = increment. Within 10% over = no change. Over by 10%+ = reset after two consecutive.
- Persist all streak data to AsyncStorage under `nova_v2_streak_data`

---

### Stage 5 — UI Layer
**Scope:** Make all of this visible.

- **Badge Showcase Screen** (new screen or Settings sub-section): Grid of all badges. Earned tiers shown in full color with icon placeholder. Locked tiers shown as dim outlines. Tap any badge to see progress bars for all three variables and "X more to next tier" gap.
- **XP Progress Bar:** Subtle bar or number in the header or dashboard. Shows progress toward next Nova Agent tier.
- **Streak Counter:** Weekly Active Streak shown prominently — always visible. Payday Streak shown contextually on the income confirmation screen.
- **Unlock Toast:** When `pendingUnlocks` has entries, show a full-screen overlay congratulation moment on next app open. Should feel like an event, not a notification banner. Clear entry after display.

---

### Stage 6 — NOVA Voice Integration *(lower priority)*
**Scope:** NOVA's daily disposition references badge/streak progress.

- When daily disposition runs, NOVA can reference badge proximity: *"Three more same-day confirmations and your Payday Oracle goes Silver."*
- When the user is close to closing the week under grocery budget, the grocery card shows a progress nudge.
- Informational only — never anxiety-inducing. Coaching tone, not harassment.

---

## Summary: The Core Design Loop

```
User takes a financial action
        ↓
XP awarded immediately (variable amount, feels proportional)
        ↓
Action counter increments
        ↓
Badge engine evaluates (silent, instant)
        ↓
If badge tier advanced → queued unlock toast
        ↓
Streak data updated
        ↓
NOVA state may shift (she sees the improved behavior)
        ↓
User sees progress → motivated to return
```

The whole loop runs inside the existing `recomputeVariance` call chain. No new timers, no background jobs, no external services. Everything is local, private, and fast.

---

## Sources

- [An Evaluation of Gamification on Financial Conduct — Wiley / Financial Planning Review (2025)](https://onlinelibrary.wiley.com/doi/full/10.1002/cfp2.70016)
- [Making Finance Fun: The Gamification of PFM Apps — Self-Determination Theory](https://selfdeterminationtheory.org/wp-content/uploads/2024/03/2021_BitrianBuilCatalan_IJBM.pdf)
- [Why Fintech Gamification Is Your Secret Weapon — Netguru (2025)](https://www.netguru.com/blog/fintech-gamification)
- [Gamification in Fintech: Financial Literacy or Just Engagement? — 11:FS](https://www.11fs.com/article/gamification-in-fintech-financial-literacy-or-just-engagement)
- [Ingress Medal/Badge System — ingress.wiki.gg](https://ingress.wiki.gg/wiki/Medal)
- [Ingress Medals Guide — FevGames](https://fevgames.net/ingress/ingress-guide/concepts/medal/)
- [Gamified Investing Apps — The Conversation](https://theconversation.com/gamified-investing-apps-are-becoming-more-popular-but-can-be-risky-for-young-investors-243442)
- [Gamification Badges: Motivation and Learning — NudgeNow](https://www.nudgenow.com/blogs/badges-for-gamification-motivation-learning)
- [How Duolingo Gamified Monthly Active Users — The PM Repo](https://www.thepmrepo.com/articles/how-duolingo-gamified-monthly-active-users-lessons-in-habit-formation)
- [Top Gamification Trends 2025 — StudioKrew](https://studiokrew.com/blog/app-gamification-strategies-2025/)
- [Finance Gamification — Yu-kai Chou / Octalysis](https://yukaichou.com/gamification-examples/top-10-finance-apps-for-2017-from-an-octalysis-gamification-perspective/)
