import { get } from 'svelte/store';
import { trackDataStore, combatStatusStore, assignCallsign } from '$lib/stores/trackData';
import { combinePlatformAndGimbal } from '$lib/utils/attitudeUtils'; // still used for final camera orientation

// Existing datastreams:
const LOCATION_API          = 'https://api.georobotix.io/ogc/t18/api/datastreams/o7pce3e60s0ie/observations';
const PLATFORM_ATTITUDE_API = 'https://api.georobotix.io/ogc/t18/api/datastreams/mlme3gtdfepvc/observations';
const CAMERA_FOV_API        = 'https://api.georobotix.io/ogc/t18/api/datastreams/nhcs9rp6713ka/observations';
const GIMBAL_ATTITUDE_API   = 'https://api.georobotix.io/ogc/t18/api/datastreams/h75dmug8e3sae/observations';
const IMAGE_FRAME_API       = 'https://api.georobotix.io/ogc/t18/api/datastreams/p3mp2peibksl4/observations';

const POLL_INTERVAL = 5000;

async function fetchLatestObservation(apiUrl: string): Promise<any | null> {
  try {
    const res = await fetch(apiUrl);
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      // Sort so that the newest observation is first
      data.items.sort((a: any, b: any) =>
        new Date(b.phenomenonTime).getTime() - new Date(a.phenomenonTime).getTime()
      );
      return data.items[0];
    }
  } catch (e) {
    console.error('Error fetching from', apiUrl, e);
  }
  return null;
}

/**
 * Polls all sensor APIs:
 *   - location
 *   - platformAttitude
 *   - cameraFOV
 *   - gimbalAttitude
 *   - imageFrame corners (ulc, urc, lrc, llc, center)
 *
 * Merges them and updates trackDataStore with everything.
 */
export async function updateTrackData(): Promise<void> {
  // Pull from 5 sources
  const [
    locationObs,
    platformObs,
    fovObs,
    gimbalObs,
    imageFrameObs
  ] = await Promise.all([
    fetchLatestObservation(LOCATION_API),
    fetchLatestObservation(PLATFORM_ATTITUDE_API),
    fetchLatestObservation(CAMERA_FOV_API),
    fetchLatestObservation(GIMBAL_ATTITUDE_API),
    fetchLatestObservation(IMAGE_FRAME_API) // new
  ]);

  // keep the user-chosen status
  const currentCombatStatus = get(combatStatusStore);

  // If we do have locationObs, that might define the vehicle ID. Else fallback:
  const vehicleId = locationObs
    ? locationObs["foi@id"]
    : (platformObs ? platformObs["foi@id"] : (imageFrameObs ? imageFrameObs["foi@id"] : "UNKNOWN"));

  // parse platformAttitude
  let platformHeading = 0, platformPitch = 0, platformRoll = 0;
  if (platformObs && platformObs.result?.attitude) {
    platformHeading = platformObs.result.attitude.heading ?? 0;
    platformPitch   = platformObs.result.attitude.pitch   ?? 0;
    platformRoll    = platformObs.result.attitude.roll    ?? 0;
  }

  // parse gimbalAttitude
  let gimbalYaw = 0, gimbalPitch = 0, gimbalRoll = 0;
  if (gimbalObs && gimbalObs.result?.attitude) {
    gimbalYaw   = gimbalObs.result.attitude.yaw   ?? 0;
    gimbalPitch = gimbalObs.result.attitude.pitch ?? 0;
    gimbalRoll  = gimbalObs.result.attitude.roll  ?? 0;
  }

  // combine them => final camera orientation
  const { heading: cameraHeading, pitch: cameraPitch } = combinePlatformAndGimbal(
    platformHeading,
    platformPitch,
    gimbalYaw,
    gimbalPitch
  );

  // parse location
  let locationData = null;
  if (locationObs && locationObs.result?.location) {
    locationData = {
      lat: locationObs.result.location.lat,
      lon: locationObs.result.location.lon,
      alt: locationObs.result.location.alt
    };
  }

  // parse imageFrame corners
  let imageFrame: any = null;
  if (imageFrameObs && imageFrameObs.result?.geoRef) {
    const ref = imageFrameObs.result.geoRef;
    imageFrame = {
      center: ref.center,
      ulc: ref.ulc,
      urc: ref.urc,
      lrc: ref.lrc,
      llc: ref.llc
    };
  }

  // Update the store
  trackDataStore.update(current => ({
    ...current,
    vesselId: vehicleId,

    // location from locationObs
    location: locationData ?? current.location,

    // raw platformAttitude
    vehicleAttitude: (platformObs && platformObs.result?.attitude)
      ? {
          heading: platformObs.result.attitude.heading,
          pitch:   platformObs.result.attitude.pitch,
          roll:    platformObs.result.attitude.roll
        }
      : current.vehicleAttitude,

    // cameraFOV
    cameraFOV: (fovObs && fovObs.result?.params)
      ? {
          hfov: fovObs.result.params.hfov,
          vfov: fovObs.result.params.vfov
        }
      : current.cameraFOV,

    // final camera orientation
    cameraGimbalAttitude: {
      yaw:   cameraHeading,
      pitch: cameraPitch,
      roll:  0
    },

    // new: image frame corners
    imageFrame,

    // preserve status
    combatStatus: currentCombatStatus,
    callsign: assignCallsign(vehicleId),
    lastUpdated: new Date().toLocaleTimeString()
  }));
}

/**
 * Start continuous polling of these data streams.
 */
export function startTrackDataPolling(): void {
  updateTrackData();
  setInterval(updateTrackData, POLL_INTERVAL);
}
