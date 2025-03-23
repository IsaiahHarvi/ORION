<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  import { current_lat_long } from '$lib/stores/current_location';
  import { flyAndScale } from '$lib/utils';
  import { loadRainViewerData } from '$lib/mapUpdater';
  import { radar_state } from '$lib/runes/current_radar.svelte';
  import { fade } from 'svelte/transition';
  import Controls from './controls.svelte';
  import UAVLayer from './UAVLayer.svelte';
  import AISLayer from './AISLayer.svelte';

  // Extract props at the top level.
  // Here we add showAISLayer in addition to the existing props.
  const { 
    showRadarLayer = true, 
    showUAVLayer = false, 
    showAISLayer = false, 
    mapEl = null 
  } = $props();

  // Declare reactive state variable for the map using $state.
  let map: any = $state(null);
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

    map.on('load', () => {
      console.log("Map loaded, props:", { showRadarLayer, showUAVLayer, showAISLayer });
      if (showRadarLayer) {
        loadRainViewerData(map);
      }
      // UAVLayer and AISLayer are rendered conditionally below.
    });
  });

  onDestroy(() => {
    if (map) {
      map.remove();
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

<style>
  /* Additional styling if needed */
</style>
