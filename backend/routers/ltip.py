from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
import io

from models.ltip import LtipSimulateRequest, LtipExportRequest
from engine.ltip_engine import ingest_price_data, run_ltip_simulation, option_fair_value_pct
from excel.template import build_ltip_template
from excel.export import export_ltip

router = APIRouter(prefix="/api/v1/ltip", tags=["ltip"])


@router.get("/template")
def download_template():
    """Download the blank LTIP Excel data-entry template."""
    try:
        file_bytes = build_ltip_template()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Template generation error: {exc}")

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=LTIP_Data_Template.xlsx"},
    )


@router.post("/upload-data")
async def upload_data(file: UploadFile = File(...)):
    """
    Ingest a completed LTIP Excel template.
    Returns market data (tickers, vols, corr_matrix) to be stored in frontend state
    and passed back in the simulate request.
    """
    if not file.filename.endswith((".xlsx", ".xlsm")):
        raise HTTPException(
            status_code=422,
            detail="File must be an Excel workbook (.xlsx or .xlsm).",
        )

    file_bytes = await file.read()

    try:
        market_data = ingest_price_data(file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Could not parse Excel file: {exc}",
        )

    return market_data


@router.post("/black-scholes")
def black_scholes(S: float, K: float, T: float, r: float, q: float, sigma: float):
    """Quick Black-Scholes lookup for the UI panel."""
    try:
        fv_pct = option_fair_value_pct(S, K, T, r, q, sigma)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"option_fair_value_pct": round(fv_pct * 100, 2)}


@router.post("/simulate")
def simulate(req: LtipSimulateRequest):
    # Vehicle weight validation
    total_wt = req.rsu_weight + req.psu_weight + req.option_weight
    if abs(total_wt - 1.0) > 0.01:
        raise HTTPException(
            status_code=422,
            detail=f"RSU + PSU + Option weights sum to {total_wt*100:.1f}%. Must equal 100%.",
        )

    # PSU mode weight validation
    if req.psu_metric.mode == "both":
        pw = req.psu_metric.rtsr_weight + req.psu_metric.internal_weight
        if abs(pw - 1.0) > 0.01:
            raise HTTPException(
                status_code=422,
                detail=f"PSU rTSR + Internal weights sum to {pw*100:.1f}%. Must equal 100%.",
            )

    payload = req.model_dump()
    market_data = payload.pop("market_data")

    try:
        results = run_ltip_simulation(payload, market_data)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Simulation error — {exc}. Check volatility assumptions and uploaded data.",
        )

    return results


@router.post("/export")
def export(req: LtipExportRequest):
    try:
        file_bytes = export_ltip(req.inputs.model_dump(), req.results)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Export error: {exc}")

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=LTIP_Analysis.xlsx"},
    )
