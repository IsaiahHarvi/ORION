import { get } from 'svelte/store';
import {
	trackDataStore,
	combatStatusStore,
	assignCallsign,
	type ImageFrameData
} from '$lib/stores/track-data';
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

async function fetchLatestObservation<T>(apiUrl: string): Promise<Observation<T> | null> {
	try {
		const res = await fetch(apiUrl);
		const data = await res.json();

		if (data.items && data.items.length > 0) {
			data.items.sort(
				(a: Observation<T>, b: Observation<T>) =>
					new Date(b.phenomenonTime).getTime() - new Date(a.phenomenonTime).getTime()
			);
			return data.items[0];
		}
	} catch (e) {
		console.error('Error fetching from', apiUrl, e);
	}

	return null;
}

type Observation<T> = {
	'foi@id': string;
	phenomenonTime: string;
	result?: T;
};

type LocationResult = {
	location?: {
		lat: number;
		lon: number;
		alt?: number;
	};
};

type Attitude = {
	heading?: number;
	pitch?: number;
	roll?: number;
	yaw?: number;
};

type PlatformResult = {
	attitude?: Attitude;
};

type FovResult = {
	params?: {
		hfov: number;
		vfov: number;
	};
};

type GeoRef = {
	center?: { lat: number; lon: number };
	ulc?: { lat: number; lon: number };
	urc?: { lat: number; lon: number };
	lrc?: { lat: number; lon: number };
	llc?: { lat: number; lon: number };
};

type ImageFrameResult = {
	geoRef?: GeoRef;
};

type LocationData = {
	lat: number;
	lon: number;
	alt?: number;
};

export async function updateTrackData(): Promise<void> {
	const [locationObs, platformObs, fovObs, gimbalObs, imageFrameObs]: [
		Observation<LocationResult> | null,
		Observation<PlatformResult> | null,
		Observation<FovResult> | null,
		Observation<PlatformResult> | null,
		Observation<ImageFrameResult> | null
	] = await Promise.all([
		fetchLatestObservation<LocationResult>(LOCATION_API),
		fetchLatestObservation<PlatformResult>(PLATFORM_ATTITUDE_API),
		fetchLatestObservation<FovResult>(CAMERA_FOV_API),
		fetchLatestObservation<PlatformResult>(GIMBAL_ATTITUDE_API),
		fetchLatestObservation<ImageFrameResult>(IMAGE_FRAME_API)
	]);

	const currentCombatStatus = get(combatStatusStore);

	const vehicleId =
		locationObs?.['foi@id'] ??
		platformObs?.['foi@id'] ??
		imageFrameObs?.['foi@id'] ??
		'UNKNOWN';

	let platformHeading = 0;
	let platformPitch = 0;

	if (platformObs?.result?.attitude) {
		platformHeading = platformObs.result.attitude.heading ?? 0;
		platformPitch = platformObs.result.attitude.pitch ?? 0;
	}

	let gimbalYaw = 0;
	let gimbalPitch = 0;

	if (gimbalObs?.result?.attitude) {
		gimbalYaw = gimbalObs.result.attitude.yaw ?? 0;
		gimbalPitch = gimbalObs.result.attitude.pitch ?? 0;
	}

	const { heading: cameraHeading, pitch: cameraPitch } = combinePlatformAndGimbal(
		platformHeading,
		platformPitch,
		gimbalYaw,
		gimbalPitch
	);

	let locationData: LocationData | null = null;

	if (locationObs?.result?.location) {
		locationData = {
			lat: locationObs.result.location.lat,
			lon: locationObs.result.location.lon,
			alt: locationObs.result.location.alt
		};
	}

	let imageFrame: ImageFrameData | undefined = undefined;

	if (imageFrameObs?.result?.geoRef) {
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
		vehicleAttitude: platformObs?.result?.attitude
			? {
					heading: platformObs.result.attitude.heading,
					pitch: platformObs.result.attitude.pitch,
					roll: platformObs.result.attitude.roll
				}
			: current.vehicleAttitude,
		cameraFOV: fovObs?.result?.params
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
