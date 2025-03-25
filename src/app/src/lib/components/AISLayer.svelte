<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type maplibregl from 'maplibre-gl';
    import { loadAISData, resetAISUpdater } from '$lib/ais-updater';
  
    export let map: maplibregl.Map;
  
    onMount(() => {
        resetAISUpdater();
        loadAISData(map);
    });
  
    onDestroy(() => {
        resetAISUpdater();
    });
</script>
  