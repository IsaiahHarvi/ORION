export interface RadarLayer {
	id: string;
	time: number;
}

export interface RainViewerFrame {
	time: number;
	path?: string;
}

export interface RainViewerResponse {
	radar: {
		past: RainViewerFrame[];
		nowcast: RainViewerFrame[];
	};
}

export interface RadarTimestamp {
	time: number;
	isNowcast: boolean;
}
