# Cadencio — Personal Financial OS

**Project Overview**: A flow-centric, manual-confirm ledger system that helps users recover from financial setbacks through gamified discipline and transparent tracking, **without ever moving money automatically**.

**Design Philosophy**: Onboarding gets you running in ~5 minutes (modal flow + obligation scheduling). The dashboard drives behavior through **Next Actions** (quest-log style). A **Universal Add Modal** centralizes all input. This is financial recovery therapy disguised as a ledger app — **manual-confirm isn't a limitation; it's the core mechanism**.

---

## 0) Non-negotiables

### Manual-Confirm Architecture
The app NEVER initiates real-world transactions. Every payment/transfer is:
1. Planned/reminded in-app
2. Executed by user in their bank app
3. Confirmed manually with **Confirm Done / Confirm Paid**
4. Logged and reflected in progress tracking

**Why**: Requiring manual confirmation transforms financial discipline into a conscious, dopamine-rewarding ritual that replaces destructive impulses with healthy progress tracking.

### No Bank Balances
The app never asks for bank account balances, account numbers, or login credentials. All financial data is **self-reported**: what you owe, what you earn, what you spend. The system tracks actions and progress, not account states.

### Universal Add is the "one door"
90% of interactions must be possible with **one button** (Spend / Receive / Obligation).

### Review & Confirm always
Anything auto-generated (AI parse, templates, salary runbook) must go through **Review & Confirm** before saving.

---

## 1) Scope Boundaries (Out of Scope for Phase 1–2)

- ❌ Bank integration (Open Banking, auto-sync, auto transfers)
- ❌ Crypto exchange integration / price feeds / portfolio P&L
- ❌ Auto-pay / scheduled transfers
- ❌ OCR from screenshots (optional later)
- ❌ Multi-user accounts (Phase 3 only)
- ❌ Wishlist / impulse delay queue (removed from MVP — Friction Screen provides the conscious pause without a holding queue)

**Why**: They harm the therapeutic loop (conscious action → confirm) and slow MVP shipping.

---

## 2) Gamification Framework: "The Cadencio Loop"

### Core Mechanics

- **Discipline Heatmap (GitHub-style)**: Green days = under budget. Streaks tracked and celebrated.
- **Main Quest** (user-selected): Three tiered recovery targets based on self-reported debt. Quest progress is transaction-derived — every Confirm Paid and logged savings transfer advances the ring.
- **Salary Day Run**: Quest checklist appears on reset day (±2 days). Guided flow for allocating income to obligations.
- **Cost-Per-Hour Pain Meter**: Converts spending into "hours of work" based on `monthlyIncome ÷ 40` (adjustable in Settings).
- **Friction Screen**: Pause before each spend — categorize as **Need** or **Growth**. Provides conscious decision-making without a delay queue.
- **Focus Mode**: Hides all currency values. Shows only percentages, progress, status, streaks, and cost-per-hour (hours, not currency).

### Rules
- Cosmetic rewards only (badges, titles). **No monetary rewards**.
- Never shame. Feedback is neutral, future-oriented, action-based.

---

## 3) Technology Stack

### Phase 1–2 (Single-user, Local-first)
- Frontend: **Vite + React + TypeScript + Tailwind**
- Storage: **IndexedDB (Dexie recommended)**
- State: Zustand (preferred) or Redux Toolkit
- Charts: Custom SVG / lightweight charting
- Auth: None (local-first)

### AI Integration (Phase 1.5+, optional)
**Never call LLM from the browser with a real API key.**
- Option A (recommended): Serverless functions (Vercel/Netlify/Cloudflare) for `/api/ai/parse`
- Option B: Express/Fastify backend (`/client` + `/server`)

### Phase 3 (Multi-user)
- Auth + DB Sync: Supabase (PostgreSQL)
- Offline-first remains: IndexedDB as local cache + background sync
- Keep Vite OR migrate to Next.js for "one repo fullstack"

---

## 4) Data Model

### Phase 1 (MVP)
```ts
Transaction {
  id: string
  dateISO: string                // YYYY-MM-DD in Settings.timezone
  amount: number
  direction: 'IN' | 'OUT'
  categoryId: string
  note?: string
  tags?: string[]                // e.g., ['confirmed', 'salary_run', 'transfer']
  confirmedAt?: number           // epoch ms
  createdAt: number
  meta?: {
    fromZoneId?: string
    toZoneId?: string
    relatedObligationCycleId?: string
  }
}

Category {
  id: string
  name: string
  type: 'IN' | 'OUT'
  icon?: string
  budgetMonthly?: number
  isFavorite?: boolean
}

Obligation {
  id: string
  name: string
  totalAmount: number            // total remaining debt
  priority: 1 | 2 | 3
  cycles: ObligationCycle[]
}

ObligationCycle {
  id: string
  amount: number                 // amount for this specific payment
  dueDateISO: string
  cadence: 'one_time' | 'monthly'
  status: 'PLANNED' | 'PAID' | 'MISSED'
  confirmedAt?: number
  autoCreatedTransactionId?: string
}

Zone {
  id: string
  name: string
  type: 'HQ' | 'SPEND' | 'OBLIGATION' | 'SAVINGS' | 'EMERGENCY'
  target?: number
  note?: string
}

Quest {
  id: string
  name: string                   // e.g., 'First Shield', 'The Reckoning', 'Cadencio\'s Ambition'
  targetAmount: number           // e.g., 150M
  createdAt: number
}

Settings {
  focusMode: boolean
  monthlyIncome?: number         // for cost-per-hour calculation
  hoursPerWeek: number           // default 40, adjustable
  monthlyCap: number             // daily cap = monthlyCap / 30
  frictionEnabled: boolean
  salaryDay: number              // default 15 (reset day)
  timezone: string               // e.g., 'Asia/Ho_Chi_Minh'
  selfReportedDebt?: number      // from onboarding Screen 4
}
```

### Derived Values (not stored, computed)
```ts
costPerHour = monthlyIncome / (hoursPerWeek / 5 * 20)  // simplified: monthlyIncome / 40 at default
dailyCap = monthlyCap / 30

questProgress = sum of all confirmed obligation payments (OUT transactions tagged 'confirmed' + 'obligation_payment')
              + sum of all logged savings transfers (OUT transactions tagged 'transfer' to savings/emergency zones)
```

### Phase 2 additions
```ts
IncomeExpectation {
  id: string
  amount: number
  expectedDateISO: string
  sourceCategoryId: string
  status: 'PLANNED' | 'RECEIVED' | 'MISSED'
  note?: string
  confirmedAt?: number
  autoCreatedTransactionId?: string
}
```

---

## 5) Critical Product Rules

### 5.1 Time & Date Rules
- All day-based logic uses **Settings.timezone**, not system timezone.
- `dateISO` stored as `YYYY-MM-DD` in that timezone.
- Heatmap day boundary = **local midnight** of Settings.timezone.
- Obligations due by **end of day** (23:59 local). Overdue triggers at next day 00:00.
- Salary Day window: `salaryDay - 2` through `salaryDay + 3` **inclusive** (local time).
- Missed income logic (Phase 2): expectedDate + 3 days grace.

### 5.2 Quest Progress Rules (Transaction-Derived)
- Quest progress = sum of all confirmed obligation payments + logged savings transfers.
- No snapshots or bank balances required. Progress comes from **confirmed actions within the app**.
- Quest target is set during onboarding (user-selected from three tiers).
- User can change quest target anytime in Settings.
- Three quest tiers are calculated by the **Obligation Suggestion Algorithm** (see separate doc) based on self-reported debt, monthly income, spend cap, and obligation load.

### 5.3 Zone Transfer Logging (MVP)
- Single-entry transfer: 1 OUT transaction tagged `transfer`, with `meta.fromZoneId` and `meta.toZoneId`.
- No double-entry accounting in MVP. Optional Phase 3 upgrade.

### 5.4 Focus Mode
When Focus Mode is ON:
- No currency values anywhere (dashboard, tooltips, charts, table cells, obligation cards).
- Numbers become progress %, status pills, and "under/over" indicators only.
- Streak count remains visible.
- **Cost-per-hour remains visible** (unit is hours, not currency).
- **Exception**: Obligation scheduling flow and Settings show raw amounts (you need to see numbers to plan). Active input screens are exempt; passive display screens are not.

### 5.5 Friction Screen
When Friction is ON:
- Every Spend triggers a pause: **Need** or **Growth**.
- Shows cost-per-hour ("≈ X hours of your life").
- In Focus Mode, cost-per-hour is visible but raw VND amount is hidden.
- No impulse category, no delay queue. The friction is the conscious pause itself — if you walk away, nothing is logged. If you buy it later, you log it then.

---

## 6) The 3 Core Loops

### Loop 1: Daily Logging (Spend/Receive)
**Frequency**: Multiple times per day. 90% of interactions are Quick Add Spend or Receive through the Universal Add Modal.

### Loop 2: Obligations (Must-Do)
**Frequency**: Weekly or when due. Dashboard shows "Due Soon" at top. One tap "Confirm Paid" → auto-creates OUT transaction → advances quest progress. Missed obligations trigger Red status.

### Loop 3: Salary Day Run (Monthly)
**Frequency**: Once per month (reset day ±2). Quest-style checklist appears automatically with scheduled obligations. Each step: execute in bank → confirm in app → logged. Completion awards badge + updates streaks.

---

## 7) Screens & Flows

### 7.1 Desktop Dashboard (16:9 primary)

**Sections (top to bottom):**

1. **Next Actions (Quest Log)** — ALWAYS AT TOP
   - Obligation scheduling prompt (if unscheduled obligations exist — persistent until resolved)
   - Due Soon obligations (priority-sorted, max 5)
   - Salary Day Run (if in window)
   - Skipped onboarding steps (income, debt target — nudge to complete)

2. **Status Banner** (Traffic Light)
   - Green: Under budget + no obligations within 7 days unpaid
   - Yellow: Near cap OR obligations due within 7 days
   - Red: Over budget OR missed/overdue obligation

3. **Main Quest Card** (user-selected quest name + progress %)

4. **Discipline Heatmap** (last 6 weeks) + streak counter

5. **Monthly Budget Usage** (progress bar showing % of monthly cap, auto-calculated daily equivalent)

6. **Zones Panel** (collapsed by default; hidden in Focus Mode)

7. **Universal Add Button** (always visible, FAB or top-bar)

**Top Bar**: App name + month selector, Focus Mode toggle, Settings gear.

**Acceptance**: Dashboard reflects any save instantly (no refresh). Next Actions always visible above analytics.

### 7.2 Universal Add Modal (MVP centerpiece)

**3 tabs** (MVP): Spend (OUT) · Receive (IN) · Obligation

**Phase 1.5+**: Add Paste (AI Parse) as 4th tab.

**Performance**: Opens in <200ms. Keyboard shortcuts: Cmd+N (Spend), Cmd+R (Receive).

### 7.3 Spend (OUT)
- Amount, category (Recent + Favorites + All), note (optional)
- Cost-per-hour preview: `hours = amount / costPerHour`
- Friction Screen (if enabled): Need / Growth
- Save: persist to IndexedDB, update heatmap/streak/budget immediately

### 7.4 Receive (IN)
- **Phase 1**: Amount, source category (Salary/Tutor/Freelance/Other), note. Save → IN transaction.
- **Phase 2**: Toggle Actual vs Expected. Expected → IncomeExpectation PLANNED. Later: Confirm Received → auto-create IN transaction.

### 7.5 Obligations Screen
**Tabs**: Upcoming (priority → date) · Paid (recent first) · Overdue (auto-flagged)

**Card**: Name, priority badge (P1 red "CRITICAL", P2 orange "HIGH", P3 gray "STANDARD"), countdown chip, "Confirm Paid" button. Amount visible only when Focus Mode is OFF.

**Confirm Paid Flow**: User taps Confirm Paid → dialog: "Have you paid in your bank app?" → optional amount edit (for overpayment/partial) → On confirm: cycle.status = PAID, confirmedAt set, auto-create OUT transaction (tags: ['confirmed', 'obligation_payment']), link via autoCreatedTransactionId, quest progress advances.

**Missed Logic**: If currentDate > dueDateISO and status ≠ PAID → status = MISSED, dashboard → Red, Next Actions shows "OVERDUE — Pay now."

**Obligation Scheduling** (post-onboarding): One-at-a-time focused flow. Each obligation shows a **suggested payment plan** (generated by the Suggestion Algorithm — see Section 9) plus manual override options: One-time / Monthly / Split. See Onboarding doc for full screen flow.

### 7.6 Budgets Screen
- Monthly cap (primary). Daily equivalent shown as reference (monthlyCap ÷ 30).
- Warnings at 80% and 100%.
- Hard Friction at 120% (Phase 2): all purchases require friction screen.

### 7.7 Settings Screen
- salaryDay (reset day), timezone, monthlyCap, monthlyIncome, hoursPerWeek
- frictionEnabled, focusMode default
- selfReportedDebt, quest target (changeable anytime)
- Export / Import JSON (MVP), Reset local data
- Privacy note: *"All data stored locally in your browser."*

---

## 8) Onboarding

See **cadencio-onboarding.md** for the full modal-based walkthrough.

**Summary**: 5-screen modal flow (~3 min) + post-onboarding obligation scheduling (~2-4 min).

```
Screen 1: What comes in? → monthly income, cost-per-hour (skippable)
Screen 2: Set your rhythm → reset day, monthly cap, friction, focus mode
Screen 3: Who do you owe? → name + total amount + priority per obligation
Screen 4: How deep is the hole? → self-reported total debt (skippable)
Screen 5: Choose your quest → three tiered targets → select one
→ Modal closes → Dashboard populates
→ Post-onboarding: schedule obligation payments (persistent Next Action)
```

---

## 9) Obligation Suggestion Algorithm

Internal logic for generating the "💡 SUGGESTED" payment plan on each obligation scheduling screen. Obligations are processed in **priority order** (P1 first). Each suggestion consumes capacity, reducing what's available for the next.

### Inputs

```ts
interface SuggestionInput {
  obligationTotal: number        // total remaining for this obligation
  priority: 1 | 2 | 3
  monthlyIncome: number          // from onboarding
  monthlyCap: number             // spending cap
  existingMonthlyLoad: number    // sum of already-scheduled monthly payments
  salaryDay: number              // reset day
  today: string                  // current date ISO
}
```

### Step 1: Remaining Capacity

```ts
const availableForObligations = monthlyIncome - monthlyCap
const remainingCapacity = availableForObligations - existingMonthlyLoad
```

### Step 2: Payment Type Selection

```
ONE-TIME if:
  obligationTotal ≤ remainingCapacity × 0.5
  OR obligationTotal ≤ monthlyIncome × 0.4

SPLIT if:
  priority === 1
  AND obligationTotal > suggestedMonthlyAmount × 6

MONTHLY otherwise
```

### Step 3: Monthly Amount Calculation

```ts
function suggestMonthlyAmount(total: number, remainingCapacity: number): number {
  const maxMonthly = remainingCapacity * 0.4

  // Smaller debts (<30M): target ≤4 months
  // Larger debts (≥30M): target 6-12 months (midpoint: 9)
  const targetMonths = total < 30_000_000 ? 4 : 9
  const idealMonthly = total / targetMonths
  const rawMonthly = Math.min(idealMonthly, maxMonthly)

  // Allow nice-number rounding to exceed cap by up to 15%
  const rounded = roundToNice(rawMonthly)
  return rounded <= maxMonthly * 1.15 ? rounded : roundToNiceDown(rawMonthly)
}
```

### Step 4: Split Calculation (P1 only)

```ts
function suggestSplit(total: number, remainingCapacity: number, monthlyIncome: number) {
  // Upfront: 30% of total, capped at 1.5× monthly income
  const rawUpfront = total * 0.30
  const cappedUpfront = Math.min(rawUpfront, monthlyIncome * 1.5)
  const upfront = roundToNice(cappedUpfront)

  const remainder = total - upfront
  const monthly = suggestMonthlyAmount(remainder, remainingCapacity)
  return { upfront, monthly }
}
```

### Step 5: Due Date Calculation

```ts
function suggestDueDate(salaryDay: number, priority: number): number {
  const offset = priority === 1 ? 1 : priority === 2 ? 3 : 5
  return ((salaryDay + offset - 1) % 30) + 1
}
// One-time payments: ~1 month from today on priority-offset day.
// If <14 days away, push to following month.
```

### Nice Number Rounding

| Amount Range | Round To | Examples |
|---|---|---|
| ≥ 10M | 5M | 10M, 15M, 20M |
| 5M – 10M | 1M | 5M, 6M, 7M, 8M |
| 1M – 5M | 500k | 1M, 1.5M, 2M, 2.5M |
| 500k – 1M | 100k | 500k, 600k, 700k |
| < 500k | 50k | 50k, 100k, 150k |

### Decision Flowchart

```
Input: obligation total, priority, remaining capacity, monthly income

  ├─ total ≤ capacity × 0.5 OR total ≤ income × 0.4?
  │    YES → ONE-TIME on priority-offset day, ~1 month out
  │
  │    NO ↓
  ├─ priority === 1 AND total > suggestedMonthly × 6?
  │    YES → SPLIT (upfront capped at income × 1.5 + monthly remainder)
  │
  │    NO ↓
  └─ MONTHLY
       total < 30M → target ≤4 months (fast payoff)
       total ≥ 30M → target 6-12 months (standard pace)
```

### Tuning Parameters

| Parameter | Default | Controls |
|---|---|---|
| `ONE_TIME_CAPACITY_RATIO` | 0.5 | One-time threshold vs remaining capacity |
| `ONE_TIME_INCOME_RATIO` | 0.4 | One-time threshold vs monthly income |
| `SPLIT_MONTH_THRESHOLD` | 6 | Months before suggesting split (P1 only) |
| `SPLIT_UPFRONT_RATIO` | 0.30 | % of total as upfront |
| `SPLIT_UPFRONT_CAP_RATIO` | 1.5 | Max upfront as multiple of monthly income |
| `MAX_MONTHLY_CAPACITY_RATIO` | 0.4 | Max % of remaining capacity per obligation |
| `NICE_NUMBER_OVERFLOW` | 1.15 | Rounding allowed to exceed cap by this % |
| `SMALL_DEBT_THRESHOLD` | 30,000,000 | Below: fast payoff. Above: standard pace. |
| `FAST_TARGET_MONTHS` | 4 | Payoff target for small debts |
| `STANDARD_TARGET_MONTHS` | 9 | Payoff target for large debts |
| `P1_DUE_OFFSET` | 1 | Days after salary day |
| `P2_DUE_OFFSET` | 3 | Days after salary day |
| `P3_DUE_OFFSET` | 5 | Days after salary day |

### Edge Cases

- **Remaining capacity ≤ 0**: User is overcommitted. Don't suggest; show: *"Your scheduled obligations already match your available income. Consider adjusting existing plans."*
- **Very large obligation** (total > monthlyIncome × 24): Long-term debt. Suggest sustainable amount at 10–15% of remaining capacity with: *"This is a long-term obligation. Start with what's comfortable."*
- **User overrides above capacity**: Don't block. Soft warning: *"This brings your monthly obligations close to your available income."*
- **Upfront exceeds cap**: If `total × 0.30` > `monthlyIncome × 1.5`, cap the upfront and extend the monthly duration.
- **All obligations one-time**: Salary Day Run shows one-time items as "due on [date]." After confirmed, they clear and quest progresses.
- **Early payment**: Users can Confirm Paid before due date. Remaining capacity recalculates and quest timeline updates.

---

## 10) AI Integration (Phase 1.5–2)

### Where AI Appears
- Universal Add → Paste (AI Parse) tab
- Optional "suggest category" button (post-MVP)
- Reconciliation helper: suggest missing logs (Phase 2)

### AI Principles (safety + trust)
- AI never auto-saves. Every parsed item shows a review row with editable fields.
- Confidence handling: High → pre-fill + soft highlight. Medium → highlight for review. Low → require user pick before enabling Confirm.
- Supports Vietnamese natural language parsing.

### Minimal Endpoint Contract
```
POST /api/ai/parse
Input:  { text, mode, timezone, salaryDay, categories }
Output: { items: ParsedItem[], warnings: string[] }
```
Server-side Zod validation. Reject malformed outputs.

---

## 11) Phase Plan

### Phase 1 — MVP (2–4 weeks, ship fast, daily usable)
- Dashboard (Next Actions + Status + Heatmap + Quest card)
- Universal Add Modal (Spend/Receive/Obligation)
- Onboarding modal (5 screens) + obligation scheduling flow with suggestion algorithm
- Obligations cycles + Confirm Paid (auto-OUT + quest progress)
- Budgets: monthly cap + warnings
- Friction Screen (Need/Growth)
- Focus Mode (no money leaks, cost-per-hour stays visible)
- Export/Import JSON backup

### Phase 1.5 — AI Parse (+1 week, optional)
- Serverless function for AI parse endpoint
- Review screen UI
- Vietnamese text parsing with confidence scoring

### Phase 2 — Expanded (4–6 weeks, audit-proof + prevent drift)
- Reconciliation wizard (weekly)
- Salary Day Runbook (guided)
- Hard Friction + Guardrails (auto-enable friction on overspend patterns)
- Expected Income + Confirm Received
- AI Parse + reconciliation hints
- Insights & Analytics (30/90-day trends, burn rate, category drift alerts)

### Phase 3 — Ship-ready (6–8 weeks, multi-user)
- Auth + cloud sync (Supabase PostgreSQL)
- Encryption + privacy (E2E, userId scoping)
- Offline-first: IndexedDB cache + background sync + conflict resolution
- Monitoring (Sentry), analytics opt-in
- A11y (WCAG 2.1 AA), performance, testing (80%+ coverage), docs
- Export options: CSV all transactions, PDF monthly report

---

## 12) Definition of Done

### Gate 1 — MVP usable daily
- Confirm Paid: cycle → PAID, OUT transaction auto-created, quest progress advances
- Focus Mode: no currency visible anywhere (cost-per-hour in hours is allowed)
- Friction Screen: Need/Growth pause works, cost-per-hour displayed
- Heatmap: updates immediately after save
- Budgets: monthly cap warning thresholds work, daily equivalent displayed
- Onboarding: 5-screen modal flow completes, obligation scheduling generates correct cycles
- Suggestion Algorithm: produces reasonable payment plans for obligations
- Export/Import: round-trip restores identical data
- Performance: Universal Add opens fast; saving feels instant

### Gate 2 — Expanded robust
- Reconciliation: detect missing logs, fix in <2 minutes
- Salary runbook: confirms create transactions consistently + tags
- AI parse: saves time and never bypasses confirm

### Gate 3 — Ship-ready
- Auth + sync reliable (offline-first)
- Security and privacy defaults correct
- Monitoring + tests cover critical flows
- Onboarding works for strangers in <5 minutes

---

## 13) Testing Plan

### Unit Tests
- Date utilities (timezone boundaries)
- Obligation cycle generation from scheduling flow
- Suggestion Algorithm (payment type selection, amount rounding, due dates)
- Quest progress calculation (transaction-derived sum)
- Focus Mode masking functions
- Budget calculation (monthly cap, daily equivalent)

### Integration Tests
- Confirm Paid → auto-create OUT transaction + linkage + quest progress update
- Obligation scheduling → correct ObligationCycles created
- Export/Import round-trip

### E2E Tests (Playwright)
- Full onboarding flow (5 screens + obligation scheduling)
- Add Spend / Add Receive
- Add Obligation + Confirm Paid
- Focus Mode on/off (no money leaks)
- Salary Day window shows checklist

---

## 14) Repo Structure

### Option A: Vite + Serverless (fast deploy)
```
cadencio/
├── app/               # Vite + React app (src/components, hooks, stores, db, types, utils)
├── api/               # Serverless functions (AI parse — Phase 1.5+)
├── shared/            # Types + Zod schemas
├── docs/              # patch-notes, daily-log
├── changelog.txt
└── README.md
```
Deploy: Vercel/Netlify/Cloudflare.

### Option B: Vite + Express (full control)
```
cadencio/
├── client/            # Vite app
├── server/            # Express/Fastify API (routes, middleware)
├── shared/            # Types + Zod schemas
└── docs/
```
Deploy: Client to CDN, Server to VPS/Railway/Fly.io.

---

## 15) Success Metrics

**MVP**: User logs daily for 30 days; at least 1 green streak of 7+ days; all P1 obligations confirmed on time; quest progress visibly advances.

**Engagement (Phase 2)**: Weekly reconciliation 80%+; Salary Day Run completion >90%.

**Recovery (Phase 3)**: User reaches First Shield milestone; debt obligations reduced >50% within 12 months.

---

## 16) Key Architectural Decisions

- ✅ No bank balances — all data is self-reported
- ✅ Quest progress is transaction-derived (confirmed payments + savings transfers)
- ✅ Keep Vite (don't migrate to Next.js for Phase 1–2)
- ✅ Confirm Paid auto-creates OUT transaction
- ✅ Universal Add Modal is the centerpiece
- ✅ Flow-first dashboard with Next Actions at top
- ✅ Monthly cap only — daily cap is derived (÷ 30)
- ✅ Friction Screen is Need/Growth (no impulse delay queue)
- ✅ Focus Mode exempts active input screens (scheduling, settings)
- ✅ Obligation scheduling is post-onboarding with suggestion algorithm
- ✅ AI parse only through backend/serverless, never client-side keys (Phase 1.5+)
- ✅ Single-entry zone transfers in MVP (no double-entry accounting)
- ✅ Expected Income in Phase 2 completes the manual-confirm loop

---

**Total MVP to Production**: ~12–18 weeks (3–4.5 months).

**Reality Check**: Don't build Phase 3 unless you've used Phase 1+2 for 3+ months yourself.

**This is a financial recovery tool disguised as a game. The manual-confirm philosophy stays sacred: real discipline requires conscious choice, every single time.** 🛡️
