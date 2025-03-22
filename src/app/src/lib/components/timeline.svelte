<script lang="ts">
    import { Button } from '$lib/components/ui/button'
    import { page } from '$app/stores';
    import { onMount, type Snippet } from 'svelte';
    import { radar_state } from '$lib/runes/current_radar.svelte';
    import LoaderCircle from '@lucide/svelte/icons/loader-circle'
    import { Slider } from "$lib/components/ui/slider";
	import { flyAndScale } from '$lib/utils';

    let validTimestamps: number[] = radar_state.radar_state.valid_past_timestamps;
    let max = $state(0)
    let selectedIndex = $state(validTimestamps.length - 1)
    let setIndex = $state(false);
    radar_state.radar_state.timestamp = validTimestamps[selectedIndex];

    let { children }: { children?: Snippet } = $props();

    function formatTimestamp(timestamp: number): string {
        const date = new Date(timestamp * 1000);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    let formattedTimestamp = $state('');

    $effect(() => {
        max = radar_state.radar_state.valid_past_timestamps?.length;
        if (max !== 0 && setIndex !== true) {
            selectedIndex = max;
            setIndex = true;
        }

        const newTimestamp = radar_state.radar_state.valid_past_timestamps[selectedIndex];
        radar_state.radar_state.timestamp = newTimestamp;
        formattedTimestamp = formatTimestamp(newTimestamp);

        if(!newTimestamp) {
            formattedTimestamp = formatTimestamp(radar_state.radar_state.valid_past_timestamps[max - 1]);
        }
    });
</script>

<div transition:flyAndScale class="bg-neutral-900 absolute bottom-8 flex-col items-center gap-2 justify-center rounded-md z-40 w-[35rem] flex-shrink-0 border p-5 flex">
    <h1 class="w-full flex font-semibold justify-between items-center">
        {formattedTimestamp}
        <p class="text-muted-foreground font-normal text-sm text-left">Last 2 hours</p>
    </h1>
    <Slider 
        type="single" 
        class="w-full mx-4 mt-1" 
        bind:value={selectedIndex}
        min={0}
        max={max}
        step={1}
    />
</div>

<style>
    
</style>
