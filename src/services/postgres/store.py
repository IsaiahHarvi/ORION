import json

import pandas as pd

from services.postgres.utils import get_postgres_connection


def store_scan_in_postgres(scan, radar, radar_id):
    scan_time = pd.to_datetime(scan.filename[4:17], format="%Y%m%d_%H%M").tz_localize(
        "UTC"
    )

    reflectivity_data = radar.fields["reflectivity"]["data"][0]
    reflectivity_list = reflectivity_data.tolist()

    lats, lons, alts = radar.get_gate_lat_lon_alt(sweep=0)

    lats_sweep = lats[0]
    lons_sweep = lons[0]
    min_lon_val = float(lons_sweep.min())
    max_lon_val = float(lons_sweep.max())
    min_lat_val = float(lats_sweep.min())
    max_lat_val = float(lats_sweep.max())

    grid_data = {
        "reflectivity": reflectivity_list,
        "min_lon": min_lon_val,
        "max_lon": max_lon_val,
        "min_lat": min_lat_val,
        "max_lat": max_lat_val,
    }

    conn = get_postgres_connection()
    cur = conn.cursor()
    insert_sql = """
    INSERT INTO radar_scans (radar_id, scan_time, grid_data, min_lon, max_lon, min_lat, max_lat)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    cur.execute(
        insert_sql,
        (
            radar_id,
            scan_time,
            json.dumps(grid_data),
            min_lon_val,
            max_lon_val,
            min_lat_val,
            max_lat_val,
        ),
    )
    conn.commit()
    cur.close()
    conn.close()
    print("  Stored in Postgres.", end="\n\n")
