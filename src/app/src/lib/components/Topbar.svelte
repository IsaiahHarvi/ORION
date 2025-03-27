<script lang="ts">
	import { radar_state } from '$lib/runes/current-radar.svelte';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { layers_state } from '$lib/runes/toggleable-layers.svelte';

	let radarLayersChecked = $derived(layers_state.data.radar_layer);
	let radarStationsChecked = $derived(layers_state.data.radar_stations_layer);

	function formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp * 1000);
		const weekday = date.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
		const day = date.getDate();
		const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
		const year = date.getFullYear().toString().slice(-2);
		const hours24 = date.getHours();
		const hours12 = hours24 % 12 || 12;
		const hours = hours12.toString().padStart(2, '0');
		const minutes = date.getMinutes().toString().padStart(2, '0');
		const ampm = hours24 >= 12 ? 'PM' : 'AM';
		return `${weekday} ${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
	}

	let formattedTimestamp = $state('');
	$effect(() => {
		if (radar_state.radar_state.timestamp) {
			formattedTimestamp = formatTimestamp(radar_state.radar_state.timestamp);
		}

		layers_state.data.radar_layer = radarLayersChecked;
		layers_state.data.radar_stations_layer = radarStationsChecked;
	});
</script>

<div
	class="invisible absolute top-0 z-40 flex h-16 w-screen flex-shrink-0 flex-row items-center gap-4 overflow-hidden border-b bg-neutral-900 p-4 lg:visible lg:ml-64 xl:ml-[20rem]"
>
	<div class="flex flex-row items-center justify-center gap-3">
		<Checkbox bind:checked={radarLayersChecked} id="radar-layers" />
		<label class="font-mono text-sm text-white" for="radar-layers"> Show Weather Radar </label>
	</div>
	<div class="flex flex-row items-center justify-center gap-3">
		<Checkbox bind:checked={radarStationsChecked} id="radar-stations" />
		<label class="font-mono text-sm text-white" for="radar-stations">
			Show Radar Stations
		</label>
	</div>
	<p class="ml-auto pr-4 font-mono text-sm font-medium text-foreground lg:mr-64 xl:mr-[20rem]">
		{#if formattedTimestamp !== ''}
			{formattedTimestamp}
		{:else}
			<LoaderCircle class="animate-spin" size="18" />
		{/if}
	</p>
</div>
