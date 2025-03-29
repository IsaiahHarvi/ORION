<script lang="ts">
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
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${weekday} ${day} ${month} ${year}, ${hours}:${minutes}`;
    }

	$effect(() => {
		layers_state.data.radar_layer = radarLayersChecked;
		layers_state.data.radar_stations_layer = radarStationsChecked;
	});
</script>

<div
	class="invisible absolute top-0 z-40 flex h-16 w-screen flex-shrink-0 flex-row items-center gap-4 overflow-hidden border-b bg-background p-3 pl-4 lg:visible"
>
    <header class="flex flex-row items-center gap-4 mr-4">
        <h1>
            ORION
        </h1>
        <p class='text-sm font-mono text-muted-foreground'>
            WEB INTERFACE
        </p>
    </header>
	<div class="flex flex-row items-center justify-center gap-3">
		<Checkbox bind:checked={radarLayersChecked} id="radar-layers" />
		<label class=" text-sm text-white" for="radar-layers"> Show Weather Radar </label>
	</div>
	<div class="flex flex-row items-center justify-center gap-3">
		<Checkbox bind:checked={radarStationsChecked} id="radar-stations" />
		<label class=" text-sm text-white" for="radar-stations">
			Show Radar Stations
		</label>
	</div>
    <p class="font-mono ml-auto">
        <span class="text-success">
            ONLINE
        </span>
        {formatTimestamp(Math.floor(Date.now() / 1000))}
    </p>
</div>
