<script lang="ts">
    import { Button } from '$lib/components/ui/button'
    import { page } from '$app/stores';
    import { onMount, type Snippet } from 'svelte';
    import { radar_state } from '$lib/runes/current_radar.svelte';
    import LoaderCircle from '@lucide/svelte/icons/loader-circle'
    import { Slider } from "$lib/components/ui/slider";

    let validTimestamps: number[] = radar_state.radar_state.valid_past_timestamps;
    let max = $state(0)
    let selectedIndex = $state(validTimestamps.length - 1)
    let setIndex = $state(false);
    radar_state.radar_state.timestamp = validTimestamps[selectedIndex];

    let { children }: { children?: Snippet } = $props();

    function formatTimestamp(timestamp: number): string {
        const date = new Date(timestamp * 1000);
        const weekday = date.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
        const day = date.getDate();
        const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const year = date.getFullYear().toString().slice(-2);
        const hours24 = date.getHours();
        const hours = hours24.toString();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${weekday} ${day} ${month} ${year}, ${hours}:${minutes}`;
    }

    let formattedTimestamp = $state('');

    $effect(() => {
        max = radar_state.radar_state.valid_past_timestamps.length;
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

<div class="bg-neutral-900 absolute bottom-8 flex-col items-center gap-2 justify-center rounded-lg z-40 w-[35rem] flex-shrink-0 border p-5 flex">
    <p class="text-white font-medium text-sm text-left w-full">{formattedTimestamp}</p>
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
