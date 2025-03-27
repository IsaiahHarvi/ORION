import maplibregl from 'maplibre-gl';
import { radar_state } from '$lib/runes/current-radar.svelte';

export interface RadarLayer {
	id: string;
	time: number;
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

	return `${weekday[date.getDay()]} ${month[date.getMonth()]} ${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function loadRainViewerData(map: maplibregl.Map, timestamp?: number): void {
	// console.log('Called');
	fetch('https://api.rainviewer.com/public/weather-maps.json')
		.then((res) => res.json())
		.then((data) => {
			let valid_past_timestamps: number[] = [];

			data.radar.past.forEach((radar: { time: number }) => {
				valid_past_timestamps = [...(valid_past_timestamps ?? []), radar.time];
			});

			radar_state.radar_state.valid_past_timestamps = valid_past_timestamps;

			const oldLayers = [...radarLayers];
			const newRadarLayers: { id: string; time: number }[] = [];

			const radarFrames = data.radar.past.slice(-FRAME_COUNT);

			radarFrames.forEach((frame: { time: number }, index: number) => {
				const layerId = `radar-layer-${Date.now()}-${index}`;
				let frameTime = frame.time;

				if (timestamp) {
					frameTime = timestamp;
				}

				map.addSource(layerId, {
					type: 'raster',
					tiles: [
						`https://tilecache.rainviewer.com/v2/radar/${frameTime}/256/{z}/{x}/{y}/${COLOR_SCHEME}/1_0.png`
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
			});

			oldLayers.forEach((oldLayer) => {
				if (map.getLayer(oldLayer.id)) {
					map.setPaintProperty(oldLayer.id, 'raster-opacity-transition', {
						duration: 500
					});

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

			setTimeout(() => loadRainViewerData(map), 5 * 60 * 1000);
		})
		.catch(() => setTimeout(() => loadRainViewerData(map), 30 * 1000));
}
