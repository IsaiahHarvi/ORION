import os

import pandas as pd
from fastapi import FastAPI
from routers import cursor

from services.scans.get_scans import download_scans
from services.scans.get_stations import get_nearby_radars
from services.scans.utils import enforce_dir_size_limit
from src.services.model.main import Model

app = FastAPI()
model_ = Model()

DATA_DIR = os.environ.get("SCAN_DIR", "./data/scans")
os.makedirs(os.path.join(DATA_DIR, "extract"), exist_ok=True)

app.include_router(cursor.router)

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/model/{lat}/{lon}/{timestamp}")
async def model(lat, lon, timestamp: str):
    radars = get_nearby_radars(float(lat), float(lon), radius_km=200)
    if not len(radars):
        return {"Error" : "No radars in 200km range"}, 500
    else:
        nearest_radar = radars[0]
        nearest_radar = "KDVN"

    timestamp = pd.Timestamp(*map(int, timestamp.split("-"))).tz_localize("UTC")
    scans = download_scans(nearest_radar, timestamp, DATA_DIR, scan_count=1)
    if not scans.success_count:
        return {"Error" : f"{nearest_radar} has 0 scans currently available."}, 500

    print(os.listdir(DATA_DIR))
    files = [os.path.join(DATA_DIR, f) for f in os.listdir(DATA_DIR)
            if os.path.isfile(os.path.join(DATA_DIR, f))]
    latest_scan = max(files, key=os.path.getmtime)
    print(files)

    enforce_dir_size_limit(DATA_DIR, max_size_bytes=3*1024*1024*1024)

    print(f"Sending {latest_scan} to model")

    tornado_probability = model_.predict(latest_scan)

    return {"probability" : tornado_probability}
