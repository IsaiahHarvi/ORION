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
    import { layers_state } from '$lib/runes/toggleable_layers.svelte';

    import OceanStyle from '$lib/content/styles/ocean.json';
    import DefaultStyle from '$lib/content/styles/default.json';
    import SatelliteStyle from '$lib/content/styles/satellite.json';
    import StreetsStyle from '$lib/content/styles/streets.json';
	import { map_style_state } from '$lib/runes/map_style.svelte';

    let map: any = $state();
    let mapElement: HTMLElement;
    let initialView = { lat: 39.8283, long: -98.5795 };

    function removeRadarLayers(map: maplibregl.Map): void {
        const style = map.getStyle();
        if (!style?.layers) return;
        style.layers.forEach((layer) => {
            if (layer.id.startsWith('radar-layer')) {
                if (map.getLayer(layer.id)) map.removeLayer(layer.id);
                if (map.getSource(layer.id)) map.removeSource(layer.id);
            }
        });
    }

    function getMapStyle(style: string) {
        return style === 'satellite'
            ? SatelliteStyle
            : style === 'streets'
            ? StreetsStyle
            : style === 'ocean'
            ? OceanStyle
            : DefaultStyle;
    }

    function initializeMap() {
        if (map) map.remove();
        
        map = new maplibregl.Map({
            container: mapElement,
            style: getMapStyle(map_style_state.data),
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
            if (layers_state.data?.radar_layer) {
                loadRainViewerData(map);
            }
        });

        map.on('mousemove', (e: maplibregl.MapMouseEvent) => {
            cursor_data.clientx = e.originalEvent.clientX;
            cursor_data.clienty = e.originalEvent.clientY;
            cursor_data.lat = parseFloat(e.lngLat.lat.toFixed(6));
            cursor_data.lng = parseFloat(e.lngLat.lng.toFixed(6));
        });
    }

    onMount(() => {
        if ($current_lat_long.lat && $current_lat_long.long) {
            initialView = $current_lat_long;
        }

        initializeMap();
    });

    let lastTimestamp = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let prevRadarLayer = layers_state.data?.radar_layer;
    let previousMapStyle = map_style_state.data;

    $effect(() => {
        if (map_style_state.data !== previousMapStyle) {
            previousMapStyle = map_style_state.data;
            initializeMap();
        }

        if (radar_state.radar_state.timestamp !== lastTimestamp && layers_state.data.radar_layer === true) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                lastTimestamp = radar_state.radar_state.timestamp ?? 0;
                loadRainViewerData(map, radar_state.radar_state.timestamp);
            }, 300);
        }
        const currentRadarLayer = layers_state.data?.radar_layer;
        if (currentRadarLayer !== prevRadarLayer) {
            if (currentRadarLayer === true) {
                removeRadarLayers(map);
                loadRainViewerData(map, radar_state.radar_state.timestamp);
            } else {
                removeRadarLayers(map);
            }
        }
        prevRadarLayer = currentRadarLayer;
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
  {#key map}
    <Controls {map} />
    {#if layers_state.data?.uav_layer}
      <UAVLayer {map} />
    {/if}
    {#if layers_state.data?.ais_layer}
      <AISLayer {map} />
    {/if}
  {/key}
{/if}