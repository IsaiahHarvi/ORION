# import os

# import numpy as np
# import pandas as pd
# import pyart
# import torch
# import torchvision.transforms as T
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# from services.model.main import Model
# from services.model.utils import get_pretrained
# from services.scans.get_scans import download_scans
from services.scans.get_stations import get_nearby_radars

# from services.scans.utils import enforce_dir_size_limit

# from tornet.tornet.data.loader import TornadoDataLoader, get_dataloader
# from tornet.tornet.data.preprocess import (
#     add_coordinates,
#     remove_time_dim,
# )

app = FastAPI()
if os.environ.get("API_MODE") == "dev":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# model_ = Model()
# pretrained_model = get_pretrained()

# DATA_DIR = os.environ.get("SCAN_DIR", "./data/scans")
# os.makedirs(os.path.join(DATA_DIR, "radar"), exist_ok=True)


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/radars/{lat}/{lon}")
async def radars(lat, lon):
    radars = get_nearby_radars(
        float(lat), float(lon), radius_km=1000000, output_format="json"
    )
    if not len(radars):
        return {"Error": "Could not find radars"}, 500
    return radars


# @app.get("/model/{lat}/{lon}/{timestamp}")
# async def model(lat, lon, timestamp: str):
#     radars = get_nearby_radars(float(lat), float(lon), radius_km=200)
#     if not len(radars):
#         return {"Error": "No radars in 200km range"}, 500
#     else:
#         nearest_radar = radars[0]
#         nearest_radar = "KDVN"

#     timestamp = pd.Timestamp(*map(int, timestamp.split("-"))).tz_localize("UTC")
#     scans = download_scans(nearest_radar, timestamp, DATA_DIR, scan_count=1)
#     if not scans.success_count:
#         return {"Error": f"{nearest_radar} has 0 scans currently available."}, 500

#     files = [
#         os.path.join(DATA_DIR, f)
#         for f in os.listdir(DATA_DIR)
#         if os.path.isfile(os.path.join(DATA_DIR, f)) and f not in ["radar", ".gitkeep"]
#     ]
#     print(f"{files=}")
#     latest_scan = max(files, key=os.path.getmtime)
#     print(f"{latest_scan=}")

#     radar = pyart.io.read_nexrad_archive(latest_scan)
#     nc_file = f"{DATA_DIR}/radar/{os.path.basename(latest_scan)}.nc"
#     pyart.io.write_cfradial(nc_file, radar)

#     tornado_probability = model_.predict(nc_file)

#     enforce_dir_size_limit(DATA_DIR, max_size_bytes=3 * 1024 * 1024 * 1024)

#     return {"probability": tornado_probability}


# def filter_numeric(data):
#     """
#     Filters out entries in data that are not numeric arrays/tensors (i.e. do not have a 'shape' attribute).
#     """
#     return {k: v for k, v in data.items() if hasattr(v, "shape")}

# @app.get("/model_test/{lat}/{lon}")
# async def model_test(lat, lon):
#     data_root = os.environ.get("TORNET_ROOT")

#     # dl = TornadoDataLoader(
#     #     [f"{data_root}/train/2019/TOR_190223_214156_KGWX_809551_X5.nc"],
#     #     variables=["DBZ", "VEL", "KDP", "RHOHV", "ZDR", "WIDTH"],
#     #     n_frames=1,
#     #     transform=T.Compose(
#     #         [
#     #             lambda d: add_coordinates(
#     #                 d, include_az=False, tilt_last=False, backend=torch
#     #             ),
#     #             lambda d: remove_time_dim(d),
#     #         ]
#     #     ),
#     # )
#     # sample = dl[0]
#  ## Set up data loader

#     ds_test = get_dataloader(
#         "keras",
#         data_root,
#         [2019,2021],
#         "test",
#         128,
#         select_keys=list(pretrained_model.input.keys()),
#         file_list = [f"{data_root}/train/2019/TOR_190223_214156_KGWX_809551_X5.nc"]
#     )

#     tornado_probability = pretrained_model.predict(ds_test)
#     return {"probability": tornado_probability.tolist()}
