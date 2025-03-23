<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';

    import { current_lat_long } from '$lib/stores/current_location';
    import { flyAndScale } from '$lib/utils';
    import { loadRainViewerData } from '$lib/mapUpdater';
    import { radar_state } from '$lib/runes/current_radar.svelte';
    import Controls from './controls.svelte';
    import UAVLayer from './UAVLayer.svelte';
    import AISLayer from './AISLayer.svelte';
    import { map_state } from '$lib/runes/map_state.svelte';
    import { cursor_data } from '$lib/runes/cursor.svelte';

    const { 
        showRadarLayer = true, 
        showUAVLayer = false, 
        showAISLayer = false, 
    } = $props();

    let map: maplibregl.Map | null = $state(null);
    let mapElement: HTMLElement;
    let initialView = { lat: 39.8283, long: -98.5795 };

    onMount(() => {
        if ($current_lat_long.lat && $current_lat_long.long) {
            initialView = $current_lat_long;
        }

        map = new maplibregl.Map({
            container: mapElement,
            style: "https://api.maptiler.com/maps/0195bee2-9b1b-7b54-b0c9-fb330ebe7162/style.json?key=rIQyeDoL1FNvjM5uLY2f",
            center: [initialView.long, initialView.lat],
            zoom: 8,
            attributionControl: false,
            fadeDuration: 0
        });

        map.setMinZoom(3);
        map.setMaxZoom(24);

        navigator.geolocation.getCurrentPosition(({ coords }) => {
            current_lat_long.set({ lat: coords.latitude, long: coords.longitude });

            const el = document.createElement('div');
            el.className = 'bg-background border-4 border-primary w-5 h-5 rounded-full';

            new maplibregl.Marker({ element: el })
                .setLngLat([coords.longitude, coords.latitude])
                .addTo(map);
        });

        map_state.data = map;

        map.on('load', () => {
            if (showRadarLayer) {
                loadRainViewerData(map);
            }
        });

        map.on('mousemove', (e: maplibregl.MapMouseEvent) => {
            cursor_data.clientx = e.originalEvent.clientX;
            cursor_data.clienty = e.originalEvent.clientY;
            cursor_data.lat = parseFloat(e.lngLat.lat.toFixed(6));
            cursor_data.lng = parseFloat(e.lngLat.lng.toFixed(6));
        });
    });

    let lastTimestamp = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    $effect(() => {
        if (radar_state.radar_state.timestamp !== lastTimestamp) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                lastTimestamp = radar_state.radar_state.timestamp ?? 0;
                loadRainViewerData(map, radar_state.radar_state.timestamp);
            }, 300);
        }
    });

    onDestroy(() => {
        if (map) {
            map.remove();
            map_state.data = null;
        }
    });
</script>

<div class="h-full w-full absolute top-0 left-0" bind:this={mapElement}></div>

{#if map}
    <Controls {map} />
    {#if showUAVLayer}
        <UAVLayer {map} />
    {/if}
    {#if showAISLayer}
        <AISLayer {map} />
    {/if}
{/if}
