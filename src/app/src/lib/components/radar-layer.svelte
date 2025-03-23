<!-- RadarLayer.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type maplibregl from 'maplibre-gl';
  import { loadRainViewerData } from '$lib/mapUpdater';
  import { radar_state } from '$lib/runes/current_radar.svelte';

  export let map: maplibregl.Map;

  let lastTimestamp = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: () => void;

  function updateRadarLayer(timestamp?: number) {
    loadRainViewerData(map, timestamp);
  }

  onMount(() => {
    if (!map.isStyleLoaded()) {
      map.on('load', () => updateRadarLayer());
    } else {
      updateRadarLayer();
    }

    unsubscribe = radar_state.subscribe(({ radar_state }) => {
      if (radar_state.timestamp !== lastTimestamp) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          lastTimestamp = radar_state.timestamp ?? 0;
          updateRadarLayer(radar_state.timestamp);
        }, 300);
      }
    });
  });

  onDestroy(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    unsubscribe && unsubscribe();
  });
</script>

<!-- Radar layer handled through map updates, no additional markup required -->