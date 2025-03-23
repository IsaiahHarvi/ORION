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

/** Reset stored route data & observations. */
export function resetUAVUpdater(): void {
  accumulatedRoutePoints = [];
  accumulatedObservations = [];
  lastUpdateTime = null;
}

/**
 * Load route data from the UAV endpoint.
 * If the map isn’t ready, we schedule a retry.
 */
export function loadRouteData(
  map: maplibregl.Map,
  onMarkerCreate: (marker: maplibregl.Marker) => void
): void {
  if (!map) {
    console.warn("loadRouteData: Map instance is undefined.");
    return;
  }
  // Wait until the style is loaded
  if (!map.isStyleLoaded()) {
    setTimeout(() => loadRouteData(map, onMarkerCreate), 300);
    return;
  }

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
      try {
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
      } catch (e) {
        console.error("Error updating route data:", e);
      }

      // Create final marker if we have at least one coordinate
      if (accumulatedRoutePoints.length > 0) {
        const latestCoord = accumulatedRoutePoints[accumulatedRoutePoints.length - 1];
        const marker = new maplibregl.Marker({ color: '#ffffff', draggable: false })
          .setLngLat(latestCoord)
          .addTo(map);

        marker.getElement().addEventListener('click', () => {
          updateTrackData();
          // Update selection flag in your store as needed
          // e.g., trackDataStore.update(d => ({ ...d, selected: true }));
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
