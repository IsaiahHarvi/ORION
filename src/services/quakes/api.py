from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from services.quakes.usgs import (
    MAGNITUDES,
    WINDOWS,
    FeedError,
    FeedKey,
    cache_ttl_seconds,
    fetch_quakes,
)

router = APIRouter(prefix="/quakes", tags=["quakes"])


# Deliberately a sync endpoint: the USGS read is blocking, and FastAPI runs
# sync handlers in a threadpool rather than stalling the event loop.
@router.get("")
def quakes(
    window: str = Query("day", description=f"One of {', '.join(WINDOWS)}"),
    min_magnitude: str = Query("2.5", description=f"One of {', '.join(MAGNITUDES)}"),
) -> JSONResponse:
    if window not in WINDOWS:
        raise HTTPException(
            status_code=422, detail=f"window must be one of {list(WINDOWS)}"
        )
    if min_magnitude not in MAGNITUDES:
        raise HTTPException(
            status_code=422,
            detail=f"min_magnitude must be one of {list(MAGNITUDES)}",
        )

    try:
        payload = fetch_quakes(FeedKey(window, min_magnitude))
    except FeedError as error:
        raise HTTPException(
            status_code=503, detail="Earthquake feed is unavailable"
        ) from error

    # Let the browser reuse the response for as long as the server would have
    # served the same cached copy anyway.
    return JSONResponse(
        payload,
        headers={"Cache-Control": f"public, max-age={int(cache_ttl_seconds())}"},
    )
