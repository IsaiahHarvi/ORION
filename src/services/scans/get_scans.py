#!/usr/bin/env python3

import json
import os
import tempfile
from datetime import datetime, timedelta

import cartopy.crs as ccrs
import cartopy.feature as cfeature
import matplotlib.pyplot as plt
import nexradaws
import numpy as np
import pandas as pd
import psycopg2
import pyart
import pytz
from metpy.plots import USCOUNTIES
from pyart.core import Radar

# from src.services.postgres.store import store_scan_in_postgres


def download_scans(radar_id, start, end, temp_dir):
    conn = nexradaws.NexradAwsInterface()
    scans = conn.get_avail_scans_in_range(start, end, radar_id)
    if scans is None:
        print("No scans available for the given time range and radar ID.")
        return []
    print(
        f"There are {len(scans)} scans available between {start} and {end}\n")
    print(scans[0: len(scans) // 4])
    results = conn.download(scans, temp_dir, threads=os.cpu_count())
    return results


def load_and_convert(url, start, end):
    df = pd.read_csv(url)
    df["datetime"] = pd.to_datetime(df.date + " " + df.time)
    df.set_index("datetime", inplace=True)
    df.index = df.index.tz_localize(
        "Etc/GMT+6", ambiguous="NaT", nonexistent="shift_forward"
    ).tz_convert("UTC")
    df.sort_index(inplace=True)
    start_str = (start - pd.Timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M")
    end_str = (end + pd.Timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M")
    return df[start_str:end_str]


def get_severe_reports(year, start, end):
    year_str = str(year)
    wind_url = f"https://www.spc.noaa.gov/wcm/data/{year_str}_wind.csv"
    torn_url = f"https://www.spc.noaa.gov/wcm/data/{year_str}_torn.csv"
    hail_url = f"https://www.spc.noaa.gov/wcm/data/{year_str}_hail.csv"
    wind_rpts = load_and_convert(wind_url, start, end)
    tor_rpts = load_and_convert(torn_url, start, end)
    hail_rpts = load_and_convert(hail_url, start, end)
    return wind_rpts, tor_rpts, hail_rpts


def extract_scans(radar_id="KDVN"):
    start = pd.Timestamp(2020, 8, 10, 16, 30).tz_localize("UTC")
    end = pd.Timestamp(2020, 8, 10, 21, 0).tz_localize("UTC")
    # current_time = pd.Timestamp.now('UTC')
    # start = current_time - pd.Timedelta(minutes=15)
    # end = current_time + pd.Timedelta(minutes=15)

    temp_location = tempfile.mkdtemp()
    print(f"Using temporary directory: {temp_location}")

    scans = download_scans(radar_id, start, end, './')

    # wind_rpts, tor_rpts, hail_rpts = load_severe_reports(start.year, start, end)

    for i, scan in enumerate(scans.iter_success(), start=1):
        if scan.filename[-3:] == "MDM":
            continue
        print(f"Processing scan: {scan.filename}")
        radar = scan.open_pyart()

    return scan, radar, radar_id


# if __name__ == "__main__":
#     store_scan_in_postgres(extract_scans())
