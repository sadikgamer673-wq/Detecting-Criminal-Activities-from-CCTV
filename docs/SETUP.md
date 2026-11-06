# Setup and Installation Guide for Windows 11

This guide covers setting up and running the CCTV AI Surveillance System on Windows 11 using PowerShell.

## Prerequisites

1. **Python 3.11+** (Python 3.11 is recommended for native computer vision wheels).
2. **Node.js 20+** and **npm 10+**.
3. **uv** (recommended for rapid virtual environment and package installation):
   ```powershell
   # If uv is not installed:
   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```
4. **Git**.

---

## 1. Backend Setup

Open a PowerShell terminal in the repository root:

```powershell
# Navigate to the workspace
cd C:\Users\sadik\Documents\antigravity\adventurous-raman

# 1. Create Python 3.11 virtual environment using uv
uv venv backend\.venv --python 3.11

# 2. Install backend dependencies
uv pip install -r backend\requirements.txt --python backend\.venv\Scripts\python.exe

# 3. Configure environment variables
Copy-Item backend\.env.example backend\.env

# 4. Initialize database schema
backend\.venv\Scripts\python.exe -c "import asyncio; from app.database.session import init_db; asyncio.run(init_db())"

# 5. Run automated test suite
cd backend
.venv\Scripts\pytest.exe -v
cd ..
```

### Running the Backend

```powershell
cd C:\Users\sadik\Documents\antigravity\adventurous-raman\backend
.venv\Scripts\uvicorn.exe app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be accessible at:
- **API Base**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **Health & Telemetry**: `http://localhost:8000/api/v1/health`
- **WebSocket Alerts**: `ws://localhost:8000/ws/events`

---

## 2. Frontend Setup

Open a second PowerShell terminal:

```powershell
cd C:\Users\sadik\Documents\antigravity\adventurous-raman\frontend

# 1. Install frontend dependencies
npm install

# 2. Configure environment variables
Copy-Item .env.example .env

# 3. Build verification
npm run build

# 4. Start the Vite development server
npm run dev
```

The Command Center UI will be accessible at:
- `http://localhost:5173`

---

## 3. Verifying the Full Stack

1. Open your browser at `http://localhost:5173`.
2. Inspect the **System Status** pill in the top header:
   - Should display **"Healthy"** (green pulsing dot).
   - Real-time roundtrip ping latency (e.g., `Ping: 4ms`).
   - Database engine status: `SQLite (WAL)`.
   - Host CPU and RAM usage percentages.
   - Storage directories writability indicators.
3. Switch between sidebar navigation modules:
   - **Overview**: Real-time counters, storage status, hardware charts.
   - **Live Monitoring**: RTSP streams status.
   - **Video Analysis**: Video upload zone.
   - **Incident Center**: Incident review triage.
   - **Evidence Library**: Extracted clip storage.
   - **Camera Management**: Camera configuration.
   - **Reports**: Audit report generation.
   - **Settings**: CPU performance and retention configurations.
