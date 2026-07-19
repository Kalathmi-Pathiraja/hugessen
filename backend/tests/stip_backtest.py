"""
STIP Piecewise Multiplier — Deterministic Backtest
===================================================
Tests the five-step pipeline at six exact, hand-verifiable performance states.
No Monte Carlo is involved — inputs are deterministic so results can be
cross-checked in Excel using a nested-IF formula.

Run from the backend/ directory:
    python3 tests/stip_backtest.py

Outputs:
    STIP_Backtest.xlsx   — branded workbook with manual Excel formulas
                           for the user to open and independently verify
    Console              — PASS/FAIL table printed to stdout
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import xlsxwriter
from engine.stip_engine import (
    calculate_multiplier,
    calculate_dollar_payout,
    calculate_payout_pct_of_target,
)

# ── Plan design parameters (defaults from the UI) ──────────────────────────
BASE_SALARY   = 400_000
TARGET_STIP   = 0.60          # 60%
TARGET_OPP    = BASE_SALARY * TARGET_STIP   # $240,000

CURVE = {
    "threshold_enabled": True,
    "threshold_perf":    0.80,   # 80% performance
    "threshold_payout":  0.50,   # 50% payout at threshold
    "target_perf":       1.00,   # 100% performance
    "target_payout":     1.00,   # 100% payout at target
    "max_perf":          1.20,   # 120% performance
    "max_payout":        2.00,   # 200% payout cap
}

# ── Six deterministic test cases ───────────────────────────────────────────
# (label, performance_pct, hand_calculated_expected_multiplier)
TEST_CASES = [
    ("Deep Bear",          0.50, 0.0000),   # below threshold → zero payout
    ("At Threshold",       0.80, 0.5000),   # exactly at threshold → 50%
    ("Mid-Ramp (T→Tgt)",   0.90, 0.7500),   # halfway between threshold & target
                                             # 50% + (90-80)/(100-80) × (100-50) = 75%
    ("At Target",          1.00, 1.0000),   # exactly at target → 100%
    ("At Maximum Cap",     1.20, 2.0000),   # exactly at max → 200%
    ("Above Cap",          1.50, 2.0000),   # above max → still capped at 200%
]

# ─────────────────────────────────────────────────────────────────────────────
# 1. Run engine and compare
# ─────────────────────────────────────────────────────────────────────────────

print()
print("=" * 80)
print("  STIP Piecewise Multiplier — Deterministic Backtest")
print("=" * 80)
print(f"  Curve design:  Threshold {CURVE['threshold_perf']*100:.0f}%→{CURVE['threshold_payout']*100:.0f}%  |"
      f"  Target 100%→100%  |  Max {CURVE['max_perf']*100:.0f}%→{CURVE['max_payout']*100:.0f}%")
print(f"  Target Opp:    ${TARGET_OPP:,.0f}  (Base ${BASE_SALARY:,.0f} × {TARGET_STIP*100:.0f}% STIP)")
print()
print(f"  {'Status':<7} {'Case':<22} {'Perf':>6} {'Expected':>10} {'Engine':>10} {'Diff':>8} {'Dollar Payout':>15}")
print("  " + "-" * 78)

all_pass = True
results_for_excel = []

for label, perf, expected_mult in TEST_CASES:
    # Step 2: multiplier
    actual_mult = calculate_multiplier(perf, CURVE)
    diff = abs(actual_mult - expected_mult)
    passed = diff < 1e-9

    # Step 4: dollar payout
    dollar = calculate_dollar_payout(actual_mult, TARGET_OPP)

    status = "✓ PASS" if passed else "✗ FAIL"
    if not passed:
        all_pass = False

    print(f"  {status:<7} {label:<22} {perf*100:>5.0f}%  "
          f"{expected_mult:>9.4f}  {actual_mult:>9.4f}  {diff:>8.1e}  ${dollar:>13,.0f}")

    results_for_excel.append({
        "label":         label,
        "perf_pct":      perf * 100,
        "expected_mult": expected_mult,
        "engine_mult":   actual_mult,
        "diff":          diff,
        "passed":        passed,
        "dollar":        dollar,
        "pct_of_target": calculate_payout_pct_of_target(dollar, TARGET_OPP) * 100,
    })

print()
print("  " + ("ALL TESTS PASSED ✓" if all_pass else "FAILURES DETECTED ✗"))
print()

# ─────────────────────────────────────────────────────────────────────────────
# 2. Generate Excel workbook
# ─────────────────────────────────────────────────────────────────────────────
NAVY   = "#0A192F"
ORANGE = "#FF6B00"
SLATE  = "#64748B"
GREEN  = "#16A34A"
RED    = "#DC2626"
OFF_WHITE = "#F8FAFC"
LIGHT_GREY = "#E2E8F0"

out_path = os.path.join(os.path.dirname(__file__), "STIP_Backtest.xlsx")
wb = xlsxwriter.Workbook(out_path)

# ── Format library ─────────────────────────────────────────────────────────
def f(**kw):
    return wb.add_format(kw)

title_fmt   = f(bold=True, font_size=16, font_color=NAVY, bottom=2, bottom_color=ORANGE)
hdr_fmt     = f(bold=True, font_color="#FFFFFF", bg_color=NAVY, align="center",
                valign="vcenter", border=1, text_wrap=True)
orange_hdr  = f(bold=True, font_color="#FFFFFF", bg_color=ORANGE, align="center",
                valign="vcenter", border=1)
label_fmt   = f(bold=True, font_color=NAVY, align="left")
val_fmt     = f(align="right", border=1, num_format="#,##0")
pct_fmt     = f(align="center", border=1, num_format='0.0"%"')
mult_fmt    = f(align="center", border=1, num_format='0.0000')
pass_fmt    = f(bold=True, font_color=GREEN, align="center", border=1, bg_color="#F0FDF4")
fail_fmt    = f(bold=True, font_color=RED,   align="center", border=1, bg_color="#FEF2F2")
formula_fmt = f(font_name="Courier New", font_size=9, font_color=SLATE,
                border=1, text_wrap=True, valign="vcenter", bg_color=OFF_WHITE)
note_fmt    = f(italic=True, font_color=SLATE, font_size=10, text_wrap=True)
section_fmt = f(bold=True, font_size=11, font_color=NAVY, top=2, top_color=ORANGE,
                bottom=1, bottom_color=LIGHT_GREY)
even_fmt    = f(border=1, align="center", bg_color="#FFFFFF")
odd_fmt     = f(border=1, align="center", bg_color=OFF_WHITE)

# ── Sheet 1: Test Results ──────────────────────────────────────────────────
ws = wb.add_worksheet("Test Results")
ws.set_column("A:A", 24)
ws.set_column("B:B", 14)
ws.set_column("C:C", 16)
ws.set_column("D:D", 16)
ws.set_column("E:E", 12)
ws.set_column("F:F", 18)
ws.set_column("G:G", 16)

r = 0
ws.merge_range(r, 0, r, 6, "STIP Piecewise Multiplier — Deterministic Backtest", title_fmt)
r += 1
ws.merge_range(r, 0, r, 6,
    "This sheet tests the engine at six exact, hand-verifiable performance levels. "
    "No Monte Carlo is used — results are deterministic and should match the Excel formula column exactly.",
    note_fmt)
ws.set_row(r, 36)
r += 2

# Plan parameters sub-table
ws.write(r, 0, "Plan Design Parameters", section_fmt)
ws.merge_range(r, 1, r, 6, "", section_fmt)
r += 1
params = [
    ("Base Salary",              f"${BASE_SALARY:,.0f}"),
    ("Target STIP %",            f"{TARGET_STIP*100:.0f}%"),
    ("Target Opportunity",       f"${TARGET_OPP:,.0f}"),
    ("Threshold Performance",    f"{CURVE['threshold_perf']*100:.0f}%"),
    ("Threshold Payout",         f"{CURVE['threshold_payout']*100:.0f}%"),
    ("Target Performance",       "100%  (hardlocked)"),
    ("Target Payout",            "100%  (hardlocked)"),
    ("Maximum Performance",      f"{CURVE['max_perf']*100:.0f}%"),
    ("Maximum Payout",           f"{CURVE['max_payout']*100:.0f}%"),
]
for p, v in params:
    ws.write(r, 0, p, label_fmt)
    ws.merge_range(r, 1, r, 2, v)
    r += 1

r += 1

# Results table
ws.write(r, 0, "Test Case",            hdr_fmt)
ws.write(r, 1, "Performance %",        hdr_fmt)
ws.write(r, 2, "Expected Multiplier",  hdr_fmt)
ws.write(r, 3, "Engine Result",        hdr_fmt)
ws.write(r, 4, "Status",               hdr_fmt)
ws.write(r, 5, "Dollar Payout ($)",    hdr_fmt)
ws.write(r, 6, "% of Target",          hdr_fmt)
ws.set_row(r, 30)
r += 1

for i, res in enumerate(results_for_excel):
    row_fmt = even_fmt if i % 2 == 0 else odd_fmt
    ws.write(r, 0, res["label"],        f(bold=True, font_color=NAVY, border=1, bg_color="#FFFFFF" if i%2==0 else OFF_WHITE))
    ws.write(r, 1, res["perf_pct"],     f(align="center", border=1, num_format='0"%"', bg_color="#FFFFFF" if i%2==0 else OFF_WHITE))
    ws.write(r, 2, res["expected_mult"], f(align="center", border=1, num_format="0.0000", bg_color="#FFFFFF" if i%2==0 else OFF_WHITE))
    ws.write(r, 3, res["engine_mult"],  f(align="center", border=1, num_format="0.0000", bg_color="#FFFFFF" if i%2==0 else OFF_WHITE))
    ws.write(r, 4, "PASS ✓" if res["passed"] else "FAIL ✗",
             pass_fmt if res["passed"] else fail_fmt)
    ws.write(r, 5, res["dollar"],       f(align="right", border=1, num_format='"$"#,##0', bg_color="#FFFFFF" if i%2==0 else OFF_WHITE))
    ws.write(r, 6, res["pct_of_target"], f(align="center", border=1, num_format='0.0"%"', bg_color="#FFFFFF" if i%2==0 else OFF_WHITE))
    r += 1

# ── Sheet 2: Excel Verification Formulas ──────────────────────────────────
ws2 = wb.add_worksheet("Verify in Excel")
ws2.set_column("A:A", 24)
ws2.set_column("B:B", 14)
ws2.set_column("C:C", 30)
ws2.set_column("D:D", 22)
ws2.set_column("E:E", 12)
ws2.set_column("F:F", 20)

r2 = 0
ws2.merge_range(r2, 0, r2, 5, "Independent Excel Verification — Piecewise Multiplier Formula", title_fmt)
r2 += 1
ws2.merge_range(r2, 0, r2, 5,
    "Column C contains the Excel nested-IF formula that independently computes the multiplier. "
    "Column D runs the formula live. Column E shows whether D matches the engine (Column 'Engine Result'). "
    "You can verify this without any Python — just check that C and D agree for every row.",
    note_fmt)
ws2.set_row(r2, 54)
r2 += 2

# Named cells for curve parameters (makes formula readable)
ws2.write(r2, 0, "Named Parameters (for formula reference)", section_fmt)
ws2.merge_range(r2, 1, r2, 5, "", section_fmt)
r2 += 1

named = [
    ("Threshold_Perf",   CURVE["threshold_perf"],   "B{r}"),
    ("Threshold_Payout", CURVE["threshold_payout"],  "B{r}"),
    ("Target_Perf",      CURVE["target_perf"],       "B{r}"),
    ("Target_Payout",    CURVE["target_payout"],     "B{r}"),
    ("Max_Perf",         CURVE["max_perf"],          "B{r}"),
    ("Max_Payout",       CURVE["max_payout"],        "B{r}"),
]
param_refs = {}
for name, val, _ in named:
    ws2.write(r2, 0, name, label_fmt)
    ws2.write(r2, 1, val, f(align="right", num_format="0.00"))
    param_refs[name] = f"$B${r2+1}"   # 1-based row for Excel formulas
    r2 += 1

r2 += 1

# Column headers
ws2.write(r2, 0, "Test Case",                  orange_hdr)
ws2.write(r2, 1, "Performance (decimal)",      orange_hdr)
ws2.write(r2, 2, "Excel Nested-IF Formula",    orange_hdr)
ws2.write(r2, 3, "Formula Result (live)",      orange_hdr)
ws2.write(r2, 4, "Engine Match?",              orange_hdr)
ws2.write(r2, 5, "Dollar Payout ($)",          orange_hdr)
ws2.set_row(r2, 30)
r2 += 1

# Convenience: cell references for the named params
TP  = param_refs["Threshold_Perf"]
TPY = param_refs["Threshold_Payout"]
GT  = param_refs["Target_Perf"]
GTY = param_refs["Target_Payout"]
MP  = param_refs["Max_Perf"]
MPY = param_refs["Max_Payout"]
# Target opportunity as literal
TO  = TARGET_OPP

first_data_row = r2 + 1  # 1-based

for i, res in enumerate(results_for_excel):
    perf_cell = f"B{r2+1}"
    engine_val = res["engine_mult"]

    # Nested IF — mirrors calculate_multiplier() exactly
    # =IF(B<TP, 0,
    #    IF(B<=GT, TPY+(B-TP)/(GT-TP)*(GTY-TPY),
    #       IF(B<=MP, GTY+(B-GT)/(MP-GT)*(MPY-GTY),
    #          MPY)))
    nested_if = (
        f"=IF({perf_cell}<{TP},0,"
        f"IF({perf_cell}<={GT},"
        f"{TPY}+({perf_cell}-{TP})/({GT}-{TP})*({GTY}-{TPY}),"
        f"IF({perf_cell}<={MP},"
        f"{GTY}+({perf_cell}-{GT})/({MP}-{GT})*({MPY}-{GTY}),"
        f"{MPY})))"
    )

    bg = "#FFFFFF" if i % 2 == 0 else OFF_WHITE

    ws2.write(r2, 0, res["label"],  f(bold=True, font_color=NAVY, border=1, bg_color=bg))
    ws2.write(r2, 1, res["perf_pct"] / 100,
              f(align="center", border=1, num_format="0.00", bg_color=bg))
    ws2.write(r2, 2, nested_if, formula_fmt)   # formula shown as text (readable)
    ws2.write_formula(r2, 3, nested_if,
              f(align="center", border=1, num_format="0.0000", bg_color=bg))
    # Match check: |D - engine| < tolerance
    match_formula = f'=IF(ABS(D{r2+1}-{engine_val})<0.00001,"MATCH ✓","MISMATCH ✗")'
    ws2.write_formula(r2, 4, match_formula, pass_fmt)
    ws2.write_formula(r2, 5, f"=D{r2+1}*{TO}",
              f(align="right", border=1, num_format='"$"#,##0', bg_color=bg))
    r2 += 1

# ── Sheet 3: How the Math Works ───────────────────────────────────────────
ws3 = wb.add_worksheet("How the Math Works")
ws3.set_column("A:A", 70)
ws3.set_row(0, 28)
ws3.merge_range(0, 0, 0, 0, "Piecewise Linear Interpolation — Reference", title_fmt)

explanation = [
    "",
    "THE PIECEWISE CURVE",
    "─────────────────────────────────────────────────────────────────────",
    "The curve has three segments, defined by three anchor points:",
    "",
    "  • Threshold  →  (threshold_perf,  threshold_payout)   e.g. (80%, 50%)",
    "  • Target     →  (100%,            100%)               hardlocked",
    "  • Maximum    →  (max_perf,        max_payout)          e.g. (120%, 200%)",
    "",
    "SEGMENT RULES",
    "─────────────────────────────────────────────────────────────────────",
    "",
    "  Performance < threshold_perf:            multiplier = 0   (zero-pay floor)",
    "",
    "  threshold_perf ≤ Performance ≤ 100%:     linear interpolation",
    "    multiplier = threshold_payout",
    "               + (performance − threshold_perf)",
    "                 ÷ (100% − threshold_perf)",
    "                 × (100% − threshold_payout)",
    "",
    "  100% < Performance ≤ max_perf:           linear interpolation",
    "    multiplier = 100%",
    "               + (performance − 100%)",
    "                 ÷ (max_perf − 100%)",
    "                 × (max_payout − 100%)",
    "",
    "  Performance > max_perf:                  multiplier = max_payout  (cap)",
    "",
    "WORKED EXAMPLE (Mid-Ramp case — 90% performance)",
    "─────────────────────────────────────────────────────────────────────",
    "  threshold_perf = 80%, threshold_payout = 50%, target = 100% / 100%",
    "",
    "  90% falls in segment 1 (threshold → target):",
    "    multiplier = 50%",
    "               + (90% − 80%) ÷ (100% − 80%) × (100% − 50%)",
    "               = 50% + (10% ÷ 20%) × 50%",
    "               = 50% + 0.5 × 50%",
    "               = 50% + 25%",
    "               = 75%  ← matches engine ✓",
    "",
    "  Dollar payout = 75% × $240,000 = $180,000",
    "",
    "WHAT THE MONTE CARLO ADDS",
    "─────────────────────────────────────────────────────────────────────",
    "  The backtest above tests the piecewise function deterministically.",
    "  The Monte Carlo wraps this function in 10,000 draws from a correlated",
    "  log-normal distribution (mean achievement = 100% of budget, spread = σ).",
    "  The Bear/Base/Bull percentiles are the P10/P50/P90 of those 10,000 outputs.",
    "  Changing the budget does not change the % distribution — it scales the",
    "  raw simulated metric values only (shown in the 'Simulated Outcomes' table).",
]

for i, line in enumerate(explanation, 1):
    style = section_fmt if line and line.isupper() and "─" not in line else note_fmt
    ws3.write(i, 0, line, style)
    if line and line.isupper() and "─" not in line:
        ws3.set_row(i, 22)

wb.close()

print(f"  Backtest workbook saved → {out_path}")
print()
if all_pass:
    print("  All 6 deterministic test cases PASSED.")
    print("  Open STIP_Backtest.xlsx and check the 'Verify in Excel' sheet.")
    print("  Every 'Formula Result' cell should show MATCH ✓.")
else:
    print("  WARNING: Some test cases failed — review 'Test Results' sheet.")
print()
