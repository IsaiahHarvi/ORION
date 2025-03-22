// src/lib/uavUpdater.ts

import maplibregl from 'maplibre-gl';
import { updateTrackData } from '$lib/trackDataUpdater';

export const routeGeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [] },
      properties: {}
    }
  ]
};

let accumulatedRoutePoints: number[][] = [];
let accumulatedObservations: any[] = [];
let lastUpdateTime: number | null = null;

function interpolateBetween(p1: number[], p2: number[], segments: number): number[][] {
  const result: number[][] = [];
  const [lon1, lat1] = p1;
  const [lon2, lat2] = p2;
  for (let j = 0; j < segments; j++) {
    const t = j / segments;
    const lon = lon1 + (lon2 - lon1) * t;
    const lat = lat1 + (lat2 - lat1) * t;
    result.push([lon, lat]);
  }
  return result;
}

function interpolateCoordinates(coords: number[][], segments: number = 10): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    result.push(...interpolateBetween(coords[i], coords[i + 1], segments));
  }
  if (coords.length > 0) {
    result.push(coords[coords.length - 1]);
  }
  return result;
}

/** Reset stored route data & observations. Call this when the map loads or page changes. */
export function resetUAVUpdater(): void {
  accumulatedRoutePoints = [];
  accumulatedObservations = [];
  lastUpdateTime = null;
}

/**
 * Load route data. If a final marker is created, we call `onMarkerCreate(marker)` so
 * the caller can store or manage it. If there's no new data, we skip creating a marker.
 */
export function loadRouteData(
  map: maplibregl.Map,
  onMarkerCreate: (marker: maplibregl.Marker) => void
): void {
  fetch('https://api.georobotix.io/ogc/t18/api/datastreams/iabpf1ivua1qm/observations')
    .then(res => res.json())
    .then(data => {
      const items = data.items || [];
      // Sort by phenomenonTime (oldest first)
      items.sort((a: any, b: any) => new Date(a.phenomenonTime).getTime() - new Date(b.phenomenonTime).getTime());
      if (items.length === 0) return;

      const newLastTime = new Date(items[items.length - 1].phenomenonTime).getTime();
      // If there's no new data, skip
      if (lastUpdateTime !== null && newLastTime === lastUpdateTime) {
        return;
      }
      lastUpdateTime = newLastTime;

      items.forEach(obs => {
        if (!accumulatedObservations.find(o => o.id === obs.id)) {
          accumulatedObservations.push(obs);
          const c = obs.result?.geoRef?.center;
          if (c && c.lat && c.lon) {
            accumulatedRoutePoints.push([c.lon, c.lat]);
          }
        }
      });

      // Interpolate route
      const interpolated = interpolateCoordinates(accumulatedRoutePoints, 10);
      routeGeoJSON.features[0].geometry.coordinates = interpolated;
      if (map.getSource('route')) {
        (map.getSource('route') as maplibregl.GeoJSONSource).setData(routeGeoJSON);
      } else {
        map.addSource('route', { type: 'geojson', data: routeGeoJSON });
        map.addLayer({
          id: 'route-layer-outline',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#212d4f', 'line-width': 10 }
        });
        map.addLayer({
          id: 'route-layer',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#6084eb', 'line-width': 8 }
        });
      }

      // Create final marker if we have at least one coordinate
      if (accumulatedRoutePoints.length > 0) {
        const latestCoord = accumulatedRoutePoints[accumulatedRoutePoints.length - 1];
        const marker = new maplibregl.Marker({ color: '#ffffff', draggable: false })
          .setLngLat(latestCoord)
          .addTo(map);

        // On marker click, do an immediate track data update, etc.
        marker.getElement().addEventListener('click', () => {
            // This triggers immediate track data update or sets selected = true
            updateTrackData(); // If you want to refresh data
        
            // Also set trackData.selected = true
            trackDataStore.update(d => ({ ...d, selected: true }));
        });
        

        // Return the newly created marker to the caller
        onMarkerCreate(marker);
      }
    })
    .catch(err => console.error("Error loading route data:", err))
    .finally(() => {
      setTimeout(() => loadRouteData(map, onMarkerCreate), 5000);
    });
}
