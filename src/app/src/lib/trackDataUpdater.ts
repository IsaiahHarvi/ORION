import { get } from 'svelte/store';
import { trackDataStore, combatStatusStore, assignCallsign } from '$lib/stores/trackData';

const LOCATION_API = 'https://api.georobotix.io/ogc/t18/api/datastreams/o7pce3e60s0ie/observations';
const VEHICLE_ATTITUDE_API = 'https://api.georobotix.io/ogc/t18/api/datastreams/mlme3gtdfepvc/observations';
const CAMERA_FOV_API = 'https://api.georobotix.io/ogc/t18/api/datastreams/nhcs9rp6713ka/observations';
const GIMBAL_ATTITUDE_API = 'https://api.georobotix.io/ogc/t18/api/datastreams/h75dmug8e3sae/observations';

const POLL_INTERVAL = 5000;

async function fetchLatestObservation(apiUrl: string): Promise<any | null> {
  try {
    const res = await fetch(apiUrl);
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      // Sort so that the newest observation comes first
      data.items.sort((a: any, b: any) => new Date(b.phenomenonTime).getTime() - new Date(a.phenomenonTime).getTime());
      return data.items[0];
    }
  } catch (e) {
    console.error('Error fetching from', apiUrl, e);
  }
  return null;
}

export async function updateTrackData(): Promise<void> {
  const [locationObs, attitudeObs, fovObs, gimbalObs] = await Promise.all([
    fetchLatestObservation(LOCATION_API),
    fetchLatestObservation(VEHICLE_ATTITUDE_API),
    fetchLatestObservation(CAMERA_FOV_API),
    fetchLatestObservation(GIMBAL_ATTITUDE_API)
  ]);

  // Read the user-selected combat status from its own store.
  const currentCombatStatus = get(combatStatusStore);

  const vehicleId = locationObs
    ? locationObs["foi@id"]
    : (attitudeObs ? attitudeObs["foi@id"] : "UNKNOWN");

  trackDataStore.update(current => ({
    ...current,
    vesselId: vehicleId,
    location: (locationObs && locationObs.result && locationObs.result.location)
      ? {
          lat: locationObs.result.location.lat,
          lon: locationObs.result.location.lon,
          alt: locationObs.result.location.alt
        }
      : current?.location,
    vehicleAttitude: (attitudeObs && attitudeObs.result && attitudeObs.result.attitude)
      ? {
          heading: attitudeObs.result.attitude.heading,
          pitch: attitudeObs.result.attitude.pitch,
          roll: attitudeObs.result.attitude.roll
        }
      : current?.vehicleAttitude,
    cameraFOV: (fovObs && fovObs.result && fovObs.result.params)
      ? {
          hfov: fovObs.result.params.hfov,
          vfov: fovObs.result.params.vfov
        }
      : current?.cameraFOV,
    cameraGimbalAttitude: (gimbalObs && gimbalObs.result && gimbalObs.result.attitude)
      ? {
          yaw: gimbalObs.result.attitude.yaw,
          pitch: gimbalObs.result.attitude.pitch,
          roll: gimbalObs.result.attitude.roll
        }
      : current?.cameraGimbalAttitude,
    // Do not override combatStatus – preserve the user selection.
    combatStatus: currentCombatStatus,
    callsign: assignCallsign(vehicleId),
    lastUpdated: new Date().toLocaleTimeString()
  }));
}

export function startTrackDataPolling(): void {
  updateTrackData();
  setInterval(updateTrackData, POLL_INTERVAL);
}
