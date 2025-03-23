<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import { resetUAVUpdater, loadRouteData } from '$lib/uavUpdater';
  import { updateTrackData } from '$lib/trackDataUpdater';
  import { trackDataStore } from '$lib/stores/trackData';
  // Import FOV utilities
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

  // Remove UAV line and label layers (if present)
  function clearUAVLayers() {
    const sourcesAndLayers = [
      { source: 'uav-center-line', layer: 'uav-center-line-layer' },
      { source: 'final-marker-label', layer: 'final-marker-label-layer' }
    ];
    sourcesAndLayers.forEach(({ source, layer }) => {
      if (map.getLayer(layer)) {
        map.removeLayer(layer);
      }
      if (map.getSource(source)) {
        map.removeSource(source);
      }
    });
  }

  // Update or add the UAV label with the current callsign
  function updateCallsignLabel(coord: [number, number]) {
    clearUAVLayers();
    const sourceId = 'final-marker-label';
    const layerId  = 'final-marker-label-layer';
    // Get the current callsign from the store (fallback to 'Unknown')
    const { callsign = 'Unknown' } = get(trackDataStore) || {};

    const geojsonData = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { callsign },
        geometry: { type: 'Point', coordinates: coord }
      }]
    };

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
  }

  // Draw a line from the UAV marker to the image-frame center
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

    // If the source exists, update it; otherwise, add it.
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

  // Recreate the final marker using the latest UAV data and callsign.
  function recreateFinalMarker(newStatus: 'Neutral' | 'Friendly' | 'Enemy') {
    if (!map || !finalMarkerCoord) return;
    if (finalMarker) {
      finalMarker.remove();
      finalMarker = null;
    }
    const { callsign = 'Unknown' } = get(trackDataStore) || {};

    finalMarker = new maplibregl.Marker({
      color: colorFromCombatStatus(newStatus),
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

  // When the UAV updater creates an initial marker.
  function handleMarkerCreate(marker: maplibregl.Marker) {
    console.log('UAV marker created:', marker.getLngLat().toArray());
    // Remove the UAV-provided marker
    marker.remove();
    // Remove any existing final marker
    if (finalMarker) {
      finalMarker.remove();
      finalMarker = null;
    }
    // Store new coordinate
    finalMarkerCoord = marker.getLngLat().toArray() as [number, number];
    const { combatStatus = 'Neutral' } = get(trackDataStore) || {};

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
      // Update marker if UAV data changes.
      if (finalMarkerCoord) {
        const status = d?.combatStatus || 'Neutral';
        recreateFinalMarker(status);
      }
      // Draw the line to the image frame center.
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

<!-- UAVLayer does not render visible DOM elements; it manages UAV map layers -->
