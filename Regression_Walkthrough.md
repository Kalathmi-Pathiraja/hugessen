# Regression & Aging — Hand-Calculation Walkthrough

All numbers below come from **Hudbay 2026 EC Benchmarking v7.xlsx**, CEO tab, year 2025,
Size Metric = **Market Cap**, Pay Metric = **Target TDC**. You can reproduce every step with a
calculator. Platform outputs are shown to full precision so you can match them exactly.

Client (Hudbay): Market Cap = **$14,317,320,280**, Target TDC = **$5,334,519.85**

---

## 1. Suggested peer weight

Formula: `w = exp(−1.5 × |ln(peer size) − ln(client size)|)`, clamped to [0.10, 1.00].

**Kinross (TSX:K)** — Market Cap $42,426,709,220:

```
distance = |ln(42,426,709,220) − ln(14,317,320,280)|
         = |24.4711 − 23.3848| = 1.086308
w = exp(−1.5 × 1.086308) = exp(−1.629462) = 0.196
```

**IAMGOLD (TSX:IMG)** — Market Cap $13,282,440,000 (close to Hudbay's size):

```
distance = |ln(13,282,440,000) − ln(14,317,320,280)| = 0.075027
w = exp(−1.5 × 0.075027) = 0.894
```

Platform shows Suggested Wt. **0.20** for Kinross and **0.89** for IAMGOLD. A peer twice
Hudbay's size gets ≈ exp(−1.5 × ln 2) = 0.35; ten times the size floors out at 0.10.

## 2. Weighted least-squares regression (log-log)

Model: `ln(pay) = a + b·ln(size)`, weighted by the applied weights.
With x = ln(size), y = ln(pay), w = applied weight, compute five sums over the 14 peers:

| Sum | Value |
|---|---|
| Σw | 7.043 |
| Σw·x | 164.71140 |
| Σw·y | 109.42023 |
| Σw·x² | 3,853.71273 |
| Σw·x·y | 2,559.41487 |

Then:

```
b (slope) = (Σw·Σwxy − Σwx·Σwy) / (Σw·Σwx² − (Σwx)²)
          = (7.043×2559.41487 − 164.71140×109.42023) /
            (7.043×3853.71273 − 164.71140²)
          = 0.26995

a (intercept) = (Σwy − b·Σwx) / Σw
              = (109.42023 − 0.26995×164.71140) / 7.043
              = 9.22280
```

Platform: slope **0.26999...**, intercept **9.2217...** — the tiny difference is because the
table above uses display-rounded weights (0.196 vs 0.19617...); with full-precision weights
the formulas give the platform's numbers exactly.

Interpretation: slope 0.27 means a 10% larger company pays ≈ 2.7% more CEO TDC, all else equal.

## 3. Client's size-predicted pay

```
predicted = exp(a + b·ln(client size))
          = exp(9.2217 + 0.26999 × ln(14,317,320,280))
          = exp(9.2217 + 0.26999 × 23.38485)
          = exp(15.53525)
          ≈ $5,584,833
```

Platform: **$5,584,832.69**. Hudbay's actual Target TDC ($5,334,520) sits ~4.5% below its
size-predicted level.

## 4. Weighted percentile rank of the client

Rank = (sum of weights of peers whose pay ≤ client pay) ÷ (total weight) × 100.

Peers at or below $5,334,519.85: Capstone (0.628), Centerra (0.178), IAMGOLD (0.894),
Eldorado (0.732), OceanaGold (0.413), Lundin (0.335) → Σ = 3.180.

```
rank = 3.180 / 7.043 × 100 = 45.2th percentile
```

Platform: **45.2** ✓

## 5. Data-aging spot-check (two peers, spec §1.6)

Aging factor = 3% (`'Raw Data'!H13`). All figures in $000s to match the Excel's aging block.

**First Quantum (TSX:FM)** — next-year salary **disclosed** (1,872.583), so no multiplier:

```
aged salary = 1,872.583            (disclosed — used as-is)
STIP  = 1,872.583 × 100%  = 1,872.583
TCC   = 1,872.583 + 1,872.583 = 3,745.166
LTIP  = 1,872.583 × 225%  = 4,213.312
TDC   = 3,745.166 + 4,213.312 = 7,958.478      → Excel CEO!W47 = 7,958.478 ✓
```

**Kinross (TSX:K)** — no disclosure, so multiplier applies; Target LTI% is undisclosed so
the 3-year-average LTIP% (315.333%) stands in (same fallback as Excel CEO!U9):

```
aged salary = 1,733.285 × 1.03 = 1,785.284
STIP  = 1,785.284 × 150%      = 2,677.926
TCC   = 1,785.284 + 2,677.926 = 4,463.209
LTIP  = 1,785.284 × 315.333%  = 5,629.595
TDC   = 4,463.209 + 5,629.595 = 10,092.804     → Excel CEO!W48 = 10,092.804 ✓
```

Hudbay's own row is **never aged**: the platform carries 5,334.520 into the 2026E column
unchanged, matching the Excel (CEO!W41 = W39).

### Known manual overrides in the source model (not replicated)

- **Centerra (TSX:CG)** is hand-deleted from the Excel's 2026E column (its TDC formula was
  overwritten with "-"), so the Excel's 2026E percentiles exclude it. The platform computes
  Centerra's aged TDC (3,951.34) normally and includes it. Excluding it reproduces the
  Excel's 2026E stats to the penny (P50 5,820.288 vs platform-with-CG 5,701.596).
- The client's **2024** value on the "CEO - YoY" tab is hardcoded at 5,080.496, which matches
  neither the Import 2024 Data tab (5,457.572) nor any current formula. The platform uses the
  Import tab's value.
