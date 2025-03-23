<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { page } from '$app/stores';
	import type { Snippet } from 'svelte';
    import { radar_state } from '$lib/runes/current_radar.svelte';
    import { map_state } from '$lib/runes/map_state.svelte';
    import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { toast } from 'svelte-sonner';

    let { children }: {
        children?: Snippet;
    } = $props();

    let value = $state('');

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
    });

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            const regex = /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/;
            const match = value.match(regex);
            if (match) {
                const lat = parseFloat(match[1]);
                const lng = parseFloat(match[3]);

                map_state.data.flyTo({ center: [lng, lat], zoom: 12 });
            } else {
                toast('Please enter valid coordinates (e.g., 33.54, -117.6).');
            }
        }
    }
</script>

<div class="bg-neutral-900 overflow-hidden lg:ml-64 xl:ml-[20rem] gap-4 lg:visible invisible w-screen absolute z-40 top-0 flex-shrink-0 border-b h-16 p-4 flex flex-row items-center">
    <input
        placeholder="e.g. 33.54, -117.6"
        bind:value
        onkeydown={handleKeydown}
        class="px-3 p-2 w-72 placeholder:text-neutral-500 text-sm font-mono bg-neutral-800 border border-neutral-700"
    />
    <p class="text-foreground font-medium text-sm font-mono">
        {#if formattedTimestamp !== ''}
            {formattedTimestamp}
        {:else}
            <LoaderCircle class="animate-spin" size="18" />
        {/if}
    </p>
</div>