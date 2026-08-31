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
 * How long a correction takes to blend in when a new report disagrees with
 * where the aircraft was being drawn. Short, because the disagreement is
 * normally small; long enough that the correction is a nudge, not a jump.
 */
const CORRECTION_MS = 2_000;

/**
 * How far ahead of the last report the display is willing to extrapolate. If
 * the feed stops answering, the aircraft coasts for a minute and then holds
 * rather than flying off across the map on stale velocity.
 */
const MAX_EXTRAPOLATION_MS = 60_000;

/** The upstream will not search further than this from a point. */
const MAX_RADIUS_NM = 250;
const MIN_RADIUS_NM = 20;
const METRES_PER_NM = 1852;
const MINUTES_PER_DEGREE = 60;

interface Contact {
	marker: maplibregl.Marker;
	/** The last reported position, and when it arrived. */
	reported: [number, number];
	reportedAt: number;
	speedKt: number;
	track: number;
	/** Difference between where the aircraft was drawn and where the newest
	 *  report puts it, blended out over CORRECTION_MS so it reads as a nudge. */
	offset: [number, number];
	trackOffset: number;
	offsetAt: number;
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
 * Straight arithmetic between 350 and 010 turns the glyph 340 degrees backwards
 * through south, which on screen is an aircraft pirouetting once a refresh.
 */
export function shortestTurn(from: number, to: number): number {
	return ((((to - from) % 360) + 540) % 360) - 180;
}

/**
 * Where an aircraft has flown to since its last report, from its own reported
 * speed and track.
 *
 * Without this the display is a slideshow: reports arrive every fifteen seconds
 * and the server serves a cached copy for fifteen more, so a marker driven
 * straight off report positions sits perfectly still most of the time and then
 * jumps. Dead reckoning between reports is what makes the traffic move.
 */
export function deadReckon(
	position: [number, number],
	speedKt: number,
	track: number,
	elapsedMs: number
): [number, number] {
	const capped = Math.min(Math.max(elapsedMs, 0), MAX_EXTRAPOLATION_MS);
	const nm = speedKt * (capped / 3_600_000);
	if (nm === 0) return [position[0], position[1]];
	const radians = (track * Math.PI) / 180;
	const lat = position[1] + (nm * Math.cos(radians)) / MINUTES_PER_DEGREE;
	// A degree of longitude shortens with latitude; ignoring that skews every
	// east-west track, badly so at Canadian and Alaskan latitudes.
	const shrink = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
	const lon = position[0] + (nm * Math.sin(radians)) / (MINUTES_PER_DEGREE * shrink);
	return [lon, lat];
}

/** Ease-out, so a correction arrives quickly and settles rather than snapping. */
function ease(t: number): number {
	return 1 - (1 - t) * (1 - t);
}

/** How much of an outstanding correction is still applied at this instant. */
function residual(contact: Contact, now: number): number {
	const t = Math.min(1, Math.max(0, (now - contact.offsetAt) / CORRECTION_MS));
	return 1 - ease(t);
}

function displayedPosition(contact: Contact, now: number): [number, number] {
	const [lon, lat] = deadReckon(
		contact.reported,
		contact.speedKt,
		contact.track,
		now - contact.reportedAt
	);
	const share = residual(contact, now);
	return [lon + contact.offset[0] * share, lat + contact.offset[1] * share];
}

function displayedTrack(contact: Contact, now: number): number {
	return contact.track + contact.trackOffset * residual(contact, now);
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
	return el;
}

/**
 * Draw one contact where it currently is.
 *
 * Position is written through the marker rather than by transforming the
 * element, because MapLibre owns that element's transform: anything written
 * there is overwritten on the next map move, which is what makes a
 * hand-transformed marker drift off its coordinates when the map is panned.
 */
function render(contact: Contact, now: number): void {
	contact.marker.setLngLat(displayedPosition(contact, now));
	const svg = glyph(contact.marker.getElement());
	if (svg) svg.style.transform = `rotate(${displayedTrack(contact, now).toFixed(1)}deg)`;
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
			const reported: [number, number] = [flight.longitude, flight.latitude];
			const track = flight.track_deg ?? 0;
			const speedKt = flight.on_ground ? 0 : (flight.ground_speed_kt ?? 0);
			const existing = contacts[flight.id];

			if (existing) {
				// Carry the current on-screen position into the new report as a
				// correction, so a report that disagrees with the dead-reckoned
				// track eases into place instead of snapping the marker.
				const wasAt = displayedPosition(existing, now);
				const wasFacing = displayedTrack(existing, now);
				existing.reported = reported;
				existing.reportedAt = now;
				existing.speedKt = speedKt;
				existing.track = track;
				existing.offset = [wasAt[0] - reported[0], wasAt[1] - reported[1]];
				existing.trackOffset = shortestTurn(track, wasFacing);
				existing.offsetAt = now;
				const svg = glyph(existing.marker.getElement());
				if (svg) svg.style.color = markerColor(flight);
			} else {
				const el = element(flight);
				const svg = glyph(el);
				if (svg) {
					svg.style.color = markerColor(flight);
					svg.style.transform = `rotate(${track}deg)`;
				}
				const marker = new maplibregl.Marker({ element: el })
					.setLngLat(reported)
					.addTo(map);
				contacts[flight.id] = {
					marker,
					reported,
					reportedAt: now,
					speedKt,
					track,
					offset: [0, 0],
					trackOffset: 0,
					offsetAt: now
				};
			}

			// Rebound the click handler every report so the detail panel opens
			// on the current altitude and speed rather than a stale one.
			const contact = contacts[flight.id];
			contact.marker.getElement().onclick = () =>
				flightStore.update((store) => ({ ...store, selectedFlight: flight }));
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
