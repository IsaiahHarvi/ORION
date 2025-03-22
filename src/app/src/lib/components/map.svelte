<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { current_lat_long } from '$lib/stores/current_location';
  
    let map: any;
    let mapElement: HTMLElement;
    let initialView = { lat: 39.8283, long: -98.5795 };
  
    let { showRadarLayer = true }: { showRadarLayer: boolean } = $props();
  
    // Radar-related variables (unchanged)
    let radarLayers: { id: string; time: number }[] = [];
    let animationPosition = 0;
    let animationTimer: number | null = null;
    const FRAME_COUNT = 1;
    const FRAME_DELAY = 1500;
    const RESTART_DELAY = 1000;
    const COLOR_SCHEME = 7;
    let isPlaying = true;
  
    // GeoJSON for the route (LineString)
    let routeGeoJSON = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [] // Updated with interpolated coordinates
          },
          properties: {}
        }
      ]
    };
  
    // Accumulate all route points over time.
    let accumulatedRoutePoints: number[][] = [];
    // Store the last update's timestamp (in ms) to avoid duplicate appends.
    let lastUpdateTime: number | null = null;
  
    // Marker to highlight the most recent point.
    let latestMarker: maplibregl.Marker | null = null;
  
    // Helper: Linear interpolation between two coordinates.
    // Returns an array of intermediate points (including the start but excluding the end).
    function interpolateBetween(p1: number[], p2: number[], segments: number): number[][] {
      const result: number[][] = [];
      const [lon1, lat1] = p1;
      const [lon2, lat2] = p2;
      for (let j = 0; j < segments; j++) {
        const t = j / segments;
        const lon = lon1 + (lon2 - lon1) * t;
        const lat = lat1 + (lat2 - lat1) * t;
        result.push([lon, lat]);
      }
      return result;
    }
  
    // Helper: Interpolate between an array of [lon, lat] points.
    // 'segments' defines how many segments to generate between two points.
    function interpolateCoordinates(coords: number[][], segments: number = 10): number[][] {
      const result: number[][] = [];
      for (let i = 0; i < coords.length - 1; i++) {
        result.push(...interpolateBetween(coords[i], coords[i + 1], segments));
      }
      if (coords.length > 0) {
        result.push(coords[coords.length - 1]);
      }
      return result;
    }
  
    // --- Radar functions (unchanged) ---
    function nextFrame(): void {
      if (!radarLayers.length) return;
      if (radarLayers[animationPosition]) {
        map.setLayoutProperty(radarLayers[animationPosition].id, 'visibility', 'none');
      }
      animationPosition = (animationPosition + 1) % radarLayers.length;
      if (radarLayers[animationPosition]) {
        map.setLayoutProperty(radarLayers[animationPosition].id, 'visibility', 'visible');
        const timestamp = document.getElementById('radar-timestamp');
        if (timestamp) {
          timestamp.textContent = formatTimestamp(radarLayers[animationPosition].time * 1000);
        }
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
          progressBar.style.width = `${((animationPosition + 1) / radarLayers.length) * 100}%`;
        }
      }
      if (animationPosition === radarLayers.length - 1) {
        clearInterval(animationTimer!);
        setTimeout(() => {
          if (isPlaying) {
            animationTimer = setInterval(nextFrame, FRAME_DELAY);
          }
        }, RESTART_DELAY - FRAME_DELAY);
      }
    }
  
    function formatTimestamp(timestamp: number): string {
      const date = new Date(timestamp);
      const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${weekday[date.getDay()]} ${month[date.getMonth()]} ${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
  
    function loadRainViewerData(): void {
      fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then(res => res.json())
        .then(data => {
          radarLayers.forEach(layer => {
            if (map.getLayer(layer.id)) map.removeLayer(layer.id);
            if (map.getSource(layer.id)) map.removeSource(layer.id);
          });
          radarLayers = [];
          const radarFrames = data.radar.past.slice(-FRAME_COUNT);
          radarFrames.forEach((frame, index) => {
            const layerId = `radar-layer-${index}`;
            const frameTime = frame.time;
            map.addSource(layerId, {
              type: 'raster',
              tiles: [`https://tilecache.rainviewer.com/v2/radar/${frameTime}/256/{z}/{x}/{y}/${COLOR_SCHEME}/1_0.png`],
              tileSize: 256
            });
            map.addLayer({
              id: layerId,
              type: 'raster',
              source: layerId,
              layout: { visibility: index === 0 ? 'visible' : 'none' },
              paint: { 'raster-opacity': 0.8 }
            });
            radarLayers.push({ id: layerId, time: frameTime });
          });
          animationPosition = 0;
          const timestamp = document.getElementById('radar-timestamp');
          if (timestamp && radarLayers[0]) {
            timestamp.textContent = formatTimestamp(radarLayers[0].time * 1000);
          }
          if (isPlaying) {
            clearInterval(animationTimer!);
            animationTimer = setInterval(nextFrame, FRAME_DELAY);
          }
          setTimeout(loadRainViewerData, 5 * 60 * 1000);
        })
        .catch(() => setTimeout(loadRainViewerData, 30 * 1000));
    }
    // --- End radar functions ---
  
    // Polls the observation API and updates the accumulated route.
    function loadRouteData(): void {
      fetch('https://api.georobotix.io/ogc/t18/api/datastreams/iabpf1ivua1qm/observations')
        .then(res => res.json())
        .then(data => {
          let items = data.items || [];
          // Sort items by phenomenonTime (oldest first)
          items.sort((a, b) => new Date(a.phenomenonTime).getTime() - new Date(b.phenomenonTime).getTime());
  
          // If there are no items, skip updating.
          if (items.length === 0) return;
  
          // Get the phenomenonTime of the last observation (in ms)
          const newLastTime = new Date(items[items.length - 1].phenomenonTime).getTime();
  
          // If the last update time hasn't changed, do nothing.
          if (lastUpdateTime !== null && newLastTime === lastUpdateTime) {
            return;
          }
          lastUpdateTime = newLastTime;
  
          // Extract new coordinates from the sorted items.
          const newCoordinates: number[][] = items
            .map(item => {
              const center = item.result?.geoRef?.center;
              return center && center.lat && center.lon ? [center.lon, center.lat] : null;
            })
            .filter(coord => coord !== null) as number[][];
  
          // Append only new points that differ from the last accumulated point.
          newCoordinates.forEach(coord => {
            const last = accumulatedRoutePoints[accumulatedRoutePoints.length - 1];
            if (!last || Math.abs(last[0] - coord[0]) > 0.00001 || Math.abs(last[1] - coord[1]) > 0.00001) {
              accumulatedRoutePoints.push(coord);
            }
          });
  
          // Interpolate between all accumulated points.
          const interpolatedCoordinates = interpolateCoordinates(accumulatedRoutePoints, 10);
  
          // Update the GeoJSON route.
          routeGeoJSON.features[0].geometry.coordinates = interpolatedCoordinates;
          if (map.getSource("route")) {
            (map.getSource("route") as maplibregl.GeoJSONSource).setData(routeGeoJSON);
          } else {
            map.addSource("route", {
              type: "geojson",
              data: routeGeoJSON
            });
            // Add an outline layer for the route.
            map.addLayer({
              id: "route-layer-outline",
              type: "line",
              source: "route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": "#212d4f", "line-width": 10 }
            });
            // Add the main route layer.
            map.addLayer({
              id: "route-layer",
              type: "line",
              source: "route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": "#6084eb", "line-width": 8 }
            });
          }
  
          // Place a red marker at the most recent raw point.
          if (accumulatedRoutePoints.length > 0) {
            const latestCoord = accumulatedRoutePoints[accumulatedRoutePoints.length - 1];
            if (latestMarker) {
              latestMarker.remove();
            }
            latestMarker = new maplibregl.Marker({ color: "#ff0000", draggable: false })
              .setLngLat(latestCoord)
              .addTo(map);
          }
        })
        .catch(err => console.error("Error loading route data:", err))
        .finally(() => {
          // Poll again after 5 seconds (adjust delay as needed)
          setTimeout(loadRouteData, 5000);
        });
    }
  
    onMount(() => {
      if (typeof window !== 'undefined') {
        navigator.geolocation.getCurrentPosition(({ coords }) => {
          current_lat_long.set({ lat: coords.latitude, long: coords.longitude });
          if (map) {
            map.flyTo({ center: [coords.longitude, coords.latitude], zoom: 8, essential: true });
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
        if (showRadarLayer) loadRainViewerData();
        // Start polling for route data.
        loadRouteData();
      });
    });
  
    onDestroy(() => {
      if (map) {
        if (animationTimer) clearInterval(animationTimer);
        map.remove();
      }
    });
  </script>
  
  <div class="h-full w-full" bind:this={mapElement}></div>
  
  <style>
    /* Additional styling can go here */
  </style>
  