# Detecting Criminal Activities from CCTV Using Object Detection and Machine Learning Algorithms

An enterprise-grade, modular, CPU-optimized CCTV surveillance and incident triage system for Windows 11.

---

## Key Capabilities

- **Dual-Mode Operation**:
  - **Mode A (Real-Time CCTV Streams)**: Connect to RTSP IP camera feeds and local test webcams, with automatic reconnection and non-blocking background stream workers.
  - **Mode B (Uploaded Video Analysis)**: Secure ingestion of MP4, AVI, and MOV video recordings with true progress reporting, incident timestamping, and evidence clip extraction.
- **CPU-First Inference Pipeline**:
  - Engineered specifically for Windows 11 PCs without requiring dedicated NVIDIA GPUs.
  - Frame subsampling (5 FPS default), resolution scaling, and temporal aggregation prevent CPU overload.
- **Ethical Security Architecture**:
  - Clear separation between **Model Detection**, **Potential Incident**, and **Human-Reviewed Incident**.
  - Strict prohibition of facial recognition, demographic profiling, or automated guilt declaration.
- **Robust Database & Storage Layer**:
  - SQLite database running in **WAL (Write-Ahead Logging)** mode with foreign key enforcement.
  - Managed evidence storage with pre-roll and post-roll video clip extraction.
- **Command Center Dashboard**:
  - Professional dark theme with high-contrast accessibility.
  - Real-time hardware telemetry (CPU, RAM, Disk, Uptime) and genuine backend data (no fabricated counts).

---

## Project Structure

```
adventurous-raman/
|-- backend/
|   |-- app/
|   |   |-- api/v1/          # REST endpoints (health, cameras, jobs, incidents)
|   |   |-- core/            # Configuration and environment settings
|   |   |-- database/        # Async SQLAlchemy session and migrations
|   |   |-- models/          # ORM models (Camera, Job, Incident, Evidence)
|   |   |-- schemas/         # Pydantic validation schemas
|   |   |-- services/        # Ingestion, detection, tracking, evidence
|   |   `-- workers/         # Background processing tasks
|   |-- tests/               # Pytest async test suite
|   |-- requirements.txt
|   `-- .env.example
|-- frontend/
|   |-- src/
|   |   |-- components/      # Sidebar, Header, Telemetry widgets
|   |   |-- pages/           # 8 Command Center modules
|   |   |-- services/        # API client and WebSocket handlers
|   |   `-- types/           # TypeScript definitions
|   |-- package.json
|   `-- tailwind.config.js
|-- storage/
|   |-- uploads/             # Raw uploaded video files
|   |-- incidents/           # Extracted evidence clips
|   `-- models/              # Pretrained model weights
|-- docs/
|   |-- ARCHITECTURE.md      # Detailed system architecture
|   |-- SETUP.md             # PowerShell setup commands
|   `-- MODEL_LIMITATIONS.md # CPU constraints and ethical guidelines
`-- README.md
```

---

## Quickstart (Windows 11 PowerShell)

### 1. Backend (Terminal 1)
```powershell
cd backend
..\backend\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
```
- Swagger API Docs: `http://localhost:8000/docs`
- Health Endpoint: `http://localhost:8000/api/v1/health`

### 2. Frontend (Terminal 2)
```powershell
cd frontend
npm run dev
```
- Command Center UI: `http://localhost:5173`

### 3. Run Automated Tests
```powershell
cd backend
.venv\Scripts\pytest.exe -v
```
```powershell
cd frontend
npm run build
```
