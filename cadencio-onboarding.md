# Cadencio — Onboarding

> Modal-based flow overlaying the skeleton dashboard.
> After completion, the dashboard populates with real data.

---

## Screen 1 (Modal): "What comes in?"

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Step 1 of 5            ⚔️ CADENCIO     │
│                                                 │
│  💰 What's your average monthly income?         │
│                                                 │
│  Doesn't need to be exact. We use it to         │
│  calculate your cost-per-hour — how many        │
│  hours of your life each purchase costs.        │
│                                                 │
│  ┌───────────────────────────────────┐          │
│  │  [amount input]                   │          │
│  └───────────────────────────────────┘          │
│                                                 │
│  ═══════════════════════════════════            │
│  Your cost-per-hour: [income ÷ 40]             │
│  Based on 40 hrs/week — adjustable in Settings  │
│  ═══════════════════════════════════            │
│                                                 │
│       [ Skip — I'll add this later ]            │
│                          [ Next → ]             │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Purpose**: Establish cost-per-hour for the Friction Screen and Spend flow.

**Behavior**:
- Cost-per-hour updates live as the user types: `monthlyIncome ÷ 40`.
- The "÷ 40" default (assuming 40 working hours/week) is noted as adjustable in Settings.
- **If skipped**: Cost-per-hour won't appear in the Spend flow. A dashboard nudge appears later: *"Add your income to unlock cost-per-hour tracking."*

---

## Screen 2 (Modal): "Set your rhythm"

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Step 2 of 5                                    │
│                                                 │
│  📅 When does your money month reset?           │
│                                                 │
│  Pick the day your main income lands, or        │
│  just use the 1st as a fresh start.             │
│                                                 │
│       Reset Day:  [ 15 ]                        │
│                                                 │
│  ─────────────────────────────────────          │
│                                                 │
│  💸 Monthly spending cap                        │
│                                                 │
│  ┌───────────────────────────────────┐          │
│  │  [amount input]                   │          │
│  └───────────────────────────────────┘          │
│                                                 │
│  That's ~[cap ÷ 30]/day                         │
│  (~[daily ÷ costPerHour] hours of your life     │
│   per day)                                      │
│                                                 │
│  ─────────────────────────────────────          │
│                                                 │
│  ⚙️ Preferences                                │
│                                                 │
│       Friction Screen:  [✅ ON ]                │
│       Pause before each spend — asks            │
│       Need or Growth before saving              │
│                                                 │
│       Focus Mode:       [✅ ON ]                │
│       Hides currency — shows progress %,        │
│       status, streaks, and cost-per-hour        │
│                                                 │
│            [ ← Back ]    [ Next → ]             │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Purpose**: Set the monthly cycle anchor, spending limits, and display preferences.

**Behavior**:
- **Reset Day**: Anchors the monthly cycle and Salary Day Run. For users with irregular income, this is the most reliable or significant pay date — not necessarily the only one.
- **Monthly cap**: Primary budget input. Daily equivalent auto-calculated and displayed: `monthlyCap ÷ 30`.
- **Friction Screen**: When ON, every Spend triggers a Need/Growth categorization + cost-per-hour display before saving.
- **Focus Mode**: When ON, hides raw currency everywhere on passive screens. Cost-per-hour (in hours) remains visible. Active input screens (scheduling, settings) are exempt.

---

## Screen 3 (Modal): "Who do you owe?"

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Step 3 of 5                                    │
│                                                 │
│  📋 Who do you owe?                             │
│                                                 │
│  List the people and payments on your mind.     │
│  Just the name, total amount, and priority.     │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ ❗ P1   [name]           [amount] VND   │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │ ⚠️ P2   [name]           [amount] VND   │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │    P3   [name]           [amount] VND   │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  Total listed: [sum] VND                        │
│                                                 │
│              [ + Add another ]                  │
│                                                 │
│            [ ← Back ]    [ Next → ]             │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Purpose**: Capture the obligations weighing on the user. Lightweight — no schedules, no cadence, no due dates yet.

**Behavior**:
- Each obligation is: **name + total amount owed + priority** (P1 Critical / P2 High / P3 Standard).
- Priority is a personal/emotional call, not derived from amount. (Mom might be P1 because it's Mom, not because 60M is the largest number.)
- Total at the bottom sums listed obligations. This feeds into Screen 5's quest calculation.
- **Payment scheduling happens post-onboarding**, not here. This screen captures *what weighs on you*; the scheduling flow handles *how to resolve it*.

---

## Screen 4 (Modal): "How deep is the hole?"

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Step 4 of 5                                    │
│                                                 │
│  🕳️ Beyond what you've listed — how deep        │
│     does the hole feel?                         │
│                                                 │
│  You listed [sum]M in obligations.              │
│  Sometimes the real number is bigger —          │
│  lost savings, missed opportunities,            │
│  ground you need to recover.                    │
│                                                 │
│  This is just for you. It sets your             │
│  recovery quest target. Change it anytime.      │
│                                                 │
│  ┌───────────────────────────────────┐          │
│  │  [amount input]                   │          │
│  └───────────────────────────────────┘          │
│                                                 │
│  💡 This number never leaves your device.       │
│                                                 │
│     [ Skip — I'll set this from dashboard ]     │
│                                                 │
│            [ ← Back ]    [ Next → ]             │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Purpose**: Let the user self-report the "real" recovery target, which may exceed the listed obligations.

**Behavior**:
- The number entered here becomes `Settings.selfReportedDebt` and is used to generate the quest tiers on Screen 5.
- **If skipped**: Dashboard shows a persistent prompt card: *"Set your recovery quest when you're ready."* The quest section remains inactive. Everything else (heatmap, budget, obligations) works normally. The user can set it tomorrow or in month 3.
- The app does not show "that's X beyond your listed obligations" — that math was found to be more anxiety-inducing than helpful. It just accepts the number.

---

## Screen 5 (Modal): "Choose your quest"

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Step 5 of 5                                    │
│                                                 │
│  ⚔️ Choose your quest                           │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  🛡️ FIRST SHIELD — [tier1]M             │    │
│  │                                         │    │
│  │  "Prove you can hold the line."         │    │
│  │                                         │    │
│  │  A quick win. Clear your smallest debt  │    │
│  │  and start building a buffer.           │    │
│  │                                         │    │
│  │  ⏱️ ~[estimate] months                  │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  ⚔️ THE RECKONING — [tier2]M       ★    │    │
│  │                                         │    │
│  │  "Face the full number."                │    │
│  │                                         │    │
│  │  Everything you reported — paid off     │    │
│  │  and recovered.                         │    │
│  │                                         │    │
│  │  ⏱️ ~[estimate] months                  │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  👑 CADENCIO'S AMBITION — [tier3]M     │    │
│  │                                         │    │
│  │  "Not just recovery — sovereignty."     │    │
│  │                                         │    │
│  │  Clear the debt, then build beyond.     │    │
│  │  Never be here again.                   │    │
│  │                                         │    │
│  │  ⏱️ ~[estimate] months                  │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  You can change your quest anytime.             │
│                                                 │
│            [ ← Back ]    [ Start → ]            │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Purpose**: Give the user a goal with emotional weight and a realistic timeline.

### Quest Tier Calculation

**If selfReportedDebt > 0:**

| Tier | Name | Target | Description |
|---|---|---|---|
| 1 | 🛡️ First Shield | ~30M or smallest-debt + buffer | Quick win, 3–4 months |
| 2 | ⚔️ The Reckoning | selfReportedDebt | Full reported number |
| 3 | 👑 Cadencio's Ambition | selfReportedDebt + 100M | Recovery + wealth building |

**If selfReportedDebt = 0 (no debt, building from scratch):**

| Tier | Name | Target | Description |
|---|---|---|---|
| 1 | 🛡️ First Shield | ~3 months expenses | Short-term buffer |
| 2 | ⚔️ The Foundation | ~6 months expenses | Stability |
| 3 | 👑 Cadencio's Ambition | ~12 months expenses | Independence |

### Timeline Estimation

Timelines account for the **debt payoff waterfall** — as obligations clear, their monthly payments free up into surplus:

```
Phase 1 (while obligations active):
  monthlySurplus = monthlyIncome - monthlyCap - totalMonthlyObligationPayments
  monthlyProgress = totalMonthlyObligationPayments + monthlySurplus

Phase 2 (after obligations clear):
  monthlySurplus = monthlyIncome - monthlyCap
  monthlyProgress = monthlySurplus

Blended estimate considers when each obligation clears and surplus increases.
```

The ★ next to The Reckoning indicates it matches the self-reported number — a visual anchor, not a recommendation.

**[Start →]** closes the modal. Dashboard populates behind it.

---

## Post-Onboarding: Obligation Scheduling

After the modal closes, the dashboard's **#1 Next Action** is:

```
┌─────────────────────────────────────────────────┐
│  ⚔️ Plan your obligations                       │
│  You listed [N] debts. Set up a payment plan    │
│  so your Salary Day Run knows what to do.       │
│                                  [ Plan → ]     │
└─────────────────────────────────────────────────┘
```

This card is **persistent** — stays at top of Next Actions until all obligations have at least one scheduled payment cycle. It doesn't block the app; the user can log spends, track their heatmap, and do everything else while it's there.

### Scheduling Flow (one obligation at a time)

Tapping [Plan →] opens a focused, sequential flow — one screen per obligation, processed in **priority order** (P1 first).

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  📋 Plan payment: [Name] ([total] remaining)    │
│                                                 │
│  How would you like to resolve this?            │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  💡 SUGGESTED                           │    │
│  │                                         │    │
│  │  [suggestion generated by algorithm]    │    │
│  │  Clears in ~[N] months ([date])         │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ─── or set your own plan ───                   │
│                                                 │
│  Payment type:                                  │
│  [ One-time ]  [ Monthly ]  [ Split ]           │
│                                                 │
│  [fields based on selected type]                │
│                                                 │
│  ─────────────────────────────────────          │
│  Remaining after this plan: [calculated]        │
│  Last payment: ~[date]                          │
│                                                 │
│       [ ← Back ]    [ Save & Next → ]           │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Suggestion**: Auto-generated by the Obligation Suggestion Algorithm (see separate doc). Always displayed as the top card — one tap to accept. Custom planning is always available below.

**Payment types**:
- **One-time**: Single lump sum on a specific date.
- **Monthly**: Fixed amount recurring on a set day, with optional end date or "until cleared."
- **Split**: Larger upfront payment + monthly installments for the remainder.

**On save**: Creates the corresponding `ObligationCycle` entries. The obligation scheduling card in Next Actions updates ("2 of 3 planned") and disappears when all are scheduled.

**Focus Mode exception**: The scheduling flow always shows raw amounts — you need to see numbers to plan payments. Focus Mode re-engages on return to the dashboard.

### After All Obligations Scheduled

The dashboard updates:
- Scheduling prompt disappears from Next Actions.
- Due Soon obligations appear with Confirm Paid buttons.
- Salary Day Run card shows "[N] obligations scheduled."

---

## Summary

```
MODAL FLOW (5 screens, ~3 minutes)

  Screen 1: Monthly income → cost-per-hour (skippable)
  Screen 2: Reset day, monthly cap, friction, focus mode
  Screen 3: Obligations — name + total + priority only
  Screen 4: Self-reported total debt (skippable)
  Screen 5: Choose quest from three tiers

  → Modal closes → Dashboard populates

POST-ONBOARDING (~2-4 minutes)

  Obligation scheduling — one at a time, priority order:
    Each shows algorithm-generated suggestion + custom options
    Payment types: One-time / Monthly / Split
    Persistent Next Action until all scheduled

TOTAL: ~5-7 minutes to fully operational dashboard
```
