# Unreleased Changes

**Version:** TBD  
**Release Date:** TBD

---

## 2026-02-12

### New
- **Universal Add Modal**: Log anything instantly (spending, income, or debt payments) in one place.
  - Large, clear amount input so you don't misread zeros.
  - Category icons help you pick the right bucket in less than a second.
- **Zones & Transfers**: Track where your money is kept (Bank, Cash, etc.).
  - Move money between zones without it counting as "spent" (internal transfers).
  - Live balances with clear + / - signs and color coding (Green for asset, Red for liability).
- **Hero Quest Card**: Your main goal is now the focal point of the dashboard.
  - Features a large progress ring and descriptive status updates on your recovery.
- **Slim Sidebar**: More space for your data, less space for the navigation menu.
- **Obligation Planning Modal**: A single, structured planning flow per obligation.
  - Summary strip shows the obligation and remaining balance at a glance.
  - Plan Type tabs (One-time / Monthly / Split) keep the flow focused.
  - AI Copilot input is visible for future natural-language planning (coming soon).

### Enhanced
- **Live Zones**: The ZONES card now reflects your actual transaction history in real-time.
- **Onboarding Feedback**: You'll see your "Total Obligations" update live on Screen 3, helping you verify your data before moving on.
- **Currency Inputs**: Amount fields now match onboarding’s VND prefix style with live comma formatting.

### Adjusted
- **Dashboard Layout**: Columns are now balanced (25% / 50% / 25%) to prioritize the middle core section.
- **Visual Cleanup**: Removed card shadows to keep the interface flat and modern.
- **Due Soon Window**: Upcoming obligations now show for the next month (7 days → 30 days).

### Fixed
- **Reset System**: Added a one-click button in the sidebar footer to wipe all data and start fresh if needed.
- **Planning Flow Stability**: Confirming a plan no longer drops you into a blank/error state.

---

## 2026-02-10


### Enhanced
- Onboarding modal layout is now square (760x680 → 680x680) so each step feels more balanced.
- Typography scale is larger (titles 28px → 32px, inputs 22px → 28px) for quicker scanning.
- Debt entry is denser with a single obligations card and inline add button, so you can compare entries faster.
- VND amounts now format with commas as you type to prevent misreading large numbers.

### Adjusted
- Priority colors now use red/yellow/green so urgency is easier to spot at a glance.
- Core documentation files now use Cadencio names to match the product identity.

### Fixed
- Toggle switches now align cleanly when toggled; the thumb no longer looks offset.
- Quest meta spacing now separates labels and values for clearer readability.
- Step 5 modal expansion keeps footer buttons anchored to their usual position.

### Adjusted
- Quest tier icons now use consistent Lucide SVGs that match the Cadencio theme.

## 2026-02-09

### New
- Clean Vite + React + TypeScript + Tailwind scaffold
- ESLint baseline for the rebuild
