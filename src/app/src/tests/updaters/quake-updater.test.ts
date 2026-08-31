import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadQuakeData, resetQuakeUpdater, markerSize, markerColor } from '$lib/quake-updater';
import { quakeStore } from '$lib/stores/quake-store';
import type { Mock } from 'vitest';
import * as maplibregl from 'maplibre-gl';

vi.mock('$lib/stores/quake-store', () => ({ quakeStore: { update: vi.fn() } }));
vi.mock('maplibre-gl', () => {
	class MockMarker {
		_element: HTMLElement;
		_lngLat: [number, number] | undefined;
		removed = false;
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
		remove() {
			this.removed = true;
		}
	}
	return {
		Marker: vi.fn(function Marker(options: { element: HTMLElement }) {
			return new MockMarker(options);
		})
	};
});

const quake = (id: string, magnitude = 5.2) => ({
	id,
	time: 1788150000000,
	magnitude,
	place: 'somewhere',
	longitude: -120.5,
	latitude: 36.25,
	depth_km: 11.4,
	url: 'https://earthquake.usgs.gov/x',
	felt: 3,
	tsunami: false,
	significance: 400,
	alert: null
});

function respondWith(quakes: unknown[]): Mock {
	return vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ quakes }) });
}

describe('quake markers', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// The Marker mock lives in the module factory, so its call history
		// survives restoreAllMocks and would leak between cases.
		vi.clearAllMocks();
		resetQuakeUpdater();
	});
	afterEach(() => {
		resetQuakeUpdater();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('places one marker per event at [lon, lat]', async () => {
		const map = {} as maplibregl.Map;
		await loadQuakeData(map, respondWith([quake('a')]) as unknown as typeof fetch);

		expect(maplibregl.Marker).toHaveBeenCalledOnce();
		const marker = vi.mocked(maplibregl.Marker).mock.results[0].value;
		// Transposing these is the classic GeoJSON bug: the feed is [lon, lat].
		expect(marker._lngLat).toEqual([-120.5, 36.25]);
	});

	it('selects the quake when its marker is clicked', async () => {
		await loadQuakeData({} as maplibregl.Map, respondWith([quake('a')]) as unknown as typeof fetch);
		const el = vi.mocked(maplibregl.Marker).mock.calls[0][0]?.element as HTMLElement;
		el.onclick?.(new MouseEvent('click'));
		expect(quakeStore.update).toHaveBeenCalled();
	});

	it('removes markers for events that have aged out of the feed', async () => {
		const map = {} as maplibregl.Map;
		await loadQuakeData(map, respondWith([quake('a'), quake('b')]) as unknown as typeof fetch);
		expect(maplibregl.Marker).toHaveBeenCalledTimes(2);
		const first = vi.mocked(maplibregl.Marker).mock.results[0].value;

		await loadQuakeData(map, respondWith([quake('b')]) as unknown as typeof fetch);
		expect(first.removed).toBe(true);
	});

	it('reuses a marker for an event still in the feed', async () => {
		const map = {} as maplibregl.Map;
		await loadQuakeData(map, respondWith([quake('a')]) as unknown as typeof fetch);
		await loadQuakeData(map, respondWith([quake('a')]) as unknown as typeof fetch);
		expect(maplibregl.Marker).toHaveBeenCalledOnce();
	});

	it('skips events with unusable coordinates', async () => {
		const broken = { ...quake('a'), longitude: Number.NaN };
		await loadQuakeData({} as maplibregl.Map, respondWith([broken]) as unknown as typeof fetch);
		expect(maplibregl.Marker).not.toHaveBeenCalled();
	});

	it('survives a failing request without throwing', async () => {
		const failing = vi.fn().mockResolvedValue({ ok: false, status: 503 });
		await expect(
			loadQuakeData({} as maplibregl.Map, failing as unknown as typeof fetch)
		).resolves.toBeUndefined();
	});

	it('scales and colours markers by magnitude', () => {
		expect(markerSize(6)).toBeGreaterThan(markerSize(3));
		// Magnitude is logarithmic; small events must stay visible, large ones bounded.
		expect(markerSize(0)).toBeGreaterThanOrEqual(8);
		expect(markerSize(9.5)).toBeLessThanOrEqual(46);
		expect(markerColor(7.1)).not.toBe(markerColor(3));
	});
});
