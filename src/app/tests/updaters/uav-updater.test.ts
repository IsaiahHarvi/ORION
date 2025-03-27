import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadRouteData } from '$lib/uav-updater';
import maplibregl from 'maplibre-gl';

class MockMarker {
	private _lngLat: [number, number];
	private _element: HTMLElement;

	constructor(options: { element: HTMLElement; draggable: boolean }) {
		this._element = options.element;
	}

	setLngLat(lngLat: [number, number]) {
		this._lngLat = lngLat;
		return this;
	}

	addTo(map: any) {
		return this;
	}

	getElement() {
		return this._element;
	}
}

const mockInterpolateCoordinates = (points: [number, number][], segments: number) =>
	points.slice(0, Math.min(points.length, segments));

const mockCreateUAVMarkerElement = (status: string) => document.createElement('div');

const mockUpdateTrackData = () => {};

describe('loadRouteData', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it('fetches route for UAVs, updates map, and creates a marker', async () => {
		const fakeItems = [
			{
				id: '1',
				phenomenonTime: '2024-03-01T12:00:00Z',
				result: {
					geoRef: {
						center: { lat: 40.123, lon: -74.456 }
					}
				}
			}
		];

		const mockFetchResponse = {
			json: vi.fn().mockResolvedValue({ items: fakeItems })
		};

		const mockFetch = vi.fn().mockResolvedValue(mockFetchResponse);

		const mockAddLayer = vi.fn();
		const mockAddSource = vi.fn();
		const mockSetData = vi.fn();
		const mockGetSource = vi.fn().mockReturnValue({ setData: mockSetData });

		const mockMap = {
			isStyleLoaded: () => true,
			getSource: mockGetSource,
			addSource: mockAddSource,
			addLayer: mockAddLayer
		};

		const markerElement = document.createElement('div');
		const mockAddEventListener = vi.fn();
		markerElement.addEventListener = mockAddEventListener;

		const mockOnMarkerCreate = vi.fn();

		const state = {
			lastUpdateTime: null,
			accumulatedObservations: [],
			accumulatedRoutePoints: [],
			routeGeoJSON: {
				type: 'FeatureCollection',
				features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }]
			}
		};

		await loadRouteData(mockMap as any, mockOnMarkerCreate, {
			fetchFn: mockFetch,
			interpolateFn: mockInterpolateCoordinates,
			createMarkerElFn: mockCreateUAVMarkerElement,
			updateTrackFn: mockUpdateTrackData,
			MarkerClass: MockMarker,
			state
		});

		expect(mockFetch).toHaveBeenCalledWith(
			'https://api.georobotix.io/ogc/t18/api/datastreams/iabpf1ivua1qm/observations'
		);

		expect(mockGetSource).toHaveBeenCalledWith('route');
		expect(mockSetData).toHaveBeenCalledWith(expect.any(Object));
		expect(mockAddSource).not.toHaveBeenCalled();
		expect(mockAddLayer).not.toHaveBeenCalled();
		expect(mockOnMarkerCreate).toHaveBeenCalled();
		expect(mockOnMarkerCreate).toHaveBeenCalled();
	});
});
