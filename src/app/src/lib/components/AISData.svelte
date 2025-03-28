<script lang="ts">
	import { onDestroy } from 'svelte';
	import { aisStore, type AISShip } from '$lib/stores/ais-store';
	import { flyAndScale } from '$lib/utils';
	import X from '@lucide/svelte/icons/x';

	let selectedShip: AISShip | null = null;

	const unsubscribe = aisStore.subscribe((store) => {
		selectedShip = store.selectedShip;
	});

	onDestroy(unsubscribe);

	function closePanel() {
		aisStore.update((d) => ({ ...d, selectedShip: null }));
	}
</script>

{#if selectedShip}
	<div
		transition:flyAndScale
		class="relative mt-16 w-full rounded-lg border bg-background p-4 text-white shadow-lg lg:w-[27.5rem]"
	>
		<button class="absolute right-4 top-4" on:click={closePanel}>
			<X class="text-white/70 duration-200 hover:text-white/40" size={18} />
		</button>

		<div class="flex flex-col space-y-2">
			<h2 class="text-xl font-bold">{selectedShip.name || 'Unnamed Vessel'}</h2>
			<div class="text-sm text-gray-400">MMSI: {selectedShip.mmsi}</div>
		</div>

		<div class="mt-4">
			<div class="my-2 grid grid-cols-2 gap-2 text-sm">
				<div><strong>Latitude:</strong> {selectedShip.lat?.toFixed(5) ?? 'N/A'}</div>
				<div><strong>Longitude:</strong> {selectedShip.lon?.toFixed(5) ?? 'N/A'}</div>
				<div><strong>Speed:</strong> {selectedShip.speed ?? 'N/A'} knots</div>
				<div><strong>Heading:</strong> {selectedShip.heading ?? 'N/A'}°</div>
			</div>
		</div>
	</div>
{/if}
