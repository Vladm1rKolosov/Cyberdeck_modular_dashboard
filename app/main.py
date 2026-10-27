from __future__ import annotations

import asyncio
import json
from pathlib import Path

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .telemetry import TelemetryCollector


ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "app" / "static"
DATA = ROOT / "data"
CONFIG = DATA / "dashboard.json"

app = FastAPI(title="CYBERDECK", docs_url="/api/docs")
app.mount("/static", StaticFiles(directory=STATIC), name="static")
collector = TelemetryCollector()


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC / "index.html")


@app.get("/api/config")
async def read_config() -> dict:
    return json.loads(CONFIG.read_text(encoding="utf-8"))


@app.get("/api/health")
async def health() -> dict:
    return {"status": "online"}


@app.websocket("/ws/telemetry")
async def telemetry_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(await collector.collect())
            await asyncio.sleep(1.5)
    except (WebSocketDisconnect, RuntimeError):
        return


def run() -> None:
    uvicorn.run("app.main:app", host="127.0.0.1", port=8765, reload=False)
