import maplibregl from 'maplibre-gl';
import { radar_state } from '$lib/runes/current-radar.svelte';

export interface RadarLayer {
	id: string;
	time: number;
}

export interface RainViewerFrame {
	time: number;
	path?: string;
}

export interface RainViewerResponse {
	radar: {
		past: RainViewerFrame[];
	};
}

export let radarLayers: RadarLayer[] = [];
export let animationPosition = 0;
export const animationTimer: number | null = null;

export const FRAME_COUNT = 1;
export const FRAME_DELAY = 1500;
export const RESTART_DELAY = 1000;
export const COLOR_SCHEME = 7;

export const isPlaying = true;

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

	return `${weekday[date.getDay()]} ${month[date.getMonth()]} ${date
		.getDate()
		.toString()
		.padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date
		.getMinutes()
		.toString()
		.padStart(2, '0')}`;
}

export async function loadRainViewerData(
	map: maplibregl.Map,
	timestamp?: number,
	givenFetchFn?: typeof fetch
): Promise<void> {
	const fetchFn = givenFetchFn ?? fetch;

	const res = await fetchFn('https://api.rainviewer.com/public/weather-maps.json');
	const data: RainViewerResponse = await res.json();
	console.log(data);

	const valid_past_timestamps = data.radar.past.map((radar) => radar.time);
	radar_state.radar_state.valid_past_timestamps = valid_past_timestamps;

	const oldLayers = [...radarLayers];
	const newRadarLayers: RadarLayer[] = [];

	const radarFrames = data.radar.past.slice(-FRAME_COUNT);

	for (let index = 0; index < radarFrames.length; index++) {
		const frame = radarFrames[index];
		const layerId = `radar-layer-${Date.now()}-${index}`;

		map.addSource(layerId, {
			type: 'raster',
			tiles: [
				`https://tilecache.rainviewer.com/v2/radar/${timestamp ?? frame.time}/256/{z}/{x}/{y}/${COLOR_SCHEME}/1_0.png`
			],
			tileSize: 256
		});

		map.addLayer({
			id: layerId,
			type: 'raster',
			source: layerId,
			layout: { visibility: 'visible' },
			paint: { 'raster-opacity': 0 }
		});

		map.setPaintProperty(layerId, 'raster-opacity-transition', { duration: 800 });

		setTimeout(() => {
			map.setPaintProperty(layerId, 'raster-opacity', 0.7);
		}, 50);

		newRadarLayers.push({ id: layerId, time: frame.time });
	}

	oldLayers.forEach((oldLayer) => {
		if (map.getLayer(oldLayer.id)) {
			map.setPaintProperty(oldLayer.id, 'raster-opacity-transition', { duration: 500 });
			map.setPaintProperty(oldLayer.id, 'raster-opacity', 0);

			setTimeout(() => {
				if (map.getLayer(oldLayer.id)) map.removeLayer(oldLayer.id);
				if (map.getSource(oldLayer.id)) map.removeSource(oldLayer.id);
			}, 500);
		}
	});

	radarLayers = newRadarLayers;
	animationPosition = 0;

	const timestampEl = document.getElementById('radar-timestamp');
	if (timestampEl && radarLayers[0]) {
		timestampEl.textContent = formatTimestamp(radarLayers[0].time * 1000);
	}

	if (isPlaying) {
		clearInterval(animationTimer!);
	}
}
