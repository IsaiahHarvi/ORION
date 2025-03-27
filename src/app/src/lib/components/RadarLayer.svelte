<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import { current_lat_long } from '$lib/stores/current-location';
	import radarIcon from '$lib/icons/radar-icon.png';
	import { flyAndScale } from '$lib/utils';
	import X from '@lucide/svelte/icons/x';
	const { map } = $props();

	type Radar = {
		radar_id: string;
		lat: number;
		lon: number;
		distance: number;
		open: boolean;
	};

	let radarMarkers: maplibregl.Marker[] = [];
	let radars: Radar[] = $state<Radar[]>([]);

	onMount(async () => {
		const key = `radars_${$current_lat_long.lat ?? 0}_${$current_lat_long.long ?? 0}`;
		const apiUrl = import.meta.env.VITE_API_URL;
		console.log(apiUrl);
		let cached = sessionStorage.getItem(key);

		if (cached) {
			radars = JSON.parse(cached);
		} else {
			const res = await fetch(
				`${apiUrl}/radars/${$current_lat_long.lat ?? 0}/${$current_lat_long.long ?? 0}`
			);
			radars = await res.json();
			sessionStorage.setItem(key, JSON.stringify(radars));
		}

		radars.forEach(
			(radar: {
				distance: number;
				lat: number;
				lon: number;
				radar_id: string;
				open: boolean;
			}) => {
				const el = markerElement(radar);
				el.title = radar.radar_id;
				const marker = new maplibregl.Marker({ element: el })
					.setLngLat([radar.lon, radar.lat])
					.addTo(map);
				radarMarkers.push(marker);
			}
		);
	});

	onDestroy(() => {
		radarMarkers.forEach((marker) => marker.remove());
	});

	function markerElement(radar: Radar): HTMLElement {
		const el = document.createElement('img');
		el.className = 'uav-marker';
		el.src = radarIcon;
		el.alt = 'UAV';
		el.style.width = '20px';
		el.style.height = '20px';
		el.style.display = 'block';
		el.className = 'marker';

		el.addEventListener('click', () => {
			radar.open = !radar.open;
		});

		return el;
	}
</script>

{#each radars as radar (radar.radar_id)}
	{#if radar.open}
		<div
			transition:flyAndScale
			class="pointer-events-auto absolute left-1/2 top-4 mt-14 w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border bg-neutral-900 p-4 text-white shadow-lg lg:left-4 lg:mt-16 lg:w-[27.5rem] lg:translate-x-0"
		>
			<button
				class="absolute right-4 top-4"
				onclick={() => {
					radar.open = false;
				}}
			>
				<X class="text-white/70 duration-200 hover:text-white/40" size={18} />
			</button>
			<h2 class="text-xl font-bold">{radar.radar_id}</h2>
			<div class="mt-4">
				<div class="my-2 grid grid-cols-1 gap-2 text-sm">
					<div><strong>Latitude:</strong> {radar.lat.toFixed(5)}</div>
					<div><strong>Longitude:</strong> {radar.lon.toFixed(5)}</div>
					<div><strong>Distance (km):</strong> {radar.distance.toFixed(0)}</div>
				</div>
			</div>
		</div>
	{/if}
{/each}

<style>
</style>
