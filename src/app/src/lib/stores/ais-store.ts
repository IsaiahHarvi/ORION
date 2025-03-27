import { writable } from 'svelte/store';

export interface AISShip {
	mmsi: number;
	name: string;
	lat: number;
	lon: number;
	speed: number;
	heading: number;
}

export interface AISStore {
	selectedShip: AISShip | null;
}

export const aisStore = writable<AISStore>({
	selectedShip: null
});
