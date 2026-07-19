# Incentive Plan Design Platform
**Hugessen Consulting — STIP & LTIP Scenario Analysis**

---

## First-time setup

### 1. Install Node.js (required for the frontend)
Download from https://nodejs.org — choose the LTS version.

Or via Homebrew:
```bash
brew install node
```

### 2. Install Python packages (backend)
```bash
cd backend
pip3 install -r requirements.txt
```

### 3. Install frontend packages
```bash
cd frontend
npm install
```

---

## Running the app

**Option A — One command (after first setup):**
```bash
./start.sh
```

**Option B — Two terminals:**

Terminal 1 (backend):
```bash
cd backend
uvicorn main:app --reload --port 8000
```

Terminal 2 (frontend):
```bash
cd frontend
npm run dev
```

Open: **http://localhost:5173**
API docs: **http://localhost:8000/docs**

---

## LTIP Excel Template

1. Click **"Download Template"** on the LTIP tab
2. Fill in the **Price History** sheet: one row per trading day, COMPANY column + one column per peer ticker
3. Fill in the **Peer Config** sheet: ticker, company name, include/exclude toggle
4. Upload the completed file — the platform extracts volatilities and correlations automatically

---

## Architecture

```
backend/
├── engine/
│   ├── stip_engine.py    # 5-step pipeline + Monte Carlo (10,000 trials)
│   └── ltip_engine.py    # GBM simulation + Black-Scholes (Merton)
├── excel/
│   ├── template.py       # LTIP data-entry template generator
│   └── export.py         # Excel export with native charts (xlsxwriter)
├── routers/
│   ├── stip.py           # POST /api/v1/stip/simulate  + /export
│   └── ltip.py           # POST /api/v1/ltip/simulate  + /upload-data + /export
└── main.py               # FastAPI app + CORS

frontend/src/
├── components/
│   ├── stip/             # Baseline, Curve, Scorecard, Correlation, Peer, Results
│   └── ltip/             # Upload, GrantSizing, BS, PSU Curve, Params, Results
├── constants/brand.ts    # Single source of truth for all colours
└── api/client.ts         # Typed fetch wrappers for all endpoints
```

---

## Key design decisions

| Decision | Choice |
|---|---|
| Distribution | Log-Normal default (no negative values); Normal allowed per-metric |
| Payout curve threshold | Toggleable — off by default, dotted line when enabled |
| Correlation defaults | Keyed to internal category *type* — display name is fully renameable |
| PSU metric | rTSR, internal financial metric, or weighted blend |
| Vesting | Cliff at 3 years (this sprint) |
| Percentile calculation | `numpy.percentile` — not hardcoded indices |
| Excel export | Native xlsxwriter charts (dynamic, linked to data) |
