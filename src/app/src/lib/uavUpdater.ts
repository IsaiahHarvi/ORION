import maplibregl from 'maplibre-gl';
import { trackDataStore } from '$lib/stores/trackData';

export const routeGeoJSON = {
	type: 'FeatureCollection',
	features: [
		{
			type: 'Feature',
			geometry: {
				type: 'LineString',
				coordinates: [] // This will be updated with interpolated coordinates
			},
			properties: {}
		}
	]
};

export let accumulatedRoutePoints: number[][] = [];
export let accumulatedObservations: any[] = [];
export let lastUpdateTime: number | null = null;
export let latestMarker: maplibregl.Marker | null = null;

// Linear interpolation helpers
export function interpolateBetween(p1: number[], p2: number[], segments: number): number[][] {
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

export function interpolateCoordinates(coords: number[][], segments: number = 10): number[][] {
	const result: number[][] = [];
	for (let i = 0; i < coords.length - 1; i++) {
		result.push(...interpolateBetween(coords[i], coords[i + 1], segments));
	}
	if (coords.length > 0) {
		result.push(coords[coords.length - 1]);
	}
	return result;
}

// Call this to reset UAV updater state when the UAV page is mounted.
export function resetUAVUpdater(): void {
	accumulatedRoutePoints = [];
	accumulatedObservations = [];
	lastUpdateTime = null;
	if (latestMarker) {
		latestMarker.remove();
		latestMarker = null;
	}
}

export function loadRouteData(map: any): void {
	fetch('https://api.georobotix.io/ogc/t18/api/datastreams/iabpf1ivua1qm/observations')
		.then(res => res.json())
		.then(data => {
			let items = data.items || [];
			// Sort by phenomenonTime (oldest first)
			items.sort(
				(a, b) => new Date(a.phenomenonTime).getTime() - new Date(b.phenomenonTime).getTime()
			);
			if (items.length === 0) return;
			const newLastTime = new Date(items[items.length - 1].phenomenonTime).getTime();
			if (lastUpdateTime !== null && newLastTime === lastUpdateTime) {
				return;
			}
			lastUpdateTime = newLastTime;
			// Accumulate new observations (do not create markers for each)
			items.forEach(observation => {
				if (!accumulatedObservations.find(o => o.id === observation.id)) {
					accumulatedObservations.push(observation);
					const center = observation.result?.geoRef?.center;
					if (center && center.lat && center.lon) {
						const coord = [center.lon, center.lat];
						accumulatedRoutePoints.push(coord);
					}
				}
			});
			// Interpolate for a smooth line.
			const interpolatedCoordinates = interpolateCoordinates(accumulatedRoutePoints, 10);
			routeGeoJSON.features[0].geometry.coordinates = interpolatedCoordinates;
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
			// Update the final (latest) marker as the only selectable marker.
			if (accumulatedRoutePoints.length > 0) {
				const latestCoord = accumulatedRoutePoints[accumulatedRoutePoints.length - 1];
				if (latestMarker) {
					latestMarker.remove();
				}
				latestMarker = new maplibregl.Marker({ color: '#ff0000', draggable: false })
					.setLngLat(latestCoord)
					.addTo(map);
				latestMarker.getElement().addEventListener('click', () => {
					// Visually indicate selection
					latestMarker.getElement().style.border = '3px solid blue';
					const finalObservation = accumulatedObservations[accumulatedObservations.length - 1];
					trackDataStore.set(finalObservation);
				});
			}
		})
		.catch(err => console.error("Error loading route data:", err))
		.finally(() => {
			setTimeout(() => loadRouteData(map), 5000);
		});
}
