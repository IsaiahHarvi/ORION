<script lang="ts">
	import QuakeData from '$lib/components/QuakeData.svelte';
	import { onMount } from 'svelte';
	import { layers_state } from '$lib/runes/toggleable-layers.svelte';

	onMount(() => {
		layers_state.data.uav_layer = false;
		layers_state.data.quake_layer = true;
	});
</script>

<div class="absolute top-4 left-0 z-20 w-screen px-4">
	<QuakeData />
</div>
