from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from services.adsb.feed import (
    DEFAULT_RADIUS_NM,
    MAX_RADIUS_NM,
    FeedError,
    cache_key,
    cache_ttl_seconds,
    fetch_aircraft,
)

router = APIRouter(prefix="/adsb", tags=["adsb"])


# Deliberately a sync endpoint: the upstream read is blocking, and FastAPI runs
# sync handlers in a threadpool rather than stalling the event loop.
@router.get("")
def aircraft(
    lat: float = Query(..., ge=-90, le=90, description="Viewport centre latitude"),
    lon: float = Query(..., ge=-180, le=180, description="Viewport centre longitude"),
    radius_nm: int = Query(
        DEFAULT_RADIUS_NM,
        ge=1,
        le=MAX_RADIUS_NM,
        description=f"Search radius in nautical miles (max {MAX_RADIUS_NM})",
    ),
) -> JSONResponse:
    try:
        payload = fetch_aircraft(cache_key(lat, lon, radius_nm))
    except FeedError as error:
        raise HTTPException(
            status_code=503, detail="Flight feed is unavailable"
        ) from error

    # Let the browser reuse the response for as long as the server would have
    # served the same cached copy anyway.
    return JSONResponse(
        payload,
        headers={"Cache-Control": f"public, max-age={int(cache_ttl_seconds())}"},
    )
