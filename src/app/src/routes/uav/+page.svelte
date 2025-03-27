<script lang="ts">
	import { onMount } from 'svelte';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import Map from '$lib/components/Map.svelte';
	import TrackData from '$lib/components/TrackData.svelte';
	import { layers_state } from '$lib/runes/toggleable-layers.svelte';

	onMount(() => {
		layers_state.data.ais_layer = false;
		layers_state.data.uav_layer = true;
	});
</script>

<div class="absolute left-0 top-4 z-20 w-screen px-4">
	<TrackData />
</div>

<Map />

<style>
	/* Any additional page-level styles */
</style>
