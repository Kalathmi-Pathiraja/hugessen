**STIP / LTIP DESIGN &**

**SCENARIO ANALYSIS PLATFORM**

*Full-Stack Build Specification for Claude Code*

Hugessen Consulting  |  Summer 2025

| FRONTEND React \+ TypeScript Recharts for all data visualisation Tailwind CSS (brand palette only) | BACKEND Python 3.11 \+ FastAPI NumPy / Pandas / SciPy openpyxl for Excel ingestion |
| :---- | :---- |

# **PART 1: STIP — SHORT-TERM INCENTIVE PLAN MODULE**

## **1.0  Architecture & Calculation Chain**

The STIP module uses a single-page responsive dashboard split into a left-hand input column and a right-hand output column. Before any code is written, the developer must implement the following explicit 5-step data pipeline. Each step must be a discrete, independently testable function.

### **Mandatory 5-Step Calculation Pipeline**

| Step | Input | Function Name | Output |
| :---- | :---- | :---- | :---- |
| 1 | Raw metric result (e.g. actual EBITDA $) | calculate\_metric\_achievement(actual, budget) | Achievement % (e.g. 0.97 \= 97%) |
| 2 | Achievement % \+ curve design params | calculate\_multiplier(achievement\_pct, curve) | Individual metric multiplier (e.g. 0.85) |
| 3 | All metric multipliers \+ weights\[\] | calculate\_weighted\_multiplier(multipliers\[\], weights\[\]) | Overall plan multiplier (e.g. 1.04) |
| 4 | Overall multiplier × target opportunity $ | calculate\_dollar\_payout(multiplier, target\_opp) | Dollar payout (e.g. $249,600) |
| 5 | Dollar payout / target opportunity | calculate\_payout\_pct\_of\_target(payout, target\_opp) | % of target (e.g. 104%) |

**⚠ These steps must never be collapsed into a single calculation. Debugging simulation errors requires each step to be independently inspectable.**

## **1.1  First Column — Plan Designer Inputs**

### **Card A: Baseline Financials**

| Field | Type | Default | Validation |
| :---- | :---- | :---- | :---- |
| Base Salary ($) | Numeric input | $400,000 | Must be \> 0 |
| Target STIP (%) | Numeric input | 60% | Must be \> 0, typically 10–200% |
| Target Opportunity ($) | Calculated display (read-only) | Base Salary × Target STIP % | Recalculates on any change above |
| Distribution Assumption | Toggle: Normal / Log-Normal | Log-Normal | See note below — expose to user |

*NOTE: Log-normal is the technically correct distribution for financial metrics (prevents negative values). Normal distribution is computationally simpler but can generate negative EBITDA in simulations. Always display which assumption is active — clients will ask.*

### **Card B: Payout Curve Designer**

Three linked sliders define the piecewise payout curve. Render a live Recharts LineChart that updates on every slider move. The X-axis is Performance Achievement % (0–200%), the Y-axis is Payout Multiplier % (0–200%).

| Slider | Controls | Default | Constraint |
| :---- | :---- | :---- | :---- |
| Threshold | Performance % at which payout begins | 80% performance → 50% payout | Must be \< Target (100%) |
| Target | Hardlocked | 100% performance \= 100% payout | Read-only. Cannot be moved. |
| Maximum | Performance % at cap and cap payout % | 120% performance → 200% payout | Must be \> Target (100%) |

**The live chart must draw the following shape:**

* Flat at 0% from 0% performance to Threshold performance (threshold is an dotted line) 

* Linear ramp from Threshold point to Target point (100%, 100%)

* Linear ramp from Target point to Maximum point

* Flat cap at Maximum payout % beyond Maximum performance

### **Card C: Balanced Scorecard Builder**

A dynamic table. User can add/delete rows. A running total of weights is displayed and turns red if it does not equal exactly 100%.

| Column | Type | Options / Validation |
| :---- | :---- | :---- |
| Metric Category | Dropdown | Financial, Operational, ESG, Individual/Qualitative |
| Specific Metric Name | Dropdown (filtered by category) or free-text | See standard metric list below |
| Weight (%) | Numeric input | All weights must sum to 100%. Show live running total. |
| Budget / Target Value | Numeric input | Absolute $ for financial metrics, % or score for others |
| Historical Volatility (σ) | Numeric input (decimal) | E.g. 0.15 \= 15%. Used as std deviation in Monte Carlo. |
| Distribution | Toggle: Normal / Log-Normal | Inherits from global setting, overridable per metric |

### **Standard Metric Library (populate dropdown)**

| Category | Standard Metrics |
| :---- | :---- |
| Financial | EBITDA, Revenue, Operating Income, Free Cash Flow (FCF), Return on Invested Capital (ROIC), Return on Equity (ROE), Net Income |
| Operational | Production Volumes, HSE Incident Rate (TRIR), CapEx Delivery (% on budget), Project Milestones (% complete), Customer Satisfaction (NPS) |
| ESG | Carbon Emissions Reduction (% vs baseline), Water Usage Intensity, Diversity & Inclusion Representation (%), Board Gender Diversity (%) |
| Individual / Qualitative | Leadership Discretionary Score (0–100), Strategic Initiative Delivery, Talent Development Score |

### **Card D: Correlation Matrix (Promoted from Hidden to Visible)**

Display an N×N editable grid where N \= number of scorecard metrics. Pre-populate with the following default values:

* Financial ↔ Financial pairs: 0.60 (positive — EBITDA and ROIC crash together)

* Financial ↔ Operational pairs: 0.35 (moderate — production volumes affect financial results)

* Financial ↔ ESG pairs: 0.10 (low — ESG targets are mostly independent of short-term financials)

* ESG ↔ ESG pairs: 0.40

* Any metric with itself (diagonal): 1.00 (hardlocked, read-only)

**Provide two buttons:**

* Reset to Defaults — restores all values above

* Validate Matrix — runs a positive semi-definite check (all eigenvalues ≥ 0). Alert user if matrix is invalid before allowing simulation to run.

**⚠ If the correlation matrix fails the positive semi-definite check, the Cholesky decomposition in the Monte Carlo will throw a runtime error. Validate before simulation, not during.**

### **Card E: Peer Benchmarking Overlay (New — Required)**

This card enables consultants to contextualise payout percentiles against market practice. Inputs:

| Field | Type | Default | Purpose |
| :---- | :---- | :---- | :---- |
| Peer Group Median Target STIP (%) | Numeric input | 55% | Shown as a reference line on output charts |
| Peer Group 25th Pctl Target STIP (%) | Numeric input | 40% | Lower bound reference line |
| Peer Group 75th Pctl Target STIP (%) | Numeric input | 70% | Upper bound reference line |
| Data Source Label | Text input | e.g. 'Hugessen 2024 O\&G Survey' | Displayed as chart footnote |

## **1.2  Right Column — Scenario Output Dashboard**

### **Output A: Linear Bullet Charts (Bear / Base / Bull)**

Three stacked horizontal bullet charts rendered using Recharts ComposedChart or SVG. Each track represents a simulation percentile.

| Track | Percentile | Description |
| :---- | :---- | :---- |
| Bear Case | 10th percentile (index 1,000 of sorted 10,000-trial array) | Weak market / all metrics miss |
| Base Case | 50th percentile (index 5,000) | Median outcome / metrics perform at budget |
| Bull Case | 90th percentile (index 9,000) | Strong market / metrics beat budget |

**Styling spec per track:**

* Background track: light grey (\#E2E8F0), full width from 0% to 200% of target

* Target notch: 1px vertical Navy (\#0A192F) line at exactly the 100% mark with label '100% Target'

* Orange fill bar: solid \#FF6B00, fills from 0 to the simulated payout % of target

* Label at end of bar: show exact % value (e.g. '142% of Target') in bold Navy

* Peer benchmarking band: if Card E is populated, render a translucent grey band from P25 to P75 peer range behind the track

### **Output B: Per-Metric Probability Breakdown Table**

Below the bullet charts, render a table showing per-metric simulation statistics. This is the decomposition of what drove the Bear/Base/Bull outcomes.

| Column | Data | Styling |
| :---- | :---- | :---- |
| Metric Name | From scorecard | Left-aligned |
| Weight (%) | From scorecard | Centre-aligned |
| Prob. Below Threshold (→ $0) | % of 10,000 trials where metric achievement \< threshold | Slate grey text; red if \> 20% |
| Prob. At/Above Target (≥100%) | % of trials where metric multiplier ≥ 1.00 | Normal text |
| Prob. At Maximum Cap | % of trials where metric multiplier \= max payout | Orange bold if \> 10% |
| Median Metric Multiplier | 50th pctl of individual metric multiplier distribution | Navy bold |

## **1.3  Backend: STIP Calculation Engine**

### **Data Model (JSON payload from frontend to /api/v1/stip/simulate)**

POST /api/v1/stip/simulate

{

  "base\_salary": 400000,

  "target\_stip\_pct": 0.60,

  "distribution": "lognormal",           // "normal" | "lognormal"

  "n\_simulations": 10000,

  "curve\_design": {

    "threshold\_perf": 0.80,

    "threshold\_payout": 0.50,

    "target\_perf": 1.00,

    "target\_payout": 1.00,

    "max\_perf": 1.20,

    "max\_payout": 2.00

  },

  "scorecard\_metrics": \[

    {

      "name": "EBITDA",

      "weight": 0.60,

      "budget\_target": 150000000,

      "volatility\_sigma": 0.15,

      "distribution": "lognormal"        // overrides global if set

    },

    {

      "name": "ROIC",

      "weight": 0.25,

      "budget\_target": 0.12,

      "volatility\_sigma": 0.08,

      "distribution": "lognormal"

    },

    {

      "name": "ESG Score",

      "weight": 0.15,

      "budget\_target": 100.0,

      "volatility\_sigma": 0.05,

      "distribution": "normal"           // ESG scores bounded — normal acceptable

    }

  \],

  "correlation\_matrix": \[

    \[1.00, 0.60, 0.10\],

    \[0.60, 1.00, 0.10\],

    \[0.10, 0.10, 1.00\]

  \]

}

### **Step 1: Validate Correlation Matrix**

Before running simulations, validate the matrix is positive semi-definite:

import numpy as np

def validate\_correlation\_matrix(corr\_matrix: list) \-\> bool:

    R \= np.array(corr\_matrix)

    eigenvalues \= np.linalg.eigvalsh(R)

    return bool(np.all(eigenvalues \>= \-1e-8))   \# tolerance for float errors

    \# Raise HTTPException 422 if False — do not proceed to simulation

### **Step 2: Cholesky Decomposition for Correlated Draws**

L \= np.linalg.cholesky(R)   \# Lower-triangular Cholesky factor

\# Shape: (n\_metrics, n\_metrics)

\# Use L @ Z\_independent to produce correlated draws

### **Step 3: Piecewise Multiplier Function (apply per metric per trial)**

def calculate\_multiplier(achievement\_pct: float, curve: dict) \-\> float:

    """

    achievement\_pct: actual / budget target (e.g. 0.97 for 97% of budget)

    curve: dict with keys threshold\_perf, threshold\_payout,

                            target\_perf, target\_payout,

                            max\_perf, max\_payout

    Returns: multiplier float in range \[0.0, max\_payout\]

    """

    p \= achievement\_pct

    if p \< curve\['threshold\_perf'\]:

        return 0.0

    elif p \<= curve\['target\_perf'\]:

        slope\_pct \= (p \- curve\['threshold\_perf'\]) /

                    (curve\['target\_perf'\] \- curve\['threshold\_perf'\])

        return curve\['threshold\_payout'\] \+ slope\_pct \*

               (curve\['target\_payout'\] \- curve\['threshold\_payout'\])

    elif p \<= curve\['max\_perf'\]:

        slope\_pct \= (p \- curve\['target\_perf'\]) /

                    (curve\['max\_perf'\] \- curve\['target\_perf'\])

        return curve\['target\_payout'\] \+ slope\_pct \*

               (curve\['max\_payout'\] \- curve\['target\_payout'\])

    else:

        return curve\['max\_payout'\]

### **Step 4: Monte Carlo Simulation Loop**

def run\_stip\_simulation(payload: dict) \-\> dict:

    n      \= payload\['n\_simulations'\]        \# 10,000

    metrics \= payload\['scorecard\_metrics'\]

    R      \= np.array(payload\['correlation\_matrix'\])

    L      \= np.linalg.cholesky(R)

    curve  \= payload\['curve\_design'\]

    n\_m    \= len(metrics)

    \# \--- draw correlated standard normals \---

    Z\_ind  \= np.random.standard\_normal((n\_m, n))   \# shape (n\_metrics, n\_trials)

    Z\_corr \= L @ Z\_ind                              \# shape (n\_metrics, n\_trials)

    \# \--- simulate achievement % for each metric in each trial \---

    achievement \= np.zeros((n\_m, n))

    for i, metric in enumerate(metrics):

        mu    \= 1.0                    \# mean achievement \= 100% of budget

        sigma \= metric\['volatility\_sigma'\]

        dist  \= metric.get('distribution', payload.get('distribution','lognormal'))

        if dist \== 'lognormal':

            \# Convert (mu, sigma) in linear space to lognormal params

            mu\_ln    \= np.log(mu\*\*2 / np.sqrt(sigma\*\*2 \+ mu\*\*2))

            sigma\_ln \= np.sqrt(np.log(1 \+ (sigma/mu)\*\*2))

            achievement\[i\] \= np.exp(mu\_ln \+ sigma\_ln \* Z\_corr\[i\])

        else:  \# normal

            achievement\[i\] \= mu \+ sigma \* Z\_corr\[i\]

            achievement\[i\] \= np.maximum(achievement\[i\], 0\)  \# floor at 0

    \# \--- apply multiplier curve to each metric in each trial \---

    multipliers \= np.zeros((n\_m, n))

    for i in range(n\_m):

        for j in range(n):

            multipliers\[i, j\] \= calculate\_multiplier(achievement\[i, j\], curve)

    \# \--- weighted aggregate multiplier per trial \---

    weights \= np.array(\[m\['weight'\] for m in metrics\])      \# sums to 1.0

    overall\_multipliers \= weights @ multipliers              \# shape (n,)

    \# \--- convert to % of target and sort \---

    payout\_pct\_of\_target \= overall\_multipliers \* 100.0

    payout\_pct\_of\_target.sort()

    \# \--- percentiles using numpy (preferred over hardcoded indices) \---

    bear, base, bull \= np.percentile(payout\_pct\_of\_target, \[10, 50, 90\])

    \# \--- per-metric probability breakdown \---

    metric\_stats \= \[\]

    for i, m in enumerate(metrics):

        metric\_stats.append({

            'name': m\['name'\],

            'prob\_zero':    float(np.mean(multipliers\[i\] \== 0.0)) \* 100,

            'prob\_target':  float(np.mean(multipliers\[i\] \>= 1.0)) \* 100,

            'prob\_max':     float(np.mean(multipliers\[i\] \>= curve\['max\_payout'\])) \* 100,

            'median\_mult':  float(np.percentile(multipliers\[i\], 50)),

        })

    target\_opp \= payload\['base\_salary'\] \* payload\['target\_stip\_pct'\]

    return {

        'bear\_pct\_of\_target':  round(bear, 1),

        'base\_pct\_of\_target':  round(base, 1),

        'bull\_pct\_of\_target':  round(bull, 1),

        'bear\_dollar':         round(bear / 100 \* target\_opp, 0),

        'base\_dollar':         round(base / 100 \* target\_opp, 0),

        'bull\_dollar':         round(bull / 100 \* target\_opp, 0),

        'target\_opportunity':  target\_opp,

        'metric\_stats':        metric\_stats,

    }

# **PART 2: LTIP — LONG-TERM INCENTIVE PLAN MODULE**

## **2.0  Architecture Overview & Key Differences from STIP**

The LTIP module operates over a 3-year vesting horizon and introduces three distinct equity vehicle types — RSUs, PSUs, and Options — each with different payout mechanics. Market data is ingested via a structured Excel template upload rather than a live API. The developer must understand these fundamental differences from the STIP module:

| Dimension | STIP | LTIP |
| :---- | :---- | :---- |
| Time horizon | 1 year (single draw) | 3 years (terminal GBM endpoint) |
| Performance metric | Internal scorecards vs. budget | Relative TSR vs. peer group |
| Payout vehicle | Cash | RSUs (share price), PSUs (multiplier × units × share price), Options (max(S\_T − K, 0)) |
| Market data source | User-entered (internal budgets) | Excel upload of historical price data |
| Output currency | % of salary target | Dollar realized wealth vs. grant-date value |
| Vesting structure | Annual cash payment | Cliff vest at year 3 (default) — see graded vesting note |

**⚠ Vesting structure must be explicitly chosen before building. This spec assumes cliff vesting at year 3 for all vehicles. If graded vesting (e.g. RSUs vest 1/3/year) is required, the GBM simulation must generate annual path steps (not just a terminal draw) and the calculation engine must sum year-1, year-2, year-3 vest tranches separately.**

## **2.1  Excel Data Template — Build Specification**

Build a downloadable Excel template (generate with openpyxl on the backend at GET /api/v1/ltip/template). The template has three sheets:

### **Sheet 1: Price History**

| Column | Header Text | Data Type | Instructions to user |
| :---- | :---- | :---- | :---- |
| A | Date | YYYY-MM-DD | 3 years of trading dates. One row per trading day (\~756 rows). |
| B | COMPANY | Float | Closing price of the subject company. Header must say 'COMPANY'. |
| C onward | \[TICKER\] | Float | One column per peer. Header \= ticker symbol (e.g. CNQ, TOU, CVE). |

### **Sheet 2: Peer Config**

| Column | Header Text | Data Type | Purpose |
| :---- | :---- | :---- | :---- |
| A | Ticker | Text | Must match column header in Sheet 1 exactly |
| B | Company Name | Text | Display name for UI labels |
| C | Peer Type | Dropdown: Custom | Index | Custom \= specific named peer; Index \= use for broad benchmark |
| D | Include in TSR Calc | Dropdown: Yes | No | Allows user to exclude problematic peers without deleting data |
| E | Dividend Yield (%) | Float | Annual dividend yield as decimal (e.g. 0.035 \= 3.5%). Used in total return calculation. Leave blank if price data already includes dividends. |

### **Sheet 3: Assumptions Override**

| Field | Default Value | Description |
| :---- | :---- | :---- |
| Risk-Free Rate (%) | 3.5 | Used in Black-Scholes. Override with current GoC 5-yr bond yield. |
| Dividend Yield (%) | 0.0 | Company dividend yield for Black-Scholes Merton adjustment. Overrides Sheet 2 company row. |
| Vesting Term (Years) | 3 | Performance period. Drives T in GBM and Black-Scholes. |
| Option Term (Years) | 5 | Time to expiry for Black-Scholes (typically longer than vesting period). |
| Simulation Count | 10000 | Number of Monte Carlo trials. Do not reduce below 5,000. |

The upload endpoint (POST /api/v1/ltip/upload-data) must validate: (1) Sheet 1 has a 'COMPANY' column. (2) All tickers in Sheet 2 match columns in Sheet 1\. (3) No more than 10% of price cells are blank (NaN). Return a structured validation response before proceeding to simulation.

## **2.2  First card on top — Grant Sizing & Vehicle Mix Inputs**

### **Card A: Grant Sizing**

| Field | Type | Default | Validation |
| :---- | :---- | :---- | :---- |
| Total Target Grant Value ($) | Numeric input | $500,000 | Must be \> 0 |
| Current Share Price ($) | Numeric input | $20.00 | Used as S and K in Black-Scholes (at-the-money at grant) |
| RSU Weight (%) | Slider | 40% | Must sum to 100% with PSU and Option weights |
| PSU Weight (%) | Slider | 40% | Must sum to 100% with RSU and Option weights |
| Option Weight (%) | Slider | 20% | Must sum to 100% with RSU and PSU weights |

Weight constraint logic: When any one slider moves, the remaining two sliders adjust proportionally to maintain the 100% total. Never allow a slider to go below 0%.

### **Card B: Black-Scholes Sub-Panel (collapsible)**

Implement the Merton (1973) continuous dividend yield adjustment to Black-Scholes. This is required for TSX-listed companies that pay dividends.

| Input | Symbol | Default | Notes |
| :---- | :---- | :---- | :---- |
| Option Term (Years) | T | 5 | Time to expiry, not vesting period |
| Risk-Free Rate (%) | r | 3.5% | Use current Government of Canada 5-yr bond yield as default |
| Dividend Yield (%) | q | 0.0% | Annual continuous dividend yield. Critical for energy/resource companies. |
| Share Price | S | From Card A | At-the-money: S \= K at grant date |
| Strike Price | K | \= S (auto-set) | Set equal to S by default. Allow override for premium/discount options. |
| Volatility | σ | From Excel upload | Pulled from annualised volatility calculation. Shown as read-only once data uploaded. |

**Merton-adjusted Black-Scholes formula:**

d1 \= (ln(S/K) \+ (r \- q \+ σ²/2) × T) / (σ × √T)

d2 \= d1 \- σ × √T

Call Value \= S × exp(-q×T) × N(d1) \- K × exp(-r×T) × N(d2)

Option Fair Value % \= Call Value / S

\# This percentage is displayed to the user as a label under the Black-Scholes panel

\# e.g. 'Option Fair Value: 31.2% of share price'

**Unit calculations from grant value:**

RSU Units    \= (Grant Value × RSU Weight %)  / Share Price

PSU Units    \= (Grant Value × PSU Weight %)  / Share Price

Option Units \= (Grant Value × Option Weight %) / (Share Price × Option Fair Value %)

\# Option Fair Value % is expressed as a decimal (e.g. 0.312), not a percentage

\# This formula correctly divides by the dollar value of one option

### **Card C: PSU Relative TSR Curve Designer**

The PSU payout multiplier is driven by the company's TSR relative to the peer group median TSR over the vesting period. The outperformance gap is expressed in percentage points (pp).

| Slider | Outperformance Gap | Default Payout | Meaning |
| :---- | :---- | :---- | :---- |
| Threshold | \-10 pp (underperform peers by 10%) | 50% payout | Below this: 0% payout |
| Target | 0 pp (in line with peers) | 100% payout | Hardlocked. Cannot be moved. |
| Maximum | \+15 pp (outperform peers by 15%) | 200% payout | Above this: capped at max |

The same piecewise calculate\_multiplier() function from the STIP engine is reused here with the outperformance gap as the performance input.

## **2.3  2nd card below the first — Simulation Parameters**

| Field | Type | Default | Source |
| :---- | :---- | :---- | :---- |
| Company Expected Annual Growth Rate (μ) | Numeric input | 6.0% | User-entered. Represents management long-range plan CAGR. |
| Company Volatility (σ) | Read-only display | Calculated from Excel upload | Backend calculates annualised vol from log returns. User cannot override. |
| Peer Volatilities (σ\_i) | Read-only display table | Calculated from Excel upload | Show per-peer annualised vol as a validation sanity check. |
| Correlation Matrix | Read-only display | Calculated from Excel upload | Show Pearson correlation matrix between company and all peers. |

Primary CTA: A large, full-width Orange (\#FF6B00) button labelled 'RUN SCENARIO ANALYSIS'. Disabled until Excel file is uploaded and validated. Show a loading spinner with elapsed time during processing.

## **2.4  third card below the 1st — Realized Value Dashboard**

### **Output A: Linear Bullet Charts**

Same visual format as STIP but with different axis semantics:

* X-axis: Dollar realized value ($0 to 2× grant value)

* Navy notch: At the original grant value (e.g. $500,000) — labelled 'Grant-Date Value'

* Orange bar: Fills to the simulated realized wealth for that percentile

* Label: Shows both dollar value (e.g. '$812,000') and multiple (e.g. '1.62×')

### **Output B: Vehicle Composition Stacked Bar Chart**

Below the bullet charts, a stacked bar chart with three bars (Bear/Base/Bull). Each bar shows the breakdown of ending value by vehicle. Use distinct, non-conflicting colours:

| Vehicle | Colour | Hex | Rationale |
| :---- | :---- | :---- | :---- |
| RSU | Navy Blue | \#0A192F | Most stable vehicle — anchored to primary brand colour |
| PSU | Vibrant Orange | \#FF6B00 | Performance-contingent — matches interactive/highlight palette |
| Options | Teal / Cyan | \#0E7490 | Distinct third colour — avoids collision with Navy and Orange |

### **Output C: Year-by-Year Base Case Value Table (New)**

For the Base Case (50th percentile) only, show a three-row table projecting value at each year. This supports retention analysis conversations.

*NOTE: For cliff vesting at year 3, Year 1 and Year 2 values are estimated intrinsic values (unvested). These are indicative only — label them 'Estimated Unvested Value (Indicative)'.*

|  | Year 1 (Indicative) | Year 2 (Indicative) | Year 3 (Realized — Vesting Date) |
| :---- | :---- | :---- | :---- |
| RSU Value | Units × P(t=1) | Units × P(t=2) | Units × P(t=3) |
| PSU Value | Units × P(t=1) × 1.0 (no multiplier yet) | Units × P(t=2) × 1.0 | Units × P(t=3) × PSU Multiplier |
| Option Value | max(P(t=1) − K, 0\) × Units | max(P(t=2) − K, 0\) × Units | max(P(t=3) − K, 0\) × Units |
| Total | Sum of above | Sum of above | Sum of above (= Bullet Chart Base Case) |

## **2.5  Backend: LTIP Calculation Engine**

### **Step 1: Excel Ingestion (POST /api/v1/ltip/upload-data)**

import pandas as pd

import numpy as np

from openpyxl import load\_workbook

def ingest\_price\_data(file\_bytes: bytes) \-\> dict:

    df \= pd.read\_excel(file\_bytes, sheet\_name='Price History', index\_col=0, parse\_dates=True)

    df \= df.sort\_index()                          \# ensure chronological order

    df \= df.dropna(how='all')                     \# drop fully empty rows

    assert 'COMPANY' in df.columns, 'Price History sheet must have a COMPANY column'

    \# Validation: reject if \> 10% of any column is NaN

    nan\_pct \= df.isna().mean()

    bad\_cols \= nan\_pct\[nan\_pct \> 0.10\].index.tolist()

    if bad\_cols:

        raise ValueError(f'Columns with \>10% missing data: {bad\_cols}')

    log\_returns \= np.log(df / df.shift(1)).dropna()

    \# Annualised volatility for each asset

    annual\_vol \= log\_returns.std() \* np.sqrt(252)

    \# Pearson correlation matrix

    corr\_matrix \= log\_returns.corr().values

    return {

        'tickers': df.columns.tolist(),          \# \['COMPANY', 'CNQ', 'TOU', ...\]

        'annual\_vol': annual\_vol.to\_dict(),

        'corr\_matrix': corr\_matrix.tolist(),

        'n\_trading\_days': len(df),

    }

### **Step 2: Black-Scholes with Merton Dividend Adjustment**

from scipy.stats import norm

import math

def black\_scholes\_call(S: float, K: float, T: float,

                        r: float, q: float, sigma: float) \-\> float:

    """

    S:     Current share price (= K at grant for at-the-money)

    K:     Strike price

    T:     Option term in years (e.g. 5.0)

    r:     Annual risk-free rate (e.g. 0.035 for 3.5%)

    q:     Annual continuous dividend yield (e.g. 0.03 for 3.0%)

    sigma: Annualised volatility (from Excel ingestion)

    Returns: Absolute option value in dollars per option

    """

    d1 \= (math.log(S / K) \+ (r \- q \+ 0.5 \* sigma\*\*2) \* T) / (sigma \* math.sqrt(T))

    d2 \= d1 \- sigma \* math.sqrt(T)

    call\_value \= (S \* math.exp(-q \* T) \* norm.cdf(d1)

                 \- K \* math.exp(-r \* T) \* norm.cdf(d2))

    return call\_value

def option\_fair\_value\_pct(S, K, T, r, q, sigma) \-\> float:

    """Returns fair value as fraction of share price (e.g. 0.312 for 31.2%)"""

    return black\_scholes\_call(S, K, T, r, q, sigma) / S

### **Step 3: Unit Calculation**

def calculate\_grant\_units(grant\_value: float, share\_price: float,

                           rsu\_wt: float, psu\_wt: float, opt\_wt: float,

                           option\_fv\_pct: float) \-\> dict:

    """

    All weights are decimals summing to 1.0 (e.g. 0.4, 0.4, 0.2)

    option\_fv\_pct is the decimal output of option\_fair\_value\_pct()

    """

    return {

        'rsu\_units':    (grant\_value \* rsu\_wt) / share\_price,

        'psu\_units':    (grant\_value \* psu\_wt) / share\_price,

        'option\_units': (grant\_value \* opt\_wt) / (share\_price \* option\_fv\_pct),

    }

    \# NOTE: option denominator is (share\_price × option\_fv\_pct) \= dollar value per option

    \# This is NOT the same as dividing by share\_price alone

### **Step 4: Correlated GBM Simulation (Terminal Endpoint)**

def run\_ltip\_simulation(payload: dict, market\_data: dict) \-\> dict:

    n      \= int(payload.get('n\_simulations', 10000))

    T      \= float(payload.get('vesting\_term', 3.0))

    mu\_co  \= float(payload\['company\_growth\_rate'\])  \# e.g. 0.06

    K      \= float(payload\['strike\_price'\])

    units  \= payload\['units'\]                       \# from calculate\_grant\_units()

    tickers    \= market\_data\['tickers'\]             \# \['COMPANY', 'CNQ', ...\]

    annual\_vol \= market\_data\['annual\_vol'\]          \# {'COMPANY': 0.28, 'CNQ': 0.31, ...}

    R          \= np.array(market\_data\['corr\_matrix'\])

    L          \= np.linalg.cholesky(R)              \# Cholesky factor

    n\_assets   \= len(tickers)

    co\_idx     \= tickers.index('COMPANY')

    peer\_idx   \= \[i for i in range(n\_assets) if i \!= co\_idx\]

    \# Drift for each asset: peers use their own historical mean return

    \# Company uses user-supplied growth rate (forward-looking)

    mu\_vec \= np.array(\[

        market\_data\['annual\_return'\].get(t, 0.06) for t in tickers

    \])

    mu\_vec\[co\_idx\] \= mu\_co              \# override company with user input

    sigma\_vec \= np.array(\[annual\_vol\[t\] for t in tickers\])

    \# \--- draw correlated terminal returns \---

    Z\_ind  \= np.random.standard\_normal((n\_assets, n))  \# (n\_assets, n\_trials)

    Z\_corr \= L @ Z\_ind                                  \# correlated draws

    \# GBM terminal return factor for each asset in each trial

    \# R\_factor\[i, j\] \= S\_T / S\_0 for asset i in trial j

    R\_factor \= np.exp(

        (mu\_vec \- 0.5 \* sigma\_vec\*\*2)\[:, None\] \* T

        \+ sigma\_vec\[:, None\] \* np.sqrt(T) \* Z\_corr

    )

    S0 \= float(payload\['share\_price'\])

    S\_T \= S0 \* R\_factor                          \# terminal price matrix (n\_assets, n\_trials)

    company\_return \= R\_factor\[co\_idx\]            \# shape (n\_trials,)

    peer\_returns   \= R\_factor\[peer\_idx\]          \# shape (n\_peers, n\_trials)

    peer\_avg\_return \= peer\_returns.mean(axis=0)  \# equally-weighted peer index return

    \# NOTE: if user chose a broad index in Sheet 2, replace with index return directly

    \# Relative TSR gap in percentage points

    \# Convert R\_factor to annualised % return for gap calculation

    co\_ann\_return   \= (company\_return \*\* (1/T) \- 1\) \* 100

    peer\_ann\_return \= (peer\_avg\_return \*\* (1/T) \- 1\) \* 100

    rtsr\_gap\_pp     \= co\_ann\_return \- peer\_ann\_return   \# shape (n\_trials,)

    \# PSU multiplier via piecewise function

    psu\_curve  \= payload\['psu\_curve'\]            \# threshold/target/max from UI

    \# Normalise gap to achievement % for reuse of calculate\_multiplier()

    \# achievement 1.0 \= at-par with peers (0 pp gap)

    \# Map: threshold\_perf in curve \= (threshold\_gap \+ 100\) / 100 in gap space

    \# SIMPLER: pass the gap directly and use gap-denominated curve values

    psu\_mult \= np.array(\[

        calculate\_multiplier\_gap(g, psu\_curve) for g in rtsr\_gap\_pp

    \])

    \# \--- terminal realized value per vehicle per trial \---

    S\_T\_co \= S\_T\[co\_idx\]                         \# company terminal price (n\_trials,)

    rsu\_val    \= units\['rsu\_units'\]    \* S\_T\_co

    psu\_val    \= units\['psu\_units'\]    \* S\_T\_co \* psu\_mult

    option\_val \= units\['option\_units'\] \* np.maximum(S\_T\_co \- K, 0.0)

    total\_val  \= rsu\_val \+ psu\_val \+ option\_val  \# shape (n\_trials,)

    \# \--- sort and extract percentiles \---

    sort\_idx   \= np.argsort(total\_val)

    total\_sort \= total\_val\[sort\_idx\]

    rsu\_sort   \= rsu\_val\[sort\_idx\]

    psu\_sort   \= psu\_val\[sort\_idx\]

    opt\_sort   \= option\_val\[sort\_idx\]

    bear, base, bull \= np.percentile(total\_sort, \[10, 50, 90\])

    def extract\_case(pct):

        idx \= int(np.searchsorted(total\_sort, np.percentile(total\_sort, pct)))

        return {'rsu': float(rsu\_sort\[idx\]), 'psu': float(psu\_sort\[idx\]),

                'option': float(opt\_sort\[idx\]), 'total': float(total\_sort\[idx\])}

    return {

        'bear':  extract\_case(10),

        'base':  extract\_case(50),

        'bull':  extract\_case(90),

        'grant\_date\_value': payload\['grant\_value'\],

        'bear\_multiple':  round(bear  / payload\['grant\_value'\], 2),

        'base\_multiple':  round(base  / payload\['grant\_value'\], 2),

        'bull\_multiple':  round(bull  / payload\['grant\_value'\], 2),

    }

### **PSU Gap-Denominated Piecewise Function**

def calculate\_multiplier\_gap(gap\_pp: float, psu\_curve: dict) \-\> float:

    """

    gap\_pp: relative TSR gap in percentage points

            e.g. \+8.0 means company outperformed peers by 8pp

    psu\_curve keys: threshold\_gap, threshold\_payout,

                    max\_gap, max\_payout

                    (target is always 0pp gap \= 1.0 payout, hardlocked)

    """

    if gap\_pp \< psu\_curve\['threshold\_gap'\]:

        return 0.0

    elif gap\_pp \<= 0.0:   \# threshold to target

        slope \= (gap\_pp \- psu\_curve\['threshold\_gap'\]) / (0.0 \- psu\_curve\['threshold\_gap'\])

        return psu\_curve\['threshold\_payout'\] \+ slope \* (1.0 \- psu\_curve\['threshold\_payout'\])

    elif gap\_pp \<= psu\_curve\['max\_gap'\]:   \# target to maximum

        slope \= gap\_pp / psu\_curve\['max\_gap'\]

        return 1.0 \+ slope \* (psu\_curve\['max\_payout'\] \- 1.0)

    else:

        return psu\_curve\['max\_payout'\]

# **PART 3: INTEGRATION, ERROR HANDLING & BRAND STANDARDS**

## **3.1  API Endpoint Summary**

| Method | Endpoint | Purpose | Returns |
| :---- | :---- | :---- | :---- |
| GET | /api/v1/ltip/template | Download blank Excel template | Excel file (application/vnd.openxmlformats) |
| POST | /api/v1/ltip/upload-data | Upload completed Excel, extract market data | { tickers, annual\_vol, corr\_matrix, validation\_warnings } |
| POST | /api/v1/stip/simulate | Run STIP Monte Carlo | { bear, base, bull pct\_of\_target, dollar values, metric\_stats } |
| POST | /api/v1/ltip/simulate | Run LTIP Monte Carlo | { bear, base, bull dollar values, vehicle breakdown, multiples } |
| GET | /api/v1/stip/validate-matrix | Validate STIP correlation matrix | { valid: bool, eigenvalues: \[\] } |

## **3.2  Error Handling Requirements**

| Error Condition | HTTP Code | User-Facing Message |
| :---- | :---- | :---- |
| STIP correlation matrix not positive semi-definite | 422 | Correlation matrix is invalid. At least one value combination is mathematically impossible. Reset to defaults or reduce extreme correlation values. |
| LTIP Excel missing COMPANY column | 422 | Price History sheet must contain a column named exactly 'COMPANY'. |
| LTIP Excel ticker mismatch (Sheet 1 vs Sheet 2\) | 422 | Tickers in Peer Config sheet do not match Price History columns. Check: \[list mismatches\]. |
| LTIP Excel \>10% missing price data | 422 | Insufficient price data in column \[X\]. Minimum 90% of rows must be populated. |
| STIP scorecard weights \!= 100% | 422 | Scorecard weights sum to \[X\]%. Must equal 100% before running simulation. |
| Vehicle mix weights \!= 100% | 422 | RSU \+ PSU \+ Option weights must equal 100%. |
| Simulation produces NaN or Inf values | 500 | Simulation error — likely caused by zero or negative volatility. Check assumptions and re-upload data. |

## **3.3  Brand Colour & Styling Constants**

All UI components must reference these constants only. No ad-hoc hex values elsewhere in the codebase.

// constants/brand.ts

export const BRAND \= {

  navy:          '\#0A192F',   // Primary structure: cards, headers, structural lines

  orange:        '\#FF6B00',   // Interactive: sliders, CTA buttons, progress fills

  slate:         '\#64748B',   // Secondary: helper text, borders, inactive elements

  lightGrey:     '\#E2E8F0',   // Backgrounds: progress track, table alternating rows

  offWhite:      '\#F8FAFC',   // Card backgrounds

  white:         '\#FFFFFF',

  // Chart-specific

  rsuBar:        '\#0A192F',   // RSU — Navy

  psuBar:        '\#FF6B00',   // PSU — Orange

  optionBar:     '\#0E7490',   // Options — Teal (distinct third colour)

  targetNotch:   '\#0A192F',   // 100% / grant-value reference line

  peerBand:      '\#CBD5E1',   // Translucent peer benchmarking band

};

## **3.4  Key Implementation Decisions Summary**

Provide this table to the developer as a quick-reference of non-obvious design choices:

| Decision | Choice Made | Why |
| :---- | :---- | :---- |
| Distribution (STIP metrics) | Log-normal (default), user-switchable per metric | Financial metrics cannot be negative; log-normal prevents this. Normal allowed for bounded metrics like ESG scores. |
| Percentile calculation | numpy.percentile(\[10, 50, 90\]) | Correct interpolation vs. hardcoded array indices which are off by \~0.01%. |
| Peer return aggregation | Equally-weighted average of peer simulations | Correct for custom peer lists. For broad index, use index GBM directly — add conditional branch. |
| Correlation matrix scope (LTIP) | COMPANY is index 0; extract Z\_corr\[0\] for company, Z\_corr\[1:\] for peers | Explicit indexing prevents silent ticker-reordering bugs. |
| Vesting assumption | Cliff vest at year 3 (default) | Simplest correct implementation. Graded vesting requires annual path steps — scope separately. |
| Black-Scholes model | Merton (1973) with continuous dividend yield q | Required for any TSX-listed company paying dividends. Default q=0 is backward compatible. |
| Options chart colour | Teal (\#0E7490) | Navy and orange are already used for structure and PSU; a third distinct colour prevents confusion. |
| CapIQ integration | Removed. Excel CSV upload only. | Programmatic CapIQ API access requires a licensed key not available in this context. |

***END OF SPECIFICATION***