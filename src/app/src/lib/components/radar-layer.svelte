<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import { current_lat_long } from '$lib/stores/current_location';
    import radarIcon from '$lib/icons/radar-icon.png';
	import { flyAndScale } from '$lib/utils';
	import X from '@lucide/svelte/icons/x';
    const { map } = $props();

    let radarMarkers: maplibregl.Marker[] = [];
    let radars = $state([]);

    onMount(async () => {
        const key = `radars_${$current_lat_long.lat ?? 0}_${$current_lat_long.long ?? 0}`;
        const apiUrl = import.meta.env.VITE_API_URL;
        let cached = sessionStorage.getItem(key);
        
        if (cached) {
            radars = JSON.parse(cached);
        } else {
            const res = await fetch(`${apiUrl}/radars/${$current_lat_long.lat ?? 0}/${$current_lat_long.long ?? 0}`);
            radars = await res.json();
            sessionStorage.setItem(key, JSON.stringify(radars));
        }

        radars.forEach((radar: { distance: number; lat: number; lon: number; radar_id: string; open: boolean; }) => {
            const el = markerElement(radar);
            el.title = radar.radar_id;
            const marker = new maplibregl.Marker({ element: el })
            .setLngLat([radar.lon, radar.lat])
            .addTo(map);
            radarMarkers.push(marker);
        });
    });

    onDestroy(() => {
        radarMarkers.forEach(marker => marker.remove());
    });

    function markerElement(radar): HTMLElement {
        const el = document.createElement('img');
        el.className = 'uav-marker';
        el.src = radarIcon;
        el.alt = 'UAV';
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.display = 'block';
        el.style.mixBlendMode = 'luminosity';

        el.addEventListener('click', () => {
            radar.open = !radar.open ?? false;
        })

        return el;
    }
</script>

{#each radars as radar (radar.radar_id)}
    {#if radar.open}
        <div transition:flyAndScale class="bg-neutral-900 absolute top-4 left-4 mt-16 border shadow-lg pointer-events-auto rounded-lg p-4 w-full lg:w-[27.5rem] text-white">
            <button class="absolute top-4 right-4" onclick={() => {
                radar.open = false;
            }}>
                <X class="hover:text-white/40 duration-200 text-white/70" size={18} />
            </button>
            <h2 class="text-xl font-bold">{radar.radar_id}</h2>
            <div class="mt-4">
            <div class="grid text-sm my-2 grid-cols-1 gap-2">
                <div><strong>Latitude:</strong> {radar.lat.toFixed(5)}</div>
                <div><strong>Longitude:</strong> {radar.lon.toFixed(5)}</div>
                <div><strong>Distance (km):</strong> {radar.distance.toFixed(0)}</div>
            </div>
        </div>
        </div>
    {/if}
{/each}


<style>
</style>
