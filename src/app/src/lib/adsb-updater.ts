import * as maplibregl from 'maplibre-gl';
import { buildApiUrl } from '$lib/api';
import { flightStore, type Flight } from '$lib/stores/flight-store';

/**
 * Aircraft move fast enough that a minute-old position is visibly wrong, and
 * the server caches for fifteen seconds anyway, so polling faster than this
 * only costs bandwidth.
 */
const REFRESH_MS = 15_000;

/** The upstream will not search further than this from a point. */
const MAX_RADIUS_NM = 250;
const MIN_RADIUS_NM = 20;
const METRES_PER_NM = 1852;

let markers: Record<string, maplibregl.Marker> = {};
let timer: ReturnType<typeof setTimeout> | undefined;

export function resetAdsbUpdater(): void {
	if (timer !== undefined) clearTimeout(timer);
	timer = undefined;
	Object.values(markers).forEach((marker) => marker.remove());
	markers = {};
}

/**
 * The radius that covers what the user is actually looking at.
 *
 * Unlike the earthquake feed, ADS-B is queried per point rather than globally,
 * so the viewport has to drive the query or a zoomed-out map shows a small disc
 * of traffic in the middle of an empty continent.
 */
export function viewportRadiusNm(map: maplibregl.Map): number {
	const bounds = map.getBounds();
	const centre = bounds.getCenter();
	// The corner is the furthest visible point, so covering it covers the rest.
	const corner = new maplibregl.LngLat(bounds.getEast(), bounds.getNorth());
	const nm = centre.distanceTo(corner) / METRES_PER_NM;
	return Math.round(Math.max(MIN_RADIUS_NM, Math.min(MAX_RADIUS_NM, nm)));
}

/** Altitude bands, so a glance separates ground traffic from overflights. */
export function markerColor(flight: Flight): string {
	if (flight.emergency) return '#ef4444';
	if (flight.on_ground) return '#94a3b8';
	const altitude = flight.altitude_ft;
	if (altitude === null) return '#38bdf8';
	if (altitude >= 30_000) return '#c084fc';
	if (altitude >= 18_000) return '#60a5fa';
	if (altitude >= 10_000) return '#34d399';
	return '#fbbf24';
}

export function label(flight: Flight): string {
	return flight.callsign ?? flight.registration ?? flight.id.toUpperCase();
}

function element(flight: Flight): HTMLElement {
	const el = document.createElement('button');
	el.className = 'adsb-marker';
	el.type = 'button';
	el.innerHTML =
		'<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
		'<path fill="currentColor" d="M12 2l1.6 6.5 7.4 3v2l-7.4-1.6-.9 5.3 2.8 2v1.8L12 20l-3.5 1-.0-1.8 2.8-2-.9-5.3L3 13.5v-2l7.4-3z"/>' +
		'</svg>';
	el.setAttribute('aria-label', `Aircraft ${label(flight)}`);
	el.onclick = () => flightStore.update((store) => ({ ...store, selectedFlight: flight }));
	orient(el, flight);
	return el;
}

/**
 * Point the glyph along the aircraft's track. The SVG is drawn nose-up, so the
 * track in degrees is the rotation in degrees with no offset.
 *
 * The rotation goes on the inner SVG rather than the marker element, because
 * MapLibre owns the marker element's own transform for positioning and would
 * overwrite anything written there on the next map move.
 */
function orient(el: HTMLElement, flight: Flight): void {
	const glyph = el.firstElementChild as SVGElement | null;
	if (!glyph) return;
	glyph.style.color = markerColor(flight);
	glyph.style.transform = `rotate(${flight.track_deg ?? 0}deg)`;
}

export async function loadFlightData(
	map: maplibregl.Map,
	fetchFn: typeof fetch = fetch
): Promise<void> {
	try {
		const centre = map.getCenter();
		const radius = viewportRadiusNm(map);
		const response = await fetchFn(
			buildApiUrl(
				`adsb?lat=${centre.lat.toFixed(3)}&lon=${centre.lng.toFixed(3)}&radius_nm=${radius}`
			)
		);
		if (!response.ok) throw new Error(`ADS-B request failed with ${response.status}`);
		const payload = (await response.json()) as { aircraft?: Flight[] };
		const aircraft = payload.aircraft ?? [];

		const seen = new Set<string>();
		for (const flight of aircraft) {
			if (
				!flight?.id ||
				!Number.isFinite(flight.longitude) ||
				!Number.isFinite(flight.latitude)
			)
				continue;
			seen.add(flight.id);
			const existing = markers[flight.id];
			if (existing) {
				// Reusing the marker is what makes an aircraft appear to fly
				// rather than blink out and reappear every refresh.
				existing.setLngLat([flight.longitude, flight.latitude]);
				orient(existing.getElement(), flight);
			} else {
				markers[flight.id] = new maplibregl.Marker({ element: element(flight) })
					.setLngLat([flight.longitude, flight.latitude])
					.addTo(map);
			}
		}

		// Aircraft land, leave the viewport, or go out of receiver range, so
		// drop what the feed no longer lists.
		for (const [id, marker] of Object.entries(markers)) {
			if (!seen.has(id)) {
				marker.remove();
				delete markers[id];
			}
		}
	} catch (error) {
		console.error('ADS-B fetch error:', error);
	} finally {
		timer = setTimeout(() => void loadFlightData(map, fetchFn), REFRESH_MS);
	}
}
