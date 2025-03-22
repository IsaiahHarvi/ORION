import maplibregl from 'maplibre-gl';
import { trackDataStore } from '$lib/stores/trackData';
import { radar_state } from './runes/current_radar.svelte';

// -----------------
// Radar State & Helpers
// -----------------
export interface RadarLayer {
	id: string;
	time: number;
}

export let radarLayers: RadarLayer[] = [];
export let animationPosition = 0;
export let animationTimer: number | null = null;
export const FRAME_COUNT = 1;
export const FRAME_DELAY = 1500;
export const RESTART_DELAY = 1000;
export const COLOR_SCHEME = 7;
export let isPlaying = true;

export function formatTimestamp(timestamp: number): string {
	const date = new Date(timestamp);
	const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const month = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];
	return `${weekday[date.getDay()]} ${month[date.getMonth()]} ${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function nextFrame(map: any): void {
	return;
	if (radarLayers[animationPosition]) {
		map.setLayoutProperty(radarLayers[animationPosition].id, 'visibility', 'none');
	}
	animationPosition = (animationPosition + 1) % radarLayers.length;
	if (radarLayers[animationPosition]) {
		map.setLayoutProperty(radarLayers[animationPosition].id, 'visibility', 'visible');
		const timestamp = document.getElementById('radar-timestamp');
		if (timestamp) {
			timestamp.textContent = formatTimestamp(radarLayers[animationPosition].time * 1000);
		}
		const progressBar = document.getElementById('progress-bar');
		if (progressBar) {
			progressBar.style.width = `${((animationPosition + 1) / radarLayers.length) * 100}%`;
		}
	}
	if (animationPosition === radarLayers.length - 1) {
		clearInterval(animationTimer!);
		setTimeout(() => {
			if (isPlaying) {
				animationTimer = setInterval(() => nextFrame(map), FRAME_DELAY);
			}
		}, RESTART_DELAY - FRAME_DELAY);
	}
}

export function loadRainViewerData(map: any, timestamp?: number): void {
	fetch('https://api.rainviewer.com/public/weather-maps.json')
		.then((res) => res.json())
		.then((data) => {
			let valid_past_timestamps: number[] = [];

			data.radar.past.forEach((radar) => {
				valid_past_timestamps = [...(valid_past_timestamps ?? []), radar.time];
			});

			radar_state.radar_state.valid_past_timestamps = valid_past_timestamps;

			radarLayers.forEach((layer) => {
				if (map.getLayer(layer.id)) map.removeLayer(layer.id);
				if (map.getSource(layer.id)) map.removeSource(layer.id);
			});
			radarLayers = [];
			const radarFrames = data.radar.past.slice(-FRAME_COUNT);
			radarFrames.forEach((frame, index) => {
				const layerId = `radar-layer-${index}`;
				const frameTime = frame.time;

				let time = frameTime;

				if (timestamp) {
					time = timestamp;
				}

				console.log(time);

				map.addSource(layerId, {
					type: 'raster',
					tiles: [
						`https://tilecache.rainviewer.com/v2/radar/${time}/256/{z}/{x}/{y}/${COLOR_SCHEME}/1_0.png`
					],
					tileSize: 256
				});
				map.addLayer({
					id: layerId,
					type: 'raster',
					source: layerId,
					layout: { visibility: index === 0 ? 'visible' : 'none' },
					paint: { 'raster-opacity': 0.8 }
				});
				radarLayers.push({ id: layerId, time: frameTime });
			});
			animationPosition = 0;

			if (isPlaying) {
				clearInterval(animationTimer!);
				animationTimer = setInterval(() => nextFrame(map), FRAME_DELAY);
			}
			setTimeout(() => loadRainViewerData(map), 5 * 60 * 1000);
		})
		.catch(() => setTimeout(() => loadRainViewerData(map), 30 * 1000));
}

// -----------------
// Route & Marker State & Helpers
// -----------------
export const routeGeoJSON = {
	type: 'FeatureCollection',
	features: [
		{
			type: 'Feature',
			geometry: {
				type: 'LineString',
				coordinates: [] // updated below with interpolated coordinates
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

// Poll the observation API, update accumulated route points,
// and update the final (selectable) marker.
export function loadRouteData(map: any): void {
	fetch('https://api.georobotix.io/ogc/t18/api/datastreams/iabpf1ivua1qm/observations')
		.then((res) => res.json())
		.then((data) => {
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
			// Accumulate new observations (but do not create a marker for each)
			items.forEach((observation) => {
				if (!accumulatedObservations.find((o) => o.id === observation.id)) {
					accumulatedObservations.push(observation);
					const center = observation.result?.geoRef?.center;
					if (center && center.lat && center.lon) {
						const coord = [center.lon, center.lat];
						accumulatedRoutePoints.push(coord);
					}
				}
			});
			// Interpolate route points for a smooth line.
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
				// Attach a click event to update track data and visually indicate selection.
				latestMarker.getElement().addEventListener('click', () => {
					latestMarker.getElement().style.border = '3px solid blue';
					const finalObservation = accumulatedObservations[accumulatedObservations.length - 1];
					trackDataStore.set(finalObservation);
				});
			}
		})
		.catch((err) => console.error('Error loading route data:', err))
		.finally(() => {
			setTimeout(() => loadRouteData(map), 5000);
		});
}
