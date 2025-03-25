import { get } from 'svelte/store';
import { trackDataStore, combatStatusStore, assignCallsign } from '$lib/stores/track-data';
import { combinePlatformAndGimbal } from '$lib/utils/attitude-utils';

const LOCATION_API = 'https://api.georobotix.io/ogc/t18/api/datastreams/o7pce3e60s0ie/observations';
const PLATFORM_ATTITUDE_API =
	'https://api.georobotix.io/ogc/t18/api/datastreams/mlme3gtdfepvc/observations';
const CAMERA_FOV_API =
	'https://api.georobotix.io/ogc/t18/api/datastreams/nhcs9rp6713ka/observations';
const GIMBAL_ATTITUDE_API =
	'https://api.georobotix.io/ogc/t18/api/datastreams/h75dmug8e3sae/observations';
const IMAGE_FRAME_API =
	'https://api.georobotix.io/ogc/t18/api/datastreams/p3mp2peibksl4/observations';

const POLL_INTERVAL = 5000;

async function fetchLatestObservation(apiUrl: string): Promise<any | null> {
	try {
		const res = await fetch(apiUrl);
		const data = await res.json();

		if (data.items && data.items.length > 0) {
			data.items.sort(
				(a: any, b: any) =>
					new Date(b.phenomenonTime).getTime() - new Date(a.phenomenonTime).getTime()
			);
			return data.items[0];
		}
	} catch (e) {
		console.error('Error fetching from', apiUrl, e);
	}

	return null;
}

export async function updateTrackData(): Promise<void> {
	const [locationObs, platformObs, fovObs, gimbalObs, imageFrameObs] = await Promise.all([
		fetchLatestObservation(LOCATION_API),
		fetchLatestObservation(PLATFORM_ATTITUDE_API),
		fetchLatestObservation(CAMERA_FOV_API),
		fetchLatestObservation(GIMBAL_ATTITUDE_API),
		fetchLatestObservation(IMAGE_FRAME_API)
	]);

	const currentCombatStatus = get(combatStatusStore);

	const vehicleId = locationObs
		? locationObs['foi@id']
		: platformObs
			? platformObs['foi@id']
			: imageFrameObs
				? imageFrameObs['foi@id']
				: 'UNKNOWN';

	let platformHeading = 0,
		platformPitch = 0,
		platformRoll = 0;

	if (platformObs && platformObs.result?.attitude) {
		platformHeading = platformObs.result.attitude.heading ?? 0;
		platformPitch = platformObs.result.attitude.pitch ?? 0;
		platformRoll = platformObs.result.attitude.roll ?? 0;
	}

	let gimbalYaw = 0,
		gimbalPitch = 0,
		gimbalRoll = 0;

	if (gimbalObs && gimbalObs.result?.attitude) {
		gimbalYaw = gimbalObs.result.attitude.yaw ?? 0;
		gimbalPitch = gimbalObs.result.attitude.pitch ?? 0;
		gimbalRoll = gimbalObs.result.attitude.roll ?? 0;
	}

	const { heading: cameraHeading, pitch: cameraPitch } = combinePlatformAndGimbal(
		platformHeading,
		platformPitch,
		gimbalYaw,
		gimbalPitch
	);

	let locationData = null;

	if (locationObs && locationObs.result?.location) {
		locationData = {
			lat: locationObs.result.location.lat,
			lon: locationObs.result.location.lon,
			alt: locationObs.result.location.alt
		};
	}

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

	trackDataStore.update((current) => ({
		...current,
		vesselId: vehicleId,

		location: locationData ?? current.location,

		vehicleAttitude:
			platformObs && platformObs.result?.attitude
				? {
						heading: platformObs.result.attitude.heading,
						pitch: platformObs.result.attitude.pitch,
						roll: platformObs.result.attitude.roll
					}
				: current.vehicleAttitude,

		cameraFOV:
			fovObs && fovObs.result?.params
				? {
						hfov: fovObs.result.params.hfov,
						vfov: fovObs.result.params.vfov
					}
				: current.cameraFOV,

		cameraGimbalAttitude: {
			yaw: cameraHeading,
			pitch: cameraPitch,
			roll: 0
		},

		imageFrame,

		combatStatus: currentCombatStatus,
		callsign: assignCallsign(vehicleId),
		lastUpdated: new Date().toLocaleTimeString()
	}));
}

export function startTrackDataPolling(): void {
	updateTrackData();
	setInterval(updateTrackData, POLL_INTERVAL);
}
