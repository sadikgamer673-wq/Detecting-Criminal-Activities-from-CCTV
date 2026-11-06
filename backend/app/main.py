import logging
import asyncio
from contextlib import asynccontextmanager
from typing import Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.database.session import init_db
from app.api.v1.api import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("cctv_system")

class ConnectionManager:
    """Manages active WebSocket client connections for real-time notifications."""
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to client: {e}")
                self.active_connections.discard(connection)

ws_manager = ConnectionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure directories exist and init database
    logger.info("Initializing CCTV Surveillance System backend...")
    settings.resolved_upload_dir
    settings.resolved_incident_dir
    settings.resolved_model_dir
    await init_db()
    
    # Register event loop for live camera stream background tasks
    loop = asyncio.get_running_loop()
    from app.services.cameras.manager import camera_stream_manager
    camera_stream_manager.set_event_loop(loop)
    
    logger.info("Database and camera stream manager initialized successfully.")
    yield
    # Shutdown
    logger.info("Shutting down CCTV Surveillance System backend...")
    camera_stream_manager.stop_all()

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for AI-Powered CCTV Crime and Suspicious Activity Detection System",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(api_router, prefix="/api/v1")

@app.get("/", tags=["Root"])
async def root():
    return {
        "service": settings.APP_NAME,
        "status": "online",
        "docs_url": "/docs",
        "health_url": "/api/v1/health"
    }

@app.websocket("/ws/events")
async def websocket_events_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send initial handshake acknowledgement
        await websocket.send_json({
            "type": "connection_established",
            "message": "Connected to Surveillance Command WebSocket"
        })
        while True:
            data = await websocket.receive_text()
            # Echo or heartbeat response
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)
