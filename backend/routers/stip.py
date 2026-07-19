from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
import io, os

from models.stip import StipSimulateRequest, ValidateMatrixRequest, StipExportRequest
from engine.stip_engine import validate_correlation_matrix, run_stip_simulation
from excel.export import export_stip

router = APIRouter(prefix="/api/v1/stip", tags=["stip"])


@router.post("/validate-matrix")
def validate_matrix(req: ValidateMatrixRequest):
    return validate_correlation_matrix(req.correlation_matrix)


@router.post("/simulate")
def simulate(req: StipSimulateRequest):
    # 1. Validate correlation matrix
    validation = validate_correlation_matrix(req.correlation_matrix)
    if not validation["valid"]:
        raise HTTPException(
            status_code=422,
            detail=(
                "Correlation matrix is invalid. At least one value combination is "
                "mathematically impossible. Reset to defaults or reduce extreme correlation values."
            ),
        )

    # 2. Run Monte Carlo
    payload = req.model_dump()
    try:
        results = run_stip_simulation(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Simulation error — {exc}. Check volatility assumptions.",
        )

    return results


@router.get("/backtest")
def download_backtest():
    """Download the pre-generated deterministic backtest Excel workbook."""
    path = os.path.join(os.path.dirname(__file__), "..", "tests", "STIP_Backtest.xlsx")
    path = os.path.abspath(path)
    if not os.path.exists(path):
        # Re-generate on demand if not present
        import subprocess
        tests_dir = os.path.join(os.path.dirname(__file__), "..", "tests")
        subprocess.run(["python3", os.path.join(tests_dir, "stip_backtest.py")], check=True)
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="STIP_Backtest.xlsx",
    )


@router.post("/export")
def export(req: StipExportRequest):
    try:
        file_bytes = export_stip(req.inputs.model_dump(), req.results)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Export error: {exc}")

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=STIP_Analysis.xlsx"},
    )
