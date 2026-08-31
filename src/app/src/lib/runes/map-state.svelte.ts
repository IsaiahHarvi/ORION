import type { Map } from 'maplibre-gl';

export function create_map_state() {
	let data = $state<Map>();

	return {
		get data() {
			return data;
		},
		set data(newState) {
			data = newState;
		}
	};
}

export const map_state = create_map_state();
