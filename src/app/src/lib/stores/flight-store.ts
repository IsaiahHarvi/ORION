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
}

export const flightStore = writable<FlightStore>({
	selectedFlight: null
});
