import { writable } from 'svelte/store';

interface LatLon {
	lat: number;
	lon: number;
}

export interface ImageFrame {
	center: {
		lat: number;
		lon: number;
	};
	ulc: LatLon | null;
	urc: LatLon | null;
	lrc: LatLon | null;
	llc: LatLon | null;
}

export interface TrackData {
	vesselId?: string;
	location?: { lat: number; lon: number; alt: number };
	vehicleAttitude?: { heading: number; pitch: number; roll: number };
	cameraFOV?: { hfov: number; vfov: number };
	cameraGimbalAttitude?: { yaw: number; pitch: number; roll: number };
	callsign?: string;
	lastUpdated?: string;
	combatStatus?: 'Neutral' | 'Friendly' | 'Enemy';
	selected?: boolean;
	imageFrame?: ImageFrame;
}

export const trackDataStore = writable<TrackData>({});
export const combatStatusStore = writable<'Neutral' | 'Friendly' | 'Enemy'>('Neutral');

const callsigns = ['Falcon', 'Raptor', 'Viper', 'Eagle', 'Hawk', 'Shadow', 'Ghost'];
export const callsignMap: { [vehicleId: string]: string } = {};

export function assignCallsign(vehicleId: string): string {
	if (callsignMap[vehicleId]) return callsignMap[vehicleId];
	const index = Object.keys(callsignMap).length % callsigns.length;
	const callsign = callsigns[index];
	callsignMap[vehicleId] = callsign;
	return callsign;
}
