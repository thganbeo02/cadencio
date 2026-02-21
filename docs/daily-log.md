# Cadencio - Daily Development Log

## 2026-02-20 - Friday

### Session 1 (Time TBD)

**Goal**: Build an Obligations hub and fix category integrity.

**Completed**:
- ✅ Built a dedicated Obligations screen with tabs, master-detail panel, and confirm paid actions.
- ✅ Added Borrowed logging inside Obligations only, including principal IN and undo support.
- ✅ Centralized categories and updated seed/UI/activity labels to stay in sync.
- ✅ Unified money/input formatting utilities across modals.
- ✅ Tuned obligations layout, typography, and date formatting (month/day).

**Blockers**: None

**Next Steps**:
- Review obligations layout spacing and nudge styling on mobile.
- Decide if the detail panel should collapse into a drawer below 1100px.

**Stats**: Files: 16 | +? -? | Deps: none

**Notes**: Borrowed cash now lives strictly in Obligations for cleaner debt integrity.

## 2026-02-18 - Wednesday

### Session 1 (Time TBD)

**Goal**: Rework Zones defaults, transfers, and clarity UI.

**Completed**:
- ✅ Replaced info modals with click/tap tooltips (quest/heatmap/cap/zones).
- ✅ Reworked Zones defaults to system rows (Money In/Out/Obligations) and added Manage Zones modal.
- ✅ Transfer modal now shows available funds, blocks over-transfer, and disables invalid confirm.
- ✅ Recent Actions undo is now one-by-one (Undo latest).
- ✅ Plan your obligations list now shows unplanned items first.
- ✅ Heatmap start clamps to onboarding day.

**Blockers**: None

**Next Steps**:
- Decide whether to surface net balance elsewhere since Money In is now IN-only.
- Consider a subtle “Started” marker for the first heatmap day.

**Stats**: Files: 6 | +? -? | Deps: none

**Notes**: Transfer availability uses zone balances (including transfers), not month-IN totals.

---

## 2026-02-17 - Tuesday

**Goal**: Rework Main Quest selection into creative quest types + tiered difficulty, and tighten dashboard clarity.

**Completed**:
- ✅ Rebuilt Onboarding Step 5 quest selection into 3 tabs (Debt Cut / Earned Climb / Recovery Map) with 1★/2★/3★ tiers.
- ✅ Debt Cut now targets “debt cleared” (ascending goals) and dashboard progress matches.
- ✅ Recovery Map now scales targets by surplus (1/3/6 month buffers) and no longer starts with “free progress” (shadow debt accounted for).
- ✅ Simplified Step 5 by removing the briefing panel; cards carry the explanation; missing inputs show a red estimate warning.
- ✅ Step 3 “Total Obligations” only appears after the user begins entering amounts.
- ✅ Replaced “Undo listed” and Zone “Transfer” pills with simple clickable text.
- ✅ Added gentle info icons that open breakdown modals for Main Quest, Heatmap, and Monthly Cap.
- ✅ Fixed white-screen issues (missing imports / stray JSX / missing state).

**Blockers**: None

**Next Steps**:
- Stabilize hero quest card layout rules (ring sizing + containment) without theme drift.
- Decide XP/reputation design for “new obligations mid-quest” and write a spec section + UI surfaces (badges/side quests).

---


## 2026-02-15 - Sunday

**Goal**: Align cashflow vs. debt tracking, and implement real heatmap/cap analytics

**Completed**:
- ✅ Removed the Obligation tab from Universal Add to keep the quick add flow focused.
- ✅ Added an "Add obligation" modal from the planning card (name, amount, priority).
- ✅ Added a Borrowed receive category with `debt_principal` tagging.
- ✅ Updated quest progress to use earned net (cashflow net minus borrowed principal).
- ✅ Implemented real Discipline Heatmap with 30/60/90-day ranges and streaks.
- ✅ Implemented real Monthly Cap usage + weekly mini bars.
- ✅ Added Focus Mode masking for money values with a percent-only quest ring.
- ✅ Simplified Recent Actions to show month/day dates and M-format amounts.
- ✅ Tightened Last OUT spacing in the dashboard.
- ✅ Updated ESLint config to ignore build output and cleaned unused symbols.
- ✅ Split release notes into a weekly draft and curated patch format.
- ✅ Updated project spec to reflect earned net quest logic and double-entry transfers.

**Blockers**: None

**Next Steps**:
- Wire Focus Mode masking across the dashboard
- Implement Salary Day Run checklist logic
- Add obligation priority sorting in the planner flow

**Stats**: Files: 14 | +~520 -~210 | Deps: none

**Notes**: Borrowed principal now shows separately so the ring stays honest while cash inflows are still recorded.

---

## 2026-02-13 - Friday

**Goal**: Fix onboarding UX bugs, stabilize planning, and wire activity/quest tracking

**Completed**:
- ✅ Fixed Onboarding Step 2 Reset Day field:
  - Removed duplicate calendar icon from input wrapper
  - Moved helper text into label for cleaner layout
  - Added validation (0–30) with error message
  - Disabled Next button until valid input
  - Added visual disabled styling for primary buttons
- ✅ Fixed ObligationPlanningModal crash (white screen):
  - Resolved temporal dead zone issue by moving obligationsList declaration above useEffect
- ✅ Simplified obligation planning UI:
  - Replaced Due Day + Start Month with single Target Date input for Monthly and Split plans
  - Made layout consistent across all plan types (One-time, Monthly, Split)
  - Target Date auto-derives due day and start month for the scheduler
- ✅ Added Recent Actions card + undo:
  - Logs planning, transactions, transfers, and confirm-paid actions
  - One-click undo for the latest 5 actions
- ✅ Refined Recent Actions display:
  - Category-based titles (Food, Transport, Salary)
  - Directional color for IN/OUT badges
  - Left alignment matches card padding
- ✅ Updated quest progress to net IN − OUT:
  - Ring clamps at 0 while showing true net line
  - Income pushes progress forward; spending pulls it back
- ✅ Added Quest Details modal:
  - View Details now shows net, monthly net, and total in/out
  - Moved net line out of the ring
  - Added remaining-to-target and a 30-day net trend sparkline
- ✅ Tuned Hero Quest sizing:
  - Larger ring with bigger inner values
  - Balanced Main Quest and Recovery typography
- ✅ Last OUT now reflects real data:
  - Uses latest OUT transaction and cost-per-hour when available
- ✅ Hardened Confirm Paid:
  - Fixed Dexie transaction scope issue
  - Handles comma-formatted amounts with validation feedback

**Blockers**: None

**Next Steps**:
- Wire Salary Day timeframe logic to trigger the checklist
- Implement "Last Purchase Impact" using latest OUT transaction
- Connect AI Copilot placeholder to real parsing pipeline

**Stats**: Files: 10 | +~320 -~85 | Deps: none

**Notes**: Activity logging and undo are in place. Quest progress now reflects net behavior without shaming negatives.

---

## 2026-02-12 - Thursday

**Goal**: Transition to build phase; implement core functional hubs and zones

**Completed**:
- ✅ Implemented `TransactionModal` (Universal Add) with Spend/Receive/Obligation tabs
- ✅ Rebuilt `HeroQuest` card with 2-column layout and matched light theme palette
- ✅ Refactored dashboard into 25/50/25% grid with slim sidebar (icon-only)
- ✅ Implemented `Zones` system (HQ, Savings, Cash) with real-time balance derivations
- ✅ Added `TransferModal` for internal zone movements (tagged `internal_transfer`)
- ✅ Added "Total Obligations" feedback to Onboarding Step 3
- ✅ Implemented "Reset System" functionality for data nuking

**Blockers**: None

**Next Steps**:
- Connect "Salary Day Checklist" to real timeframe logic
- Activate "Last Purchase Impact" using latest `OUT` transaction
- Refine "Spend Cap" logic and mini-bars on dashboard

**Stats**: Files: 12 | +~650 -~120 | Deps: none

**Notes**: Functional foundation is now solid. Users can log the full cycle (Salary IN -> Transfer to Zones -> Spend -> Pay Debts).


**Goal**: Redesign obligation planning UI and stabilize planning flow

**Completed**:
- ✅ Rebuilt Obligation Planning modal layout to match the new UX spec
- ✅ Added AI Copilot input placeholder and intent chips (non-functional for now)
- ✅ Replaced money inputs with onboarding-style VND prefix + live comma formatting
- ✅ Fixed planner index bug that caused a blank/error screen after confirming
- ✅ Expanded Due Soon window to upcoming 30 days
- ✅ Added roadmap notes to README + project spec

**Blockers**: None

**Next Steps**:
- Connect AI Copilot to a real parsing pipeline when ready
- Add obligation schedule preview before confirming
- Wire Last OUT impact to the latest `OUT` transaction

**Stats**: Files: 7 | +~420 -~120 | Deps: none

**Notes**: Planner flow is now stable, and the modal matches onboarding visual language.

---

## 2026-02-10 - Tuesday

**Goal**: Refine onboarding UI and input behavior

**Completed**:
- ✅ Tuned onboarding modal sizing, typography scale, and layout density
- ✅ Standardized VND prefixes with comma formatting across debt inputs
- ✅ Consolidated obligations into a single card with updated priority colors
- ✅ Fixed toggle switch alignment and quest meta spacing
- ✅ Renamed spec and onboarding docs to Cadencio filenames
- ✅ Swapped quest emojis for themed SVGs and aligned Step 5 footer buttons

**Blockers**: None

**Next Steps**:
- Verify onboarding interactions in target browsers
- Decide on dynamic timeline logic for quest milestones

**Stats**: Files: 9 | +unknown -unknown | Deps: none

**Notes**: Line counts not tracked in a non-git workspace.

---

## 2026-02-09 - Phase 1 Scaffold

**Goal**: Clean rebuild foundation

**Completed**:
- ✅ Reset repository and re-initialized a clean Vite + React + TypeScript + Tailwind scaffold
- ✅ Added ESLint baseline and dependency set
- ✅ Retained the official spec and onboarding docs as the source of truth

**Blockers**: None

**Next Steps**:
- Wire the data model (Dexie schema) from the project spec
- Build the 5-screen onboarding modal
- Implement the obligation suggestion engine
