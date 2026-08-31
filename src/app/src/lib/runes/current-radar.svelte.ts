import type { RadarTimestamp } from '$types';

export type CurrentRadar = {
	timestamp?: number;
	/** Fractional index into valid_timestamps; the fraction crossfades frames. */
	position: number;
	playing: boolean;
	valid_timestamps: RadarTimestamp[];
};

export function create_radar_state() {
	let radar_state = $state<CurrentRadar>({
		position: 0,
		playing: true,
		valid_timestamps: []
	});

	return {
		get radar_state() {
			return radar_state;
		},
		set radar_state(newState) {
			radar_state = newState;
		}
	};
}

export const radar_state = create_radar_state();
