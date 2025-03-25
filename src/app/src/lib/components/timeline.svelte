<script lang="ts">
    import { Button } from '$lib/components/ui/button'
    import { page } from '$app/stores';
    import { onMount, type Snippet } from 'svelte';
    import { radar_state } from '$lib/runes/current_radar.svelte';
    import LoaderCircle from '@lucide/svelte/icons/loader-circle'
    import { Slider } from "$lib/components/ui/slider";
    import { flyAndScale } from '$lib/utils';
    import Pause from '@lucide/svelte/icons/pause';
    import Play from '@lucide/svelte/icons/play';

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
    let loop = $state(true);

    $effect(() => {
        max = radar_state.radar_state.valid_past_timestamps?.length;
        if (max !== 0 && setIndex !== true) {
            selectedIndex = max;
            setIndex = true;
        }

        const newTimestamp = radar_state.radar_state.valid_past_timestamps[selectedIndex];
        radar_state.radar_state.timestamp = newTimestamp;
        formattedTimestamp = formatTimestamp(newTimestamp);

        if (!newTimestamp) {
            formattedTimestamp = formatTimestamp(radar_state.radar_state.valid_past_timestamps[max - 1]);
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

<div transition:flyAndScale class="bg-neutral-900 absolute bottom-0 left-0 lg:left-auto lg:bottom-10 w-screen flex-col items-center gap-2 justify-center rounded-md z-40 lg:w-[35rem] h-32 md:h-auto flex-shrink-0 border p-5 flex">
    <h1 class="w-full flex font-semibold justify-between items-center">
        {formattedTimestamp}
        <p class="text-muted-foreground font-normal text-sm text-left">Last 2 hours</p>
    </h1>
    <div class="flex flex-row w-full">
        <button onclick={() => loop = !loop}>
            {#if loop}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M15 18q-.402 0-.701-.299T14 17V7q0-.402.299-.701T15 6h1.5q.402 0 .701.299T17.5 7v10q0 .402-.299.701T16.5 18zm-7.5 0q-.402 0-.701-.299T6.5 17V7q0-.402.299-.701T7.5 6H9q.402 0 .701.299T10 7v10q0 .402-.299.701T9 18z"/></svg>
            {:else}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M8 17.175V6.825q0-.425.3-.713t.7-.287q.125 0 .263.037t.262.113l8.15 5.175q.225.15.338.375t.112.475t-.112.475t-.338.375l-8.15 5.175q-.125.075-.262.113T9 18.175q-.4 0-.7-.288t-.3-.712"/></svg>
            {/if}
        </button>
        <Slider 
            type="single" 
            size={4}
            class="w-full mx-2 mt-1" 
            bind:value={selectedIndex}
            min={0}
            max={max}
            step={1}
        />
    </div>
</div>

<style>
    
</style>
