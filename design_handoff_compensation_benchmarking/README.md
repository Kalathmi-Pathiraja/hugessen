# Handoff: Compensation Benchmarking — Screen Redesign

## Overview
A redesign of the "Compensation Benchmarking" screen (under a tool the client calls "Incentive Plan Design" today) inside an internal Hugessen Consulting analyst tool. The goal was to move the screen away from a generic/"AI-generated" look — bright orange filled buttons everywhere, no hierarchy, default chart styling — toward a calm, professional financial-tool aesthetic, using Hugessen's real brand system (navy/orange/gray, Calibri).

## About the Design Files
The files in `design/` are **design references built in HTML**, not production code. They were authored in a prototyping tool with its own custom runtime (`support.js`, a `<x-dc>` component wrapper) — this is NOT a framework to adopt. Your job is to **recreate this screen inside the platform's real, existing codebase** (whatever framework/stack it already uses — React, Vue, Angular, etc.), using its existing component library, state management, and API/data layer. Treat the HTML/CSS here purely as a visual and structural spec — exact colors, spacing, type, and layout — not as code to paste in.

You can open `design/Compensation Benchmarking.dc.html` directly in a browser to see it live and inspect computed styles via devtools if useful.

## Fidelity
**High-fidelity.** Colors, type, spacing, and component states below are final — implement them pixel-accurately using the target codebase's existing UI primitives (buttons, inputs, tables, etc.) where they already exist; only introduce new one-off styles for things with no existing equivalent (e.g. the segmented role dropdown, the hanging-bar chart).

One caveat: all chart data (peer companies, dollar values, regression points) is **placeholder/sample data** — wire the real API/data source in.

## Screens / Views

### Compensation Benchmarking (single screen)
**Purpose:** Lets an analyst pick a role + peer group, a fiscal year, and pay/size metrics, then reviews three types of benchmarking analysis (Hanging Bar Charts / Size-Adjusted Analysis / YoY Trend) and adjusts peer weighting for the regression.

**Overall layout:** Two-column app shell.
- Left: fixed sidebar, `236px` wide, white background, `1px solid #C7C9C8` right border.
- Right: main content area, flexible width, `36px 44px 60px` padding, background `#F2F2F2` (page background).
- Whole app min-height `100vh`.

---

### 1. Sidebar
- **Logo block** (top, `24px 22px 20px` padding, `1px solid #DFE1DF` bottom border): wordmark "HUGESSEN" — 16px, weight 700, Calibri Light stack, color navy `#002957`. Below it, "Advisory Platform" — 10px, uppercase, 0.08em letter-spacing, color `#8A8D93`.
- **Nav sections**, each with a `10px` uppercase muted-gray (`#8A8D93`) section label, `600` weight, `0.08em` tracking:
  - **Workspace** — plain nav rows ("Dashboard", "Peer Groups"), 13px/500, `#5F6269`-ish text (`--fg-2`), 4px radius, hover background `#F2F2F2`.
  - **Tools** — this screen's group. Contains "STIP", "LTIP", "Compensation Benchmarking". The active item ("Compensation Benchmarking") is bold (700), navy text, `#F2F2F2` background, and has a **3px solid orange left border** — this accent border is reserved for the active/selected nav item only.
  - **Analysis** — plain nav rows ("Reports", "Settings"), same style as Workspace.
- **User footer** (bottom, `14px 16px` padding, `1px solid #DFE1DF` top border): 28px circular navy avatar with white initials, name (12px/600) + role label (11px, muted) beside it.

### 2. Header row
- Breadcrumb link "← Back to Verification" — 12.5px, muted gray, no underline, hover → navy.
- Eyebrow "TOOLS" — 11px uppercase, 0.16em tracking, orange (`.eyebrow` class from the design system).
- Page title "Compensation Benchmarking" — `h1`, 30px, Calibri Light, navy.
- Right-aligned "↓ Export Analysis" button — secondary/outline style: white background, `1.5px solid #C7C9C8` border, 2px radius, 12.5px/600 text, hover → navy border + navy text.

### 3. Filter bar
White card, `1px solid #C7C9C8` border, 2px radius, `14px 18px` padding.
- **Role — single combined dropdown** (this replaces what were two separate "Role" and "Peer Group" pill rows in an earlier draft; the client confirmed these are really **one selection group**, not two).
  - Trigger: white box, `1px solid #C7C9C8` border, 4px radius, `8px 12px` padding, min-width 190px, showing the current value in 12.5px/600 navy text plus a small caret (rotates 180° when open).
  - Menu: absolute-positioned panel below the trigger, white, `1px solid #C7C9C8` border, 4px radius, drop shadow (`0 4px 14px rgba(0,41,87,0.10), 0 1px 3px rgba(0,41,87,0.08)`), max-height 320px scrollable.
  - **Full option list (flat, one list, in this order):** 2nd Highest, CEO, CFO, COO, Legal, NEO1, NEO2, NEO3, NEO4, Region, Tech.
  - Selected row: bold navy text on `#F2F2F2` background. Others: 500 weight, default text color, hover → `#F2F2F2` background.
  - Single-select; clicking an option sets the value and closes the menu.
- **Fiscal Year** — segmented control, right-aligned. Track: `#F2F2F2` background, `3px` padding, 4px radius. Options 2023/2024/2025, each pill `6px 14px`, 12.5px/600. Selected pill: solid navy background, white text. Unselected: transparent, muted gray text.

### 4. Sub-tabs
Underline tab row below the filter bar, `1px solid #C7C9C8` bottom border, 28px gap between tabs.
- Tabs: "Hanging Bar Charts", "Size-Adjusted Analysis", "YoY Trend".
- Active tab: 14px/600 navy text, `2.5px solid` **orange** bottom border (this is the one deliberate accent use of orange as an active-state indicator in the whole screen, besides chart highlight markers and the Export/Apply CTAs).
- Inactive tab: 14px/600, muted gray text, transparent border.
- **Note:** in this reference, changing the sub-tab does not currently swap the chart content below (there's a single fixed layout representing the "Size-Adjusted Analysis" tab). In the real implementation, each tab should render its own analysis view — "Hanging Bar Charts" and "YoY Trend" need their own chart content built out; only "Size-Adjusted Analysis" is fully speced here.

### 5. Metric selector row
Two side-by-side groups, `40px` gap:
- **Size Metric**: Market Cap / Total Enterprise Value / Revenue / Total Assets.
- **Regression Pay Metric**: Base Salary / Total Cash (TCC) / Total Direct Comp (TDC) / Total Comp.

Each is a row of individually-bordered pills (not a segmented track like the Role/Year controls): `1px solid #C7C9C8` border, white background, 2px radius, `7px 14px` padding, 12.5px/600 text. Selected pill: solid navy fill, white text, navy border. This is a deliberately different visual weight from the Role/Year segmented controls — it signals "secondary/refinement" filters rather than the primary selection.

### 6. Charts row
Two-column grid, `1.3fr / 1fr`, `20px` gap. Both are white cards, `1px solid #C7C9C8` border, 2px radius, `22px 24px 20px` padding.

**Card A — "Pay vs. Size Regression" (scatter plot)**
- Header: `h3` title (20px/600 navy) + "n = 12 peers" meta label (11.5px, muted, Calibri Light numeral style) right-aligned.
- Chart: SVG scatter plot, x-axis = size metric ($3.8B–$19.0B, sample), y-axis = pay metric ($0–$4.0M, sample), light dashed gridlines (`#DFE1DF`), solid axis lines (`#C7C9C8`), a dashed **navy** trend/regression line, gray-slate circular dots for peer companies (`opacity:0.75`), and **one orange rotated-square ("diamond") marker** for the selected/client company — orange is used only for this single highlighted point.
- Footer row below the chart, above a `1px solid #DFE1DF` divider: "Model fit: R² = 0.26" + a small legend swatch/label for "Selected company".

**Card B — "Size-Adjusted Positioning" (hanging bar chart)**
- Small legend row above the chart: three swatches — navy square "P50–P75", slate square "P25–P50", orange diamond "Client".
- Subtitle: "Total Cash (TCC)" (12.5px, muted).
- Chart: SVG **hanging (floating) bar** — a single vertical two-tone bar anchored to a value axis (not the ground): the lower segment (P25→P50) is **slate** `#464B54`, the upper segment (P50→P75) is **navy** `#002957`. An **orange rotated-square marker** sits at the client's actual value within/near the bar, labeled "Client · 40th pct." in orange, Calibri Light numerals. Y-axis gridlines/labels ($0, $1.0M, $2.0M) dashed and muted, matching Card A's style. X-axis label below: "Total Cash (TCC)".
- Stat row below the chart, 3 equal columns, divided by `1px solid #DFE1DF` vertical rules, centered text: P25 value, P50 value (bold, navy — this is the emphasized "median" column), P75 value. Labels are the `.stat-label` uppercase/tracked style; values are 16px, Calibri Light.
- Footnote below: "Size-adjusted view — peer weights applied below." (11px, muted, italic-free).

### 7. Peer Weights table
Full-width white card, same border/radius treatment, `22px 24px 8px` padding.
- Header row: `h3` "Peer Weights" title, plus two right-aligned buttons:
  - **"Reset to Suggested"** — outline/secondary button (white, `1.5px solid #C7C9C8`, hover → navy border+text).
  - **"Apply Weights"** — **primary CTA, solid orange fill** (`#F0531E`, hover `#EA3C18`), white text. This is the **only solid-orange button on the screen** — orange fill is reserved for this single primary confirming action.
- Table: navy (`#002957`) header row, white uppercase 11px/600 column labels with 0.06em tracking (Company / Pay Value / Size Value / Suggested Wt. / Applied Wt.), `10px 12px` cell padding.
- Body rows: alternating white / `#FAFAFA` stripe, `1px solid #DFE1DF` row dividers, 12.5px text. Numeric columns (Pay Value, Size Value, Suggested Wt.) are right-aligned and set in **Calibri Light** (the "numbers font" — see Design Tokens below), not the body sans.
- **Applied Wt.** column is **editable**: each cell is a bordered text input (`1px solid #C7C9C8`, 2px radius, `5px 8px` padding, 64px wide, right-aligned, Calibri Light, bold navy text) that the analyst can type directly into.
- Footnote below the table (11px, muted, italic): "Applied weights determine the size-adjusted regression above. Weights are re-normalized to sum to 1.0 on apply."

## Interactions & Behavior
- **Role dropdown**: click trigger to open/close; click any option to select it and close the menu (single-select, replaces the old two-row Role + Peer Group pills). No animation needed beyond an instant open/close (brand motion guidance is "minimal" — simple fades only, no bounce/spring).
- **Fiscal Year segmented control**: click to select; single-select, immediate.
- **Sub-tabs**: click to switch active tab (only visual state is wired in this reference — real content-per-tab needs to be implemented).
- **Size Metric / Regression Pay Metric pills**: click to select; single-select each, immediate.
- **Peer Weights table — Applied Wt. inputs**: freely editable text inputs, one per row.
- **Reset to Suggested**: resets all Applied Wt. values back to each row's Suggested Wt. value.
- **Apply Weights**: primary action — in this reference it's a no-op button; in production it should re-run the size-adjusted regression using the current Applied Wt. values (and, per the footnote, re-normalize weights to sum to 1.0).
- **Hover states**: outline buttons → navy border + navy text; primary orange button → deepens to `#EA3C18`; sidebar nav rows → light gray background; dropdown menu rows → light gray background. No scale/transform on any hover or press (flat, "dignified" brand motion).

## State Management
Suggested state shape for this screen:
- `role: string` — one of the 11 flat options (2nd Highest, CEO, CFO, COO, Legal, NEO1–4, Region, Tech)
- `roleMenuOpen: boolean`
- `fiscalYear: '2023' | '2024' | '2025'`
- `activeTab: 'Hanging Bar Charts' | 'Size-Adjusted Analysis' | 'YoY Trend'`
- `sizeMetric: 'Market Cap' | 'Total Enterprise Value' | 'Revenue' | 'Total Assets'`
- `regressionMetric: 'Base Salary' | 'Total Cash (TCC)' | 'Total Direct Comp (TDC)' | 'Total Comp'`
- `peerWeights: { [companyId]: { pay, size, suggestedWeight, appliedWeight } }` — `appliedWeight` is user-editable; changing `role`/`fiscalYear`/metrics should trigger a data refetch and probably reset weights to the new suggested defaults.

Data needed from the backend: the peer company list (name, pay value, size value, suggested weight) for the current role/year/metric combination; the regression scatter points + trend line; and the P25/P50/P75 + client-value distribution for the hanging bar chart.

## Design Tokens

**Colors**
| Token | Hex | Usage |
|---|---|---|
| Hugessen Orange | `#F0531E` | Primary/CTA accent — used ONLY for: active sub-tab underline, chart highlight markers (diamond), sidebar active-item left border, "Apply Weights" button, eyebrow text |
| Orange Deep | `#EA3C18` | Hover/pressed state for orange elements |
| Hugessen Navy | `#002957` | Headings, selected segmented-control fill, table header row, primary structural color |
| Navy Deep | `#011D45` | Reserved for deeper layered navy surfaces (not heavily used on this screen) |
| Slate | `#464B54` | Secondary chart color (P25–P50 bar segment, scatter dots) |
| Charcoal | `#5F6269` | Default body text |
| Ink | `#32363D` | Headline text on white |
| Gray-300 | `#C7C9C8` | All hairline borders |
| Gray-200 | `#DFE1DF` | Divider rules, table stripe, soft dashed gridlines |
| Gray-100 | `#F2F2F2` | Page background, segmented-control track background, hover backgrounds |
| White | `#FFFFFF` | Card/surface background |

**Typography**
- Body/UI text family: Calibri → falls back to Open Sans, Segoe UI, system-ui.
- **Numerals/data family ("Calibri Light")**: used for ALL numeric values — axis labels, stat callouts ($1.9M etc.), table numeric columns, weight inputs, chart annotation text. Falls back to Calibri → Open Sans.
- Headings (h1/h2): Calibri Light weight 300.
- Scale used on this screen: 30px (h1 title) · 20px (h3 card titles) · 16px (stat values) · 14px (sub-tab labels) · 13px (sidebar nav) · 12.5px (body/pills/buttons) · 11–11.5px (eyebrows, table headers, meta text) · 10–10.5px (chart axis labels, section micro-labels).
- Eyebrow style: 11px, uppercase, 600 weight, 0.16em letter-spacing, orange.

**Spacing / Radius**
- Card padding: `22px 24px 20px` (or `22px 24px 8px` for the table card).
- Card border radius: `2px`. Buttons: `2px`. Segmented-control track: `4px`, dropdown: `4px`. This is a hard-edged, minimal-radius brand — never use large rounded corners or pill shapes.
- Card/section gaps: `20px` between major blocks, `40px` between metric-selector groups.

**Shadows**
- Card elevation: none (flat, bordered only).
- Dropdown/menu popover: `0 4px 14px rgba(0,41,87,0.10), 0 1px 3px rgba(0,41,87,0.08)`.
- Segmented-control selected pill: `0 1px 2px rgba(50,54,61,0.06), 0 2px 6px rgba(50,54,61,0.06)`.

## Assets
No image/icon assets are used — all chart visuals are inline SVG (scatter plot, hanging bar chart) built with the color tokens above; the sidebar avatar is initials-in-a-circle, not a photo. If your codebase has a Lucide icon set already wired (per the design system's iconography section), workspace/analysis nav rows can use solid navy/orange Lucide glyphs instead of the placeholder unicode glyphs used in the reference file.

## Files
- `design/Compensation Benchmarking.dc.html` — the full reference screen (open directly in a browser).
- `design/support.js` — runtime the reference file depends on to render; irrelevant to your implementation, keep it alongside the html file only if you want to view the reference.
- `design/_ds/hugessen-design-system-.../colors_and_type.css` — the full CSS custom-property token file (all hex values, type scale, spacing scale, radii, shadow values referenced above) — a good one-to-one source for translating tokens into your codebase's theme/tokens file.
