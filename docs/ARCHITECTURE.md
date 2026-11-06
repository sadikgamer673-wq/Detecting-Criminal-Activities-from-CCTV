# CCTV AI Surveillance System Architecture

## 1. System Overview

The **CCTV AI Surveillance System** is an enterprise-grade modular surveillance command center designed for Windows 11 environments without requiring dedicated NVIDIA GPUs. It provides both real-time RTSP camera monitoring and batch offline video analysis with an emphasis on low-latency CPU inference, actionable security telemetry, and auditable evidence management.

```
+-----------------------------------------------------------------------------------+
|                        ADVANCED SURVEILLANCE COMMAND CENTER                       |
|                       React 19 + TypeScript + Tailwind CSS                        |
+-----------------------------------------------------------------------------------+
        ^                                               ^
        | HTTP REST API                                 | WebSocket Live Telemetry
        v                                               v
+-----------------------------------------------------------------------------------+
|                             FASTAPI BACKEND ENGINE                                |
|                                                                                   |
|  +------------------------+  +-------------------------+  +--------------------+  |
|  |   API Routes (v1)      |  |  WebSocket Manager      |  | System Telemetry   |  |
|  | - /api/v1/health       |  |  /ws/events             |  | CPU / Memory / Disk|  |
|  | - /api/v1/cameras      |  +-------------------------+  +--------------------+  |
|  | - /api/v1/videos       |                                                       |
|  | - /api/v1/incidents    |  +-------------------------+  +--------------------+  |
|  | - /api/v1/reports      |  | SQLite Database (WAL)   |  | Rolling Buffer     |  |
|  +------------------------+  | SQLAlchemy Async ORM    |  | Evidence Extractor |  |
|                              +-------------------------+  +--------------------+  |
+-----------------------------------------------------------------------------------+
        |                                               |
        v                                               v
+-------------------------------+               +-----------------------------------+
|     STREAM INGESTION (RTSP)   |               |     OFFLINE VIDEO INGESTION       |
| - OpenCV Frame Decoding       |               | - MP4 / AVI / MOV Validation      |
| - Configurable FPS Subsampling|               | - Non-blocking Background Worker  |
| - Auto-Reconnect Logic        |               | - Incremental Progress Tracking   |
+-------------------------------+               +-----------------------------------+
        \                                               /
         \                                             /
          v                                           v
+-----------------------------------------------------------------------------------+
|                          MODULAR AI DETECTION PIPELINE                            |
|                                                                                   |
|  1. Object Detection (YOLO-family CPU-optimized lightweight model)                |
|  2. Person Tracking (ByteTrack / SORT multi-frame ID association)                 |
|  3. Video Activity Recognition (Validated temporal action classification)         |
|  4. Incident Scoring & Aggregation (Cooldown window, multi-frame confidence)      |
|  5. Evidence Clip Extraction (3s pre-roll + 3s post-roll lossless extraction)    |
+-----------------------------------------------------------------------------------+
```

---

## 2. Component Breakdown

### 2.1 Backend Services
- **`app/core/config.py`**: Centralized configuration management using Pydantic Settings, resolving paths dynamically and enforcing environment variables.
- **`app/database/`**: SQLAlchemy 2.x async engine with SQLite WAL (Write-Ahead Logging) and `PRAGMA foreign_keys=ON` for concurrent access without locking bottlenecks.
- **`app/models/`**:
  - `Camera`: RTSP endpoint configuration, connection state, resolution, and location metadata.
  - `VideoAnalysisJob`: Uploaded video tracking, progress percentage, frame counts, and state machine.
  - `PotentialIncident`: Security detections with start/end timestamps, confidence score, source binding, and human review status.
  - `IncidentEvidence`: Video clip references, thumbnails, file sizes, and duration metadata.
  - `SystemSetting`: Persistent tuning parameters (FPS sampling, confidence thresholds, cooldown periods).
- **`app/api/v1/health.py`**: Live health and telemetry endpoint providing hardware metrics (`psutil`), storage writability checks, database ping, and operational queue counts.
- **`app/main.py`**: FastAPI application with CORS middleware, lifespan events, and WebSocket event bus (`/ws/events`).

### 2.2 Frontend Command Center
- **Framework**: React 19, TypeScript, Vite, Tailwind CSS.
- **Theme**: Professional high-contrast dark theme designed for surveillance command rooms.
- **Navigation**:
  1. **Overview**: Real-time operational telemetry, CPU/RAM usage, storage health, active camera and job counters, and empty states.
  2. **Live Monitoring**: Real-time RTSP grid and event timeline.
  3. **Video Analysis**: Drag-and-drop video upload and progress tracking.
  4. **Incident Center**: Potential incident triage, acknowledgement, and human review.
  5. **Evidence Library**: Archival clip playback and export.
  6. **Camera Management**: RTSP stream CRUD and connection testing.
  7. **Reports**: Audit reports separating model predictions from human confirmations.
  8. **Settings**: Detection thresholds, FPS subsampling, and evidence retention.

---

## 3. Storage Hierarchy

- `storage/uploads/`: Video files uploaded for offline analysis.
- `storage/incidents/`: Extracted video evidence clips (pre-roll and post-roll context around triggered incidents).
- `storage/models/`: Cached AI model weights and checkpoints.
