import { writable } from 'svelte/store';

export interface ImageFrameData {
	center?: { lat: number; lon: number };
	ulc?: { lat: number; lon: number };
	urc?: { lat: number; lon: number };
	lrc?: { lat: number; lon: number };
	llc?: { lat: number; lon: number };
}

export interface TrackData {
	vesselId?: string;
	location?: { lat: number; lon: number; alt?: number };
	vehicleAttitude?: { heading?: number; pitch?: number; roll?: number };
	cameraFOV?: { hfov?: number; vfov?: number };
	cameraGimbalAttitude?: { yaw: number; pitch: number; roll: number };
	callsign?: string;
	lastUpdated?: string;
	selected?: boolean;
	combatStatus?: 'Neutral' | 'Friendly' | 'Enemy';
	imageFrame?: ImageFrameData;
}

export const trackDataStore = writable<TrackData>({});

export const combatStatusStore = writable<'Neutral' | 'Friendly' | 'Enemy'>('Neutral');

const callsigns = ['Falcon', 'Raptor', 'Viper', 'Eagle', 'Hawk', 'Shadow', 'Ghost'];

export const callsignMap: Record<string, string> = {};

export function assignCallsign(vehicleId: string): string {
	if (callsignMap[vehicleId]) return callsignMap[vehicleId];
	const index = Object.keys(callsignMap).length % callsigns.length;
	const callsign = callsigns[index];
	callsignMap[vehicleId] = callsign;
	return callsign;
}
