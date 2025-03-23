<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { current_lat_long } from '$lib/stores/current_location';
    import { flyAndScale } from '$lib/utils';
    import { loadRainViewerData } from '$lib/mapUpdater';
    import { loadRouteData, resetUAVUpdater } from '$lib/uavUpdater';
    import { radar_state } from '$lib/runes/current_radar.svelte';
	import { fade } from 'svelte/transition';
    import { cursor_data } from '$lib/runes/cursor.svelte';
	import Controls from './controls.svelte';
  
    let map: any = $state();
    let socket: WebSocket | undefined;
    let mapElement: HTMLElement;
    let markerElement: HTMLElement;
    let initialView = { lat: 39.8283, long: -98.5795 };
  
    let lastTimestamp = 0;
    let loadedUAVData = false;

    let url =
    import.meta.env.MODE === 'development'
      ? 'ws://localhost:8000/ws/cursor'
      : 'wss://orion.harville.dev/ws/cursor';

    const {
        showRadarLayer = true,
        showUAVLayer = false,
        mapEl = null,
    }: { showRadarLayer?: boolean; showUAVLayer?: boolean; mapEl?: any } = $props();

    let lastSent = 0;
    const throttleDelay = 50;

    function handleMouseMove(e: any) {
        const now = Date.now();
        if (now - lastSent < throttleDelay) return;

        cursor_data.clientx = e.clientX;
        cursor_data.clienty = e.clientY;

        const point = [e.clientX, e.clientY];
        const lngLat = map.unproject(point);

        cursor_data.lat = lngLat.lat;
        cursor_data.lng = lngLat.lng;

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(cursor_data));
            lastSent = now;
        }
    }

    function createCustomMarkerElement() {
        const el = document.createElement('div');
        el.classList.add('h-5', 'w-5', 'bg-neutral-700', 'border-[3px]', 'border-white', 'rounded-full');
        return el;
    }
  
    onMount(() => {
        socket = new WebSocket(url);

        if (typeof window !== 'undefined') {
            window.addEventListener('mousemove', handleMouseMove);

            navigator.geolocation.getCurrentPosition(({ coords }) => {
            current_lat_long.set({ lat: coords.latitude, long: coords.longitude });
            if (map) {
                map.flyTo({ center: [coords.longitude, coords.latitude], zoom: 8, essential: true });
                const marker = new maplibregl.Marker({
                    element: createCustomMarkerElement()
                    })
                    .setLngLat([coords.longitude, coords.latitude])
                    .addTo(map);
                }
            });
        }
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

        map.on('load', () => {
            if (showRadarLayer) {
                loadRainViewerData(map);
            }
            // If UAV layer is enabled, reset UAV state and then load UAV updater data.
            if (showUAVLayer) {
                resetUAVUpdater();
                loadRouteData(map);
            }
        });
    });
  
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
        socket?.close();

        if (map) {
            map.remove();
        }
        
        if (typeof window !== 'undefined') {
            window.removeEventListener('mousemove', handleMouseMove);
        }
    });
</script>
  
<div in:fade={{ duration: 150, delay: 300 }} class="h-full w-full absolute top-0 left-0" bind:this={mapElement}></div>
{#if map}
    <Controls map={map} />
{/if}

<style>
/* Additional styling if needed */
</style>
