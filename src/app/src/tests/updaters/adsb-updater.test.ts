import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	loadFlightData,
	resetAdsbUpdater,
	viewportRadiusNm,
	markerColor,
	label,
	shortestTurn,
	deadReckon,
	stepAnimation
} from '$lib/adsb-updater';
import { flightStore, type Flight } from '$lib/stores/flight-store';
import type { Mock } from 'vitest';
import * as maplibregl from 'maplibre-gl';

vi.mock('$lib/stores/flight-store', () => ({ flightStore: { update: vi.fn() } }));
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
		getLngLat() {
			return { lng: this._lngLat?.[0] ?? 0, lat: this._lngLat?.[1] ?? 0 };
		}
		getElement() {
			return this._element;
		}
		addTo() {
			return this;
		}
		remove() {
			this.removed = true;
		}
	}
	class LngLat {
		constructor(
			public lng: number,
			public lat: number
		) {}
		distanceTo() {
			return 185_200; // 100 nm
		}
	}
	return {
		Marker: vi.fn(function Marker(options: { element: HTMLElement }) {
			return new MockMarker(options);
		}),
		LngLat
	};
});

const flight = (id: string, overrides: Partial<Flight> = {}): Flight => ({
	id,
	callsign: 'JIA5024',
	registration: 'N586NN',
	aircraft_type: 'CRJ9',
	latitude: 36.674,
	longitude: -88.362,
	altitude_ft: 32000,
	on_ground: false,
	ground_speed_kt: 478,
	track_deg: 243,
	vertical_rate_fpm: 64,
	squawk: '1677',
	emergency: null,
	seen_pos_s: 0.4,
	distance_nm: 89.9,
	...overrides
});

const fakeMap = () =>
	({
		getCenter: () => ({ lat: 36.0, lng: -86.7 }),
		getBounds: () => ({
			getCenter: () => new maplibregl.LngLat(-86.7, 36.0),
			getEast: () => -85.0,
			getNorth: () => 37.0
		})
	}) as unknown as maplibregl.Map;

function respondWith(aircraft: unknown[]): Mock {
	return vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ aircraft }) });
}

describe('adsb markers', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// The Marker mock lives in the module factory, so its call history
		// survives restoreAllMocks and would leak between cases.
		vi.clearAllMocks();
		resetAdsbUpdater();
	});
	afterEach(() => {
		resetAdsbUpdater();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('places one marker per aircraft at [lon, lat]', async () => {
		await loadFlightData(fakeMap(), respondWith([flight('a')]) as unknown as typeof fetch);
		expect(maplibregl.Marker).toHaveBeenCalledOnce();
		const marker = vi.mocked(maplibregl.Marker).mock.results[0].value;
		// The feed reports lat and lon separately; MapLibre wants [lon, lat].
		expect(marker._lngLat).toEqual([-88.362, 36.674]);
	});

	it('queries the viewport the user is looking at', async () => {
		const fetchFn = respondWith([]);
		await loadFlightData(fakeMap(), fetchFn as unknown as typeof fetch);
		const url = fetchFn.mock.calls[0][0] as string;
		expect(url).toContain('lat=36.000');
		expect(url).toContain('lon=-86.700');
		expect(url).toContain('radius_nm=100');
	});

	it('clamps the radius to what the upstream will answer', () => {
		const wide = {
			getBounds: () => ({
				getCenter: () => ({ distanceTo: () => 5_000_000 }),
				getEast: () => 0,
				getNorth: () => 0
			})
		} as unknown as maplibregl.Map;
		expect(viewportRadiusNm(wide)).toBe(250);
	});

	it('moves an aircraft already on the map instead of recreating it', async () => {
		const map = fakeMap();
		await loadFlightData(map, respondWith([flight('a')]) as unknown as typeof fetch);
		const start = performance.now();
		await loadFlightData(
			map,
			respondWith([
				flight('a', { latitude: 37.0, longitude: -88.0 })
			]) as unknown as typeof fetch
		);
		expect(maplibregl.Marker).toHaveBeenCalledOnce();

		const marker = vi.mocked(maplibregl.Marker).mock.results[0].value;
		// The correction from the old drawn position to the new report eases in
		// rather than snapping, so mid-correction it is at neither.
		stepAnimation(start + 500);
		expect(marker._lngLat).not.toEqual([-88.0, 37.0]);
	});

	it('keeps flying between reports instead of standing still', async () => {
		// The server caches for as long as the client polls, so consecutive
		// reports are often identical. Dead reckoning is what keeps the marker
		// moving through them.
		const map = fakeMap();
		await loadFlightData(map, respondWith([flight('a')]) as unknown as typeof fetch);
		const marker = vi.mocked(maplibregl.Marker).mock.results[0].value;
		const start = performance.now();

		stepAnimation(start + 4_000);
		const first = marker._lngLat as [number, number];
		stepAnimation(start + 8_000);
		const second = marker._lngLat as [number, number];

		expect(second[0]).not.toBe(first[0]);
		expect(second[1]).not.toBe(first[1]);
		// Track 243 is south-west, so it must be going that way and no other.
		expect(second[0]).toBeLessThan(first[0]);
		expect(second[1]).toBeLessThan(first[1]);
	});

	it('leaves a parked aircraft where it is', async () => {
		const map = fakeMap();
		await loadFlightData(
			map,
			respondWith([
				flight('a', { on_ground: true, ground_speed_kt: 0, altitude_ft: null })
			]) as unknown as typeof fetch
		);
		const marker = vi.mocked(maplibregl.Marker).mock.results[0].value;
		stepAnimation(performance.now() + 30_000);
		expect(marker._lngLat).toEqual([-88.362, 36.674]);
	});

	it('stops extrapolating when the feed goes quiet', () => {
		// A minute of coasting is a plausible position; ten minutes is fiction.
		const oneMinute = deadReckon([-88.0, 36.0], 480, 90, 60_000);
		const tenMinutes = deadReckon([-88.0, 36.0], 480, 90, 600_000);
		expect(tenMinutes).toEqual(oneMinute);
	});

	it('shortens a degree of longitude with latitude', () => {
		// Flying due east at the same speed covers more degrees further north.
		const [equator] = deadReckon([0, 0], 480, 90, 60_000);
		const [arctic] = deadReckon([0, 70], 480, 90, 60_000);
		expect(arctic).toBeGreaterThan(equator);
	});

	it('takes the short way round when a heading crosses north', () => {
		// 350 to 010 is a 20 degree right turn, not a 340 degree left one.
		expect(shortestTurn(350, 10)).toBe(20);
		expect(shortestTurn(10, 350)).toBe(-20);
	});

	it('removes aircraft the feed no longer reports', async () => {
		const map = fakeMap();
		await loadFlightData(
			map,
			respondWith([flight('a'), flight('b')]) as unknown as typeof fetch
		);
		const first = vi.mocked(maplibregl.Marker).mock.results[0].value;
		await loadFlightData(map, respondWith([flight('b')]) as unknown as typeof fetch);
		expect(first.removed).toBe(true);
	});

	it('selects the aircraft when its marker is clicked', async () => {
		await loadFlightData(fakeMap(), respondWith([flight('a')]) as unknown as typeof fetch);
		const el = vi.mocked(maplibregl.Marker).mock.calls[0][0]?.element as HTMLElement;
		el.click();
		expect(flightStore.update).toHaveBeenCalled();
	});

	it('points the glyph along the aircraft track', async () => {
		await loadFlightData(fakeMap(), respondWith([flight('a')]) as unknown as typeof fetch);
		const el = vi.mocked(maplibregl.Marker).mock.calls[0][0]?.element as HTMLElement;
		const glyph = el.firstElementChild as SVGElement;
		// On the glyph, not the marker element: MapLibre writes the element's own
		// transform to position it, so a rotation there is lost on the next map
		// move and the marker drifts off its coordinates.
		expect(glyph.style.transform).toBe('rotate(243deg)');
		expect(el.style.transform).toBe('');
	});

	it('skips aircraft with unusable coordinates', async () => {
		const broken = flight('a', { latitude: Number.NaN });
		await loadFlightData(fakeMap(), respondWith([broken]) as unknown as typeof fetch);
		expect(maplibregl.Marker).not.toHaveBeenCalled();
	});

	it('survives a failing request without throwing', async () => {
		const failing = vi.fn().mockResolvedValue({ ok: false, status: 503 });
		await expect(
			loadFlightData(fakeMap(), failing as unknown as typeof fetch)
		).resolves.toBeUndefined();
	});

	it('colours by altitude band and flags emergencies', () => {
		expect(markerColor(flight('a', { altitude_ft: 35_000 }))).not.toBe(
			markerColor(flight('a', { altitude_ft: 3_000 }))
		);
		expect(markerColor(flight('a', { on_ground: true, altitude_ft: null }))).not.toBe(
			markerColor(flight('a'))
		);
		// An emergency outranks the altitude band it would otherwise get.
		expect(markerColor(flight('a', { emergency: 'lifeguard' }))).toBe('#ef4444');
	});

	it('falls back through callsign, registration, then ICAO address', () => {
		expect(label(flight('a'))).toBe('JIA5024');
		expect(label(flight('a', { callsign: null }))).toBe('N586NN');
		expect(label(flight('a78d6b', { callsign: null, registration: null }))).toBe('A78D6B');
	});
});
