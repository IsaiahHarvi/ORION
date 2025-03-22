<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { current_lat_long } from '$lib/stores/current_location';

    let map: any;
    let mapElement: HTMLElement;
    let initialView = { lat: 39.8283, long: -98.5795 };
    
    let { showRadarLayer = true }: { showRadarLayer: boolean } = $props();
    
    let radarLayers: { id: string; time: number }[] = [];
    let animationPosition = 0;
    let animationTimer: number | null = null;
    
    const FRAME_COUNT = 1;
    const FRAME_DELAY = 1500;
    const RESTART_DELAY = 1000;
    const COLOR_SCHEME = 7;

    let isPlaying = true;

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
    
</style>