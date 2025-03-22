<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
  
    import { current_lat_long } from '$lib/stores/current_location';
    import { loadRainViewerData } from '$lib/mapUpdater';
    import { loadRouteData, resetUAVUpdater } from '$lib/uavUpdater';
    import { updateTrackData } from '$lib/trackDataUpdater';
    import { trackDataStore } from '$lib/stores/trackData'; // For callsign, selected, etc.
  
    function colorFromCombatStatus(status: 'Neutral' | 'Friendly' | 'Enemy'): string {
      switch (status) {
        case 'Friendly': return '#00ff00';
        case 'Enemy':    return '#ff0000';
        default:         return '#ffffff'; // Neutral
      }
    }
  
    let map: maplibregl.Map;
    let mapElement: HTMLElement;
    let initialView = { lat: 39.8283, long: -98.5795 };
  
    // We'll store the final marker + coordinate
    let finalMarker: maplibregl.Marker | null = null;
    let finalMarkerCoord: [number, number] | null = null;
  
    // Props controlling layers
    const { showRadarLayer = true, showUAVLayer = false } = $$props;
  
    /**
     * A helper to set/update the "callsign label" on the map using a symbol layer.
     * We store a single point feature with property "callsign".
     */
    function updateCallsignLabel(callsign: string, coord: [number, number]) {
      const sourceId = 'final-marker-label';
      const layerId = 'final-marker-label-layer';
  
      // Our single-feature data
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
  
      // If we haven't added this source/layer yet, add them
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: 'geojson', data: geojsonData });
  
        map.addLayer({
          id: layerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'text-field': ['get', 'callsign'],
            'text-size': 14,
            'text-offset': [1, 0],         // shift label to the right
            'text-anchor': 'left',        // anchor on the left side
            'text-allow-overlap': true    // so it doesn't disappear
          },
          paint: {
            'text-color': '#ffffff'
          }
        });
      } else {
        // If the source already exists, just update its data
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojsonData);
      }
    }
  
    /**
     * Re-create final marker if user changes combatStatus, preserving coordinate.
     * Then re-update the label to match the callsign in the store.
     */
    function recreateFinalMarker(newStatus: 'Neutral' | 'Friendly' | 'Enemy') {
      if (!map || !finalMarkerCoord) return;
  
      // remove old marker if exists
      finalMarker?.remove();
  
      // figure out callsign from trackData store
      const data = $trackDataStore;
      const callsign = data?.callsign || 'Unknown';
  
      // create marker with the new color
      finalMarker = new maplibregl.Marker({
        color: colorFromCombatStatus(newStatus),
        draggable: false
      })
        .setLngLat(finalMarkerCoord)
        .addTo(map);
  
      // set the marker to be clickable
      finalMarker.getElement().style.cursor = 'pointer';
  
      // on marker click, set trackData.selected = true and do an update
      finalMarker.getElement().addEventListener('click', e => {
        console.log('Marker clicked!');
        trackDataStore.update(d => ({ ...d, selected: true }));
        updateTrackData();
        e.stopPropagation();
      });
  
      // also update the callsign label next to the marker
      updateCallsignLabel(callsign, finalMarkerCoord);
    }

    function createCustomMarkerElement() {
      const el = document.createElement('div');
      el.classList.add('h-5', 'w-5', 'bg-neutral-700', 'border-[3px]', 'border-white', 'rounded-full');
      return el;
    }
  
    /**
     * Called by UAV Updater when it has a final marker. We remove that marker
     * and re-create it with the correct color, plus set up the label.
     */
    function handleMarkerCreate(marker: maplibregl.Marker) {
      // remove old marker if any
      finalMarker?.remove();
  
      // store coordinate
      finalMarkerCoord = marker.getLngLat().toArray() as [number, number];
  
      // read user’s current track data store
      const data = $trackDataStore;
      let status: 'Neutral' | 'Friendly' | 'Enemy' = data?.combatStatus || 'Neutral';
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
  
      // also add the callsign label next to it
      updateCallsignLabel(callsign, finalMarkerCoord);
    }
  
    // subscribe to trackDataStore, if user changes status or callsign => re-create marker
    const unsub = trackDataStore.subscribe(d => {
      if (!finalMarkerCoord || !map) return;
      // if callsign or combatStatus changed, re-create
      // (You could be more selective if you want)
      const status = d?.combatStatus || 'Neutral';
      recreateFinalMarker(status);
    });
  
    onMount(() => {
      // geolocation
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
  
      // create the map
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
        if (showUAVLayer) {
          resetUAVUpdater();
          loadRouteData(map, handleMarkerCreate);
        }
      });
  
      // if user clicks away from final marker => unselect track data
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
        if (map) {
            map.remove();
        }
    });
  </script>
  
  <div out:flyAndScale class="h-full w-full absolute top-0 left-0" bind:this={mapElement}></div>
  
  <style>
  /* optional style here */
  </style>
  