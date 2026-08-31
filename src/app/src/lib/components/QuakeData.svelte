<script lang="ts">
	import { onDestroy } from 'svelte';
	import { quakeStore, type Quake } from '$lib/stores/quake-store';
	import { markerColor } from '$lib/quake-updater';
	import { flyAndScale } from '$lib/utils';
	import X from '@lucide/svelte/icons/x';

	let selectedQuake: Quake | null = $state(null);

	const unsubscribe = quakeStore.subscribe((store) => {
		selectedQuake = store.selectedQuake;
	});

	onDestroy(unsubscribe);

	function closePanel() {
		quakeStore.update((d) => ({ ...d, selectedQuake: null }));
	}

	function formatTime(milliseconds: number): string {
		return new Date(milliseconds).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
	}
</script>

{#if selectedQuake}
	<div
		transition:flyAndScale
		class="bg-background relative mt-16 w-full rounded-lg border p-4 text-white shadow-lg lg:w-[27.5rem]"
	>
		<button class="absolute top-4 right-4" onclick={closePanel} aria-label="Close">
			<X class="text-white/70 duration-200 hover:text-white/40" size={18} />
		</button>

		<div class="flex items-center gap-3">
			<span
				class="flex size-11 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold text-black"
				style="background-color: {markerColor(selectedQuake.magnitude)}"
			>
				{selectedQuake.magnitude.toFixed(1)}
			</span>
			<div class="min-w-0">
				<h2 class="truncate text-lg font-bold">
					{selectedQuake.place ?? 'Unknown location'}
				</h2>
				<div class="text-foreground-muted font-mono text-xs">
					{formatTime(selectedQuake.time)}
				</div>
			</div>
		</div>

		<div class="my-3 grid grid-cols-2 gap-2 text-sm">
			<div><strong>Latitude:</strong> {selectedQuake.latitude.toFixed(4)}</div>
			<div><strong>Longitude:</strong> {selectedQuake.longitude.toFixed(4)}</div>
			<div>
				<strong>Depth:</strong>
				{selectedQuake.depth_km !== null
					? `${selectedQuake.depth_km.toFixed(1)} km`
					: 'N/A'}
			</div>
			<div><strong>Felt reports:</strong> {selectedQuake.felt ?? '0'}</div>
		</div>

		{#if selectedQuake.tsunami}
			<div class="mb-2 rounded bg-red-900/40 px-2 py-1 text-sm text-red-200">
				Tsunami evaluation issued for this event
			</div>
		{/if}

		{#if selectedQuake.url}
			<!-- An absolute USGS event URL, not an app route, so resolve() does not apply. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={selectedQuake.url}
				target="_blank"
				rel="noopener noreferrer"
				class="text-sm underline decoration-white/40 hover:decoration-white"
			>
				View on USGS
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
	</div>
{/if}
