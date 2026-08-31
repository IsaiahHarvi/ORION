import { writable } from 'svelte/store';

export interface Flight {
	id: string;
	callsign: string | null;
	registration: string | null;
	aircraft_type: string | null;
	latitude: number;
	longitude: number;
	altitude_ft: number | null;
	on_ground: boolean;
	ground_speed_kt: number | null;
	track_deg: number | null;
	vertical_rate_fpm: number | null;
	squawk: string | null;
	emergency: string | null;
	seen_pos_s: number | null;
	distance_nm: number | null;
}

export interface FlightStore {
	selectedFlight: Flight | null;
	/**
	 * `performance.now()` when the selected report arrived, and how stale its
	 * position already was by then. Together they give a position age that
	 * keeps counting up, instead of one frozen at the moment of the click.
	 */
	observedAt: number;
	positionAgeMs: number;
}

export const flightStore = writable<FlightStore>({
	selectedFlight: null,
	observedAt: 0,
	positionAgeMs: 0
});
