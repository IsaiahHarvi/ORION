<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { current_lat_long } from '$lib/stores/current_location';
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import Map from '$lib/components/map.svelte';
    import TrackData from '$lib/components/track-data.svelte';
</script>

<div class="absolute z-20 top-4 left-4">
    <TrackData />
</div>

<Map showUAVLayer={true} />

<style>
/* Any additional page-level styles */
</style>
