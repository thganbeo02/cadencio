# AI Agent Instructions: Changelog & Commit Management

## CRITICAL SESSION INSTRUCTIONS (Cadencio)

- Treat `changelog.txt` as dev-only implementation log; do not use it for user-facing patch notes.
- User-facing patch notes workflow:
  - **Daily (Mon-Sat)**: Append entries to `docs/patch-notes/UNRELEASED.md` under today's date.
  - **Weekly release (every Sunday)**: Cut a new file `docs/patch-notes/0.x.y.md` from `UNRELEASED.md`, set `**Date:**` to that Sunday, bump `package.json` version, then reset `UNRELEASED.md` to template.
- Patch notes style:
  - Use `New / Enhanced / Adjusted / Tightened / Fixed` labels.
  - Include numeric deltas when relevant (`30M → 50M`).
  - Keep entries user-facing and explain WHY changes matter.
- Same-day consolidation rule:
  - If tweaking a feature multiple times on the same date, EDIT the existing entry to reflect final state.
  - Do NOT add duplicate entries for same-day tweaks.
- Git:
  - This repo may not be a git repository; if so, omit commit-related fields.
  - Don't commit unless explicitly asked.
  - Never amend commits unless explicitly asked.

---

After each coding session, you MUST update documentation in this exact format.

## Files to Maintain

```
/changelog.txt                    # Dev-only implementation log
/docs/daily-log.md                # Daily session log
/docs/patch-notes/UNRELEASED.md   # Upcoming changes (user-facing)
/docs/patch-notes/0.x.y.md        # Released versions (cut weekly)
```

---

## changelog.txt Format

```
CADENCIO - CHANGELOG
Last Updated: [YYYY-MM-DD HH:MM]

================================================================================
[YYYY-MM-DD] - [Human-Readable Day Summary]
================================================================================

FEATURE: [Feature Name in Title Case]
--------
What Changed (Human):
  - [Plain English - what users notice]
  - [Benefits or behavior changes]

What Changed (Technical):
  - [Code/architectural changes]
  - [Files modified, dependencies]

Commit: [commit-hash] (optional)
Files: [list of modified files]

---

[Repeat for each feature this day]
```

### CRITICAL: Same-Day Consolidation Rule

**If you tweak a feature multiple times on the same date:**
- Do NOT add a second entry
- EDIT the existing entry to reflect the final state
- Update line counts, file lists, and descriptions to final values
- If the "why" meaningfully changed, update that paragraph too

Example:
```
❌ WRONG:
FEATURE: Priority System
What Changed (Technical):
  - Added priority field
Files: obligation.ts

FEATURE: Priority System (Updated)
What Changed (Technical):
  - Added priority field
  - Added sorting logic
Files: obligation.ts, ObligationsList.tsx

✅ CORRECT:
FEATURE: Priority System
What Changed (Technical):
  - Added priority field
  - Added sorting logic
Files: obligation.ts, ObligationsList.tsx
```


### Example Changelog Entry

```
CADENCIO - CHANGELOG
Last Updated: 2025-02-06 14:30

================================================================================
2025-02-06 - Priority System & Two-Phase Recovery
================================================================================

FEATURE: Obligation Priority System
--------
What Changed (Human):
  - Obligations now have priority levels (Critical, High, Standard)
  - Dashboard automatically shows most important debts first
  - Critical obligations highlighted in red - never miss family payments

What Changed (Technical):
  - Added `priority: 1 | 2 | 3` field to Obligation type
  - Modified ObligationsList to sort by priority then date
  - Created PriorityBadge component with conditional styling
  - Updated obligation form with priority selector

Commit: abc123f
Files: obligation.ts, ObligationsList.tsx, PriorityBadge.tsx, 
       CreateObligation.tsx, useObligations.ts

---

FEATURE: Two-Phase Recovery Progress
--------
What Changed (Human):
  - Goal split into Phase 1 (30M shield) and Phase 2 (100M recovery)
  - See a "win" in 3-4 months instead of waiting 10 months
  - Progress bar auto-updates based on current phase

What Changed (Technical):
  - Created useRecoveryProgress hook with two-phase calculation
  - Modified MainQuestCard for conditional phase display
  - Added phase transition animation at 30M milestone
  - Progress formula: clamp((netWorth - lowPoint) / phaseTarget, 0, 1)

Commit: def456a
Files: useRecoveryProgress.ts, MainQuestCard.tsx, RadialProgress.tsx,
       progressCalculations.ts, milestones.ts

================================================================================
2025-02-05 - Project Initialization
================================================================================

FEATURE: Project Setup
--------
What Changed (Human):
  - Created React app for Cadencio
  - Configured styling and development tools

What Changed (Technical):
  - Initialized React + TypeScript with Vite
  - Configured Tailwind CSS with custom palette
  - Set up ESLint, Prettier, folder structure

Commit: initial
Files: package.json, vite.config.ts, tailwind.config.js
```

---

## PATCH NOTES System (User-Facing)

### Overview
- **changelog.txt** = Dev implementation log (technical)
- **Patch Notes** = User-facing release notes (benefits & changes)

### Workflow

**Daily (Mon-Sat)**:
- Append entries to `docs/patch-notes/UNRELEASED.md` under today's date
- Use user-friendly language, not technical jargon
- Include numeric changes where relevant (e.g., "30M → 50M")

**Weekly Release (Every Sunday)**:
1. Cut a new file: `docs/patch-notes/0.x.y.md` from `UNRELEASED.md`
2. Set `**Date:**` field to that Sunday
3. Bump version in `package.json`
4. Reset `UNRELEASED.md` to template
5. Commit with message: `release: version 0.x.y`

**Version Bumping**:
- `0.x.0` → Major feature release (new screens, core mechanics)
- `0.x.y` → Minor features, improvements, fixes

---

## UNRELEASED.MD Format

```markdown
# Unreleased Changes

**Version:** TBD  
**Release Date:** TBD

---

## 2025-02-06 (Thursday)

### Enhanced
- Two-phase recovery progress now shows "First Shield" milestone at 30M
  - Phase 1: 0M → 30M (emergency fund)
  - Phase 2: 30M → 100M (full recovery)
  - You'll see progress wins in 3-4 months instead of 10

### New
- Priority system for obligations
  - Critical (P1): Family debts, urgent bills → always at top
  - High (P2): Monthly recurring → middle section
  - Standard (P3): Utilities, subscriptions → bottom section

### Fixed
- Streak counter no longer resets incorrectly at midnight for non-UTC timezones

---

## 2025-02-05 (Wednesday)

### New
- Initial app setup complete
- Local-first storage (all data stays on your device)
- Offline-capable (no internet required)

---

[Previous days...]
```

### Patch Notes Style Guide

**Labels** (adapted from LoL):
- **New**: Brand new features or screens
- **Enhanced**: Improvements to existing features (LoL's "Buff")
- **Adjusted**: Rebalanced or changed mechanics (LoL's "Adjust")
- **Tightened**: Stricter discipline features (LoL's "Nerf")
- **Fixed**: Bug fixes

**Writing Style**:
- Use second person ("You'll see..." not "Users will see...")
- Include numeric deltas when relevant: `5M → 10M`
- Explain WHY the change matters, not just WHAT changed
- Keep technical terms minimal
- Use bullet points with sub-bullets for details

**Examples**:

✅ **Good**:
```
### Enhanced
- Salary Day Runbook now guides you through all 5 steps
  - Prevents forgetting to fund emergency savings
  - Each step has a satisfying checkbox
  - Completion awards "Cadencio Salary" badge
```

❌ **Bad**:
```
### Enhanced
- Modified SalaryDayRunbook component to include all allocation steps
- Added ObligationCycle status updates
- Implemented badge unlock logic
```

---

## RELEASED VERSION Format (0.x.y.md)

```markdown
# Version 0.2.0 - "The Shield Update"

**Date:** Sunday, February 9, 2025  
**Theme:** Two-phase recovery system

---

## Major Changes

### Two-Phase Recovery Progress
The 100M recovery goal is now split into achievable phases to keep you motivated.

**Phase 1: First Shield (0M → 30M)**
- Your emergency fund milestone
- Achievable in 3-4 months of discipline
- Progress bar shows percentage toward 30M
- Unlocks "Shield Complete" badge

**Phase 2: The Recovery (30M → 100M)**  
- Activates after Phase 1 completion
- Progress resets to 0% for fresh start feeling
- Final push to financial freedom

**Why this matters**: Seeing meaningful progress in 3-4 months keeps you committed, instead of watching a tiny percentage inch upward for 10 months.

---

## New Features

### Obligation Priority System
Never miss critical payments again.

- **Priority 1 (Critical)**: Family debts, urgent bills
  - Highlighted in red
  - Always at top of dashboard
  - Due date countdown prominently displayed

- **Priority 2 (High)**: Monthly recurring obligations
  - Orange highlighting
  - Middle section of obligation list

- **Priority 3 (Standard)**: Utilities, subscriptions
  - Gray styling
  - Bottom section

**Example**: Debt to family (due Feb 15) now shows as "CRITICAL - 2 DAYS" at the very top.

---

## Enhancements

### Dashboard Status Banner
- Now shows specific reason for yellow/red states
- Example: "Yellow: Obligations due within 7 days" instead of just "Yellow"

### Quick Add Transaction
- Cost-per-hour calculation now shows immediately as you type
- Example: "8.5 hours of work" appears under amount field

---

## Fixes

### Streak Calculation
- Fixed: Streak counter no longer resets incorrectly at midnight for non-UTC timezones
- Fixed: Green streak now properly counts consecutive under-budget days

---

## Developer Notes

**Files Changed**: 18 files modified  
**Lines Changed**: +524 / -112  
**New Dependencies**: None  
**Migration Required**: No

---

**Full Changelog**: [View all technical changes](../../changelog.txt)
```

---

## WEEKLY RELEASE Checklist (Every Sunday)

Run through this checklist every Sunday:

```
[ ] Review UNRELEASED.md for completeness
[ ] Choose version number (0.x.0 for major, 0.x.y for minor)
[ ] Create new file: docs/patch-notes/0.x.y.md
[ ] Copy content from UNRELEASED.md into new file
[ ] Set Date field to today (Sunday)
[ ] Add optional theme/subtitle to version header
[ ] Group changes under: Major Changes / New Features / Enhancements / Fixes
[ ] Rewrite technical bullets into user-friendly language
[ ] Add "Why this matters" explanations for major features
[ ] Bump version in package.json
[ ] Reset UNRELEASED.md to template
[ ] Commit: "release: version 0.x.y"
[ ] Show me the release notes for review
```

---

## UNRELEASED.MD Template

After each Sunday release, reset `UNRELEASED.md` to this:

```markdown
# Unreleased Changes

**Version:** TBD  
**Release Date:** TBD

---

## [No changes yet]

---

**Note**: Changes will be released on Sunday. Check previous versions in [patch-notes/](./patch-notes/).
```

---

## Example Workflow

**Monday-Saturday**:
```
You: "I just added the priority system"

AI: "I'll update the documentation:

UNRELEASED.MD (appended):
---
## 2025-02-06 (Thursday)

### New
- Priority system for obligations
  - Critical (P1): Family debts → always at top, red highlight
  - High (P2): Monthly bills → middle section, orange
  - Standard (P3): Utilities → bottom section, gray
---

changelog.txt (appended):
[technical entry as usual]

DAILY-LOG.MD (appended):
[session log as usual]

Ready to commit?"
```

**Sunday**:
```
You: "Cut the weekly release"

AI: "Creating version 0.2.0 from UNRELEASED.md...

FILE: docs/patch-notes/0.2.0.md
---
# Version 0.2.0 - "The Shield Update"

**Date:** Sunday, February 9, 2025  
**Theme:** Two-phase recovery system

## Major Changes
[formatted user-facing content]
---

UPDATED: package.json
- version: "0.1.0" → "0.2.0"

RESET: UNRELEASED.md to template

Commit message:
---
release: version 0.2.0

The Shield Update - two-phase recovery system

Major features:
- Two-phase progress tracking (30M shield → 100M recovery)
- Obligation priority system (P1/P2/P3)
- Enhanced dashboard status indicators

See docs/patch-notes/0.2.0.md for full release notes.
---

Ready to commit release 0.2.0?"
```

---

## DAILY-LOG.MD Format

```markdown
# Cadencio - Daily Development Log

## [YYYY-MM-DD] - [Day of Week]

### Session [N] ([HH:MM] - [HH:MM])

**Goal**: [What you set out to accomplish]

**Completed**:
- ✅ [Task completed]
- ⏳ [Task in progress]

**Blockers**: [Issues encountered or "None"]

**Next Steps**: [What to do next session]

**Stats**: Files: [N] | +[lines] -[lines] | Deps: [list or "none"]

**Notes**: [Important observations or context]
```

### Example Daily Log

```markdown
## 2025-02-06 - Tuesday

### Session 1 (09:00 - 11:30)

**Goal**: Implement obligation priority system

**Completed**:
- ✅ Added priority field to Obligation type
- ✅ Created PriorityBadge component
- ✅ Modified ObligationsList sorting logic
- ✅ Updated CreateObligation form

**Blockers**: None

**Next Steps**: Add priority filter UI

**Stats**: Files: 5 | +180 -20 | Deps: none

**Notes**: Priority system removes cognitive load. P1 obligations always visible.

---

### Session 2 (14:00 - 17:00)

**Goal**: Build two-phase recovery progress

**Completed**:
- ✅ Created useRecoveryProgress hook
- ✅ Modified MainQuestCard for dual phases
- ✅ Implemented radial progress component
- ⏳ Working on edge cases

**Blockers**: Decided to reset progress to 0% at Phase 2 for psychological "new quest"

**Next Steps**: Add phase transition animation

**Stats**: Files: 6 | +240 -85 | Deps: none

**Notes**: Two-phase feels more motivating. "60% to Shield" > "6% to 100M"
```

---

## COMMIT MESSAGE Format

**Convention**: `type(scope): short summary` (Conventional Commits)

### Types
- `feat`: New feature
- `fix`: Bug fix  
- `refactor`: Code restructuring (no behavior change)
- `chore`: Dependencies, tooling, build
- `docs`: Documentation only

### Rules
- **Title**: 50 chars max, imperative mood, no period
- **Body**: 72 chars/line, explain WHAT and WHY
- **Scope**: feature/component name (obligations, dashboard, progress)

### Examples

```
feat(obligations): add priority system for debt management

Implement three-tier priority (Critical/High/Standard) to help users
focus on most important obligations first.

Changes:
- Add priority field to Obligation type
- Create PriorityBadge component with color coding
- Sort obligations by priority then date
- Surface P1 obligations on dashboard

Human Impact: Critical debts always appear at top, preventing missed
payments and reducing stress.

Technical: Modified 5 files, +180 LOC
```

```
feat(dashboard): implement two-phase recovery milestone system

Split 100M goal into achievable phases for better motivation.

Phase 1 "First Shield" (0→30M): Emergency fund, 3-4 month goal
Phase 2 "The Recovery" (30→100M): Full recovery after Phase 1

Changes:
- Create useRecoveryProgress hook with dual-phase logic
- Update MainQuestCard with conditional rendering
- Add phase transition celebration

Human Impact: Users see wins earlier (3-4 months vs 10), increasing
likelihood of completing recovery plan.

Technical: Modified 6 files, +240 -85 LOC
```

```
fix(dashboard): correct streak calculation for timezone edge cases

Fixed streak counter resetting incorrectly at midnight for non-UTC users.

Root cause: Used server time instead of user's local time
Solution: Convert all dates to user timezone before comparison

Closes #42
```

---

## Your Workflow

**Daily (After completing work)**:

1. **Update changelog.txt**
   - Add entry with today's date (or edit existing if same-day tweak)
   - Write human + technical descriptions
   - List modified files

2. **Update UNRELEASED.md**
   - Append user-facing entry under today's date
   - Use labels: New / Enhanced / Adjusted / Tightened / Fixed
   - Write in second person ("You'll see..." not "Users will...")
   - Include numeric deltas where relevant

3. **Update daily-log.md**
   - Record session time and stats
   - Note blockers and next steps

4. **Prepare commit message**
   - Use conventional format
   - Include what changed and why
   - Explain human impact for features

5. **Ask for confirmation**
   - Show me all entries (changelog, unreleased, daily log)
   - Wait for approval before committing

**Weekly (Every Sunday)**:

1. **Cut release version**
   - Create `docs/patch-notes/0.x.y.md` from `UNRELEASED.md`
   - Rewrite in user-friendly language with context
   - Bump `package.json` version
   - Reset `UNRELEASED.md` to template

2. **Ask for confirmation**
   - Show me the release notes
   - Wait for approval before committing release

---

## Quick Reference

**Changelog** (dev-only): `[DATE] | FEATURE: [Name] | Human: [benefits] | Technical: [changes] | Files: [list]`

**Patch Notes** (user-facing): `### [Label] | - [user benefit with context] | Sub-bullets for details`

**Labels**: New | Enhanced | Adjusted | Tightened | Fixed

**Commit**: `type(scope): summary | body with what/why | stats`

**Same-Day Rule**: Edit existing entry, don't add duplicate

**Sunday Release**: Cut 0.x.y.md from UNRELEASED.md → bump package.json → reset UNRELEASED.md

**Remember**:
- CHANGELOG = Technical (for devs)
- UNRELEASED/Patch Notes = User-friendly (for users)
- Explain WHY not just WHAT
- Keep chronological (newest first)
- One entry per feature per day (consolidate tweaks)
- Don't commit unless explicitly asked
- Never amend commits unless explicitly asked
