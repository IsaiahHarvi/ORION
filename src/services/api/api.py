import os

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware

from services.nexrad.api import router as radar_router
from services.scans.get_stations import get_radars

app = FastAPI(
    root_path="/api",
)
app.include_router(radar_router)

_cors_origins = [
    origin.strip()
    for origin in os.environ.get("ORION_CORS_ORIGINS", "").split(",")
    if origin.strip()
]
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/health", status_code=status.HTTP_200_OK)
async def healthcheck():
    """Returns a 200 OK and JSON with status: healthy"""
    return {"status": "healthy"}


@app.get("/radars_near/{lat}/{lon}/{radius_km}")
async def radars_nearby(lat, lon, radius_km):
    """Returns all radars within a specified radius of a given latitude and longitude"""
    radars = get_radars(
        float(lat), float(lon), radius_km=int(radius_km), output_format="json"
    )
    if not len(radars):
        return {"Error": f"Could not find radars within {radius_km}km radius"}, 500
    return radars


@app.get("/radars/{lat}/{lon}")
async def radars(lat, lon):
    """Returns all radars and distances"""
    radars = get_radars(float(lat), float(lon), radius_km=1000000, output_format="json")
    if not len(radars):
        return {"Error": "Could not find any radars"}, 500
    return radars
