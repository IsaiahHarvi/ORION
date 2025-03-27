<script lang="ts">
	import Map from '$lib/components/Map.svelte';
	import AISData from '$lib/components/AISData.svelte';
	import { onMount } from 'svelte';
	import { layers_state } from '$lib/runes/toggleable-layers.svelte';

	onMount(() => {
		layers_state.data.uav_layer = false;
		layers_state.data.ais_layer = true;
	});
</script>

<!-- Turn off radar if desired -->
<Map />

<div class="absolute left-0 top-4 z-20 w-screen px-4">
	<AISData />
</div>
