<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { current_lat_long } from '$lib/stores/current_location';
    import Sidebar from '$lib/components/sidebar.svelte';
    import Topbar from '$lib/components/topbar.svelte';
    import { Button } from '$lib/components/ui/button'
	import Map from '$lib/components/map.svelte';
	import Timeline from '$lib/components/timeline.svelte';
</script>

<div class="flex flex-row h-screen w-screen">
    <Sidebar />
    <div class="relative flex items-center justify-center h-full w-full">
        <!--
            <Topbar />
        -->
        <Map />
        <Timeline />
    </div>
</div>

<style>
</style>