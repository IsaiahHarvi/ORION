export type CurrentRadar = {
	timestamp?: number;
};

export function create_radar_state() {
	let radar_state = $state<CurrentRadar>({});

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
