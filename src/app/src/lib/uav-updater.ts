import maplibregl from 'maplibre-gl';
import { updateTrackData } from '$lib/track-data-updater';
import uavIcon from '$lib/icons/uav-icon.png';

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

export async function loadRouteData(
	map: maplibregl.Map,
	onMarkerCreate: (marker: maplibregl.Marker) => void,
	options?: {
		fetchFn?: typeof fetch;
		interpolateFn?: typeof interpolateCoordinates;
		createMarkerElFn?: typeof createUAVMarkerElement;
		updateTrackFn?: () => void;
		scheduleNext?: (cb: () => void) => void;
		MarkerClass?: typeof maplibregl.Marker; // Add option to inject Marker class
		state?: {
			lastUpdateTime: number | null;
			accumulatedObservations: any[];
			accumulatedRoutePoints: [number, number][];
			routeGeoJSON: any;
		};
	}
): Promise<void> {
	const fetchFn = options?.fetchFn ?? fetch;
	const interpolateFn = options?.interpolateFn ?? interpolateCoordinates;
	const createMarkerElFn = options?.createMarkerElFn ?? createUAVMarkerElement;
	const updateTrackFn = options?.updateTrackFn ?? updateTrackData;
	const scheduleNext = options?.scheduleNext ?? ((cb) => setTimeout(cb, 5000));
	const MarkerClass = options?.MarkerClass ?? maplibregl.Marker; // Use injected Marker class or default
	const state = options?.state ?? {
		lastUpdateTime,
		accumulatedObservations,
		accumulatedRoutePoints,
		routeGeoJSON
	};

	if (!map) return;
	if (!map.isStyleLoaded()) {
		setTimeout(() => {
			loadRouteData(map, onMarkerCreate, options);
		}, 300);
		return;
	}

	try {
		const res = await fetchFn(
			'https://api.georobotix.io/ogc/t18/api/datastreams/iabpf1ivua1qm/observations'
		);
		const data = await res.json();
		const items = data.items || [];

		items.sort(
			(a: any, b: any) =>
				new Date(a.phenomenonTime).getTime() - new Date(b.phenomenonTime).getTime()
		);

		if (items.length === 0) return;

		const newLastTime = new Date(items[items.length - 1].phenomenonTime).getTime();
		if (state.lastUpdateTime !== null && newLastTime === state.lastUpdateTime) return;

		state.lastUpdateTime = newLastTime;

		items.forEach((obs: any) => {
			if (!state.accumulatedObservations.find((o) => o.id === obs.id)) {
				state.accumulatedObservations.push(obs);
				const c = obs.result?.geoRef?.center;
				if (c && c.lat && c.lon) {
					state.accumulatedRoutePoints.push([c.lon, c.lat]);
				}
			}
		});

		const interpolated = interpolateFn(state.accumulatedRoutePoints, 10);
		state.routeGeoJSON.features[0].geometry.coordinates = interpolated;

		if (map.getSource('route')) {
			(map.getSource('route') as maplibregl.GeoJSONSource).setData(state.routeGeoJSON);
		} else {
			map.addSource('route', { type: 'geojson', data: state.routeGeoJSON });

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

		if (state.accumulatedRoutePoints.length > 0) {
			const latestCoord =
				state.accumulatedRoutePoints[state.accumulatedRoutePoints.length - 1];
			const marker = new MarkerClass({
				element: createMarkerElFn('Neutral'),
				draggable: false
			})
				.setLngLat(latestCoord)
				.addTo(map);

			marker.getElement().addEventListener('click', updateTrackFn);
			onMarkerCreate(marker);
		}
	} catch (err) {
		console.error('Error loading route data:', err);
	} finally {
		scheduleNext(() => loadRouteData(map, onMarkerCreate, options));
	}
}
