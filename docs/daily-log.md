# Cadencio - Daily Development Log

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
