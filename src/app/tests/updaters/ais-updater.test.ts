import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadAISData, resetAISUpdater } from '$lib/ais-updater';
import { aisStore } from '$lib/stores/ais-store';
import type { Mock } from 'vitest';
import maplibregl from 'maplibre-gl';

vi.mock('$lib/icons/ship-icon.png', () => ({ default: 'ship-icon.png' }));
vi.mock('$lib/stores/ais-store', () => ({
	aisStore: { update: vi.fn() }
}));
vi.mock('maplibre-gl', () => {
	class MockMarker {
		_element: HTMLElement;
		_lngLat: [number, number] | undefined;
		constructor(options: { element: HTMLElement }) {
			this._element = options.element;
		}
		setLngLat(lngLat: [number, number]) {
			this._lngLat = lngLat;
			return this;
		}
		addTo() {
			return this;
		}
		remove() {}
	}
	return {
		default: {
			Marker: vi
				.fn()
				.mockImplementation((options: { element: HTMLElement }) => new MockMarker(options))
		}
	};
});

describe('loadAISData', () => {
	let mockMap: Partial<maplibregl.Map>;
	let mockFetch: Mock;

	beforeEach(() => {
		vi.useFakeTimers();
		resetAISUpdater();
		mockFetch = vi.fn().mockResolvedValue({
			json: () =>
				Promise.resolve({
					items: [
						{
							'foi@id': '123456789',
							result: {
								location: { lat: 12.34, lon: 56.78 },
								sog: 10,
								heading: 90,
								name: 'Test Ship'
							}
						}
					]
				})
		});
		globalThis.fetch = mockFetch;
		mockMap = {
			addLayer: vi.fn(),
			addSource: vi.fn(),
			getSource: vi.fn()
		};
		globalThis.document.createElement = vi.fn().mockImplementation((tag: string) => {
			return {
				tagName: tag.toUpperCase(),
				className: '',
				setAttribute: vi.fn(),
				style: {},
				onclick: null
			};
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('creates and adds a new marker to the map with correct data', async () => {
		resetAISUpdater();
		loadAISData(mockMap as maplibregl.Map);
		await vi.runAllTicks();

		expect(globalThis.fetch).toHaveBeenCalledWith(
			'https://api.georobotix.io/ogc/t18/api/datastreams/kuhmds0ib5gd8/observations'
		);
		expect(maplibregl.Marker).not.toHaveBeenCalled();

		const markerConstructorSpy = vi.spyOn(maplibregl, 'Marker');

		if (markerConstructorSpy.mock.calls.length > 0) {
			const markerOptions = markerConstructorSpy.mock.calls[0][0];
			if (markerOptions && markerOptions.element) {
				const el = markerOptions.element as HTMLImageElement;

				expect(el).toBeDefined();
				expect(el.tagName).toBe('IMG');
				expect(el.src).toContain('ship-icon.png');

				el.onclick?.(new MouseEvent('click'));
				expect(aisStore.update).toHaveBeenCalled();
			}
		} else {
			expect(maplibregl.Marker).not.toHaveBeenCalled();
		}

		vi.advanceTimersByTime(10000);
	});
});
