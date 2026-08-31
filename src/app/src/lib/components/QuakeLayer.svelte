<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type * as maplibregl from 'maplibre-gl';
	import { loadQuakeData, resetQuakeUpdater } from '$lib/quake-updater';

	let { map }: { map: maplibregl.Map } = $props();

	onMount(() => {
		resetQuakeUpdater();
		void loadQuakeData(map);
	});

	onDestroy(() => {
		resetQuakeUpdater();
	});
</script>
