<script lang="ts">
	import { onMount } from 'svelte';
	import { radar_state } from '$lib/runes/current-radar.svelte';
	import { Slider } from '$lib/components/ui/slider';
	import { flyAndScale } from '$lib/utils';

    let validTimestamps: number[] = $derived(
        radar_state.radar_state.valid_timestamps
            .map((t) => t.time)
    );
	let max = $state(0);
	let selectedIndex = $state(radar_state.radar_state.valid_timestamps.length - 1);
	let setIndex = $state(false);

	function formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp * 1000);
		const hours = date.getHours().toString().padStart(2, '0');
		const minutes = date.getMinutes().toString().padStart(2, '0');
		return `${hours}:${minutes}`;
	}

	let formattedTimestamp = $state('');
	let loop = $state(false);

	$effect(() => {
		max = radar_state.radar_state.valid_timestamps?.length;
		if (max !== 0 && setIndex !== true) {
			selectedIndex = max;
			setIndex = true;
		}

        const newTimestamp = radar_state.radar_state.valid_timestamps[selectedIndex]?.time ?? 0;
        radar_state.radar_state.timestamp = newTimestamp;
        formattedTimestamp = formatTimestamp(newTimestamp);
        
		if (!newTimestamp) {
			formattedTimestamp = formatTimestamp(
				radar_state.radar_state.valid_timestamps[max - 1]?.time
			);
		}
	});

	onMount(() => {
		const interval = setInterval(() => {
			if (loop) {
				selectedIndex = (selectedIndex + 1) % max;
			}
		}, 5000);
		return () => clearInterval(interval);
	});
</script>

<div
	transition:flyAndScale
	class="invisible absolute bottom-0 left-0 z-40 flex h-32 w-screen flex-shrink-0 flex-col items-center justify-center gap-2 rounded-t-md rounded-b-none border-t border-r border-l bg-background p-6 md:visible md:h-24 lg:bottom-10 lg:left-auto lg:w-[35rem]"
>
	<h1 class="flex w-full items-center text-lg gap-2 justify-start">
		{formattedTimestamp}
        <span class="text-muted-foreground text-sm">
            {formatTimestamp(validTimestamps[0])} - {formatTimestamp(validTimestamps[validTimestamps.length - 1])}
        </span>
	</h1>
	<div class="flex w-full flex-row">
		<Slider
			type="single"
			size={4}
			class="mt-1 w-full"
			bind:value={selectedIndex}
			min={0}
			max={(max - 1)}
			step={1}
		/>
	</div>
</div>

<!-- Small version for mobile devices -->
<div
	transition:flyAndScale
	class="h-22 visible absolute bottom-0 left-0 z-40 px-4 flex w-screen flex-shrink-0 flex-col items-center justify-center gap-2 rounded-md border bg-background p-4 md:invisible md:h-auto"
>
	<h1 class="flex w-full items-center text-ssm gap-2 justify-start">
		{formattedTimestamp}
        <span class="text-muted-foreground text-sm">
            {formatTimestamp(validTimestamps[0])} - {formatTimestamp(validTimestamps[validTimestamps.length - 1])}
        </span>
	</h1>
	<div class="flex w-full flex-row px-1">
		<Slider
			type="single"
			size={4}
			class="mt-1 w-full"
			bind:value={selectedIndex}
			min={0}
			{max}
			step={1}
		/>
	</div>
</div>

<style>
</style>
