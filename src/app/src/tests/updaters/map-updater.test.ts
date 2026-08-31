import { loadRadarData, resetRadarManifestCache, setRadarFramePosition } from '$lib/map-updater';
import { radar_state } from '$lib/runes/current-radar.svelte';
import type * as maplibregl from 'maplibre-gl';
import { beforeEach, describe, it, expect, vi } from 'vitest';

describe('setRadarFramePosition', () => {
	function blendAt(position: number): Record<string, number> {
		const opacities: Record<string, number> = {};
		const mockMap = {
			getLayer: vi.fn().mockReturnValue({}),
			setPaintProperty: vi.fn((layer: string, _property: string, value: number) => {
				opacities[layer] = value;
			})
		};
		setRadarFramePosition(mockMap as unknown as maplibregl.Map, position);
		return opacities;
	}

	beforeEach(() => {
		radar_state.radar_state.valid_timestamps = [
			{ id: 'a', time: 1 },
			{ id: 'b', time: 2 }
		] as never;
	});

	it('shows a single frame at a whole position', () => {
		const opacities = blendAt(0);
		expect(opacities['radar-layer-a']).toBeGreaterThan(0);
		expect(opacities['radar-layer-b']).toBe(0);
	});

	it('splits opacity between neighbours mid-transition', () => {
		const opacities = blendAt(0.5);
		expect(opacities['radar-layer-a']).toBeCloseTo(opacities['radar-layer-b']);
		// Total ink stays constant so the loop does not pulse in brightness.
		expect(opacities['radar-layer-a'] + opacities['radar-layer-b']).toBeCloseTo(
			blendAt(0)['radar-layer-a']
		);
	});

	it('clamps past the end of the buffer', () => {
		const opacities = blendAt(99);
		expect(opacities['radar-layer-b']).toBeGreaterThan(0);
	});
});

describe('loadRadarData', () => {
	beforeEach(resetRadarManifestCache);

	it('fetches the ORION manifest and displays its default frame', async () => {
		const mockMap = {
			addSource: vi.fn(),
			addLayer: vi.fn(),
			removeLayer: vi.fn(),
			removeSource: vi.fn(),
			getLayer: vi.fn().mockReturnValue(undefined),
			getSource: vi.fn().mockReturnValue(undefined),
			getStyle: vi.fn().mockReturnValue({ layers: [] }),
			setPaintProperty: vi.fn(),
			isStyleLoaded: vi.fn().mockReturnValue(true),
			once: vi.fn()
		};

		const fakeRadarData = {
			version: 1,
			generated_at: '2026-08-29T12:01:00Z',
			default_frame_id: '1743220200',
			latest_observed_frame_id: '1743220200',
			tile_size: 256,
			min_zoom: 4,
			max_zoom: 9,
			bounds: [-91.5, 33, -81, 39],
			configured_stations: ['KOHX', 'KHTX', 'KNQA'],
			attribution: { text: 'NOAA/NWS NEXRAD processed by ORION' },
			frames: [
				{
					id: '1743219600',
					time: 1743219600,
					kind: 'observed',
					tiles: 'nexrad/tiles/1743219600/{z}/{x}/{y}.png',
					stations: ['KOHX', 'KHTX'],
					max_skew_seconds: 90
				},
				{
					id: '1743220200',
					time: 1743220200,
					kind: 'observed',
					tiles: 'nexrad/tiles/1743220200/{z}/{x}/{y}.png',
					stations: ['KOHX', 'KHTX'],
					max_skew_seconds: 75
				}
			]
		};

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: vi.fn().mockResolvedValue(fakeRadarData)
		});

		await loadRadarData(mockMap as unknown as maplibregl.Map, {
			fetchFn: mockFetch,
			apiBase: 'https://orion.example/api'
		});

		expect(mockFetch).toHaveBeenCalledWith('https://orion.example/api/nexrad/frames', {
			headers: { Accept: 'application/json' }
		});

		// Every buffered frame is preloaded as its own source so that playback
		// crossfades between them without re-fetching tiles.
		expect(mockMap.addSource).toHaveBeenCalledTimes(2);
		expect(mockMap.addSource).toHaveBeenCalledWith(
			'radar-layer-1743220200',
			expect.objectContaining({
				type: 'raster',
				tileSize: 256,
				tiles: ['https://orion.example/api/nexrad/tiles/1743220200/{z}/{x}/{y}.png'],
				attribution: 'NOAA/NWS NEXRAD processed by ORION'
			})
		);
		expect(mockMap.addSource).toHaveBeenCalledWith(
			'radar-layer-1743219600',
			expect.objectContaining({
				tiles: ['https://orion.example/api/nexrad/tiles/1743219600/{z}/{x}/{y}.png']
			})
		);

		expect(mockMap.addLayer).toHaveBeenCalledTimes(2);
		expect(mockMap.addLayer).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'radar-layer-1743220200',
				type: 'raster',
				paint: expect.objectContaining({ 'raster-opacity': 0 })
			}),
			undefined
		);
	});

	it('rejects an unavailable manifest', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: vi.fn().mockResolvedValue({
				version: 1,
				configured_stations: [],
				frames: []
			})
		});
		await expect(
			loadRadarData({} as maplibregl.Map, {
				fetchFn: mockFetch,
				apiBase: 'https://orion.example/api'
			})
		).rejects.toThrow('Radar mosaic is not available yet');
	});
});
