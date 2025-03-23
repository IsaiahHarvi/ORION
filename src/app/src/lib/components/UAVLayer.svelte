<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import { resetUAVUpdater, loadRouteData, createUAVMarkerElement } from '$lib/uavUpdater';
  import { updateTrackData } from '$lib/trackDataUpdater';
  import { trackDataStore } from '$lib/stores/trackData';
  import { buildFramePolygon, showFramePolygon, drawUavToCenterLine } from '$lib/utils/frameCoverage';
  import { get } from 'svelte/store';

  export let map: maplibregl.Map;

  let finalMarker: maplibregl.Marker | null = null;
  let finalMarkerCoord: [number, number] | null = null;
  let unsub: () => void;

  // Instead of using a color option on marker creation,
  // we now create the UAV marker with our UAV icon tinted based on combat status.
  function recreateFinalMarker(newStatus: 'Neutral' | 'Friendly' | 'Enemy') {
    if (!map || !finalMarkerCoord) return;
    if (finalMarker) {
      finalMarker.remove();
      finalMarker = null;
    }
    finalMarker = new maplibregl.Marker({
      element: createUAVMarkerElement(newStatus),
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

  function handleMarkerCreate(marker: maplibregl.Marker) {
    console.log('UAV marker created:', marker.getLngLat().toArray());
    marker.remove();
    if (finalMarker) {
      finalMarker.remove();
      finalMarker = null;
    }
    finalMarkerCoord = marker.getLngLat().toArray() as [number, number];
    const { combatStatus = 'Neutral' } = get(trackDataStore) || {};

    finalMarker = new maplibregl.Marker({
      element: createUAVMarkerElement(combatStatus),
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

  // The rest of your code remains the same...
  function clearUAVLayers() {
    if (!map.isStyleLoaded()) {
      setTimeout(clearUAVLayers, 300);
      return;
    }
    const layersToClear = [
      { source: 'uav-center-line', layer: 'uav-center-line-layer' },
      { source: 'final-marker-label', layer: 'final-marker-label-layer' }
    ];
    layersToClear.forEach(({ source, layer }) => {
      if (map.getLayer(layer)) {
        try {
          map.removeLayer(layer);
        } catch (e) {
          console.warn(`Error removing layer ${layer}:`, e);
        }
      }
      if (map.getSource(source)) {
        try {
          map.removeSource(source);
        } catch (e) {
          console.warn(`Error removing source ${source}:`, e);
        }
      }
    });
  }

  function updateCallsignLabel(coord: [number, number]) {
    if (!map.isStyleLoaded()) {
      setTimeout(() => updateCallsignLabel(coord), 300);
      return;
    }
    clearUAVLayers();
    const sourceId = 'final-marker-label';
    const layerId  = 'final-marker-label-layer';
    const { callsign = 'Unknown' } = get(trackDataStore) || {};

    const geojsonData = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { callsign },
        geometry: { type: 'Point', coordinates: coord }
      }]
    };

    try {
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
    } catch (e) {
      console.error("Error updating call sign label:", e);
    }
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
        if (map.isStyleLoaded()) {
          drawUavToCenterLine(map, finalMarkerCoord, [centerLon, centerLat]);
          if (d.imageFrame.ulc && d.imageFrame.urc && d.imageFrame.lrc && d.imageFrame.llc) {
            const { center, ulc, urc, lrc, llc } = d.imageFrame;
            const framePoly = buildFramePolygon(ulc, urc, lrc, llc);
            showFramePolygon(map, framePoly, center);
          }
        }
      }
    });
  });

  onDestroy(() => {
    unsub && unsub();
  });
</script>
