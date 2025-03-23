import type { Feature, Polygon, FeatureCollection } from 'geojson';
import type maplibregl from 'maplibre-gl';

export interface LatLon {
  lat: number;
  lon: number;
}

// Existing buildFramePolygon and showFramePolygon functions…
export function buildFramePolygon(
  ulc: LatLon,
  urc: LatLon,
  lrc: LatLon,
  llc: LatLon
): Feature<Polygon> {
  // ... existing code ...
  // (This function builds a circle polygon based on the four corners)
  // [code omitted for brevity]
}

export function showFramePolygon(
  map: maplibregl.Map,
  framePoly: Feature<Polygon>,
  _center: LatLon
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
        'fill-color': '#FFFF00',
        'fill-opacity': 0.25
      }
    });
    console.log('Circle polygon added.', framePoly);
  } else {
    (map.getSource(fillSourceId) as maplibregl.GeoJSONSource).setData(polyFC);
  }
}

/**
 * Draws a line from the UAV marker to the image frame center.
 * This function is exported so UAVLayer.svelte can use it.
 */
export function drawUavToCenterLine(
  map: maplibregl.Map,
  uavCoord: [number, number],
  centerCoord: [number, number]
) {
  const lineFeature = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [uavCoord, centerCoord]
    },
    properties: {}
  };

  const lineFC: FeatureCollection = {
    type: 'FeatureCollection',
    features: [lineFeature]
  };

  const sourceId = 'uav-center-line';
  const layerId = 'uav-center-line-layer';

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: 'geojson', data: lineFC });
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#FFFF00', 'line-width': 3 }
    });
  } else {
    (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(lineFC);
  }
}
