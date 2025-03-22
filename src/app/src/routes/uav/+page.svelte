<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { current_lat_long } from '$lib/stores/current_location';
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import Map from '$lib/components/map.svelte';
    import TrackData from '$lib/components/track-data.svelte';
  </script>
  
  <div class="relative h-screen w-screen">
    <Map />
    <!-- Position the TrackData component on top of the map (e.g., top-left corner) -->
    <div class="absolute top-4 left-4">
      <TrackData />
    </div>
  </div>
  
  <style>
    /* Any additional page-level styles */
  </style>
  