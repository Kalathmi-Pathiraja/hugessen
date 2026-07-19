**COMPENSATION BENCHMARKING MODULE**

Design & Build Specification

Hugessen Incentive Design Platform  ·  Internal Use Only

# **1\. Platform Context & Module Overview**

The Incentive Design Platform is a locally-hosted React \+ FastAPI application used by Hugessen Consulting analysts to run compensation scenario analysis. It currently contains two working modules — the STIP Designer and the LTIP Engine — both of which share a FastAPI backend that handles computation and Excel parsing via Python.

The Compensation Benchmarking module is a third module added to this same platform. It introduces a new upload flow, new backend parsing and computation routes, and a new frontend section that follows the same visual language (navy, orange, gray, black) and component patterns as the existing STIP and LTIP modules.

This spec is written as a developer brief for Claude Code. Claude Code should treat every decision described here as a hard requirement and should not introduce architectural patterns that deviate from the existing codebase without flagging it first.

## **1.1 Module Goals**

* Automatically parse the Hugessen benchmarked Excel (Raw Data tab) server-side and return structured compensation data per role, per company, per year.

* Render a data verification table so analysts can confirm the data has been read correctly before doing any analysis.

* Render hanging bar charts (Base / TCC / TDC, side by side) per role, exactly mirroring the TC Chart tab structure in the Excel.

* Layer a weighted regression model on top of the charts, where peer weights are suggested by size proximity to the client and can be manually overridden by the analyst.

* Export the currently selected role's chart data, peer weights, and weighted percentiles to an Excel file with embedded formulas for audit purposes.

## **1.2 Standalone vs. Integrated Usage**

The STIP and LTIP modules must continue to work without a benchmark upload. If no benchmarking data has been uploaded, those modules render with empty, manually editable input fields exactly as they do today. The shared benchmark data layer is additive, not a dependency.

If a benchmarking file HAS been uploaded and a role is selected, the platform may optionally pre-populate base salary and target STIP/LTIP percentages into the STIP and LTIP modules for that executive. This is a stretch goal — implement only after the core benchmarking module is complete.

**Architecture decision (confirmed):** the platform remains a single FastAPI backend process and a single React app — not a separate deployable service per module. Isolation between STIP, LTIP, and Benchmarking is enforced at the code-module level (no cross-imports between engines, routers, models, or components — see Section 10), which gives fault isolation for backend logic without the deployment/CORS overhead of multiple processes. The one isolation gap pure import-separation doesn't cover is a frontend runtime crash: a `BenchmarkingErrorBoundary` component (Section 7) wraps the Benchmarking tab in App.tsx so an unhandled error inside the benchmarking module renders a fallback instead of taking down the STIP/LTIP tabs.

# **2\. Existing Architecture (Do Not Modify Without Flagging)**

Claude Code must read and understand the existing file structure before writing any new code. The following is the confirmed structure. New files must follow the same naming conventions and folder placement.

| Path | Purpose |
| :---- | :---- |
| frontend/src/api/client.ts | All fetch calls to the FastAPI backend. New benchmarking API calls must be added here. |
| frontend/src/components/ltip/ | LTIP module components. Mirror this folder structure for benchmarking. |
| frontend/src/components/stip/ | STIP module components. Visual design reference — match this theme. |
| frontend/src/components/shared/ | Shared components used across modules. Add any reusable benchmarking components here. |
| frontend/src/types/ | TypeScript type definitions. Add BenchmarkingTypes.ts here. |
| frontend/src/constants/ | App-wide constants. Add benchmarking constants here if needed. |
| backend/engine/ltip\_engine.py | Black-Scholes \+ Monte Carlo. Reference for engine pattern. |
| backend/engine/stip\_engine.py | STIP Monte Carlo. Reference for engine pattern. |
| backend/excel/template.py | Excel template generation. Reference for export pattern. |
| backend/excel/export.py | Excel export logic. Reference for export pattern. |
| backend/routers/ltip.py | FastAPI routes for LTIP. Mirror this pattern for benchmarking router. |
| backend/models/ltip.py | Pydantic models for LTIP. Mirror this pattern for benchmarking models. |
| backend/main.py | FastAPI app entry point. Register the new benchmarking router here. |

# **3\. New Files to Create**

The following net-new files must be created. No existing files should be deleted or renamed. Existing files that require modification are listed in Section 4\.

| New File Path | Purpose |
| :---- | :---- |
| backend/engine/benchmarking\_engine.py | Percentile calculations, weighted least squares regression, peer weight suggestion logic. |
| backend/excel/benchmarking\_parser.py | Parses the Raw Data tab and Peer Group tab of the uploaded benchmarking Excel. Returns structured Pydantic model. |
| backend/excel/benchmarking\_export.py | Generates the audit Excel export for the selected role, with formulas and weighted percentile calculations. |
| backend/routers/benchmarking.py | FastAPI router. Registers all /api/v1/benchmarking/\* endpoints. |
| backend/models/benchmarking.py | All Pydantic request/response models for the benchmarking module. |
| frontend/src/components/benchmarking/ | Folder containing all React components for the benchmarking module. See Section 7 for component breakdown. |
| frontend/src/types/BenchmarkingTypes.ts | TypeScript interfaces for all benchmarking data structures. Must match Pydantic models exactly. |

## **3.1 Files to Modify (Existing)**

* backend/main.py — import and register the new benchmarking router under the prefix /api/v1/benchmarking

* frontend/src/api/client.ts — add all benchmarking fetch functions following the existing pattern

* frontend/src/App.tsx — add 'benchmarking' to the Tab union and render `<BenchmarkingErrorBoundary><BenchmarkingModule /></BenchmarkingErrorBoundary>` alongside StipPage/LtipPage, following the existing `tab === 'stip' ? <StipPage /> : ...` conditional pattern.

# **4\. Backend Specification**

## **4.1 Excel Parser  —  backend/excel/benchmarking\_parser.py**

This is the most critical backend file. It must parse the Hugessen benchmarked Excel file, which follows a specific structure. Claude Code must read the existing ingest\_price\_data() function in backend/engine/ltip\_engine.py to understand the parsing pattern before writing this file.

**4.1.1 Input**

* A single .xlsx file uploaded via multipart form POST.

* The parser reads TWO tabs from this file: the Raw Data tab and the Peer Group tab.

* Claude Code must NOT assume fixed column letter positions. Columns must be identified by their header names, since the template may vary slightly across engagements.

**4.1.2 Raw Data Tab — Columns to Extract**

The Raw Data tab contains one row per executive per company per year. The following named columns must be extracted. All column identification must be done by searching for the header string, not by hardcoded column index:

| Column Header (as in Excel) | Internal Field Name | Notes |
| :---- | :---- | :---- |
| Look-Up | lookup\_key | Primary key e.g. TSX:HBM\_2025\_CEO. Look-Up2 / Look-Up3 (sort/helper columns seen in some templates) are ignored. |
| Ticker | ticker | e.g. TSX:HBM |
| Company | company\_name | Full company name |
| Year | year | Integer fiscal year |
| Role Match, Role Match 2, Role Match 3, ... | (folded into role\_tags — see 4.1.4) | Dynamically detected. Not a fixed pair — see role\_tags resolution rule below. |
| Position Match | position\_match | e.g. CEO, CFO, NEO1, NEO2, NEO3. Also feeds role\_tags resolution — see 4.1.4. |
| Position Title | position\_title | Actual title as disclosed in proxy |
| Incumbent | incumbent\_name | Full name |
| Annualized / Converted (Base) | base\_salary | The column immediately following "Actual Paid". Do NOT match by header text alone — "Annualized / Converted" also appears verbatim after "Actual $" for STIP. Anchor by the preceding header. |
| Latest (if disclosed) \- Annualized / Converted | base\_salary\_next\_year | Forward salary if disclosed, else null |
| Actual $ (STIP) → Annualized/Converted | stip\_actual | The "Annualized/Converted" column immediately following "Actual $", not the one following "Actual Paid". |
| Target STI % | stip\_target\_pct | Target STIP as % of base |
| Target STI $ | stip\_target\_dollar | Target STIP in dollars |
| Actual TCC | actual\_tcc | Base \+ actual STIP |
| Target TCC | target\_tcc | Base \+ target STIP |
| RSUs | ltip\_rsu | RSU grant value |
| PSUs | ltip\_psu | PSU grant value |
| Stock Options | ltip\_options | Option grant value |
| DSUs | ltip\_dsu | DSU grant value |
| LT Cash | ltip\_cash | Long-term cash value |
| Total LTI $ | ltip\_total | Sum of all LTIP vehicles |
| Target LTI % | ltip\_target\_pct | Target LTIP as % of base |
| Target LTI $ | ltip\_target\_dollar | Target LTIP in dollars |
| Target (TDC) | target\_tdc | Base \+ target STIP \+ target LTIP |
| Actual (TDC) | actual\_tdc | Base \+ actual STIP \+ actual LTIP |
| Pension | pension | Raw pension value, as disclosed currency |
| DB or DC Pension? | pension\_type | "DB", "DC", or null |
| Pension Converted | pension\_converted | Pension in reporting currency |
| Pension 3 Year Average | pension\_3yr\_avg | Optional, null if not disclosed |
| Other | other | Raw "other comp" value |
| Other Converted | other\_converted | Other comp in reporting currency |
| Other 3 Year Average | other\_3yr\_avg | Optional, null if not disclosed |
| Actual (Actual TDC \+ Pension \+ Other) | actual\_total\_comp | Grand total — included in v1 per filename "(with pension and other)" |
| Target (Target TDC \+ Pension \+ Other) | target\_total\_comp | Grand total |
| Months | months\_in\_role | Passed through as metadata only. The Annualized/Converted columns already account for partial years — do not re-prorate. |

Ignored columns (present in the template but not extracted): Incumbent Start Month, End Month, Currency of Disclosure, FX Rate (already baked into the Annualized/Converted columns per 4.1.4), 3 Year Average STIP %, 3 Year Average LTIP %, Total LTI %, Total LTI (Converted), Incumbent Specific Notes, Data Recorder, Peer Reviewer, Flags.

**4.1.3 Peer Group Tab — Columns to Extract**

The Peer Group tab contains one row per peer company with size metrics. These are used exclusively for the regression engine. Columns are identified by header name search, not index.

* Company or Ticker — peer identifier, must match tickers in Raw Data tab

* Market Cap — primary size metric, numeric, in same currency as Raw Data

* TEV or Total Enterprise Value — secondary size metric

* Revenue — tertiary size metric

* Total Assets — quaternary size metric, available as a 4th selectable option alongside Market Cap / TEV / Revenue

IMPORTANT: These columns may be populated via QIQ (S\&P Capital IQ) formulas in the live Excel and may appear as \#N/A or empty in exported copies. The parser must handle missing values gracefully — if a size metric cell is missing or formula-errored, store null for that field. Do not crash. Log a validation warning.

**4.1.4 Parsing Logic**

* Identify the client company by finding the row where the Ticker column matches the Client Ticker value declared in the Raw Data inputs section. All other companies are peers.

* The most recent year is determined by finding the maximum Year value present in the data for any company. Store this as default\_year in the response.

* Parse ALL years present in the Raw Data tab, not just the most recent. The frontend year toggle requires multi-year data.

* Handle dashes (-) as null values. The Excel uses \- to indicate not applicable, which is distinct from 0 (plan exists, no payout).

* Handle currency conversion: the Raw Data tab contains an FX Rate column and a Currency of Disclosure column. All values must be converted to the reporting currency declared in the Raw Data inputs section (typically CAD). Annualized/Converted columns have already been converted — use those, not the raw currency columns.

* **Role tag resolution (role\_tags).** Position Match and Role Match are not a primary/fallback pair — they both feed the same concept: which tab(s) a row appears under. Confirmed against real data (2026 template):
  * `Position Match = CEO`, all Role Match columns null → tag = `["CEO"]` (Position Match supplies the label directly when no Role Match override exists — this is also true for CFO and for NEO3/NEO4/NEO5 rows with no Role Match value, which keep "NEO3"/"NEO4"/"NEO5" as their literal tab label).
  * `Position Match = NEO1`, `Role Match = COO`, `Role Match 2 = "2nd Highest"` → tags = `["COO", "2nd Highest"]`. Position Match is dropped once any Role Match column is populated. The row appears under **both** tabs simultaneously (not either/or).
  * `Position Match = "-"` (dash = null, per the rule above) and no Role Match values → tags = `[]`. Row is excluded from all role tabs but kept in `peers` with a validation warning.
  * **Algorithm:** detect all Role Match columns dynamically by matching the header pattern `Role Match` or `Role Match \d+` (case-sensitive match on the literal header, trimmed; no fixed cap at 2 — a template with "Role Match 3" must work without a code change). For each row: `role_tags = [v for v in (row[c] for c in detected_role_match_columns) if v not in (None, "-", "")]`. If that list is empty, fall back to `role_tags = [position_match]` unless `position_match` is also `None`/`"-"`, in which case `role_tags = []` and a warning is logged.
  * `PeerRecord.role_tags: List[str]` replaces the `role_match` / `role_match_2` fields from the original draft (Section 4.1.5 below reflects this). `position_match` is still stored on `PeerRecord` separately as a raw/audit field, but the frontend builds role tabs from the union of `role_tags` across all rows, not from `position_match`.
  * A peer with multiple `role_tags` renders under multiple tabs, exactly as the original spec described for the 2-column case — this is now the general case for any number of detected Role Match columns.

**4.1.5 Return Model  —  BenchmarkData (Pydantic)**

The parser must return a flat Pydantic model. This model is stored in frontend state and re-sent with subsequent calculation calls, following the same pattern as MarketData in backend/models/ltip.py.

class PeerRecord(BaseModel):

    lookup\_key: str

    ticker: str

    company\_name: str

    year: int

    role\_tags: List\[str\]            \# resolved per the role tag rule in 4.1.4; may be \[\]

    position\_match: Optional\[str\]   \# raw/audit field, not used for tab assignment

    position\_title: str

    incumbent\_name: str

    base\_salary: Optional\[float\]

    base\_salary\_next\_year: Optional\[float\]

    stip\_actual: Optional\[float\]

    stip\_target\_pct: Optional\[float\]

    stip\_target\_dollar: Optional\[float\]

    actual\_tcc: Optional\[float\]

    target\_tcc: Optional\[float\]

    ltip\_rsu: Optional\[float\]

    ltip\_psu: Optional\[float\]

    ltip\_options: Optional\[float\]

    ltip\_dsu: Optional\[float\]

    ltip\_cash: Optional\[float\]

    ltip\_total: Optional\[float\]

    ltip\_target\_pct: Optional\[float\]

    ltip\_target\_dollar: Optional\[float\]

    target\_tdc: Optional\[float\]

    actual\_tdc: Optional\[float\]

    pension: Optional\[float\]

    pension\_type: Optional\[str\]

    pension\_converted: Optional\[float\]

    pension\_3yr\_avg: Optional\[float\]

    other: Optional\[float\]

    other\_converted: Optional\[float\]

    other\_3yr\_avg: Optional\[float\]

    actual\_total\_comp: Optional\[float\]

    target\_total\_comp: Optional\[float\]

    months\_in\_role: Optional\[float\]

class PeerSizeRecord(BaseModel):

    ticker: str

    company\_name: str

    market\_cap: Optional\[float\]

    tev: Optional\[float\]

    revenue: Optional\[float\]

    total\_assets: Optional\[float\]

class BenchmarkData(BaseModel):

    client\_ticker: str

    reporting\_currency: str

    default\_year: int

    available\_years: List\[int\]

    roles: List\[str\]          \# unique values across all peers\[i\].role\_tags, sorted

    peers: List\[PeerRecord\]   \# all rows, all years, all roles

    peer\_sizes: List\[PeerSizeRecord\]

    validation\_warnings: List\[str\]

## **4.2 Benchmarking Engine  —  backend/engine/benchmarking\_engine.py**

This file contains all computation logic. It must not import from ltip\_engine.py or stip\_engine.py — it is fully self-contained.

**4.2.1 Weighted Percentile Calculation**

Function signature: calculate\_weighted\_percentiles(values: List\[float\], weights: List\[float\]) \-\> dict

Algorithm — weighted percentile using linear interpolation:

* Sort values and their corresponding weights together by value ascending.

* Compute cumulative weights after sorting.

* Normalize cumulative weights to the range \[0, 1\] by dividing by total weight sum.

* For each target quantile (0.25, 0.50, 0.75), find where the normalized cumulative weight crosses that value using linear interpolation between the two surrounding data points.

* Return a dict with keys p25, p50, p75, and also include the raw sorted values and weights for audit purposes.

This must produce results identical to numpy.percentile with the interpolation='linear' argument when all weights equal 1.0. Include a unit test assertion for this equivalence in backend/tests/.

**4.2.2 Regression Engine**

Function signature: run\_regression(pay\_values: List\[float\], size\_values: List\[float\], weights: List\[float\], client\_size: float) \-\> RegressionResult

Algorithm:

* Fit a weighted least squares (WLS) regression of log(pay) on log(size). Log-linear is standard for compensation vs. size relationships. Use numpy or scipy.stats — whichever is already a dependency in the existing backend.

* Compute the fitted line: predicted\_log\_pay \= intercept \+ slope \* log(size).

* Compute residuals for each peer: residual \= actual\_pay \- exp(predicted\_log\_pay).

* Compute the client's predicted pay at client\_size: client\_predicted\_pay \= exp(intercept \+ slope \* log(client\_size)).

* Return the slope, intercept, R-squared, each peer's predicted pay and residual, and the client's predicted pay.

Minimum peer count guard: if fewer than 8 peers have non-null size values for the selected size metric, return a validation warning and set regression\_valid: false in the response. Do not crash — return the unweighted percentiles as fallback.

**4.2.3 Peer Weight Suggestion**

Function signature: suggest\_weights(peer\_sizes: List\[float\], client\_size: float) \-\> List\[float\]

Algorithm:

* Compute the absolute log-distance between each peer size and the client size: distance \= abs(log(peer\_size) \- log(client\_size))

* Map distances to weights using a decay function: weight \= exp(-1.5 \* distance). This gives weight 1.0 to an exact-size match and weight \~0.22 to a peer 10x larger or smaller.

* Clamp all weights to the range \[0.1, 1.0\] — no peer gets a weight of zero, they are merely downweighted.

* Return weights as a list in the same order as peer\_sizes.

**4.2.4 Full Calculation Response Model**

class PercentileResult(BaseModel):

    p25: float

    p50: float

    p75: float

class PeerWeightedResult(BaseModel):

    ticker: str

    company\_name: str

    pay\_value: float

    suggested\_weight: float

    applied\_weight: float

    size\_value: Optional\[float\]

    predicted\_pay: Optional\[float\]

    residual: Optional\[float\]

class RegressionResult(BaseModel):

    slope: Optional\[float\]

    intercept: Optional\[float\]

    r\_squared: Optional\[float\]

    client\_predicted\_pay: Optional\[float\]

    regression\_valid: bool

    regression\_warning: Optional\[str\]

class CalculationResponse(BaseModel):

    role: str

    year: int

    pay\_metric: str            \# 'base' | 'tcc' | 'tdc' | 'total\_comp'

    size\_metric: str           \# 'market\_cap' | 'tev' | 'revenue' | 'total\_assets'

    unweighted: PercentileResult

    weighted: PercentileResult

    client\_pay: Optional\[float\]

    client\_percentile\_unweighted: Optional\[float\]

    client\_percentile\_weighted: Optional\[float\]

    peers: List\[PeerWeightedResult\]

    regression: RegressionResult

## **4.3 FastAPI Router  —  backend/routers/benchmarking.py**

Follow the exact same structure as backend/routers/ltip.py. Register this router in backend/main.py under the prefix /api/v1/benchmarking with the tag 'benchmarking'.

**Endpoints**

| Endpoint | Method | Description |
| :---- | :---- | :---- |
| /api/v1/benchmarking/upload | POST | Accepts multipart Excel file. Calls benchmarking\_parser.py. Returns BenchmarkData. Validates file is .xlsx. |
| /api/v1/benchmarking/calculate | POST | Accepts BenchmarkData \+ role \+ year \+ pay\_metric \+ size\_metric \+ peer\_weights dict. Returns CalculationResponse. |
| /api/v1/benchmarking/suggest-weights | POST | Accepts BenchmarkData \+ role \+ year \+ size\_metric. Returns suggested weights dict keyed by ticker. |
| /api/v1/benchmarking/export | POST | Accepts CalculationResponse \+ BenchmarkData. Returns .xlsx file as streaming response. See Section 4.4. |

## **4.4 Excel Export  —  backend/excel/benchmarking\_export.py**

Generates an audit-ready Excel file for the currently selected role. Follow the pattern in backend/excel/export.py. The output must open correctly in Excel without errors.

The export must contain the following sheets:

* Summary — role name, year, pay metric, size metric, client ticker, export timestamp, weighted and unweighted P25/P50/P75 for Base, TCC, TDC, and Total Comp.

* Peer Data — one row per peer showing: ticker, company name, incumbent, pay value (base/TCC/TDC/total\_comp), size value, applied weight, predicted pay (from regression), residual, and percentile rank.

* Weighted Percentiles — the percentile calculation shown step by step: sorted values, cumulative weights, normalized cumulative weights, and the interpolated P25/P50/P75 values. Formula cells where possible so the reviewer can trace the arithmetic.

* Regression — slope, intercept, R-squared, and a data table with log(size) and log(pay) values per peer, plus the fitted values and residuals.

The export does NOT need to replicate the visual formatting of the Hugessen template exactly. It needs to be clean, readable, and fully auditable. Use basic Excel formatting — header rows in navy fill with white text, alternating row shading, numeric columns formatted as currency or percentage as appropriate.

# **5\. Frontend Specification**

## **5.1 Visual Design Constraints — CRITICAL**

The Compensation Benchmarking module must match the visual design of the existing STIP module exactly. Claude Code must open the STIP components in frontend/src/components/stip/ and use the same Tailwind classes, color tokens, card styles, button styles, and typography patterns. Do not introduce new design patterns.

* Primary color: Navy — use the same Tailwind class or hex value already used in STIP components for navy.

* Accent color: Orange — use the same Tailwind class already used in STIP for orange highlights and active states.

* Secondary color: Gray — use the same Tailwind class already used in STIP for secondary text and borders.

* Background: light theme — `bg-offwhite` page background, `bg-white border border-lightgrey` cards, `bg-navy` top nav bar. (Corrected from the original draft, which assumed a dark theme — the actual STIP/LTIP modules are light-themed; verified against frontend/src/components/stip/StipPage.tsx and tailwind.config.js.)

* Typography: Match font size, weight, and spacing exactly from STIP components.

* Buttons: Match the existing button component styles — do not create new button styles.

* All chart colors must also follow the palette — use navy for peer bars, orange for the client dot/line, gray for axis labels.

## **5.2 Navigation**

The Compensation Benchmarking tab is added to the top-level navigation alongside STIP Designer and LTIP Engine. It must use the same tab component already used for STIP/LTIP navigation. The tab label is 'Compensation Benchmarking'.

## **5.3 TypeScript Types  —  frontend/src/types/BenchmarkingTypes.ts**

All TypeScript interfaces must mirror the Pydantic models exactly. Define interfaces for: PeerRecord, PeerSizeRecord, BenchmarkData, PercentileResult, PeerWeightedResult, RegressionResult, CalculationResponse. Use number | null for Optional\[float\] fields.

## **5.4 API Client  —  frontend/src/api/client.ts**

Add the following functions to client.ts, following the existing fetch pattern:

* uploadBenchmarkFile(file: File): Promise\<BenchmarkData\>

* calculateBenchmarking(payload: CalculateRequest): Promise\<CalculationResponse\>

* suggestWeights(payload: SuggestWeightsRequest): Promise\<Record\<string, number\>\>

* exportBenchmarking(payload: ExportRequest): Promise\<Blob\>

# **6\. UI Flow & Screen States**

## **6.1 Screen 1 — Upload**

When the Compensation Benchmarking tab is first opened, the screen shows only an upload area. No other UI elements are visible until a file is successfully parsed.

* Upload area: drag-and-drop zone or click-to-browse, accepts .xlsx only. Matches the existing upload component style used in the LTIP module for share price data upload.

* On upload: POST to /api/v1/benchmarking/upload. Show a loading spinner during parsing.

* On success: store BenchmarkData in component state. Transition to Screen 2 automatically.

* On error: show an inline error message (e.g. 'Could not parse file — ensure you are uploading the Raw Data tab in the standard Hugessen benchmarking template'). Do not crash. Allow re-upload.

* Validation warnings from the parser (e.g. missing size metric values) are displayed as a collapsible yellow warning banner at the top of Screen 2, not as blocking errors.

## **6.2 Screen 2 — Data Verification Table**

After a successful upload, the analyst sees a verification table before any charts are shown. This screen's purpose is to confirm the data has been parsed correctly.

**Year Toggle**

* A year selector appears at the top of the screen. It is populated dynamically from available\_years in BenchmarkData.

* Default selection is default\_year (the most recent year in the data).

* Changing the year updates the verification table instantly — no API call needed, the data is already in state.

**Role Tabs**

* Below the year toggle, a row of tabs is rendered — one per unique role in BenchmarkData.roles. Examples: CEO | CFO | COO | Legal | Region | Tech.

* Tabs are generated dynamically from the data — do not hardcode role names.

* If a peer has a role\_match\_2 value, they appear under both their primary role tab and their secondary role tab.

* Default selected tab is CEO if present, otherwise the first role alphabetically.

**Verification Table**

The table shows one row per peer for the selected role and selected year. Columns:

| Column | Description |
| :---- | :---- |
| Company | company\_name |
| Incumbent | incumbent\_name |
| Title | position\_title |
| Base Salary | base\_salary, formatted as currency |
| STIP Actual | stip\_actual, formatted as currency |
| STIP Target % | stip\_target\_pct, formatted as percentage |
| Target TCC | target\_tcc, formatted as currency |
| LTIP Total | ltip\_total, formatted as currency |
| LTIP Target % | ltip\_target\_pct, formatted as percentage |
| Target TDC | target\_tdc, formatted as currency |
| Actual TDC | actual\_tdc, formatted as currency |
| Pension | pension\_converted, formatted as currency |
| Other | other\_converted, formatted as currency |
| Target Total Comp | target\_total\_comp, formatted as currency |
| Actual Total Comp | actual\_total\_comp, formatted as currency |

The client company row must be visually distinct — highlight it with an orange left border or orange text so the analyst can immediately identify client vs. peer rows.

A 'Proceed to Charts' button at the bottom of this screen transitions to Screen 3\. The analyst can return to this screen at any time via a back button.

## **6.3 Screen 3 — Role-Scoped Hanging Chart (revised twice after live testing — see history below)**

**Revision history, since this screen went through two wrong designs before landing on the right one:**
1. Original draft: one role at a time (via Role tabs), 4 separate single-metric chart cards (Base/TCC/TDC/Total Comp).
2. First revision: after inspecting the real "TC Chart" Excel tab, built an all-roles-at-once overview (one chart, all roles on the x-axis, TDC+TC grouped per role, auto-suggested weights only). This matched the Excel tab's literal structure but was **not what the user wanted** — it made the Role tabs do nothing on this screen, which defeated their purpose.
3. **Final design (current):** stay role-tab-driven — the Role tabs select one role exactly as before, and the chart shows **Base Salary, TDC, and TC together as three grouped bars in one chart** (not 4 separate cards) for that role. Switching the Role tab updates the chart's three bars to that role's data.

**Controls bar (top of screen)**

* Role tabs — same dynamic tabs as Screen 2, persists the selection. Changing role re-fetches `/suggest-weights` \+ `/calculate` for all 4 pay metrics for that role (Base, TCC, TDC, Total Comp — Total Comp stays computed for the Regression Panel's pay-metric selector and the Export button even though this chart only displays 3 of the 4).

* Year toggle — same year selector as Screen 2\.

* View toggle — two buttons: Raw Market | Size-Adjusted. Default: Raw Market. Size-Adjusted uses the currently-applied weights (auto-suggested unless overridden on the Regression Panel for this role).

**Chart area (`RoleHangingChart.tsx`)**

One chart, three categories on the x-axis for the selected role: **Base Salary, TDC, TC**. Each category is its own floating P25→P50→P75 stacked bar:

* Vertical axis: pay value in reporting currency. Format as $Xk/$XM/$XB.

* Each bar floats between P25 (bottom edge) and P75 (top edge), split into two segments at P50: lower segment P25-P50 in a lighter navy, upper segment P50-P75 in navy.

* The client's value is marked as a thin orange band inserted into the stack at its exact value via boundary decomposition (`buildBarSegments.ts`) — this places the marker correctly even when the client falls outside the P25-P75 range, which a plain `ReferenceLine` can't do as precisely once segments are built from data-driven stacking rather than a literal y-domain line.

* A 3-column summary strip below the chart gives exact P25/P50/P75/client/percentile figures per metric, since fine differences aren't always readable directly off stacked bars at this scale.

* Hovering any bar shows a tooltip with that metric's full percentile breakdown.

* When the View toggle is set to Size-Adjusted, the bars shift to reflect weighted P25/P50/P75 percentiles using the currently-applied weights.

`buildBarSegments.ts` (the segment-decomposition helper) and the `<Cell>`-based per-row coloring technique are shared with the Regression Panel's single-metric hanging chart — both ultimately render one or more of these floating bars, just with a different x-axis (metric-per-role here; this screen has no all-roles or all-metrics view).

## **6.4 Screen 4 — Regression & Weight Panel**

Accessed via a 'Size-Adjusted Analysis' button or tab on Screen 3\. This screen sits alongside the bar charts — the layout splits into two panels.

**Left panel — Regression Scatter Plot**

* X-axis: size metric value (market cap by default). Log scale. Formatted as $XB or $XM.

* Y-axis: pay value for the selected pay metric. Log scale. Formatted as $Xk or $XM.

* Each peer is a dot. Dot size scales with the peer's applied weight — higher weight \= larger dot. This makes it immediately visually obvious which peers are driving the analysis.

* The client company is rendered as an orange diamond, not a dot.

* The regression line is drawn across the full x-axis range in a dashed navy line.

* A size metric selector (Market Cap | TEV | Revenue | Total Assets) appears above the chart. Changing it re-calls /api/v1/benchmarking/suggest-weights and /api/v1/benchmarking/calculate.

* R-squared value displayed below the chart as 'Model fit: R² \= 0.71'.

* If regression\_valid is false, the scatter plot still renders but the regression line is hidden and a warning banner reads: 'Insufficient size data for regression — minimum 8 peers required. Showing unweighted percentiles.'

**Right panel — Hanging Bar Chart (weight-reactive)**

* A single HangingBarChart for the selected role \+ Regression Pay Metric (one bar, not the Screen 3 RoleHangingChart's three) — this one always shows the weighted view using the manually-applied weights from the table below.

* Update in real time as the analyst changes weights in the weight table below.

**Peer Weight Table (below both panels)**

A table showing all peers for the selected role and year with their weights. One row per peer:

| Company | Incumbent | Pay Value | Size Value | Suggested Wt. | Applied Wt. |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Kinross | J.P. Rollinson | $9.8M | $18.2B mkt cap | 0.35 | 0.40 ← editable |
| Capstone | J. MacKenzie | $4.4M | $3.5B mkt cap | 1.00 | 1.00 ← editable |

The Applied Weight column is an editable input field. Range: 0.10 to 1.00. Step: 0.05. Validates on blur — if the analyst types a value outside \[0.10, 1.00\], it snaps to the nearest bound and shows a brief tooltip.

* A 'Reset to Suggested' button restores all weights to the values returned by /api/v1/benchmarking/suggest-weights.

* An 'Apply Weights' button sends the current weights to /api/v1/benchmarking/calculate and updates both panels.

* Auto-apply on each weight change is NOT implemented — the analyst must press Apply Weights. This prevents excessive API calls during manual adjustment.

# **7\. Frontend Component Breakdown**

All components live in frontend/src/components/benchmarking/. Follow the same file naming convention as the STIP and LTIP component folders.

| Component File | Responsibility |
| :---- | :---- |
| BenchmarkingModule.tsx | Top-level container. Manages all module state. Handles screen transitions (Upload → Verify → Charts → Regression). Does NOT do any computation itself. |
| BenchmarkUpload.tsx | Upload drag-and-drop zone. Calls uploadBenchmarkFile(). Emits onSuccess(data: BenchmarkData). |
| BenchmarkVerification.tsx | Data verification table. Accepts BenchmarkData as prop. Renders year toggle, role tabs, and verification table. Emits no API calls — reads from prop only. |
| RoleTabBar.tsx | Reusable dynamic tab bar. Accepts roles: string\[\] and selectedRole: string. Used on both Verification and Charts screens. |
| YearToggle.tsx | Reusable year selector. Accepts years: number\[\] and selectedYear: number. |
| HangingBarChart.tsx | Single hanging bar chart for one pay metric/role. Accepts p25, p50, p75, clientPay, payMetric, weighted: boolean. Used standalone by RegressionPanel's "Size-Adjusted Positioning" (one role, one metric). |
| RoleHangingChart.tsx | Screen 3's primary chart. One Recharts BarChart, x-axis = {Base Salary, TDC, TC} for the currently selected Role tab, each its own 6-segment stacked bar built via buildBarSegments.ts, plus a 3-column summary strip. Replaces the original HangingBarChartGroup.tsx (deleted — was a 4-column grid of 4 separate single-metric cards). An interim all-roles-overview design (RoleComparisonChart.tsx) was built and then discarded per direct user feedback — see Section 6.3 revision history. |
| buildBarSegments.ts | Pure helper. Decomposes a P25/P50/P75 band \+ an optional exact client value into a fixed 6-slot stack (transparent/light/dark/orange-tick segments), since Recharts assigns one fill per dataKey across a whole series, not per row — per-role color variation requires \<Cell\> components keyed to these slots. |
| RegressionScatterPlot.tsx | Recharts ScatterChart showing peers, regression line, and client. Accepts RegressionResult and PeerWeightedResult\[\]. |
| PeerWeightTable.tsx | Editable peer weight table. Accepts PeerWeightedResult\[\]. Emits onWeightsChange(weights: Record\<string, number\>). Includes Reset and Apply buttons. |
| RegressionPanel.tsx | Combines RegressionScatterPlot \+ a single HangingBarChart (one role, one metric — NOT the old HangingBarChartGroup, which squeezed a single chart into a 4-column grid sized for four) \+ PeerWeightTable. Manages weight state locally. |
| ExportButton.tsx | Calls exportBenchmarking() and triggers browser file download. Shows loading state during export. |
| BenchmarkingErrorBoundary.tsx | React class component error boundary. Wraps BenchmarkingModule in App.tsx. Catches render errors anywhere in the benchmarking module and shows a fallback card instead of crashing the whole app. Does not catch STIP/LTIP errors — those are unaffected since this boundary only wraps the benchmarking subtree. |

# **8\. State Management**

All state is managed in BenchmarkingModule.tsx using React useState hooks, following the same pattern as the existing STIP and LTIP modules. Do not introduce Redux, Zustand, or any external state library.

| State Variable | Type | Description |
| :---- | :---- | :---- |
| benchmarkData | BenchmarkData | null | Set on successful upload. Cleared on re-upload. |
| selectedRole | string | Currently selected role tab. |
| selectedYear | number | Currently selected year. |
| selectedPayMetric | 'base'|'tcc'|'tdc'|'total\_comp' | Pay metric toggle selection. |
| selectedSizeMetric | 'market\_cap'|'tev'|'revenue'|'total\_assets' | Size metric for regression. |
| calculationResult | CalculationResponse | null | Result from /calculate endpoint. |
| appliedWeights | Record\<string, number\> | Peer ticker → applied weight. Populated from suggest-weights on role/year/size change. |
| currentScreen | 'upload'|'verify'|'charts'|'regression' | Controls which screen is shown. |
| isLoading | boolean | True during any API call. |
| error | string | null | Error message for display. |

# **9\. Build Sequence — Follow This Order Exactly**

Claude Code must build in the following sequence. Do not skip ahead. Each step should be verified working before the next begins.

**Step 1 — Backend Models**

* Create backend/models/benchmarking.py with all Pydantic models defined in Section 4\.

* No logic — pure data models only.

* Verify: python \-c 'from backend.models.benchmarking import BenchmarkData' succeeds.

**Step 2 — Excel Parser**

* Create backend/excel/benchmarking\_parser.py.

* Test with the actual Hudbay\_2026\_EC\_Benchmarking\_v4.xlsx file.

* Verify: all 13 peer CEO rows parse correctly for 2024 and 2025\. Print output to console and confirm role\_match values, base salaries, and target\_tdc values match the Import 2024 Data tab as a sanity check.

**Step 3 — Benchmarking Engine**

* Create backend/engine/benchmarking\_engine.py with weighted percentile, regression, and weight suggestion functions.

* Verify: unit test that equal weights produce same result as numpy.percentile. Verify regression returns valid slope/intercept for test data.

**Step 4 — FastAPI Router**

* Create backend/routers/benchmarking.py.

* Register in backend/main.py.

* Verify: uvicorn starts without errors. /api/v1/benchmarking/upload returns 422 on empty POST (correct validation behavior).

**Step 5 — Excel Export**

* Create backend/excel/benchmarking\_export.py.

* Verify: export endpoint returns a valid .xlsx file that opens in Excel without errors.

**Step 6 — TypeScript Types & API Client**

* Create frontend/src/types/BenchmarkingTypes.ts.

* Add fetch functions to frontend/src/api/client.ts.

* Verify: TypeScript compiles without errors (npm run build or tsc \--noEmit).

**Step 7 — Upload Component & Navigation**

* Create BenchmarkUpload.tsx and BenchmarkingModule.tsx.

* Add Compensation Benchmarking tab to navigation.

* Verify: tab renders, upload area appears, file upload calls backend and stores BenchmarkData in state.

**Step 8 — Verification Table**

* Create BenchmarkVerification.tsx, RoleTabBar.tsx, YearToggle.tsx.

* Verify: switching roles and years updates the table. Client row is visually distinct.

**Step 9 — Hanging Bar Charts**

* Create HangingBarChart.tsx and HangingBarChartGroup.tsx.

* Verify: three charts render side by side. Client orange line at correct position. P25/P50/P75 bars floating correctly.

**Step 10 — Regression Panel**

* Create RegressionScatterPlot.tsx, PeerWeightTable.tsx, RegressionPanel.tsx.

* Verify: scatter plot renders with regression line. Peer dots sized by weight. Weight table is editable. Apply Weights triggers recalculation and bar charts update.

**Step 11 — Export**

* Create ExportButton.tsx.

* Verify: clicking export downloads a valid .xlsx file containing all four required sheets.

**Step 12 — Integration & Polish**

* Confirm STIP and LTIP modules are completely unaffected by all changes.

* Confirm all Tailwind classes match the STIP module visual design.

* Confirm all error states are handled gracefully.

* Confirm validation warnings from the parser appear as non-blocking banners.

# **10\. Explicit Constraints for Claude Code**

These are hard rules. Do not deviate from them.

* NEVER import from ltip\_engine.py or stip\_engine.py in benchmarking\_engine.py. Each engine is fully self-contained.

* NEVER import from benchmarking components in stip or ltip components. Module isolation is mandatory.

* NEVER hardcode column indices when parsing Excel. Always identify columns by header name search — EXCEPT where header text collides (the two "Annualized / Converted" columns, see 4.1.2), where the column must be anchored relative to its preceding distinctive header instead.

* NEVER hardcode the number of Role Match columns. Detect "Role Match", "Role Match 2", "Role Match 3", ... dynamically by pattern at parse time.

* NEVER crash on missing or null data from the Excel. Return validation warnings instead.

* NEVER introduce a new state management library. useState only.

* NEVER introduce a new charting library. Use Recharts which is already a dependency.

* NEVER introduce axios. Use the Fetch API via client.ts as the existing pattern dictates.

* NEVER modify the visual design of the STIP or LTIP modules.

* ALWAYS follow the Pydantic model → TypeScript interface mapping exactly. Field names must be identical.

* ALWAYS show a loading spinner during API calls. Never leave the UI frozen without feedback.

* ALWAYS validate file type on upload — reject non-.xlsx files before sending to backend.

* ALWAYS handle the case where Peer Group tab size data is missing — regression falls back gracefully to unweighted percentiles.

Hugessen Consulting  ·  Incentive Design Platform  ·  Compensation Benchmarking Module  ·  Internal Use Only