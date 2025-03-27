import maplibregl from 'maplibre-gl';
import { aisStore, type AISShip } from '$lib/stores/ais-store';
import shipIcon from '$lib/icons/ship-icon.png';

let aisMarkers: Record<string, maplibregl.Marker> = {};

export function resetAISUpdater(): void {
	Object.values(aisMarkers).forEach((marker) => marker.remove());
	aisMarkers = {};
}

type Item = {
	'foi@id': string;
	result: {
		location?: {
			lat: number;
			lon: number;
		};
		sog?: number;
		heading?: number;
		name?: string;
	};
};

export function loadAISData(map: maplibregl.Map): void {
	fetch('https://api.georobotix.io/ogc/t18/api/datastreams/kuhmds0ib5gd8/observations')
		.then((res) => res.json())
		.then((data) => {
			const items = data?.items || [];
			items.forEach((item: Item) => {
				const mmsi: number = Number(item['foi@id']);
				const result = item.result;
				if (!result || !result.location) return;

				const { lat, lon } = result.location;
				const speed = result.sog;
				const heading = result.heading;

				const providedName = result.name;
				const shipName = providedName && providedName.trim() !== '' ? providedName : mmsi;

				const shipData = {
					mmsi,
					name: shipName,
					lat,
					lon,
					speed,
					heading
				};

				if (!aisMarkers[mmsi]) {
					const el = document.createElement('img');
					el.className = 'ais-marker';
					el.src = shipIcon;
					el.alt = 'AIS Ship';
					el.style.width = '24px';
					el.style.height = '24px';
					el.style.border = '4px';
					el.className = 'marker';

					const marker = new maplibregl.Marker({ element: el })
						.setLngLat([lon, lat])
						.addTo(map);

					el.onclick = () => {
						aisStore.update((store) => ({
							...store,
							selectedShip: shipData as AISShip
						}));
					};

					aisMarkers[mmsi] = marker;
				} else {
					aisMarkers[mmsi].setLngLat([lon, lat]);
				}
			});
		})
		.catch((err) => console.error('AIS fetch error:', err))
		.finally(() => {
			setTimeout(() => loadAISData(map), 10000);
		});
}
