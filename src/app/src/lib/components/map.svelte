<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { current_lat_long } from '$lib/stores/current_location';
    import { flyAndScale } from '$lib/utils';
    // Import the updater functions from our separate module.
    import { loadRainViewerData, loadRouteData } from '$lib/mapUpdater';
  
    let map: any;
    let mapElement: HTMLElement;
    let markerElement: HTMLElement;
    let initialView = { lat: 39.8283, long: -98.5795 };
  
    export let showRadarLayer: boolean = true;
  
    // Custom marker element creation (for initial position)
    function createCustomMarkerElement() {
      const el = document.createElement('div');
      el.classList.add('h-5', 'w-5', 'bg-neutral-700', 'border-[3px]', 'border-white', 'rounded-full');
      return el;
    }
  
    onMount(() => {
      if (typeof window !== 'undefined') {
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
  
  <div transition:flyAndScale class="h-full w-full absolute top-0 left-0" bind:this={mapElement}></div>
  
  <style>
    /* Additional styling if needed */
  </style>
  