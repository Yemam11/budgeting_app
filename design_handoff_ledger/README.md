# Handoff: Ledger — Budgeting App UI Redesign

## Overview
This is a high-fidelity UI redesign for an existing local-first personal budgeting app built in React + Vite + Dexie (IndexedDB). The design covers all six core screens: Dashboard, Transactions, Budgets, Import, Owed to You, and Settings.

## About the Design Files
The files in this bundle are **HTML design prototypes** — not production code. They use mock data and inline React/Babel. Your task is to **recreate these designs inside the existing app's codebase** (`app/src/`) using its established React + Tailwind + Recharts + Dexie patterns. Replace mock data with the real Dexie live queries already in the codebase. Use the design tokens and component specs in this README as the source of truth.

## Fidelity
**High-fidelity.** Colors, typography, spacing, shadows, and interactions are all final. Recreate pixel-accurately. The glass card system, hero band, and sidebar are the most important visual elements to get right.

---

## Design System

### Typography
| Role | Font | Weight | Size | Letter-spacing |
|------|------|--------|------|----------------|
| Page title | Geist | 600 | 26px | -0.02em |
| Section title / card head | Geist | 500 | 14px | normal |
| Body | Geist | 400 | 14px / 13px | normal |
| Eyebrow label | Geist | 600 | 10px | 0.14em uppercase |
| Figures / amounts | Geist Mono | 500 | varies | -0.02em to -0.03em |
| Hero figure | Geist Mono | 500 | 44px | -0.03em |
| Table headers | Geist | 500 | 11px | 0.08em uppercase |
| Table cells | Geist | 400 | 13px | normal |
| Confidence % | Geist Mono | 400 | 10px | normal |

Load from Google Fonts:
```
https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap
```

### Color Tokens

#### Light Theme
```css
--bg:           oklch(98% 0.004 80)       /* warm off-white canvas */
--bg-2:         oklch(96% 0.006 80)
--ink:          oklch(18% 0.012 260)      /* near-black */
--ink-2:        oklch(28% 0.015 260)
--ink-soft:     oklch(45% 0.012 260)
--ink-mute:     oklch(62% 0.01 260)
--line:         oklch(92% 0.006 260)      /* dividers */
--line-strong:  oklch(86% 0.008 260)

--accent:       oklch(78% 0.16 165)       /* electric mint */
--accent-ink:   oklch(30% 0.08 165)
--accent-soft:  oklch(94% 0.05 165)

--danger:       oklch(65% 0.18 25)        /* red-orange */
--danger-soft:  oklch(95% 0.04 25)
--warn:         oklch(78% 0.12 75)        /* amber */

--glass-bg:     color-mix(in oklab, white 70%, transparent)
--glass-border: color-mix(in oklab, white 60%, transparent)
```

#### Dark Theme
```css
--bg:           oklch(14% 0.012 260)
--ink:          oklch(96% 0.005 260)
--ink-2:        oklch(88% 0.008 260)
--ink-soft:     oklch(70% 0.01 260)
--ink-mute:     oklch(55% 0.012 260)
--line:         oklch(100% 0 0 / 0.08)
--line-strong:  oklch(100% 0 0 / 0.15)
--glass-bg:     color-mix(in oklab, oklch(30% 0.02 260) 50%, transparent)
--glass-border: oklch(100% 0 0 / 0.1)
--accent-soft:  oklch(30% 0.08 165 / 0.3)
--accent-ink:   oklch(85% 0.12 165)
```

### Spacing
| Token | Value |
|-------|-------|
| Card padding | 20px |
| Hero padding | 28px 32px |
| Sidebar padding | 20px 14px |
| Row gap (major) | 20px |
| Row gap (minor) | 16px |
| Table cell padding | 12px 16px |
| Table header padding | 10px 16px |

### Border Radius
```
--r-sm: 8px
--r-md: 12px   (chips, tags)
--r-lg: 18px   (glass cards)
--r-xl: 24px   (hero band)
```

### Shadows
```css
--shadow-sm: 0 1px 2px rgba(15,20,35,0.04), 0 1px 1px rgba(15,20,35,0.02);
--shadow-md: 0 6px 20px -8px rgba(15,20,35,0.12), 0 2px 6px -2px rgba(15,20,35,0.06);
--shadow-lg: 0 24px 48px -24px rgba(15,20,35,0.18), 0 8px 16px -8px rgba(15,20,35,0.08);
```

### Glass Card System
This is the primary card component — used for every content panel except the hero.
```css
background: var(--glass-bg);
backdrop-filter: blur(18px) saturate(140%);
-webkit-backdrop-filter: blur(18px) saturate(140%);
border: 1px solid var(--glass-border);
border-radius: 18px;
box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.6);
```

### Ambient Aurora Background
Fixed behind all content. Three radial gradients + subtle grid:
```css
/* Gradient layer */
background:
  radial-gradient(900px 600px at 88% -10%, oklch(85% 0.12 165 / 0.35), transparent 60%),
  radial-gradient(700px 500px at 105% 45%, oklch(80% 0.12 300 / 0.20), transparent 60%),
  radial-gradient(600px 400px at -10% 90%, oklch(85% 0.08 220 / 0.18), transparent 60%);

/* Grid overlay (::after pseudo) */
background-image:
  linear-gradient(to right, oklch(50% 0.01 260 / 0.035) 1px, transparent 1px),
  linear-gradient(to bottom, oklch(50% 0.01 260 / 0.035) 1px, transparent 1px);
background-size: 48px 48px;
mask-image: radial-gradient(ellipse at 50% 40%, black 30%, transparent 80%);
```

---

## Components

### Sidebar / Shell
- Width: **240px**, fixed left
- Background: `color-mix(in oklab, white 45%, transparent)` + `backdrop-filter: blur(12px)`
- Right border: `1px solid var(--line)`
- Contains: Brand logo, ⌘K search, nav items, account footer
- **Brand mark**: 30×30px, border-radius 9px, dark graphite gradient, rotated diamond accent in mint
- **Nav items**: 40px tall, 10px radius, icon (15px) + label + optional badge + active dot
  - Active state: `background: color-mix(in oklab, white 80%, transparent)` + `border: 1px solid var(--line)` + mint dot
  - Hover: `background: color-mix(in oklab, white 50%, transparent)`
- **Account footer**: avatar (32×32, gradient circle, initials) + name/subtitle + overflow icon

### Hero Band (Dashboard only)
```css
background: linear-gradient(135deg, oklch(20% 0.015 260), oklch(15% 0.02 260));
border-radius: 22px;
padding: 28px 32px;
color: white;
border: 1px solid oklch(30% 0.02 260);
box-shadow: 0 20px 40px -20px oklch(15% 0.05 260 / 0.5), inset 0 1px 0 oklch(100% 0 0 / 0.08);
```
Geometric engraving pattern overlay (::before):
```css
background-image:
  linear-gradient(135deg, oklch(100% 0 0 / 0.06) 0 1px, transparent 1px 12px),
  linear-gradient(45deg, oklch(100% 0 0 / 0.04) 0 1px, transparent 1px 14px);
mask-image: radial-gradient(ellipse at 85% 50%, black 0%, transparent 70%);
```
Content: Net figure (44px mono, -0.03em), delta badge, money-in / money-out sub-stats, action buttons.

### Buttons
```css
/* Primary */
background: var(--accent);
color: oklch(18% 0.03 165);
border: 1px solid color-mix(in oklab, var(--accent), black 15%);
box-shadow: inset 0 1px 0 oklch(100% 0 0 / 0.4), 0 2px 6px -2px oklch(50% 0.16 165 / 0.4);
border-radius: 10px; padding: 7px 12px; font-size: 13px; font-weight: 500;

/* Ghost */
background: color-mix(in oklab, white 40%, transparent);
border: 1px solid var(--line-strong);
border-radius: 10px; padding: 7px 12px; font-size: 13px; font-weight: 500;
```

### Chip / Badge
```css
display: inline-flex; align-items: center; gap: 6px;
padding: 3px 8px; border-radius: 999px;
font-size: 11px; font-weight: 500;
background: color-mix(in oklab, white 50%, transparent);
border: 1px solid var(--line);
```
Variants: `chip-accent` (mint bg), `chip-danger` (red bg).

### Category Badge (inline in tables)
Use category's color to derive chip:
```css
background: color-mix(in oklab, {cat.color}, transparent 86%);
border-color: color-mix(in oklab, {cat.color}, transparent 70%);
color: color-mix(in oklab, {cat.color}, black 20%);
```

### Confidence Bar
```
Width: ~80px; 4px tall track; rounded ends.
Track: oklch(50% 0.01 260 / 0.12)
Fill: green ≥90%, amber ≥70%, red <70%
Right label: 10px mono, var(--ink-mute)
```

### Progress Ring (Budget burndown)
SVG circle; outer track at 10% opacity; fill uses category color or danger if over.

### Delta Badge
```
Up arrow + percentage, green: oklch(55% 0.14 160)
Down arrow + percentage, red: oklch(58% 0.18 25)
Font: 12px Geist Mono, weight 500
```

### Table System
```css
/* Header row */
background: color-mix(in oklab, white 40%, transparent);
font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
color: var(--ink-mute); padding: 10px 16px;
border-bottom: 1px solid var(--line);

/* Body rows */
padding: 12px 16px; border-bottom: 1px solid var(--line);
Hover: background: color-mix(in oklab, white 40%, transparent);
```

### Segmented Control
Used for time period toggles (Weekly/Daily/Monthly):
```css
Container: background: oklch(50% 0.01 260 / 0.08); border-radius: 10px; padding: 3px;
Active segment: background: white; border-radius: 7px; box-shadow: var(--shadow-sm);
```

---

## Screens

### 1. Dashboard
**Layout:** Vertical stack, gap 20px.
1. **Header row** — Page greeting (left) + action buttons (right): Date range pill, Export ghost, Import primary
2. **Hero band** — Full-width dark card. Net figure large-left, money-in/out sub-stats center, action buttons right
3. **Row: Cash flow (60%) + Category donut (40%)** — Two glass cards side by side
   - Cash flow: SVG grouped bar chart (income=mint, spend=dark), weekly granularity, 12 weeks
   - Donut: 160px SVG donut (innerRadius 80px, thickness 18px), legend with 5 top categories
4. **Sankey / Money flow** — Full-width glass card. Income sources left, spending destinations right, flow paths as SVG paths with `opacity: 0.35–0.4`
5. **Row: Spend trend (58%) + Budget burn-down (42%)** — Two glass cards
   - Spend trend: Stacked bar chart, 6 months, 6 categories
   - Budget burn-down: Progress ring (40px) per category + bar + amounts
6. **Recent activity** — Full-width glass table, 6 most recent transactions

### 2. Transactions
**Layout:** Vertical stack, gap 16px.
1. Header + stats strip (4 glass cards in a row): Spend, Income, Needs review, Outstanding
2. Toolbar: Search input (280px) + segmented filter tabs (All / Needs review / Spend / Income / Transfer / CC payment) + More filters + Sort
3. Full-width glass table: Checkbox, Date, Bank logo, Merchant (+ split/notes sub-rows), Type tag, Category chip with dropdown chevron, Confidence bar, Amount, ⋯ menu
4. Pagination footer

Key columns:
- **Bank logo**: 20×20 pill-shaped colored logo tile (AX/BM/SC)
- **Needs-review** flag: small amber chip next to merchant name
- **Split indicator**: Icon + "Split N ways · $X.XX mine" in amber-toned 11px
- **Type tag**: monospaced 11px pill with grey background
- Amount: green for income, default for spend

### 3. Budgets
**Layout:** Vertical stack, gap 16px.
1. Header + month selector
2. Hero summary: 4-column glass card — Spent, Remaining, Pace (vs expected for day-of-month), Overall progress bar with expected-pace marker
3. Full-width glass table: Category (swatch + name), Spent, Monthly limit (editable inline input or "Set limit" dashed button), Progress bar (with day-of-month pace marker at 77% of bar width), Remaining, Pace delta badge
4. Status summary: chips in card header ("9 on track", "1 at risk", "1 over")

### 4. Import
**Layout:** Vertical stack, gap 20px.
1. Header with description
2. Dropzone: dashed border using accent, mint icon tile, "Drop CSV files" CTA
3. Supported banks: 3-column glass cards (bank logo + name + hint + Ready chip)
4. Recent imports table: Bank logo, filename (mono), row count, timestamp, status chip, overflow menu

### 5. Owed to You
**Layout:** Vertical stack, gap 16px.
1. Header
2. Summary glass card: Total outstanding amount + "by person" grid (person avatar tile + name + amount)
3. Proposals alert card (amber-tinted background): Each proposed settlement with "Not a match" / "Confirm settled" buttons
4. Outstanding table: Person, Originated from (merchant), Date, Amount, Mark paid action

### 6. Settings
**Layout:** Vertical stack, max-width 820px, gap 16px.
1. Header
2. **Categorization** glass card: Confidence threshold slider, toggle for merchant propagation, toggle for split exclusion
3. **Data & privacy** glass card: Local-only status banner (mint-tinted) + Export/Restore/Clear buttons
4. **Categories** glass card: Colored chip grid of all categories + "New category" dashed chip

---

## Interactions & Behavior

### Navigation
- Sidebar is always visible; clicking a nav item swaps the main content area
- Active item shows a mint dot + white background
- Badge on "Owed to you" shows count of outstanding entries

### Transactions — Category dropdown
- Clicking a category chip opens a dropdown to re-assign
- On change: show confirmation modal asking "Apply to this transaction" vs "Apply to all from {merchant}" (propagate)
- On propagate: show flash toast "Updated N transactions"

### Budget table — Inline limit editing
- Monthly limit cell shows an input on click (number type, step 10)
- On blur: save via `db.budgets.put(...)` or delete if empty/zero

### Confidence threshold (Settings)
- Range slider 0–100%, step 5
- Live preview: transactions below threshold get the amber "review" chip in the transactions table

### Theme toggle
- CSS custom property swap on `<html>` or a wrapping `div`
- Persist to `localStorage('theme')`

### Filtering (Transactions)
- Segment filter + search are AND-combined
- "Needs review": type=spend AND categorySource !== 'user' AND confidence < threshold

---

## Design Tokens for Tailwind
If you're using Tailwind, add these to `tailwind.config.js`:
```js
theme: {
  extend: {
    fontFamily: {
      sans: ['Geist', 'ui-sans-serif', 'system-ui'],
      mono: ['Geist Mono', 'ui-monospace', 'Menlo'],
    },
    borderRadius: {
      'card': '18px',
      'hero': '22px',
      'btn': '10px',
    },
    backdropBlur: {
      'glass': '18px',
    },
  }
}
```

---

## Charts

All charts are custom SVG — do not use Recharts for these (it was producing ugly output per the README). Implement as lightweight SVG components:

| Chart | Used on | Notes |
|-------|---------|-------|
| Grouped bar (cashflow) | Dashboard | income=mint bars, spend=dark bars, side by side per period |
| Donut | Dashboard | SVG arc paths, no library needed |
| Stacked bar | Dashboard | Category-colored segments per month |
| Sankey | Dashboard | Bezier path ribbons, income left → hub → categories right |
| Progress ring | Dashboard (budgets) | SVG circle stroke-dasharray |
| Horizontal bar | Budgets table | Simple div bar, with pace-marker line |

---

## Assets
- **Icons**: Custom SVG paths (24×24 viewBox, stroke-based). See `src/primitives.jsx` for the full icon set: dashboard, transactions, budget, import, owed, settings, search, plus, filter, sort, arrow_up_right, arrow_down_right, more, check, x, calendar, download, upload, sparkle, split, chevron_down, shield, lock, bank, file.
- **Bank logos**: Programmatic colored tiles (AX/BM/SC initials). No image files needed.
- **Fonts**: Google Fonts (Geist + Geist Mono)

---

## Files in This Package
| File | Purpose |
|------|---------|
| `index.html` | Entry point — loads all scripts, defines CSS variables |
| `src/data.jsx` | Mock data (replace with real Dexie queries) |
| `src/primitives.jsx` | Icon, BankLogo, CatSwatch, Delta, ConfBar components |
| `src/charts.jsx` | CashflowBars, Donut, StackedBars, AreaSpark, ProgressRing, Sankey |
| `src/dashboard.jsx` | Dashboard page |
| `src/transactions.jsx` | Transactions page |
| `src/budgets.jsx` | Budgets page |
| `src/other-pages.jsx` | Import, Outstanding, Settings pages |
| `src/shell.jsx` | App shell (sidebar + main layout) |
| `src/app.jsx` | Root — mounts all pages in design canvas |
| `src/design-canvas.jsx` | Design canvas viewer (remove in production) |

---

## Implementation Notes for Claude Code

1. **Keep the existing Dexie schema** — `db.transactions`, `db.categories`, `db.budgets`, `db.outstanding`, `db.importBatches` are already correct. Just replace mock data calls with `useLiveQuery` hooks.

2. **Replace Recharts with custom SVG charts** — the existing Recharts usage in `Dashboard.tsx` and `Budgets.tsx` should be swapped for the SVG chart components in `src/charts.jsx`. Recharts' styling is difficult to match to this design.

3. **CSS approach** — The existing Tailwind setup can be kept, but you'll need to add the custom CSS variables (design tokens above) to `index.css`. The glass card system is easier as a CSS class than Tailwind utilities.

4. **Remove the design canvas** (`src/design-canvas.jsx`, `DCSection`, `DCArtboard`, `DesignCanvas`) — in production the app renders a single `<Shell>` with a tab/router, not a canvas.

5. **Dark mode** — Implement as a CSS variable swap. Add a `data-theme="dark"` attribute on `<html>` and define the dark token overrides in a `[data-theme="dark"]` selector block. Persist to localStorage.

6. **Confidence threshold** — Add this as an `AppSetting` in the existing settings table. Read it in the transactions filter logic.
