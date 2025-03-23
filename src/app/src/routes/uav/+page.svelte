<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { current_lat_long } from '$lib/stores/current_location';
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import Map from '$lib/components/map.svelte';
    import TrackData from '$lib/components/track-data.svelte';
    import { layers_state } from '$lib/runes/toggleable_layers.svelte';

    onMount(() => {
        layers_state.data.ais_layer = false;
        layers_state.data.uav_layer = true;
    })
</script>

<div class="absolute w-screen z-20 left-0 px-4 top-4">
    <TrackData />
</div>

<Map />

<style>
/* Any additional page-level styles */
</style>
