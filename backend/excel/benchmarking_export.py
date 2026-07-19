"""
Audit-ready Excel export for the Compensation Benchmarking module.
Mirrors the formatting conventions in backend/excel/export.py.
"""
import io
import math
from datetime import datetime

import xlsxwriter

from models.benchmarking import BenchmarkData, CalculationResponse

NAVY = "#0A192F"
ORANGE = "#FF6B00"
SLATE = "#64748B"
LIGHT_GREY = "#E2E8F0"

_PAY_LABELS = {"base": "Base Salary", "tcc": "Total Cash (TCC)", "tdc": "Total Direct Comp (TDC)", "total_comp": "Total Comp"}
_SIZE_LABELS = {"market_cap": "Market Cap", "tev": "Total Enterprise Value", "revenue": "Revenue", "total_assets": "Total Assets"}


def _section_header(ws, row, col, text, wb, merge_cols=8):
    fmt = wb.add_format({
        "bold": True, "font_size": 12, "font_color": "#FFFFFF",
        "bg_color": NAVY, "align": "left", "valign": "vcenter",
        "left": 1, "left_color": ORANGE,
    })
    ws.merge_range(row, col, row, col + merge_cols - 1, text, fmt)
    return row + 1


def export_benchmarking(data: BenchmarkData, calc: CalculationResponse) -> bytes:
    buf = io.BytesIO()
    wb = xlsxwriter.Workbook(buf, {"in_memory": True})

    hdr_fmt = wb.add_format({
        "bold": True, "font_color": "#FFFFFF", "bg_color": NAVY,
        "align": "center", "valign": "vcenter", "border": 1,
    })
    label_fmt = wb.add_format({"bold": True, "font_color": NAVY, "align": "left"})
    val_fmt = wb.add_format({"align": "right", "border": 1, "num_format": "#,##0"})
    pct_fmt = wb.add_format({"align": "right", "border": 1, "num_format": "0.0%"})
    row_alt = wb.add_format({"bg_color": "#F8FAFC", "border": 1})
    row_plain = wb.add_format({"border": 1})
    client_fmt = wb.add_format({"border": 1, "left": 2, "left_color": ORANGE, "bold": True})

    pay_label = _PAY_LABELS.get(calc.pay_metric, calc.pay_metric)
    size_label = _SIZE_LABELS.get(calc.size_metric, calc.size_metric)

    # -------------------------------------------------------------------
    # Sheet 1: Summary
    # -------------------------------------------------------------------
    ws_sum = wb.add_worksheet("Summary")
    ws_sum.set_column(0, 0, 26)
    ws_sum.set_column(1, 1, 22)

    r = 0
    r = _section_header(ws_sum, r, 0, "  Compensation Benchmarking Summary", wb, 2)
    rows = [
        ("Role", calc.role),
        ("Year", calc.year),
        ("Pay Metric", pay_label),
        ("Size Metric", size_label),
        ("Client Ticker", data.client_ticker),
        ("Reporting Currency", data.reporting_currency),
        ("Export Timestamp", datetime.now().strftime("%Y-%m-%d %H:%M")),
    ]
    for label, val in rows:
        ws_sum.write(r, 0, label, label_fmt)
        ws_sum.write(r, 1, val)
        r += 1

    r += 1
    r = _section_header(ws_sum, r, 0, "  Percentiles", wb, 4)
    ws_sum.write(r, 0, "", hdr_fmt)
    ws_sum.write(r, 1, "P25", hdr_fmt)
    ws_sum.write(r, 2, "P50", hdr_fmt)
    ws_sum.write(r, 3, "P75", hdr_fmt)
    r += 1
    ws_sum.write(r, 0, "Unweighted", label_fmt)
    ws_sum.write(r, 1, calc.unweighted.p25, val_fmt)
    ws_sum.write(r, 2, calc.unweighted.p50, val_fmt)
    ws_sum.write(r, 3, calc.unweighted.p75, val_fmt)
    r += 1
    ws_sum.write(r, 0, "Weighted (Size-Adjusted)", label_fmt)
    ws_sum.write(r, 1, calc.weighted.p25, val_fmt)
    ws_sum.write(r, 2, calc.weighted.p50, val_fmt)
    ws_sum.write(r, 3, calc.weighted.p75, val_fmt)
    r += 2

    if calc.client_pay is not None:
        ws_sum.write(r, 0, "Client Pay", label_fmt)
        ws_sum.write(r, 1, calc.client_pay, val_fmt)
        r += 1
        ws_sum.write(r, 0, "Client Percentile (Unweighted)", label_fmt)
        ws_sum.write(r, 1, f"{calc.client_percentile_unweighted:.1f}th" if calc.client_percentile_unweighted is not None else "n/a")
        r += 1
        ws_sum.write(r, 0, "Client Percentile (Weighted)", label_fmt)
        ws_sum.write(r, 1, f"{calc.client_percentile_weighted:.1f}th" if calc.client_percentile_weighted is not None else "n/a")
        r += 1

    # -------------------------------------------------------------------
    # Sheet 2: Peer Data
    # -------------------------------------------------------------------
    ws_peer = wb.add_worksheet("Peer Data")
    cols = ["Ticker", "Company", f"Pay Value ({pay_label})", f"Size Value ({size_label})",
            "Applied Weight", "Predicted Pay", "Residual", "Percentile Rank"]
    widths = [12, 26, 18, 18, 14, 16, 14, 14]
    for c, w in enumerate(widths):
        ws_peer.set_column(c, c, w)
    for c, col in enumerate(cols):
        ws_peer.write(0, c, col, hdr_fmt)

    sorted_peers = sorted(calc.peers, key=lambda p: p.pay_value)
    n = len(sorted_peers)
    for i, p in enumerate(sorted_peers):
        row = i + 1
        fmt = row_alt if i % 2 else row_plain
        pct_rank = round(100 * (i + 0.5) / n, 1) if n else None
        ws_peer.write(row, 0, p.ticker, fmt)
        ws_peer.write(row, 1, p.company_name, fmt)
        ws_peer.write(row, 2, p.pay_value, val_fmt)
        ws_peer.write(row, 3, p.size_value if p.size_value is not None else "n/a", fmt if p.size_value is None else val_fmt)
        ws_peer.write(row, 4, p.applied_weight, fmt)
        ws_peer.write(row, 5, p.predicted_pay if p.predicted_pay is not None else "n/a", fmt if p.predicted_pay is None else val_fmt)
        ws_peer.write(row, 6, p.residual if p.residual is not None else "n/a", fmt if p.residual is None else val_fmt)
        ws_peer.write(row, 7, f"{pct_rank}th" if pct_rank is not None else "n/a", fmt)

    if calc.client_pay is not None:
        client_row = len(sorted_peers) + 2
        ws_peer.write(client_row, 0, data.client_ticker, client_fmt)
        ws_peer.write(client_row, 1, "Client", client_fmt)
        ws_peer.write(client_row, 2, calc.client_pay, val_fmt)
        ws_peer.write(client_row, 7, f"{calc.client_percentile_weighted:.1f}th" if calc.client_percentile_weighted is not None else "n/a", client_fmt)

    # -------------------------------------------------------------------
    # Sheet 3: Weighted Percentiles (step-by-step, with formula cells)
    # -------------------------------------------------------------------
    ws_wp = wb.add_worksheet("Weighted Percentiles")
    wp_cols = ["Sorted Pay Value", "Weight", "Cumulative Weight (Before)", "Normalized Position"]
    for c, w in enumerate([18, 12, 24, 20]):
        ws_wp.set_column(c, c, w)
    for c, col in enumerate(wp_cols):
        ws_wp.write(0, c, col, hdr_fmt)

    sorted_by_pay = sorted(calc.peers, key=lambda p: p.pay_value)
    n2 = len(sorted_by_pay)
    total_weight_minus_last = sum(p.applied_weight for p in sorted_by_pay[:-1]) if n2 > 1 else 1
    for i, p in enumerate(sorted_by_pay):
        row = i + 1
        ws_wp.write(row, 0, p.pay_value, val_fmt)
        ws_wp.write(row, 1, p.applied_weight)
        if i == 0:
            ws_wp.write_formula(row, 2, "=0", val_fmt)
        else:
            ws_wp.write_formula(row, 2, f"=B{row}+C{row}", val_fmt)
        if n2 > 1:
            ws_wp.write_formula(row, 3, f"=C{row+1}/{total_weight_minus_last}" if total_weight_minus_last else "=0")
        else:
            ws_wp.write(row, 3, 1.0)

    note_row = n2 + 3
    ws_wp.write(note_row, 0, "P25 / P50 / P75", label_fmt)
    ws_wp.write(note_row, 1, calc.weighted.p25, val_fmt)
    ws_wp.write(note_row, 2, calc.weighted.p50, val_fmt)
    ws_wp.write(note_row, 3, calc.weighted.p75, val_fmt)
    ws_wp.write(note_row + 2, 0, "Interpolated at the normalized-position crossing for q=0.25/0.50/0.75 (linear interpolation between the two surrounding rows above).", wb.add_format({"italic": True, "font_color": SLATE, "font_size": 9}))

    # -------------------------------------------------------------------
    # Sheet 4: Regression
    # -------------------------------------------------------------------
    ws_reg = wb.add_worksheet("Regression")
    ws_reg.set_column(0, 0, 22)
    ws_reg.set_column(1, 1, 18)

    r = 0
    r = _section_header(ws_reg, r, 0, "  Weighted Least Squares Regression — log(pay) on log(size)", wb, 2)
    reg = calc.regression
    if reg.regression_valid:
        for label, val in [
            ("Slope", round(reg.slope, 4)),
            ("Intercept", round(reg.intercept, 4)),
            ("R-squared", round(reg.r_squared, 4)),
            ("Client Predicted Pay", reg.client_predicted_pay),
        ]:
            ws_reg.write(r, 0, label, label_fmt)
            ws_reg.write(r, 1, val)
            r += 1
    else:
        ws_reg.write(r, 0, reg.regression_warning or "Regression not valid for this peer set.", wb.add_format({"italic": True, "font_color": SLATE}))
        r += 1

    r += 2
    ws_reg.write(r, 0, "Ticker", hdr_fmt)
    ws_reg.write(r, 1, "log(Size)", hdr_fmt)
    ws_reg.write(r, 2, "log(Pay)", hdr_fmt)
    ws_reg.write(r, 3, "Fitted log(Pay)", hdr_fmt)
    ws_reg.write(r, 4, "Predicted Pay", hdr_fmt)
    ws_reg.write(r, 5, "Residual", hdr_fmt)
    r += 1
    for p in calc.peers:
        if p.size_value is None or p.size_value <= 0:
            continue
        ws_reg.write(r, 0, p.ticker)
        ws_reg.write(r, 1, round(math.log(p.size_value), 4))
        ws_reg.write(r, 2, round(math.log(p.pay_value), 4))
        if reg.regression_valid and p.predicted_pay:
            ws_reg.write(r, 3, round(math.log(p.predicted_pay), 4))
            ws_reg.write(r, 4, round(p.predicted_pay, 0), val_fmt)
            ws_reg.write(r, 5, round(p.residual, 0), val_fmt)
        r += 1

    wb.close()
    buf.seek(0)
    return buf.read()
