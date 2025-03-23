import { writable } from 'svelte/store';

interface AISShip {
    mmsi: number;
    name: string;
    lat: number;
    lon: number;
    speed: number;
    heading: number;
}

interface AISStore {
    selectedShip: AISShip | null;
}

export const aisStore = writable<AISStore>({
    selectedShip: null
});
