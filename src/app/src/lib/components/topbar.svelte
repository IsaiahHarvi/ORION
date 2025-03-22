<script lang="ts">
    import { Button } from '$lib/components/ui/button'
    import { page } from '$app/stores';
	import type { Snippet } from 'svelte';
    import { radar_state } from '$lib/runes/current_radar.svelte';
    import LoaderCircle from '@lucide/svelte/icons/loader-circle'

    let { children }: {
        children?: Snippet
    } = $props();

    function formatTimestamp(timestamp: number): string {
        // Convert timestamp from seconds to milliseconds
        const date = new Date(timestamp * 1000);
        
        // Format day (3-letter abbreviation)
        const weekday = date.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
        
        // Get day number
        const day = date.getDate();
        
        // Format month (3-letter abbreviation)
        const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        
        // Get 2-digit year
        const year = date.getFullYear().toString().slice(-2);
        
        // Convert 24-hour format to 12-hour format with AM/PM
        const hours24 = date.getHours();
        const hours12 = hours24 % 12 || 12; // Convert 0 to 12 for midnight
        const hours = hours12.toString().padStart(2, '0'); // Ensure 2 digits
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours24 >= 12 ? 'PM' : 'AM';
        
        // Return formatted timestamp: MON 3 DEC 24, 01:40 PM
        return `${weekday} ${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
    }

    let formattedTimestamp = $state('');
    $effect(() => {
        if (radar_state.radar_state.timestamp) {
            formattedTimestamp = formatTimestamp(radar_state.radar_state.timestamp)
        }
    })
</script>
 
<div class="bg-neutral-900/50 w-full flex-shrink-0 border-b h-16 p-4 flex flex-row items-center">
    <p class="text-foreground font-medium text-sm font-mono">
        {#if formattedTimestamp !== ''}
            {formattedTimestamp}
        {:else}
            <LoaderCircle class="animate-spin" size='18' />
        {/if}
    </p>
</div>