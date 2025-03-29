import { loadRainViewerData } from '$lib/map-updater';
import { describe, it, expect, vi } from 'vitest';

describe('loadRainViewerData', () => {
	it('fetches radar data and updates map and UI', async () => {
		const mockMap = {
			addSource: vi.fn(),
			addLayer: vi.fn(),
			setPaintProperty: vi.fn(),
			getLayer: vi.fn().mockReturnValue(true),
			getSource: vi.fn().mockReturnValue(true),
			removeLayer: vi.fn(),
			removeSource: vi.fn()
		};

		const fakeRadarData = {
			radar: {
				past: [
					{ time: 1743219600, path: '/v2/radar/1743219600' },
					{ time: 1743220200, path: '/v2/radar/1743220200' },
					{ time: 1743220800, path: '/v2/radar/1743220800' },
					{ time: 1743221400, path: '/v2/radar/1743221400' }
				],
				nowcast: [
					{ time: 1743222000, path: '/v2/radar/nowcast_abc123' },
					{ time: 1743222600, path: '/v2/radar/nowcast_def456' }
				]
			}
		};

		const mockFetch = vi.fn().mockResolvedValue({
			json: vi.fn().mockResolvedValue(fakeRadarData)
		});

		document.body.innerHTML = `<div id="radar-timestamp"></div>`;

		await loadRainViewerData(mockMap as unknown as maplibregl.Map, 1743219600, mockFetch);

		expect(mockFetch).toHaveBeenCalledWith(
			'https://api.rainviewer.com/public/weather-maps.json'
		);

		expect(mockMap.addSource).toHaveBeenCalledTimes(1);
		expect(mockMap.addSource).toHaveBeenCalledWith(
			expect.stringContaining('radar-layer'),
			expect.objectContaining({
				type: 'raster',
				tileSize: 256
			})
		);

		expect(mockMap.addLayer).toHaveBeenCalledTimes(1);

		expect(mockMap.setPaintProperty).toHaveBeenCalledWith(
			expect.stringContaining('radar-layer'),
			'raster-opacity-transition',
			{ duration: 800 }
		);

		const timestampEl = document.getElementById('radar-timestamp');
		expect(timestampEl?.textContent).toBeDefined();
	});
});
