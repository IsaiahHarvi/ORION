export function create_map_style_state() {
	let data = $state(localStorage.getItem('map_style') || 'default');

	return {
		get data() {
			return data;
		},
		set data(newStyle) {
			if (['default', 'streets', 'ocean', 'satellite'].includes(newStyle)) {
				data = newStyle;
				localStorage.setItem('map_style', newStyle);
			} else {
				throw new Error('Invalid map style');
			}
		}
	};
}

export const map_style_state = create_map_style_state();
