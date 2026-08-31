import type * as maplibregl from 'maplibre-gl';
import { buildApiUrl } from '$lib/api';
import { radar_state } from '$lib/runes/current-radar.svelte';
import type { RadarManifest } from '$types';

export const RADAR_LAYER_ID = 'radar-layer';
/** Frames kept resident so playback crossfades instead of re-fetching tiles. */
export const RADAR_BUFFER_SIZE = 6;
const RADAR_MAX_OPACITY = 0.55;
const MANIFEST_TTL_MS = 60_000;

function frameLayerId(frameId: string): string {
	return `${RADAR_LAYER_ID}-${frameId}`;
}

export function isRadarLayerId(layerId: string): boolean {
	return layerId === RADAR_LAYER_ID || layerId.startsWith(`${RADAR_LAYER_ID}-`);
}

let cachedManifest: RadarManifest | undefined;
let cachedApiBase = '';
let cachedAt = 0;
let pendingManifest: Promise<RadarManifest> | undefined;
let manifestGeneration = 0;

type LoadRadarOptions = {
	timestamp?: number;
	fetchFn?: typeof fetch;
	apiBase?: string;
	forceManifest?: boolean;
};

export class RadarUnavailableError extends Error {}

function validateManifest(value: unknown): RadarManifest {
	if (!value || typeof value !== 'object') throw new Error('Radar manifest is not an object');
	const manifest = value as RadarManifest;
	if (
		manifest.version !== 1 ||
		!Array.isArray(manifest.frames) ||
		!Array.isArray(manifest.configured_stations)
	) {
		throw new Error('Unsupported radar manifest');
	}
	if (!manifest.frames.length)
		throw new RadarUnavailableError('Radar mosaic is not available yet');
	if (!manifest.frames.some((frame) => frame.id === manifest.default_frame_id)) {
		throw new Error('Radar manifest default frame is missing');
	}

	const timestamps = new Set<number>();
	for (const frame of manifest.frames) {
		if (
			typeof frame.id !== 'string' ||
			!Number.isFinite(frame.time) ||
			!['observed', 'forecast'].includes(frame.kind) ||
			typeof frame.tiles !== 'string' ||
			!Array.isArray(frame.stations) ||
			!Number.isFinite(frame.max_skew_seconds) ||
			!['{z}', '{x}', '{y}'].every((token) => frame.tiles.includes(token)) ||
			timestamps.has(frame.time)
		) {
			throw new Error('Radar manifest contains an invalid frame');
		}
		timestamps.add(frame.time);
	}
	return manifest;
}

export function resetRadarManifestCache(): void {
	cachedManifest = undefined;
	cachedApiBase = '';
	cachedAt = 0;
	pendingManifest = undefined;
	manifestGeneration = 0;
}

export async function fetchRadarManifest(
	fetchFn: typeof fetch = fetch,
	apiBase = import.meta.env.VITE_API_URL,
	force = false
): Promise<RadarManifest> {
	const now = Date.now();
	if (!force && cachedManifest && cachedApiBase === apiBase && now - cachedAt < MANIFEST_TTL_MS) {
		return cachedManifest;
	}
	if (!force && pendingManifest && cachedApiBase === apiBase) return pendingManifest;

	cachedApiBase = apiBase;
	const generation = ++manifestGeneration;
	const request = (async () => {
		const response = await fetchFn(buildApiUrl('nexrad/frames', apiBase), {
			headers: { Accept: 'application/json' }
		});
		if (response.status === 503)
			throw new RadarUnavailableError('Radar mosaic is not available yet');
		if (!response.ok) throw new Error(`Radar manifest request failed with ${response.status}`);
		const manifest = validateManifest(await response.json());
		manifest.frames.sort((a, b) => a.time - b.time);
		if (generation === manifestGeneration) {
			cachedManifest = manifest;
			cachedAt = Date.now();
		}
		return manifest;
	})();
	pendingManifest = request;

	try {
		const manifest = await request;
		if (generation !== manifestGeneration) {
			throw new DOMException('Superseded radar manifest request', 'AbortError');
		}
		return manifest;
	} finally {
		if (pendingManifest === request) pendingManifest = undefined;
	}
}

export async function loadRadarData(
	map: maplibregl.Map,
	options: LoadRadarOptions = {}
): Promise<void> {
	const apiBase = options.apiBase ?? import.meta.env.VITE_API_URL;
	const manifest = await fetchRadarManifest(
		options.fetchFn,
		apiBase,
		options.forceManifest ?? false
	);
	const timestamps = manifest.frames.map((frame) => ({
		id: frame.id,
		time: frame.time,
		isNowcast: frame.kind === 'forecast',
		tileUrl: buildApiUrl(frame.tiles, apiBase),
		stations: frame.stations,
		configuredStationCount: manifest.configured_stations.length,
		maxSkewSeconds: frame.max_skew_seconds,
		motion: frame.motion_mps ?? { x: 0, y: 0 }
	}));
	// Only the most recent frames are kept warm; older ones stay in the manifest
	// for the scrubber but are not worth the tile requests.
	const buffered = timestamps.slice(-RADAR_BUFFER_SIZE);
	radar_state.radar_state.valid_timestamps = buffered;

	const defaultFrame = manifest.frames.find((frame) => frame.id === manifest.default_frame_id)!;
	const targetTimestamp =
		options.timestamp ?? radar_state.radar_state.timestamp ?? defaultFrame.time;
	const selected =
		buffered.find((frame) => frame.time === targetTimestamp) ?? buffered[buffered.length - 1];
	radar_state.radar_state.timestamp = selected.time;
	if (options.timestamp !== undefined || radar_state.radar_state.position === 0) {
		radar_state.radar_state.position = buffered.indexOf(selected);
	}

	// Touching sources or layers before the style finishes loading throws; this
	// happens on first paint and whenever the base style is being swapped.
	while (!map.isStyleLoaded()) {
		await new Promise((resolve) => map.once('styledata', resolve));
	}

	// Every buffered frame gets its own source and layer so playback only has to
	// change opacity. Swapping tiles on one shared source re-fetches on every
	// step, which is what made the loop stutter.
	const firstLabel = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
	for (const frame of buffered) {
		const layerId = frameLayerId(frame.id);
		if (!map.getSource(layerId)) {
			map.addSource(layerId, {
				type: 'raster',
				tiles: [frame.tileUrl],
				tileSize: manifest.tile_size,
				minzoom: manifest.min_zoom,
				maxzoom: manifest.max_zoom,
				bounds: manifest.bounds,
				attribution: manifest.attribution.text
			});
		}
		if (!map.getLayer(layerId)) {
			map.addLayer(
				{
					id: layerId,
					type: 'raster',
					source: layerId,
					layout: { visibility: 'visible' },
					paint: {
						'raster-opacity': 0,
						'raster-resampling': 'linear',
						// Frames are swapped by opacity, so MapLibre's own
						// cross-source fade would double-fade every step.
						'raster-fade-duration': 0
					}
				},
				firstLabel
			);
		}
	}

	const keep = new Set(buffered.map((frame) => frameLayerId(frame.id)));
	for (const layer of map.getStyle().layers) {
		if (isRadarLayerId(layer.id) && !keep.has(layer.id)) {
			if (map.getLayer(layer.id)) map.removeLayer(layer.id);
			if (map.getSource(layer.id)) map.removeSource(layer.id);
		}
	}

	setRadarFramePosition(map, radar_state.radar_state.position);
}

/**
 * Show a fractional position in the buffer, blending the two frames it falls
 * between. Callers drive this every animation frame, so it must stay cheap:
 * setting paint properties only, never touching sources.
 */
export function setRadarFramePosition(map: maplibregl.Map, position: number): void {
	const frames = radar_state.radar_state.valid_timestamps;
	if (!frames.length || !map.getLayer(frameLayerId(frames[0].id))) return;

	const clamped = Math.max(0, Math.min(position, frames.length - 1));
	const lower = Math.floor(clamped);
	const upper = Math.min(lower + 1, frames.length - 1);
	const blend = clamped - lower;

	for (const [index, frame] of frames.entries()) {
		const layerId = frameLayerId(frame.id);
		if (!map.getLayer(layerId)) continue;
		let opacity = 0;
		if (index === lower) opacity = (1 - blend) * RADAR_MAX_OPACITY;
		if (index === upper) opacity += blend * RADAR_MAX_OPACITY;
		map.setPaintProperty(layerId, 'raster-opacity', opacity);
	}
}
