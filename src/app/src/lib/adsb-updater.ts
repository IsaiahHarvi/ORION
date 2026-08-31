import * as maplibregl from 'maplibre-gl';
import { buildApiUrl } from '$lib/api';
import { flightStore, type Flight } from '$lib/stores/flight-store';

/**
 * Aircraft move fast enough that a minute-old position is visibly wrong, and
 * the server caches for fifteen seconds anyway, so polling faster than this
 * only costs bandwidth.
 */
export const REFRESH_MS = 15_000;

/**
 * How long a marker takes to travel from its last reported position to its new
 * one. Matching the refresh interval means the aircraft is always in motion:
 * one leg finishes just as the next report arrives, so the track reads as
 * flight rather than a jump every fifteen seconds. The cost is that the drawn
 * position trails the reported one by up to one interval, which at jet speeds
 * is a couple of nautical miles -- invisible at the zooms this layer is used at.
 */
const GLIDE_MS = REFRESH_MS;

/** The upstream will not search further than this from a point. */
const MAX_RADIUS_NM = 250;
const MIN_RADIUS_NM = 20;
const METRES_PER_NM = 1852;

interface Contact {
	marker: maplibregl.Marker;
	from: [number, number];
	to: [number, number];
	fromTrack: number;
	toTrack: number;
	startedAt: number;
}

let contacts: Record<string, Contact> = {};
let timer: ReturnType<typeof setTimeout> | undefined;
let frame: number | undefined;

export function resetAdsbUpdater(): void {
	if (timer !== undefined) clearTimeout(timer);
	timer = undefined;
	if (frame !== undefined) cancelAnimationFrame(frame);
	frame = undefined;
	Object.values(contacts).forEach((contact) => contact.marker.remove());
	contacts = {};
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

/**
 * The signed turn from one heading to another, taking the short way round.
 *
 * Straight arithmetic between 350° and 010° turns the glyph 340° backwards
 * through south, which on screen is an aircraft pirouetting once a refresh.
 */
export function shortestTurn(from: number, to: number): number {
	return ((((to - from) % 360) + 540) % 360) - 180;
}

/** The heading currently on screen, which is where the next turn starts from. */
function displayedTrack(contact: Contact, now: number): number {
	const t = GLIDE_MS === 0 ? 1 : Math.min(1, Math.max(0, (now - contact.startedAt) / GLIDE_MS));
	return contact.fromTrack + shortestTurn(contact.fromTrack, contact.toTrack) * ease(t);
}

/** Ease-out, so a leg starts at speed and settles rather than stopping dead. */
function ease(t: number): number {
	return 1 - (1 - t) * (1 - t);
}

function glyph(el: HTMLElement): SVGElement | null {
	return el.firstElementChild as SVGElement | null;
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
	return el;
}

/**
 * Draw one contact at its interpolated position.
 *
 * Position is written through the marker rather than by transforming the
 * element, because MapLibre owns that element's transform: anything written
 * there is overwritten on the next map move, which is what makes a
 * hand-transformed marker drift off its coordinates when the map is panned.
 */
function render(contact: Contact, now: number): void {
	const t = GLIDE_MS === 0 ? 1 : Math.min(1, Math.max(0, (now - contact.startedAt) / GLIDE_MS));
	const eased = ease(t);
	const lng = contact.from[0] + (contact.to[0] - contact.from[0]) * eased;
	const lat = contact.from[1] + (contact.to[1] - contact.from[1]) * eased;
	contact.marker.setLngLat([lng, lat]);

	const turn = shortestTurn(contact.fromTrack, contact.toTrack);
	const heading = contact.fromTrack + turn * eased;
	const svg = glyph(contact.marker.getElement());
	if (svg) svg.style.transform = `rotate(${heading.toFixed(1)}deg)`;
}

/** Advance every contact. Exported so tests can step time deterministically. */
export function stepAnimation(now: number = performance.now()): void {
	for (const contact of Object.values(contacts)) render(contact, now);
}

function startAnimation(): void {
	if (frame !== undefined) return;
	const tick = (now: number) => {
		stepAnimation(now);
		frame = requestAnimationFrame(tick);
	};
	frame = requestAnimationFrame(tick);
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
		const now = performance.now();

		const seen = new Set<string>();
		for (const flight of aircraft) {
			if (
				!flight?.id ||
				!Number.isFinite(flight.longitude) ||
				!Number.isFinite(flight.latitude)
			)
				continue;
			seen.add(flight.id);
			const target: [number, number] = [flight.longitude, flight.latitude];
			const track = flight.track_deg ?? 0;
			const existing = contacts[flight.id];

			if (existing) {
				// Start the new leg from wherever the aircraft is being drawn
				// right now, not from its last reported point, or a refresh
				// that lands mid-glide snaps the marker backwards.
				const current = existing.marker.getLngLat();
				existing.from = [current.lng, current.lat];
				existing.to = target;
				existing.fromTrack = displayedTrack(existing, now);
				existing.toTrack = track;
				existing.startedAt = now;
				const svg = glyph(existing.marker.getElement());
				if (svg) svg.style.color = markerColor(flight);
				// Keep the click handler pointing at the current report, so the
				// detail panel does not show a stale altitude.
				existing.marker.getElement().onclick = () =>
					flightStore.update((store) => ({ ...store, selectedFlight: flight }));
			} else {
				const el = element(flight);
				const svg = glyph(el);
				if (svg) {
					svg.style.color = markerColor(flight);
					svg.style.transform = `rotate(${track}deg)`;
				}
				const marker = new maplibregl.Marker({ element: el }).setLngLat(target).addTo(map);
				contacts[flight.id] = {
					marker,
					from: target,
					to: target,
					fromTrack: track,
					toTrack: track,
					startedAt: now
				};
			}
		}

		// Aircraft land, leave the viewport, or go out of receiver range, so
		// drop what the feed no longer lists.
		for (const [id, contact] of Object.entries(contacts)) {
			if (!seen.has(id)) {
				contact.marker.remove();
				delete contacts[id];
			}
		}

		if (Object.keys(contacts).length > 0) startAnimation();
	} catch (error) {
		console.error('ADS-B fetch error:', error);
	} finally {
		timer = setTimeout(() => void loadFlightData(map, fetchFn), REFRESH_MS);
	}
}

/**
 * Re-query for a moved viewport without tearing the layer down.
 *
 * Clearing the markers here is what made the display flash on every pan: each
 * one was destroyed and rebuilt rather than kept and moved.
 */
export function refreshForViewport(map: maplibregl.Map, fetchFn: typeof fetch = fetch): void {
	if (timer !== undefined) clearTimeout(timer);
	timer = undefined;
	void loadFlightData(map, fetchFn);
}
