export function create_layers_state() {
	let data = $state<{
		radar_layer: boolean;
		radar_stations_layer: boolean;
		uav_layer: boolean;
		ais_layer: boolean;
	}>({
		radar_layer: true,
		radar_stations_layer: true,
		uav_layer: false,
		ais_layer: false
	});

	return {
		get data() {
			return data;
		},
		set data(newState) {
			data = newState;
		}
	};
}

export const layers_state = create_layers_state();
