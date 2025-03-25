<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { current_lat_long } from '$lib/stores/current-location';
    import Sidebar from '$lib/components/sidebar.svelte';
    import Topbar from '$lib/components/topbar.svelte';
    import { Button } from '$lib/components/ui/button'
	import Map from '$lib/components/map.svelte';
	import Timeline from '$lib/components/timeline.svelte';
	import { layers_state } from '$lib/runes/toggleable-layers.svelte';

    onMount(() => {
        layers_state.data.uav_layer = false;
        layers_state.data.ais_layer = false;
    })
</script>

<Map />

<style>
</style>