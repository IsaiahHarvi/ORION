<!-- Map.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
  
    import { current_lat_long } from '$lib/stores/current_location';
    import { loadRainViewerData } from '$lib/mapUpdater';
    import { loadRouteData, resetUAVUpdater } from '$lib/uavUpdater';
    import { radar_state } from '$lib/runes/current_radar.svelte';
    import { fade } from 'svelte/transition';
  
    import { updateTrackData } from '$lib/trackDataUpdater';
    import { trackDataStore } from '$lib/stores/trackData';
  
    // If you want to keep the imageFrame polygon overlay:
    import { buildFramePolygon, showFramePolygon } from '$lib/utils/frameCoverage';
  
    /**
     * Convert a combat status to a color for the UAV marker.
     */
    function colorFromCombatStatus(status: 'Neutral' | 'Friendly' | 'Enemy'): string {
      switch (status) {
        case 'Friendly': return '#00ff00'; // green
        case 'Enemy':    return '#ff0000'; // red
        default:         return '#ffffff'; // white for neutral
      }
    }
  
    let map: maplibregl.Map;
    let mapElement: HTMLElement;
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

    let finalMarker: maplibregl.Marker | null = null;
    let finalMarkerCoord: [number, number] | null = null;
  
    /**
     * Adds or updates a line from UAV -> imageFrame center
     */
    function drawUavToCenterLine(
      map: maplibregl.Map,
      uavCoord: [number, number],
      centerCoord: [number, number],
      lineSourceId = 'uav-center-line',
      lineLayerId = 'uav-center-line-layer'
    ) {
      // Build a line with two coordinates
      const lineFeature = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            uavCoord,        // [lon, lat] of UAV
            centerCoord      // [lon, lat] of the image-frame center
          ]
        },
        properties: {}
      };
  
      const lineFC = {
        type: 'FeatureCollection',
        features: [lineFeature]
      };
  
      // Create or update the line source/layer
      if (!map.getSource(lineSourceId)) {
        map.addSource(lineSourceId, { type: 'geojson', data: lineFC });
        map.addLayer({
          id: lineLayerId,
          type: 'line',
          source: lineSourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#FFFF00',  // <— bright yellow
            'line-width': 3
          }
        });
      } else {
        (map.getSource(lineSourceId) as maplibregl.GeoJSONSource).setData(lineFC);
      }
    }
  
    /**
     * Create or update a label on the map for the UAV callsign, using a symbol layer.
     */
    function updateCallsignLabel(callsign: string, coord: [number, number]) {
      const sourceId = 'final-marker-label';
      const layerId  = 'final-marker-label-layer';
  
      const geojsonData = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { callsign },
            geometry: { type: 'Point', coordinates: coord }
          }
        ]
      };
  
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: 'geojson', data: geojsonData });
        map.addLayer({
          id: layerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'text-field': ['get', 'callsign'],
            'text-size': 14,
            'text-offset': [1, 0],
            'text-anchor': 'left',
            'text-allow-overlap': true
          },
          paint: {
            'text-color': '#ffffff'
          }
        });
      } else {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojsonData);
      }
    }
  
    /**
     * Re-create the final marker if user changes status or callsign, preserving finalMarkerCoord.
     */
    function recreateFinalMarker(newStatus: 'Neutral' | 'Friendly' | 'Enemy') {
      if (!map || !finalMarkerCoord) return;
  
      // remove old marker
      finalMarker?.remove();
  
      // read track data store to get callsign
      const data = $trackDataStore;
      const callsign = data?.callsign || 'Unknown';
  
      // create a new marker with the updated color
      finalMarker = new maplibregl.Marker({
        color: colorFromCombatStatus(newStatus),
        draggable: false
      })
        .setLngLat(finalMarkerCoord)
        .addTo(map);
  
      // make pointer
      finalMarker.getElement().style.cursor = 'pointer';
  
      // on marker click => set trackData.selected = true
      finalMarker.getElement().addEventListener('click', e => {
        console.log('Marker clicked!');
        trackDataStore.update(d => ({ ...d, selected: true }));
        // Optionally refresh data from server
        updateTrackData();
        e.stopPropagation();
      });
  
      // label for callsign
      updateCallsignLabel(callsign, finalMarkerCoord);
    }
  
    /**
     * Called by loadRouteData(...) once it locates a "final" UAV point to mark.
     */
    function handleMarkerCreate(marker: maplibregl.Marker) {
      // remove old marker
      finalMarker?.remove();
  
      // store new coordinate
      finalMarkerCoord = marker.getLngLat().toArray() as [number, number];
  
      // read track data for status/callsign
      const data = $trackDataStore;
      const status: 'Neutral' | 'Friendly' | 'Enemy' = data?.combatStatus || 'Neutral';
      const callsign = data?.callsign || 'Unknown';
  
      // remove the UAV-provided marker
      marker.remove();
  
      // create our final marker
      finalMarker = new maplibregl.Marker({
        color: colorFromCombatStatus(status),
        draggable: false
      })
        .setLngLat(finalMarkerCoord)
        .addTo(map);
  
      finalMarker.getElement().style.cursor = 'pointer';
  
      finalMarker.getElement().addEventListener('click', e => {
        console.log('Marker clicked!');
        trackDataStore.update(d => ({ ...d, selected: true }));
        updateTrackData();
        e.stopPropagation();
      });
  
      // label
      updateCallsignLabel(callsign, finalMarkerCoord);
    }
  
    // Subscribe to trackDataStore => re-create marker if needed & draw the line to imageFrame center
    const unsub = trackDataStore.subscribe(d => {
      if (!map) return;
  
      // 1) If we already have finalMarkerCoord, re-create marker if status/callsign changed
      if (finalMarkerCoord) {
        const status = d?.combatStatus || 'Neutral';
        recreateFinalMarker(status);
      }
  
      // 2) If the user has an imageFrame center AND we have finalMarkerCoord => draw line
      if (finalMarkerCoord && d?.imageFrame?.center) {
        const { lat: centerLat, lon: centerLon } = d.imageFrame.center;
        // UAV: finalMarkerCoord is [lon, lat]
        // center: [centerLon, centerLat]
        drawUavToCenterLine(map, finalMarkerCoord, [centerLon, centerLat]);
      } else {
        // optional: remove the line if no center
        // e.g. if (map.getLayer('uav-center-line-layer')) map.removeLayer('uav-center-line-layer');
        //      if (map.getSource('uav-center-line'))      map.removeSource('uav-center-line');
      }
  
      // 3) If we want to show the imageFrame polygon corners
      if (d.imageFrame && d.imageFrame.ulc && d.imageFrame.urc && d.imageFrame.lrc && d.imageFrame.llc) {
        const { center, ulc, urc, lrc, llc } = d.imageFrame;
        const framePoly = buildFramePolygon(ulc, urc, lrc, llc);
        showFramePolygon(map, framePoly, center);
      }
    });
  
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
  
      // create map
      map = new maplibregl.Map({
        container: mapElement,
        style: "https://api.maptiler.com/maps/0195bee2-9b1b-7b54-b0c9-fb330ebe7162/style.json?key=rIQyeDoL1FNvjM5uLY2f",
        center: [initialView.long, initialView.lat],
        zoom: 8,
        attributionControl: false,
        fadeDuration: 0
    });

      map.on('load', () => {
        // load radar
            if (showRadarLayer) {
                loadRainViewerData(map);
            }
            // load UAV route
            if (showUAVLayer) {
                resetUAVUpdater();
                loadRouteData(map, handleMarkerCreate);
  
          // do an immediate fetch of track data
          updateTrackData();
        }
      });
  
      // if user clicks the map away from the final marker => unselect track data
      map.on('click', e => {
        if (finalMarker && e.originalEvent.target !== finalMarker.getElement()) {
          trackDataStore.update(d => ({ ...d, selected: false }));
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
      unsub();
      if (map) {
        map.remove();
      }
    });
</script>
  
<div in:fade={{ duration: 150, delay: 300 }} class="h-full w-full absolute top-0 left-0" bind:this={mapElement}></div>

<style>
/* Additional styling if needed */
</style>
