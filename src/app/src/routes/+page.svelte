<script lang="ts">
	import { onMount } from 'svelte';
	import { layers_state } from '$lib/runes/toggleable-layers.svelte';

	onMount(() => {
		layers_state.data.uav_layer = false;
		layers_state.data.ais_layer = false;
	});
</script>
