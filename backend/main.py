import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import RequireSession
from routers.auth import router as auth_router
from routers.stip import router as stip_router
from routers.ltip import router as ltip_router
from routers.benchmarking import router as benchmarking_router

app = FastAPI(
    title="Incentive Plan Design API",
    description="STIP & LTIP scenario analysis engine — Hugessen Consulting",
    version="1.0.0",
)

allow_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
if extra_origin := os.environ.get("FRONTEND_ORIGIN"):
    allow_origins.append(extra_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(stip_router, dependencies=[RequireSession])
app.include_router(ltip_router, dependencies=[RequireSession])
app.include_router(benchmarking_router, dependencies=[RequireSession])


@app.get("/")
def root():
    return {"status": "ok", "message": "Incentive Plan Design API is running."}
