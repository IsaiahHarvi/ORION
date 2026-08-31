/** Bulk echo motion in metres per second, east and north positive. */
export interface RadarMotion {
	x: number;
	y: number;
}

export interface RadarFrame {
	id: string;
	time: number;
	kind: 'observed' | 'forecast';
	tiles: string;
	stations: string[];
	max_skew_seconds: number;
	motion_mps?: RadarMotion;
}

export interface RadarManifest {
	version: 1;
	generated_at: string | null;
	default_frame_id: string;
	latest_observed_frame_id: string;
	tile_size: number;
	min_zoom: number;
	max_zoom: number;
	bounds: [number, number, number, number];
	configured_stations: string[];
	attribution: {
		text: string;
		url?: string;
	};
	frames: RadarFrame[];
}

export interface RadarTimestamp {
	id: string;
	time: number;
	isNowcast: boolean;
	tileUrl: string;
	stations: string[];
	configuredStationCount: number;
	maxSkewSeconds: number;
	motion: RadarMotion;
}
