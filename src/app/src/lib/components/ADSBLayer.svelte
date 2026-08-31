<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type * as maplibregl from 'maplibre-gl';
	import { loadFlightData, resetAdsbUpdater } from '$lib/adsb-updater';

	let { map }: { map: maplibregl.Map } = $props();

	/**
	 * ADS-B is queried around the viewport centre, so a pan or zoom has to
	 * re-query or the map keeps showing traffic from where the user used to be.
	 * Debounced on moveend so dragging across a state is one request, not fifty.
	 */
	let moveTimer: ReturnType<typeof setTimeout> | undefined;

	function onMoveEnd() {
		if (moveTimer !== undefined) clearTimeout(moveTimer);
		moveTimer = setTimeout(() => {
			resetAdsbUpdater();
			void loadFlightData(map);
		}, 500);
	}

	onMount(() => {
		resetAdsbUpdater();
		void loadFlightData(map);
		map.on('moveend', onMoveEnd);
	});

	onDestroy(() => {
		if (moveTimer !== undefined) clearTimeout(moveTimer);
		map.off('moveend', onMoveEnd);
		resetAdsbUpdater();
	});
</script>
