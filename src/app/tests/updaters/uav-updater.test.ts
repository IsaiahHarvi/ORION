import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadRouteData } from '$lib/uav-updater';

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

	addTo() {
		return this;
	}

	getElement() {
		return this._element;
	}
}

type Coordinate = [number, number];
type ObservationItem = {
	id: string;
	phenomenonTime: string;
	result: {
		geoRef: {
			center: { lat: number; lon: number };
		};
	};
};

type State = {
	lastUpdateTime: string | null;
	accumulatedObservations: ObservationItem[];
	accumulatedRoutePoints: Coordinate[];
	routeGeoJSON: {
		type: 'FeatureCollection';
		features: {
			type: 'Feature';
			geometry: {
				type: 'LineString';
				coordinates: Coordinate[];
			};
		}[];
	};
};

const mockInterpolateCoordinates = (points: Coordinate[], segments: number): Coordinate[] =>
	points.slice(0, Math.min(points.length, segments));

const mockCreateUAVMarkerElement = (): HTMLElement => document.createElement('div');

const mockUpdateTrackData = (): void => {};

describe('loadRouteData', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it('fetches route for UAVs, updates map, and creates a marker', async () => {
		const fakeItems: ObservationItem[] = [
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

		const mockOnMarkerCreate = vi.fn();

		const state: State = {
			lastUpdateTime: null,
			accumulatedObservations: [],
			accumulatedRoutePoints: [],
			routeGeoJSON: {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						geometry: {
							type: 'LineString',
							coordinates: []
						}
					}
				]
			}
		};

		await loadRouteData(mockMap as unknown as maplibregl.Map, mockOnMarkerCreate, {
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
	});
});
