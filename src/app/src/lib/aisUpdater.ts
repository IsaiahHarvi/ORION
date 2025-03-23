import maplibregl from 'maplibre-gl';
import { aisStore } from '$lib/stores/aisStore';
import shipIcon from '$lib/icons/ship-icon.png';

let aisMarkers: Record<string, maplibregl.Marker> = {};

/** Remove all AIS markers from the map. */
export function resetAISUpdater(): void {
    Object.values(aisMarkers).forEach(marker => marker.remove());
    aisMarkers = {};
}

/** 
 * Fetch AIS data from the API endpoint and render/update markers on the map.
 * This version maps API fields to our AISShip interface.
 */
export function loadAISData(map: maplibregl.Map): void {
    fetch('https://api.georobotix.io/ogc/t18/api/datastreams/kuhmds0ib5gd8/observations')
        .then(res => res.json())
        .then(data => {
            console.log('AIS data:', data);
            const items = data?.items || [];
            items.forEach((item: any) => {
                // Use "foi@id" as the unique key (as a string)
                const mmsi = item["foi@id"];
                const result = item.result;
                if (!result || !result.location) return;

                const { lat, lon } = result.location;
                const speed = result.sog;      // speed over ground
                const heading = result.heading; // heading

                // Check if a name is provided. If not, just use the MMSI.
                const providedName = result.name; // if available
                const shipName = providedName && providedName.trim() !== '' ? providedName : mmsi;

                // Build our AIS ship data object.
                const shipData = {
                    mmsi, 
                    name: shipName,
                    lat,
                    lon,
                    speed,
                    heading
                };

                // Create or update marker for this ship.
                if (!aisMarkers[mmsi]) {
                    // Instead of using an emoji, we create an <img> element.
                    const el = document.createElement('img');
                    el.className = 'ais-marker';
                    el.src = shipIcon; // update this path to your ship icon
                    el.alt = 'AIS Ship';
                    el.style.width = '24px';
                    el.style.height = '24px';

                    const marker = new maplibregl.Marker({ element: el })
                        .setLngLat([lon, lat])
                        .addTo(map);

                    el.onclick = () => {
                        aisStore.update(store => ({ ...store, selectedShip: shipData }));
                    };

                    aisMarkers[mmsi] = marker;
                } else {
                    aisMarkers[mmsi].setLngLat([lon, lat]);
                }
            });
        })
        .catch(err => console.error('AIS fetch error:', err))
        .finally(() => {
            setTimeout(() => loadAISData(map), 10000); // Refresh every 10 seconds
        });
}
