import maplibregl from 'maplibre-gl';
import { radar_state } from '$lib/runes/current_radar.svelte';

export interface RadarLayer {
  id: string;
  time: number;
}

export let radarLayers: RadarLayer[] = [];
export let animationPosition = 0;
export let animationTimer: number | null = null;
export const FRAME_COUNT = 1;
export const FRAME_DELAY = 1500;
export const RESTART_DELAY = 1000;
export const COLOR_SCHEME = 7;
export let isPlaying = true;

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${weekday[date.getDay()]} ${month[date.getMonth()]} ${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function nextFrame(map: any): void {
  // Update global radar state
  radar_state.radar_state = { timestamp: radarLayers[animationPosition]?.time };

  if (!radarLayers.length) return;
  if (radarLayers[animationPosition]) {
    map.setLayoutProperty(radarLayers[animationPosition].id, 'visibility', 'none');
  }
  animationPosition = (animationPosition + 1) % radarLayers.length;
  if (radarLayers[animationPosition]) {
    map.setLayoutProperty(radarLayers[animationPosition].id, 'visibility', 'visible');
    const timestampEl = document.getElementById('radar-timestamp');
    if (timestampEl) {
      timestampEl.textContent = formatTimestamp(radarLayers[animationPosition].time * 1000);
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
        animationTimer = setInterval(() => nextFrame(map), FRAME_DELAY);
      }
    }, RESTART_DELAY - FRAME_DELAY);
  }
}

export function loadRainViewerData(map: any, timestamp?: number): void {
  fetch('https://api.rainviewer.com/public/weather-maps.json')
    .then(res => res.json())
    .then(data => {
      radarLayers.forEach(layer => {
        if (map.getLayer(layer.id)) map.removeLayer(layer.id);
        if (map.getSource(layer.id)) map.removeSource(layer.id);
      });
      radarLayers = [];
      const radarFrames = data.radar.past.slice(-FRAME_COUNT);
      radarFrames.forEach((frame: any, index: number) => {
        const layerId = `radar-layer-${index}`;
        let frameTime = frame.time;
        if (timestamp) {
          frameTime = timestamp;
        }
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
        radarLayers.push({ id: layerId, time: frame.time });
      });
      animationPosition = 0;
      const timestampEl = document.getElementById('radar-timestamp');
      if (timestampEl && radarLayers[0]) {
        timestampEl.textContent = formatTimestamp(radarLayers[0].time * 1000);
      }
      if (isPlaying) {
        clearInterval(animationTimer!);
        animationTimer = setInterval(() => nextFrame(map), FRAME_DELAY);
      }
      setTimeout(() => loadRainViewerData(map), 5 * 60 * 1000);
    })
    .catch(() => setTimeout(() => loadRainViewerData(map), 30 * 1000));
}
