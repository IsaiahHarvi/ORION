<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { current_lat_long } from '$lib/stores/current-location';
    import Sidebar from '$lib/components/SidebarTemp.svelte';
    import Topbar from '$lib/components/Topbar.svelte';
    import { Button } from '$lib/components/ui/button'
	import Map from '$lib/components/MapTemp.svelte';
	import Timeline from '$lib/components/TimelineTemp.svelte';
	import { layers_state } from '$lib/runes/toggleable-layers.svelte';

    onMount(() => {
        layers_state.data.uav_layer = false;
        layers_state.data.ais_layer = false;
    })
</script>

<Map />

<style>
</style>