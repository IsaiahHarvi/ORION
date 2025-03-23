import maplibregl from 'maplibre-gl';
import { aisStore } from '$lib/stores/aisStore';

let aisMarkers: Record<number, maplibregl.Marker> = {};

export function resetAISUpdater(): void {
    Object.values(aisMarkers).forEach(marker => marker.remove());
    aisMarkers = {};
}

/** Fetch AIS data and render markers on the map. */
export function loadAISData(map: maplibregl.Map): void {
    fetch('https://api.georobotix.io/ogc/t18/api/ais')
        .then(res => res.json())
        .then(data => {
            const ships = data?.ships || [];

            ships.forEach((ship: any) => {
                const { mmsi, name, lat, lon, speed, heading } = ship;

                if (!aisMarkers[mmsi]) {
                    const el = document.createElement('div');
                    el.className = 'ais-marker';
                    el.innerHTML = '🚢';

                    const marker = new maplibregl.Marker({ element: el })
                        .setLngLat([lon, lat])
                        .addTo(map);

                    el.onclick = () => {
                        aisStore.update(store => ({ ...store, selectedShip: ship }));
                    };

                    aisMarkers[mmsi] = marker;
                } else {
                    aisMarkers[mmsi].setLngLat([lon, lat]);
                }
            });
        })
        .catch(err => console.error('AIS fetch error:', err))
        .finally(() => {
            setTimeout(() => loadAISData(map), 10000); // Refresh every 10 sec
        });
}
