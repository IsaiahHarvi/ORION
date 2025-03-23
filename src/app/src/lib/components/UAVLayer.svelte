<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import { resetUAVUpdater, loadRouteData } from '$lib/uavUpdater';
  import { updateTrackData } from '$lib/trackDataUpdater';
  import { trackDataStore } from '$lib/stores/trackData';
  // Import the FOV utilities
  import { buildFramePolygon, showFramePolygon } from '$lib/utils/frameCoverage';
  import { get } from 'svelte/store';

  export let map: maplibregl.Map;

  let finalMarker: maplibregl.Marker | null = null;
  let finalMarkerCoord: [number, number] | null = null;
  let unsub: () => void;

  function colorFromCombatStatus(status: 'Neutral' | 'Friendly' | 'Enemy'): string {
    switch (status) {
      case 'Friendly': return '#00ff00';
      case 'Enemy':    return '#ff0000';
      default:         return '#ffffff';
    }
  }

  function updateCallsignLabel(coord: [number, number]) {
    const sourceId = 'final-marker-label';
    const layerId  = 'final-marker-label-layer';
    // Get the current callsign from the store (fallback to 'Unknown')
    const { callsign = 'Unknown' } = get(trackDataStore) || {};

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
        paint: { 'text-color': '#ffffff' }
      });
    } else {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojsonData);
    }
  }

  function drawUavToCenterLine(
    uavCoord: [number, number],
    centerCoord: [number, number],
    lineSourceId = 'uav-center-line',
    lineLayerId = 'uav-center-line-layer'
  ) {
    const lineFeature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [uavCoord, centerCoord]
      },
      properties: {}
    };

    const lineFC = {
      type: 'FeatureCollection',
      features: [lineFeature]
    };

    if (!map.getSource(lineSourceId)) {
      map.addSource(lineSourceId, { type: 'geojson', data: lineFC });
      map.addLayer({
        id: lineLayerId,
        type: 'line',
        source: lineSourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#FFFF00', 'line-width': 3 }
      });
    } else {
      (map.getSource(lineSourceId) as maplibregl.GeoJSONSource).setData(lineFC);
    }
  }

  // When recreating the final marker, pull the updated callsign from the store.
  function recreateFinalMarker(newStatus: 'Neutral' | 'Friendly' | 'Enemy') {
    if (!map || !finalMarkerCoord) return;
    finalMarker?.remove();

    const { callsign = 'Unknown' } = get(trackDataStore) || {};

    finalMarker = new maplibregl.Marker({
      color: colorFromCombatStatus(newStatus),
      draggable: false
    })
      .setLngLat(finalMarkerCoord)
      .addTo(map);

    finalMarker.getElement().style.cursor = 'pointer';
    finalMarker.getElement().addEventListener('click', e => {
      // On click, update the track data to mark this UAV as selected
      trackDataStore.update(d => ({ ...d, selected: true }));
      updateTrackData();
      e.stopPropagation();
    });

    updateCallsignLabel(finalMarkerCoord);
  }

  // Callback when the UAV updater creates an initial marker.
  function handleMarkerCreate(marker: maplibregl.Marker) {
    console.log('UAV marker created:', marker.getLngLat().toArray());
    // Remove the UAV-provided marker
    marker.remove();
    // Store new coordinate
    finalMarkerCoord = marker.getLngLat().toArray() as [number, number];
    // Get initial status and callsign from store
    const { combatStatus = 'Neutral', callsign = 'Unknown', imageFrame } = get(trackDataStore) || {};

    // Create the final marker
    finalMarker = new maplibregl.Marker({
      color: colorFromCombatStatus(combatStatus),
      draggable: false
    })
      .setLngLat(finalMarkerCoord)
      .addTo(map);

    finalMarker.getElement().style.cursor = 'pointer';
    finalMarker.getElement().addEventListener('click', e => {
      trackDataStore.update(d => ({ ...d, selected: true }));
      updateTrackData();
      e.stopPropagation();
    });

    updateCallsignLabel(finalMarkerCoord);
  }

  onMount(() => {
    resetUAVUpdater();
    console.log("UAVLayer onMount: map.isStyleLoaded =", map.isStyleLoaded());
    
    if (!map.isStyleLoaded()) {
      map.on('load', () => {
        console.log("Map loaded, starting UAV updater");
        loadRouteData(map, handleMarkerCreate);
        updateTrackData();
      });
    } else {
      console.log("Map style already loaded, starting UAV updater immediately");
      loadRouteData(map, handleMarkerCreate);
      updateTrackData();
    }
    
    unsub = trackDataStore.subscribe(d => {
      if (!map) return;
      if (finalMarkerCoord) {
        const status = d?.combatStatus || 'Neutral';
        recreateFinalMarker(status);
      }
      if (finalMarkerCoord && d?.imageFrame?.center) {
        const { lat: centerLat, lon: centerLon } = d.imageFrame.center;
        drawUavToCenterLine(finalMarkerCoord, [centerLon, centerLat]);
      }
      // Draw the FOV polygon if imageFrame corners exist.
      if (d.imageFrame && d.imageFrame.ulc && d.imageFrame.urc && d.imageFrame.lrc && d.imageFrame.llc) {
        const { center, ulc, urc, lrc, llc } = d.imageFrame;
        const framePoly = buildFramePolygon(ulc, urc, lrc, llc);
        showFramePolygon(map, framePoly, center);
      }
    });
  });

  onDestroy(() => {
    unsub && unsub();
  });
</script>

<!-- This component doesn’t render visible DOM elements; it only manages UAV map layers. -->
