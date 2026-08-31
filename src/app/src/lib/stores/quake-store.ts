import { writable } from 'svelte/store';

export interface Quake {
	id: string;
	time: number;
	magnitude: number;
	place: string | null;
	longitude: number;
	latitude: number;
	depth_km: number | null;
	url: string | null;
	felt: number | null;
	tsunami: boolean;
	significance: number | null;
	alert: string | null;
}

export interface QuakeStore {
	selectedQuake: Quake | null;
}

export const quakeStore = writable<QuakeStore>({
	selectedQuake: null
});
