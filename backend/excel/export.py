"""
Excel export engine using xlsxwriter.
Produces a branded workbook with native dynamic charts for both STIP and LTIP.
"""
import io
from typing import Any, Dict
import xlsxwriter

NAVY = "#0A192F"
ORANGE = "#FF6B00"
SLATE = "#64748B"
LIGHT_GREY = "#E2E8F0"
OFF_WHITE = "#F8FAFC"
TEAL = "#0E7490"


def _fmt(wb, **kwargs):
    return wb.add_format(kwargs)


def _section_header(ws, row, col, text, wb, merge_cols=8):
    fmt = wb.add_format({
        "bold": True, "font_size": 12, "font_color": "#FFFFFF",
        "bg_color": NAVY, "align": "left", "valign": "vcenter",
        "left": 1, "left_color": ORANGE,
    })
    ws.merge_range(row, col, row, col + merge_cols - 1, text, fmt)
    return row + 1


def export_stip(inputs: Dict[str, Any], results: Dict[str, Any]) -> bytes:
    buf = io.BytesIO()
    wb = xlsxwriter.Workbook(buf, {"in_memory": True})

    # Format library
    hdr_fmt = wb.add_format({
        "bold": True, "font_color": "#FFFFFF", "bg_color": NAVY,
        "align": "center", "valign": "vcenter", "border": 1,
    })
    orange_hdr = wb.add_format({
        "bold": True, "font_color": "#FFFFFF", "bg_color": ORANGE,
        "align": "center", "valign": "vcenter", "border": 1,
    })
    label_fmt = wb.add_format({
        "bold": True, "font_color": NAVY, "align": "left", "valign": "vcenter",
    })
    val_fmt = wb.add_format({
        "align": "right", "valign": "vcenter", "border": 1,
        "num_format": "#,##0",
    })
    pct_fmt = wb.add_format({
        "align": "right", "valign": "vcenter", "border": 1,
        "num_format": "0.0%",
    })
    pct_plain = wb.add_format({
        "align": "right", "valign": "vcenter", "border": 1,
        "num_format": "0.0",
    })
    bold_orange = wb.add_format({"bold": True, "font_color": ORANGE})
    bold_navy = wb.add_format({"bold": True, "font_color": NAVY})
    italic_grey = wb.add_format({"italic": True, "font_color": SLATE, "font_size": 9})

    # -----------------------------------------------------------------------
    # Sheet 1: Inputs
    # -----------------------------------------------------------------------
    ws_in = wb.add_worksheet("Inputs")
    ws_in.set_column(0, 0, 32)
    ws_in.set_column(1, 1, 20)

    r = 0
    r = _section_header(ws_in, r, 0, "  STIP Design Inputs", wb, 8)

    rows = [
        ("Base Salary ($)", f"${inputs['base_salary']:,.0f}"),
        ("Target STIP (%)", f"{inputs['target_stip_pct']*100:.0f}%"),
        ("Target Opportunity ($)", f"${inputs['base_salary']*inputs['target_stip_pct']:,.0f}"),
        ("Distribution Assumption", inputs['distribution'].title()),
        ("Simulations", f"{inputs['n_simulations']:,}"),
    ]
    for label, val in rows:
        ws_in.write(r, 0, label, label_fmt)
        ws_in.write(r, 1, val)
        r += 1

    r += 1
    r = _section_header(ws_in, r, 0, "  Payout Curve Design", wb, 8)
    cd = inputs["curve_design"]
    curve_rows = [
        ("Threshold Enabled", "Yes" if cd.get("threshold_enabled") else "No"),
        ("Threshold Performance", f"{cd.get('threshold_perf', 0.8)*100:.0f}%"),
        ("Threshold Payout", f"{cd.get('threshold_payout', 0.5)*100:.0f}%"),
        ("Target Performance", "100%"),
        ("Target Payout", "100%"),
        ("Maximum Performance", f"{cd['max_perf']*100:.0f}%"),
        ("Maximum Payout", f"{cd['max_payout']*100:.0f}%"),
    ]
    for label, val in curve_rows:
        ws_in.write(r, 0, label, label_fmt)
        ws_in.write(r, 1, val)
        r += 1

    r += 1
    r = _section_header(ws_in, r, 0, "  Scorecard Metrics", wb, 8)
    ws_in.write(r, 0, "Metric", hdr_fmt)
    ws_in.write(r, 1, "Weight", hdr_fmt)
    ws_in.write(r, 2, "Budget Target", hdr_fmt)
    ws_in.write(r, 3, "Volatility σ", hdr_fmt)
    ws_in.set_column(2, 3, 16)
    r += 1
    for m in inputs["scorecard_metrics"]:
        ws_in.write(r, 0, m["name"])
        ws_in.write(r, 1, f"{m['weight']*100:.0f}%")
        ws_in.write(r, 2, f"{m['budget_target']:,.2f}")
        ws_in.write(r, 3, f"{m['volatility_sigma']*100:.1f}%")
        r += 1

    # -----------------------------------------------------------------------
    # Sheet 2: Results Summary
    # -----------------------------------------------------------------------
    ws_res = wb.add_worksheet("Results")
    ws_res.set_column(0, 0, 22)
    ws_res.set_column(1, 3, 18)

    r = 0
    r = _section_header(ws_res, r, 0, "  STIP Simulation Results", wb, 4)

    ws_res.write(r, 0, "Scenario", hdr_fmt)
    ws_res.write(r, 1, "% of Target", hdr_fmt)
    ws_res.write(r, 2, "Dollar Payout ($)", hdr_fmt)
    ws_res.write(r, 3, "vs. Target Opp.", hdr_fmt)
    r += 1

    tgt = results["target_opportunity"]
    scenarios = [
        ("Bear Case (P10)", results["bear_pct_of_target"], results["bear_dollar"]),
        ("Base Case (P50)", results["base_pct_of_target"], results["base_dollar"]),
        ("Bull Case (P90)", results["bull_pct_of_target"], results["bull_dollar"]),
    ]
    colors = [SLATE, ORANGE, NAVY]
    for (label, pct, dollar), color in zip(scenarios, colors):
        fmt_lbl = wb.add_format({"bold": True, "font_color": color, "border": 1})
        ws_res.write(r, 0, label, fmt_lbl)
        ws_res.write(r, 1, pct, pct_plain)
        ws_res.write(r, 2, dollar, val_fmt)
        ws_res.write(r, 3, f"{pct:.1f}%")
        r += 1

    r += 1
    ws_res.write(r, 0, "Target Opportunity", label_fmt)
    ws_res.write(r, 1, f"${tgt:,.0f}")

    # -----------------------------------------------------------------------
    # Sheet 3: Metric Breakdown
    # -----------------------------------------------------------------------
    ws_met = wb.add_worksheet("Metric Breakdown")
    ws_met.set_column(0, 0, 22)
    ws_met.set_column(1, 5, 20)

    r = 0
    r = _section_header(ws_met, r, 0, "  Per-Metric Probability Breakdown", wb, 6)

    cols = ["Metric", "Weight (%)", "Prob. Zero Payout (%)",
            "Prob. ≥ Target (%)", "Prob. At Max (%)", "Median Multiplier"]
    for c, col in enumerate(cols):
        ws_met.write(r, c, col, hdr_fmt if c > 0 else orange_hdr)
    r += 1

    for stat in results["metric_stats"]:
        ws_met.write(r, 0, stat["name"])
        ws_met.write(r, 1, stat["weight_pct"])
        ws_met.write(r, 2, stat["prob_zero"])
        ws_met.write(r, 3, stat["prob_target"])
        ws_met.write(r, 4, stat["prob_max"])
        ws_met.write(r, 5, stat["median_mult"])
        r += 1

    # -----------------------------------------------------------------------
    # Sheet 4: Distribution (P1–P100)
    # -----------------------------------------------------------------------
    ws_dist = wb.add_worksheet("Distribution")
    ws_dist.set_column(0, 1, 20)

    r = 0
    r = _section_header(ws_dist, r, 0, "  Payout Distribution (P1–P100)", wb, 2)
    ws_dist.write(r, 0, "Percentile", hdr_fmt)
    ws_dist.write(r, 1, "Payout (% of Target)", hdr_fmt)
    r += 1

    dist_start_row = r
    for i, val in enumerate(results["percentile_distribution"], 1):
        ws_dist.write(r, 0, i)
        ws_dist.write(r, 1, round(val, 2))
        r += 1
    dist_end_row = r - 1

    # -----------------------------------------------------------------------
    # Sheet 5: Charts
    # -----------------------------------------------------------------------
    ws_chart = wb.add_worksheet("Charts")
    ws_chart.write(0, 0, "STIP Scenario Analysis — Charts", wb.add_format({
        "bold": True, "font_size": 14, "font_color": NAVY,
    }))

    # Chart A: Payout distribution line
    chart_dist = wb.add_chart({"type": "line"})
    chart_dist.add_series({
        "name": "Payout % of Target",
        "categories": ["Distribution", dist_start_row, 0, dist_end_row, 0],
        "values": ["Distribution", dist_start_row, 1, dist_end_row, 1],
        "line": {"color": ORANGE, "width": 2.25},
    })
    chart_dist.set_title({"name": "Payout Distribution (P1–P100)"})
    chart_dist.set_x_axis({"name": "Percentile"})
    chart_dist.set_y_axis({"name": "Payout (% of Target)"})
    chart_dist.set_size({"width": 480, "height": 288})
    chart_dist.set_style(10)
    ws_chart.insert_chart(2, 0, chart_dist)

    # Chart B: Bear / Base / Bull bar
    chart_bar = wb.add_chart({"type": "bar"})
    bear_r = 1 + 1  # row index in Results sheet (0-based: header=0, hdr2=1, bear=2)
    chart_bar.add_series({
        "name": "Bear",
        "categories": ["Results", 2, 0, 4, 0],
        "values": ["Results", 2, 1, 4, 1],
        "fill": {"color": SLATE},
    })
    chart_bar.set_title({"name": "Bear / Base / Bull Payout (% of Target)"})
    chart_bar.set_x_axis({"name": "% of Target"})
    chart_bar.set_size({"width": 480, "height": 288})
    chart_bar.set_style(10)
    ws_chart.insert_chart(2, 8, chart_bar)

    wb.close()
    buf.seek(0)
    return buf.read()


def export_ltip(inputs: Dict[str, Any], results: Dict[str, Any]) -> bytes:
    buf = io.BytesIO()
    wb = xlsxwriter.Workbook(buf, {"in_memory": True})

    hdr_fmt = wb.add_format({
        "bold": True, "font_color": "#FFFFFF", "bg_color": NAVY,
        "align": "center", "valign": "vcenter", "border": 1,
    })
    orange_hdr = wb.add_format({
        "bold": True, "font_color": "#FFFFFF", "bg_color": ORANGE,
        "align": "center", "valign": "vcenter", "border": 1,
    })
    label_fmt = wb.add_format({
        "bold": True, "font_color": NAVY, "align": "left",
    })
    val_fmt = wb.add_format({
        "align": "right", "border": 1, "num_format": "#,##0",
    })

    # -----------------------------------------------------------------------
    # Sheet 1: Inputs
    # -----------------------------------------------------------------------
    ws_in = wb.add_worksheet("Inputs")
    ws_in.set_column(0, 0, 30)
    ws_in.set_column(1, 1, 20)

    r = 0
    r = _section_header(ws_in, r, 0, "  LTIP Design Inputs", wb, 4)
    grant_rows = [
        ("Total Grant Value ($)", f"${inputs['grant_value']:,.0f}"),
        ("Share Price ($)", f"${inputs['share_price']:.2f}"),
        ("RSU Weight (%)", f"{inputs['rsu_weight']*100:.0f}%"),
        ("PSU Weight (%)", f"{inputs['psu_weight']*100:.0f}%"),
        ("Option Weight (%)", f"{inputs['option_weight']*100:.0f}%"),
        ("Option Term (Years)", f"{inputs['option_term']:.1f}"),
        ("Risk-Free Rate (%)", f"{inputs['risk_free_rate']*100:.2f}%"),
        ("Dividend Yield (%)", f"{inputs['dividend_yield']*100:.2f}%"),
        ("Company Growth Rate μ (%)", f"{inputs['company_growth_rate']*100:.1f}%"),
        ("Vesting Term (Years)", f"{inputs['vesting_term']:.0f}"),
        ("PSU Metric Mode", inputs["psu_metric"]["mode"].title()),
    ]
    for label, val in grant_rows:
        ws_in.write(r, 0, label, label_fmt)
        ws_in.write(r, 1, val)
        r += 1

    if results.get("units"):
        r += 1
        r = _section_header(ws_in, r, 0, "  Grant Units", wb, 4)
        ws_in.write(r, 0, "RSU Units", label_fmt)
        ws_in.write(r, 1, f"{results['units']['rsu_units']:,.1f}")
        r += 1
        ws_in.write(r, 0, "PSU Units", label_fmt)
        ws_in.write(r, 1, f"{results['units']['psu_units']:,.1f}")
        r += 1
        ws_in.write(r, 0, "Option Units", label_fmt)
        ws_in.write(r, 1, f"{results['units']['option_units']:,.1f}")
        r += 1
        ws_in.write(r, 0, "Option Fair Value (% of S)", label_fmt)
        ws_in.write(r, 1, f"{results.get('option_fair_value_pct', 0):.1f}%")
        r += 1

    # -----------------------------------------------------------------------
    # Sheet 2: Results
    # -----------------------------------------------------------------------
    ws_res = wb.add_worksheet("Results")
    ws_res.set_column(0, 0, 24)
    ws_res.set_column(1, 5, 16)

    r = 0
    r = _section_header(ws_res, r, 0, "  LTIP Realized Value Summary", wb, 6)

    cols = ["Scenario", "RSU ($)", "PSU ($)", "Options ($)", "Total ($)", "Multiple (×)"]
    for c, col in enumerate(cols):
        ws_res.write(r, c, col, hdr_fmt)
    r += 1

    grant = results["grant_value"]
    for label, case, mult in [
        ("Bear Case (P10)", results["bear"], results["bear_multiple"]),
        ("Base Case (P50)", results["base"], results["base_multiple"]),
        ("Bull Case (P90)", results["bull"], results["bull_multiple"]),
    ]:
        ws_res.write(r, 0, label)
        ws_res.write(r, 1, case["rsu"], val_fmt)
        ws_res.write(r, 2, case["psu"], val_fmt)
        ws_res.write(r, 3, case["option"], val_fmt)
        ws_res.write(r, 4, case["total"], val_fmt)
        ws_res.write(r, 5, f"{mult:.2f}×")
        r += 1

    r += 1
    ws_res.write(r, 0, "Grant-Date Value", label_fmt)
    ws_res.write(r, 1, f"${grant:,.0f}")

    # -----------------------------------------------------------------------
    # Sheet 3: Year-by-Year
    # -----------------------------------------------------------------------
    ws_yby = wb.add_worksheet("Year by Year")
    ws_yby.set_column(0, 0, 22)
    ws_yby.set_column(1, 4, 20)

    r = 0
    r = _section_header(ws_yby, r, 0, "  Base Case Year-by-Year Value (Cliff Vest @ Yr 3)", wb, 5)
    cols = ["Vehicle", "Year 1 (Indicative)", "Year 2 (Indicative)", "Year 3 (Realized)", ""]
    for c, col in enumerate(cols[:4]):
        ws_yby.write(r, c, col, hdr_fmt)
    r += 1

    for yr_data in results.get("year_by_year", []):
        pass  # written below after reformatting

    # Reformat year-by-year as rows per vehicle
    yby = results.get("year_by_year", [])
    if yby:
        vehicles = ["RSU", "PSU", "Option", "Total"]
        keys = ["rsu", "psu", "option", "total"]
        for v, k in zip(vehicles, keys):
            ws_yby.write(r, 0, v, label_fmt)
            for col_i, yr_data in enumerate(yby, 1):
                fmt = wb.add_format({
                    "align": "right", "border": 1,
                    "num_format": "#,##0",
                    "italic": yr_data["indicative"],
                    "font_color": SLATE if yr_data["indicative"] else NAVY,
                })
                ws_yby.write(r, col_i, yr_data.get(k, 0), fmt)
            r += 1

    # -----------------------------------------------------------------------
    # Sheet 4: Distribution (P1–P100)
    # -----------------------------------------------------------------------
    ws_dist = wb.add_worksheet("Distribution")
    ws_dist.set_column(0, 1, 20)

    r = 0
    r = _section_header(ws_dist, r, 0, "  Realized Value Distribution (P1–P100)", wb, 2)
    ws_dist.write(r, 0, "Percentile", hdr_fmt)
    ws_dist.write(r, 1, "Total Realized Value ($)", hdr_fmt)
    r += 1

    dist_start_row = r
    for i, val in enumerate(results["percentile_distribution"], 1):
        ws_dist.write(r, 0, i)
        ws_dist.write(r, 1, round(val, 0))
        r += 1
    dist_end_row = r - 1

    # -----------------------------------------------------------------------
    # Sheet 5: Charts
    # -----------------------------------------------------------------------
    ws_chart = wb.add_worksheet("Charts")
    ws_chart.write(0, 0, "LTIP Scenario Analysis — Charts", wb.add_format({
        "bold": True, "font_size": 14, "font_color": NAVY,
    }))

    # Distribution line chart
    chart_dist = wb.add_chart({"type": "line"})
    chart_dist.add_series({
        "name": "Realized Value",
        "categories": ["Distribution", dist_start_row, 0, dist_end_row, 0],
        "values": ["Distribution", dist_start_row, 1, dist_end_row, 1],
        "line": {"color": ORANGE, "width": 2.25},
    })
    chart_dist.set_title({"name": "Realized Value Distribution (P1–P100)"})
    chart_dist.set_x_axis({"name": "Percentile"})
    chart_dist.set_y_axis({"name": "Realized Value ($)"})
    chart_dist.set_size({"width": 480, "height": 288})
    chart_dist.set_style(10)
    ws_chart.insert_chart(2, 0, chart_dist)

    # Stacked bar: RSU / PSU / Options per scenario
    ws_breakdown = wb.add_worksheet("_vehicle_data")
    ws_breakdown.write(0, 0, "Scenario")
    ws_breakdown.write(0, 1, "RSU")
    ws_breakdown.write(0, 2, "PSU")
    ws_breakdown.write(0, 3, "Options")
    for row_i, (label, case) in enumerate([
        ("Bear", results["bear"]),
        ("Base", results["base"]),
        ("Bull", results["bull"]),
    ], 1):
        ws_breakdown.write(row_i, 0, label)
        ws_breakdown.write(row_i, 1, case["rsu"])
        ws_breakdown.write(row_i, 2, case["psu"])
        ws_breakdown.write(row_i, 3, case["option"])

    chart_stack = wb.add_chart({"type": "bar", "subtype": "stacked"})
    for col_i, (vehicle, color) in enumerate([("RSU", NAVY), ("PSU", ORANGE), ("Options", TEAL)], 1):
        chart_stack.add_series({
            "name": vehicle,
            "categories": ["_vehicle_data", 1, 0, 3, 0],
            "values": ["_vehicle_data", 1, col_i, 3, col_i],
            "fill": {"color": color},
        })
    chart_stack.set_title({"name": "Realized Value by Vehicle (Bear / Base / Bull)"})
    chart_stack.set_x_axis({"name": "Realized Value ($)"})
    chart_stack.set_size({"width": 480, "height": 288})
    chart_stack.set_style(10)
    ws_chart.insert_chart(2, 8, chart_stack)

    wb.close()
    buf.seek(0)
    return buf.read()
