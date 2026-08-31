import { map_style_urls } from '$lib/map-styles';

export function create_map_style_state() {
	const storedStyle = localStorage.getItem('map_style');
	let data = $state(map_style_urls.includes(storedStyle ?? '') ? storedStyle! : 'dark');

	return {
		get data() {
			return data;
		},
		set data(newStyle) {
			if (map_style_urls.includes(newStyle)) {
				data = newStyle;
				localStorage.setItem('map_style', newStyle);
			} else {
				throw new Error('Invalid map style');
			}
		}
	};
}

export const map_style_state = create_map_style_state();
