// src/lib/utils/frameCoverage.ts
import type { Feature, Polygon, FeatureCollection } from 'geojson';
import type maplibregl from 'maplibre-gl';

export interface LatLon {
  lat: number;
  lon: number;
}

/**
 * Instead of building a polygon from 4 corners, we build a circle
 * around `center` with radius determined by the average distance to each corner.
 */
export function buildFramePolygon(
  ulc: LatLon,
  urc: LatLon,
  lrc: LatLon,
  llc: LatLon
): Feature<Polygon> {
  try {
    // 1) We'll parse these corners and "center" (the function doesn't receive `center` yet,
    //    but we will rely on `showFramePolygon(...)` to pass it. 
    //    Actually, the showFramePolygon() signature includes `center: LatLon`,
    //    so we can just rely on that. We'll just store the corners for radius calc.
    //    We'll do the radius calculation in showFramePolygon for clarity if you prefer,
    //    but let's do it here for minimal changes.

    // This function doesn't get `center` as an argument in the old code – 
    // so let's store corners in the polygon properties temporarily,
    // and let `showFramePolygon` read them. Or let's do a simple approach:
    // We'll forcibly define a "center" inside these corners: the average lat/lon.

    // We'll compute a quick approximate center from corners or do something.
    // But the user typically calls showFramePolygon(map, framePoly, center).
    // We'll rely on showFramePolygon to do the radius & circle generation. 
    // In that scenario, `buildFramePolygon()` is basically not used for corners anymore.
    // However, the user specifically asked "make it a circle ignoring corners" – 
    // let's do it all in buildFramePolygon for consistency. We'll need a center param though.

    // We'll define a default center from the average of corners:
    const latSum = ulc.lat + urc.lat + lrc.lat + llc.lat;
    const lonSum = ulc.lon + urc.lon + lrc.lon + llc.lon;
    const centerLat = latSum / 4;
    const centerLon = lonSum / 4;

    // 2) For radius, we measure distance from center to each corner, average them.
    const d1 = approxDistanceMeters(centerLat, centerLon, ulc.lat, ulc.lon);
    const d2 = approxDistanceMeters(centerLat, centerLon, urc.lat, urc.lon);
    const d3 = approxDistanceMeters(centerLat, centerLon, lrc.lat, lrc.lon);
    const d4 = approxDistanceMeters(centerLat, centerLon, llc.lat, llc.lon);

    const avgDist = (d1 + d2 + d3 + d4) / 4 || 1000; // fallback e.g. 1000m

    // 3) Build a ring of N points forming a circle around (centerLon, centerLat)
    const segments = 60;
    const ring: [number, number][] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (2 * Math.PI * i) / segments;
      // approximate lat/lon offset
      const dx = avgDist * Math.cos(angle);
      const dy = avgDist * Math.sin(angle);
      const [lon, lat] = offsetLatLon(centerLat, centerLon, dx, dy);
      ring.push([lon, lat]);
    }
    // close ring
    ring.push(ring[0]);

    // Return a circle polygon
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [ring]
      },
      properties: {
        // store the "center" we computed
        circleCenter: { lat: centerLat, lon: centerLon },
        radiusMeters: avgDist
      }
    };
  } catch (err) {
    console.error("Error building circle polygon:", err);
    // fallback to degenerate polygon
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[0,0],[0,0],[0,0],[0,0],[0,0]]]
      },
      properties: {}
    };
  }
}

/**
 * We'll draw the 'circle polygon' in a fill layer with bright yellow color,
 * ignoring the old line from center to centroid.
 */
export function showFramePolygon(
  map: maplibregl.Map,
  framePoly: Feature<Polygon>,
  _center: LatLon // we won't use `_center` now – circle is built in buildFramePolygon
) {
  const fillSourceId = 'frame-polygon';
  const fillLayerId  = 'frame-polygon-fill';

  const polyFC: FeatureCollection<Polygon> = {
    type: 'FeatureCollection',
    features: [framePoly]
  };

  if (!map.getSource(fillSourceId)) {
    map.addSource(fillSourceId, { type: 'geojson', data: polyFC });
    map.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: fillSourceId,
      paint: {
        'fill-color': '#FFFF00',  // bright yellow
        'fill-opacity': 0.25
      }
    });
    console.log('Circle polygon added.', framePoly);
  } else {
    (map.getSource(fillSourceId) as maplibregl.GeoJSONSource).setData(polyFC);
  }
}

/**
 * Approx distance in meters between two lat/lon points (rough formula).
 */
function approxDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6378137; // Earth radius in m
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2)
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
          * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Offsets lat/lon by dx,dy (in meters) using a naive approach.
 */
function offsetLatLon(centerLat: number, centerLon: number, dx: number, dy: number): [number, number] {
  const R = 6378137;
  const dLat = (dy / R) * (180 / Math.PI);
  const dLon = (dx / (R * Math.cos((Math.PI * centerLat) / 180))) * (180 / Math.PI);
  return [centerLon + dLon, centerLat + dLat];
}
