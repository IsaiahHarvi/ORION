import maplibregl, { type LngLatLike } from 'maplibre-gl';
import { updateTrackData } from '$lib/track-data-updater';
import uavIcon from '$lib/icons/uav-icon.png';

export const routeGeoJSON: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
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
let accumulatedObservations: { id: string }[] = [];
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

export function resetUAVUpdater(): void {
	accumulatedRoutePoints = [];
	accumulatedObservations = [];
	lastUpdateTime = null;
}

function tintFilterFromCombatStatus(status: 'Neutral' | 'Friendly' | 'Enemy'): string {
	switch (status) {
		case 'Friendly':
			return 'brightness(0) saturate(100%) invert(45%) sepia(100%) saturate(3000%) hue-rotate(90deg)';
		case 'Enemy':
			return 'brightness(0) saturate(100%) invert(15%) sepia(100%) saturate(3000%) hue-rotate(350deg)';
		default:
			return 'none';
	}
}

export function createUAVMarkerElement(status: 'Neutral' | 'Friendly' | 'Enemy'): HTMLElement {
	const el = document.createElement('img');
	el.className = 'uav-marker';
	el.src = uavIcon;
	el.alt = 'UAV';
	el.style.width = '32px';
	el.style.height = '32px';
	el.style.display = 'block';
	el.style.filter = tintFilterFromCombatStatus(status);
	el.className = 'marker';
	return el;
}

export function loadRouteData(
	map: maplibregl.Map,
	onMarkerCreate: (marker: maplibregl.Marker) => void
): void {
	if (!map) {
		console.warn('loadRouteData: Map instance is undefined.');
		return;
	}

	if (!map.isStyleLoaded()) {
		setTimeout(() => loadRouteData(map, onMarkerCreate), 300);
		return;
	}

	fetch('https://api.georobotix.io/ogc/t18/api/datastreams/iabpf1ivua1qm/observations')
		.then((res) => res.json())
		.then((data) => {
			const items = data.items || [];

			items.sort(
				(a: { phenomenonTime: string }, b: { phenomenonTime: string }) =>
					new Date(a.phenomenonTime).getTime() - new Date(b.phenomenonTime).getTime()
			);

			if (items.length === 0) return;

			const newLastTime = new Date(items[items.length - 1].phenomenonTime).getTime();

			if (lastUpdateTime !== null && newLastTime === lastUpdateTime) {
				return;
			}

			lastUpdateTime = newLastTime;

			items.forEach(
				(obs: {
					id: string;
					result: { geoRef: { center: { lat: number; lon: number } } };
				}) => {
					if (!accumulatedObservations.find((o) => o.id === obs.id)) {
						accumulatedObservations.push(obs);

						const c = obs.result?.geoRef?.center;
						if (c && c.lat && c.lon) {
							accumulatedRoutePoints.push([c.lon, c.lat]);
						}
					}
				}
			);

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
				console.error('Error updating route data:', e);
			}

			if (accumulatedRoutePoints.length > 0) {
				const latestCoord = accumulatedRoutePoints[accumulatedRoutePoints.length - 1];

				const marker = new maplibregl.Marker({
					element: createUAVMarkerElement('Neutral'),
					draggable: false
				})
					.setLngLat(latestCoord as LngLatLike)
					.addTo(map);

				marker.getElement().addEventListener('click', () => {
					updateTrackData();
				});

				onMarkerCreate(marker);
			}
		})
		.catch((err) => console.error('Error loading route data:', err))
		.finally(() => {
			setTimeout(() => loadRouteData(map, onMarkerCreate), 5000);
		});
}
