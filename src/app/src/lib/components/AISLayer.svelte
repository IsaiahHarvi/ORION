<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type maplibregl from 'maplibre-gl';
    import { loadAISData, resetAISUpdater } from '$lib/aisUpdater';
  
    export let map: maplibregl.Map;
  
    onMount(() => {
      console.log("AISLayer mounted"); // Debug log
      resetAISUpdater();
      loadAISData(map);
    });
  
    onDestroy(() => {
      resetAISUpdater();
    });
</script>
  