from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
import io

from models.benchmarking import CalculateRequest, SuggestWeightsRequest, ExportRequest, YoYRequest
from excel.benchmarking_parser import parse_benchmarking_excel
from engine.benchmarking_engine import compute_calculation, compute_suggested_weights, compute_yoy
from excel.benchmarking_export import export_benchmarking

router = APIRouter(prefix="/api/v1/benchmarking", tags=["benchmarking"])


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    """Parse the Raw Data + Peer Group tabs of an uploaded benchmarking Excel."""
    if not file.filename.endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=422, detail="File must be an Excel workbook (.xlsx or .xlsm).")

    file_bytes = await file.read()

    try:
        data = parse_benchmarking_excel(file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Could not parse file — ensure you are uploading the standard Hugessen "
                   f"benchmarking template with Raw Data and Peer Group tabs. ({exc})",
        )

    return data


@router.post("/suggest-weights")
def suggest_weights_endpoint(req: SuggestWeightsRequest):
    try:
        return compute_suggested_weights(req.benchmark_data, req.role, req.year, req.size_metric)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Weight suggestion error: {exc}")


@router.post("/calculate")
def calculate(req: CalculateRequest):
    try:
        return compute_calculation(
            req.benchmark_data, req.role, req.year, req.pay_metric,
            req.size_metric, req.peer_weights,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Calculation error: {exc}")


@router.post("/yoy")
def yoy(req: YoYRequest):
    try:
        return compute_yoy(req.benchmark_data, req.role, req.aging_factor, req.prior_year_override, req.excluded_tickers)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"YoY trend error: {exc}")


@router.post("/export")
def export(req: ExportRequest):
    try:
        file_bytes = export_benchmarking(req.benchmark_data, req.calculation)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Export error: {exc}")

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Compensation_Benchmarking_Analysis.xlsx"},
    )
