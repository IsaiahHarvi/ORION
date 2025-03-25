<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { page } from '$app/stores';
	import type { Snippet } from 'svelte';
    import { radar_state } from '$lib/runes/current-radar.svelte';
    import { map_state } from '$lib/runes/map-state.svelte';
    import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { toast } from 'svelte-sonner';
	import { Checkbox } from '$lib/components/ui/checkbox';
    import { layers_state } from '$lib/runes/toggleable-layers.svelte';

    let { children }: {
        children?: Snippet;
    } = $props();

    let value = $state('');
    let checked = $state(true);
    let checked2 = $state(false);

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

        layers_state.data.radar_layer = checked;
        layers_state.data.radar_stations_layer = checked2;
    });
</script>

<div class="bg-neutral-900 overflow-hidden lg:ml-64 xl:ml-[20rem] gap-4 lg:visible invisible w-screen absolute z-40 top-0 flex-shrink-0 border-b h-16 p-4 flex flex-row items-center">
    <div class="flex items-center justify-center flex-row gap-3">
        <Checkbox bind:checked id="radar-layers" />
        <label class="text-sm text-white font-mono" for="radar-layers">
            Show Weather Radar
        </label>
    </div>
    <div class="flex items-center justify-center flex-row gap-3">
        <Checkbox bind:checked={checked2} id="radar-layers-le" />
        <label class="text-sm text-white font-mono" for="radar-layers-le">
            Show Radar Stations
        </label>
    </div>
    <p class="text-foreground ml-auto lg:mr-64 pr-4 xl:mr-[20rem] font-medium text-sm font-mono">
        {#if formattedTimestamp !== ''}
            {formattedTimestamp}
        {:else}
            <LoaderCircle class="animate-spin" size="18" />
        {/if}
    </p>
</div>