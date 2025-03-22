<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { current_lat_long } from '$lib/stores/current_location';
    import { flyAndScale } from '$lib/utils';
    // Import common map updater functions
    import { loadRainViewerData } from '$lib/mapUpdater';
    // Import UAV‑specific updater functions
    import { loadRouteData, resetUAVUpdater } from '$lib/uavUpdater';
    import { radar_state } from '$lib/runes/current_radar.svelte';
  
    let map: any;
    let mapElement: HTMLElement;
    let markerElement: HTMLElement;
    let initialView = { lat: 39.8283, long: -98.5795 };
  
    let lastTimestamp = 0;
    let loadedUAVData = false;
  
    const {
      showRadarLayer = true,
      showUAVLayer = false,
      mapEl = null,
    }: { showRadarLayer?: boolean; showUAVLayer?: boolean; mapEl?: any } = $props();
  
    // Custom marker element for the initial position
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
        if (map) {
            map.remove();
        }
    });
  </script>
  
  <div out:flyAndScale class="h-full w-full absolute top-0 left-0" bind:this={mapElement}></div>
  
  <style>
    /* Additional styling if needed */
  </style>
  