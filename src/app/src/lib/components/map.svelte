<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { current_lat_long } from '$lib/stores/current_location';
    import { loadRainViewerData, loadRouteData } from '$lib/mapUpdater';
  
    let map: any;
    let mapElement: HTMLElement;
    let initialView = { lat: 39.8283, long: -98.5795 };
    export let showRadarLayer: boolean = true;
  
    onMount(() => {
      if (typeof window !== 'undefined') {
        navigator.geolocation.getCurrentPosition(({ coords }) => {
          current_lat_long.set({ lat: coords.latitude, long: coords.longitude });
          if (map) {
            map.flyTo({ center: [coords.longitude, coords.latitude], zoom: 8, essential: true });
          }
        });
      }
      if ($current_lat_long.lat && $current_lat_long.long) {
        initialView = $current_lat_long;
      }
      map = new maplibregl.Map({
        container: mapElement,
        style: `https://api.maptiler.com/maps/0195bee2-9b1b-7b54-b0c9-fb330ebe7162/style.json?key=rIQyeDoL1FNvjM5uLY2f`,
        center: [initialView.long, initialView.lat],
        zoom: 8
      });
      map.on('load', () => {
        if (showRadarLayer) loadRainViewerData(map);
        loadRouteData(map);
      });
    });
  
    onDestroy(() => {
      if (map) {
        map.remove();
      }
    });
  </script>
  
  <div class="h-full w-full" bind:this={mapElement}></div>
  
  <style>
    /* Additional styling if needed */
  </style>
  