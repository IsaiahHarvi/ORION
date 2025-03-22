<script lang="ts">
    import { Button } from '$lib/components/ui/button'
    import { page } from '$app/stores';
    import type { Snippet } from 'svelte';
    import { radar_state } from '$lib/runes/current_radar.svelte';
    import LoaderCircle from '@lucide/svelte/icons/loader-circle'
    import { Slider } from "$lib/components/ui/slider";

    // Default to the current time if baseTimestamp is undefined or invalid
    let baseTimestamp = radar_state.radar_state.timestamp || Math.floor(Date.now() / 1000);
    let minutesOffset = $state(0);
    let maxMinutes = $state(1440);

    // Function to update the radar timestamp based on the current base timestamp and offset
    function updateTimestamp() {
        if (typeof baseTimestamp !== 'number' || isNaN(baseTimestamp)) {
            console.error("Invalid baseTimestamp:", baseTimestamp);
            return;
        }

        const newTimestamp = baseTimestamp + (minutesOffset * 60);
        radar_state.radar_state.timestamp = newTimestamp;
    }

    let { children }: {
        children?: Snippet
    } = $props();

    function formatTimestamp(timestamp: number): string {
        const date = new Date(timestamp * 1000);
        const weekday = date.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
        const day = date.getDate();
        const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const year = date.getFullYear().toString().slice(-2);
        const hours24 = date.getHours();
        const hours = hours24.toString()
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${weekday} ${day} ${month} ${year}, ${hours}:${minutes}`;
    }

    let formattedTimestamp = $state('');

    // Whenever the radar state timestamp changes, reformat the timestamp
    $effect(() => {
        if (radar_state.radar_state.timestamp) {
            formattedTimestamp = formatTimestamp(radar_state.radar_state.timestamp);
        }
    });
    
    // Whenever the minutesOffset changes, update the radar timestamp
    $effect(() => {
        updateTimestamp();
    });
</script>

<div class="bg-neutral-900 absolute bottom-8 flex-col items-center gap-2 justify-center rounded-lg z-40 w-[35rem] flex-shrink-0 border p-5 flex">
    <p class="text-white font-medium text-sm text-left w-full">{formattedTimestamp}</p>
    <Slider 
        type="single" 
        class="w-full mx-4 mt-1" 
        bind:value={minutesOffset}
        onchange={() => {
            updateTimestamp(); // Update timestamp and log it on slider change
        }}
        min={-maxMinutes} 
        max={maxMinutes} 
        step={1} 
    />
</div>

<style>
    
</style>
