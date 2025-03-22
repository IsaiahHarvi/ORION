<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { current_lat_long } from '$lib/stores/current_location';
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import Map from '$lib/components/map.svelte';
</script>

<div class="relative h-screen w-screen">
    <Map />
</div>

<style>
</style>