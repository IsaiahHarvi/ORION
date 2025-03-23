import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

@router.websocket("/ws/cursor")
async def websocket_cursor_pos(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            clientx = payload.get("clientx")
            clienty = payload.get("clienty")
            lat = payload.get("lat")
            long = payload.get("long")
            await websocket.send_text(f"Cursor at ({clientx}, {clienty}) with GPS ({lat}, {long})")
    except WebSocketDisconnect:
        pass