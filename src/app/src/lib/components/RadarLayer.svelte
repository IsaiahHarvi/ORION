<script module lang="ts">
	export type RadarStation = {
		radar_id: string;
		lat: number;
		lon: number;
		distance: number;
		open: boolean;
	};
</script>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { buildApiUrl } from '$lib/api';
	import * as maplibregl from 'maplibre-gl';
	import { current_lat_long } from '$lib/stores/current-location';
	import radarIcon from '$lib/icons/radar-icon.png';
	import { toast } from '@sivir-ui/svelte';

	const { map, onselect }: { map: maplibregl.Map; onselect: (radar: RadarStation) => void } =
		$props();

	let radarMarkers: maplibregl.Marker[] = [];
	let radars: RadarStation[] = $state([]);

	onMount(async () => {
		try {
			const key = `radars_${$current_lat_long.lat ?? 0}_${$current_lat_long.long ?? 0}`;
			const cached = sessionStorage.getItem(key);

			if (cached) {
				radars = JSON.parse(cached) as RadarStation[];
			} else {
				const response = await fetch(
					buildApiUrl(
						`radars/${$current_lat_long.lat ?? 0}/${$current_lat_long.long ?? 0}`
					)
				);
				if (!response.ok)
					throw new Error(`Radar station request failed with ${response.status}`);
				radars = (await response.json()) as RadarStation[];
				sessionStorage.setItem(key, JSON.stringify(radars));
			}

			radars.forEach((radar) => {
				const el = markerElement(radar);
				el.title = radar.radar_id;
				const marker = new maplibregl.Marker({ element: el })
					.setLngLat([radar.lon, radar.lat])
					.addTo(map);
				radarMarkers.push(marker);
			});
		} catch (error) {
			console.error(error);
			toast.error('Could not load radar stations.');
		}
	});

	onDestroy(() => {
		radarMarkers.forEach((marker) => marker.remove());
	});

	function markerElement(radar: RadarStation): HTMLElement {
		const el = document.createElement('button');
		const image = document.createElement('img');
		el.type = 'button';
		el.className = 'marker radar-marker';
		el.setAttribute('aria-label', `Open ${radar.radar_id} radar station`);
		image.src = radarIcon;
		image.alt = '';
		image.width = 20;
		image.height = 20;
		el.appendChild(image);

		el.addEventListener('click', (event) => {
			event.stopPropagation();
			onselect(radar);
		});

		return el;
	}
</script>
