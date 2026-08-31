import * as maplibregl from 'maplibre-gl';
import { buildApiUrl } from '$lib/api';
import { quakeStore, type Quake } from '$lib/stores/quake-store';

/** USGS regenerates its summary feeds about once a minute. */
const REFRESH_MS = 60_000;

let markers: Record<string, maplibregl.Marker> = {};
let timer: ReturnType<typeof setTimeout> | undefined;

export function resetQuakeUpdater(): void {
	if (timer !== undefined) clearTimeout(timer);
	timer = undefined;
	Object.values(markers).forEach((marker) => marker.remove());
	markers = {};
}

/**
 * Marker size tracks magnitude, because magnitude is what the eye should sort
 * on first. The scale is deliberately non-linear: magnitude is logarithmic, so
 * a linear radius would make every quake below M5 an indistinguishable dot.
 */
export function markerSize(magnitude: number): number {
	return Math.max(8, Math.min(46, 6 + Math.pow(Math.max(magnitude, 0), 1.6) * 1.7));
}

/** Warmer is stronger; the bands match how USGS itself talks about magnitude. */
export function markerColor(magnitude: number): string {
	if (magnitude >= 7) return '#b91c1c';
	if (magnitude >= 6) return '#ea580c';
	if (magnitude >= 5) return '#f59e0b';
	if (magnitude >= 4) return '#eab308';
	if (magnitude >= 2.5) return '#84cc16';
	return '#38bdf8';
}

function element(quake: Quake): HTMLElement {
	const size = markerSize(quake.magnitude);
	const el = document.createElement('button');
	el.className = 'quake-marker';
	el.type = 'button';
	el.style.width = `${size}px`;
	el.style.height = `${size}px`;
	el.style.setProperty('--quake-color', markerColor(quake.magnitude));
	el.setAttribute(
		'aria-label',
		`Magnitude ${quake.magnitude} earthquake${quake.place ? ` ${quake.place}` : ''}`
	);
	el.onclick = () => quakeStore.update((store) => ({ ...store, selectedQuake: quake }));
	return el;
}

export async function loadQuakeData(
	map: maplibregl.Map,
	fetchFn: typeof fetch = fetch
): Promise<void> {
	try {
		const response = await fetchFn(buildApiUrl('quakes?window=day&min_magnitude=2.5'));
		if (!response.ok) throw new Error(`Quake request failed with ${response.status}`);
		const payload = (await response.json()) as { quakes?: Quake[] };
		const quakes = payload.quakes ?? [];

		const seen = new Set<string>();
		for (const quake of quakes) {
			if (!quake?.id || !Number.isFinite(quake.longitude) || !Number.isFinite(quake.latitude))
				continue;
			seen.add(quake.id);
			const existing = markers[quake.id];
			if (existing) {
				existing.setLngLat([quake.longitude, quake.latitude]);
			} else {
				markers[quake.id] = new maplibregl.Marker({ element: element(quake) })
					.setLngLat([quake.longitude, quake.latitude])
					.addTo(map);
			}
		}

		// Events roll out of the 24-hour window, so drop what the feed no longer
		// lists rather than accumulating markers for the life of the session.
		for (const [id, marker] of Object.entries(markers)) {
			if (!seen.has(id)) {
				marker.remove();
				delete markers[id];
			}
		}
	} catch (error) {
		console.error('Earthquake fetch error:', error);
	} finally {
		timer = setTimeout(() => void loadQuakeData(map, fetchFn), REFRESH_MS);
	}
}
