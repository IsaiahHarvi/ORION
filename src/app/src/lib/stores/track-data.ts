import { writable } from 'svelte/store';

/** The structure for track data. We add `selected?: boolean` to show/hide the overlay. */
export interface TrackData {
  vesselId?: string;
  location?: { lat: number; lon: number; alt: number };
  vehicleAttitude?: { heading: number; pitch: number; roll: number };
  cameraFOV?: { hfov: number; vfov: number };
  cameraGimbalAttitude?: { yaw: number; pitch: number; roll: number };
  callsign?: string;
  lastUpdated?: string;
  // The key to toggling the overlay
  selected?: boolean;
}

/** Holds the main track data from the UAV. */
export const trackDataStore = writable<TrackData>({});

/** Holds the user-selected combat status separately. */
export const combatStatusStore = writable<'Neutral' | 'Friendly' | 'Enemy'>('Neutral');

/** If you have callsign logic: */
const callsigns = ["Falcon", "Raptor", "Viper", "Eagle", "Hawk", "Shadow", "Ghost"];
export const callsignMap: { [vehicleId: string]: string } = {};

export function assignCallsign(vehicleId: string): string {
  if (callsignMap[vehicleId]) return callsignMap[vehicleId];
  const index = Object.keys(callsignMap).length % callsigns.length;
  const callsign = callsigns[index];
  callsignMap[vehicleId] = callsign;
  return callsign;
}
