<script lang="ts">
	import FlightData from '$lib/components/FlightData.svelte';
	import { onMount } from 'svelte';
	import { layers_state } from '$lib/runes/toggleable-layers.svelte';

	onMount(() => {
		layers_state.data.quake_layer = false;
		layers_state.data.adsb_layer = true;
	});
</script>

<div class="absolute top-4 left-0 z-20 w-screen px-4">
	<FlightData />
</div>
