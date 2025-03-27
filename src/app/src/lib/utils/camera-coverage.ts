// src/lib/utils/cameraCoverage.ts
import type { Feature, Polygon, FeatureCollection, Feature as GeoJSONFeature } from 'geojson';
import type maplibregl from 'maplibre-gl';

/**
 * Compute a ground coverage polygon from:
 * - UAV lat/lon/alt
 * - camera heading (0°=north, +east)
 * - camera pitch (negative => looking down)
 * - horizontal + vertical field of view (degrees)
 *
 * No range clamping. If pitch is near 0 => fallback to 10000m range for corners.
 * We wrap each corner in try/catch. If it fails, corner reverts to UAV lat/lon.
 */
export function computeCoveragePolygon(
	lat: number,
	lon: number,
	alt: number,
	yaw: number,
	pitch: number,
	hfov: number,
	vfov: number
): Feature<Polygon> {
	try {
		// helper: lat/lon + bearing + distance => new lat/lon
		function destinationLatLon(
			latDeg: number,
			lonDeg: number,
			bearingDeg: number,
			distanceM: number
		): [number, number] {
			const R = 6378137; // Earth radius (m)
			const bearingRad = (bearingDeg * Math.PI) / 180;
			const latRad = (latDeg * Math.PI) / 180;
			const lonRad = (lonDeg * Math.PI) / 180;

			const lat2 = Math.asin(
				Math.sin(latRad) * Math.cos(distanceM / R) +
					Math.cos(latRad) * Math.sin(distanceM / R) * Math.cos(bearingRad)
			);
			const lon2 =
				lonRad +
				Math.atan2(
					Math.sin(bearingRad) * Math.sin(distanceM / R) * Math.cos(latRad),
					Math.cos(distanceM / R) - Math.sin(latRad) * Math.sin(lat2)
				);

			return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
		}

		// corner lat/lon function => big try/catch
		function cornerLatLon(hAngleDeg: number, vAngleDeg: number): [number, number] {
			try {
				const cornerYaw = yaw + hAngleDeg;
				const cornerPitch = pitch + vAngleDeg;

				const absPitch = Math.abs(cornerPitch);
				let cornerRange: number;
				if (absPitch < 0.1) {
					// near 0 => fallback to 10km
					cornerRange = 10000;
				} else {
					cornerRange = alt / Math.tan((absPitch * Math.PI) / 180);
				}

				// if it's Infinity or NaN, fallback again
				if (!Number.isFinite(cornerRange)) cornerRange = 10000;

				return destinationLatLon(lat, lon, cornerYaw, cornerRange);
			} catch (err) {
				console.error('Error computing corner lat/lon:', err);
				return [lon, lat]; // fallback => UAV location
			}
		}

		const hHalf = hfov / 2;
		const vHalf = vfov / 2;

		const corners: [number, number][] = [
			cornerLatLon(-hHalf, -vHalf),
			cornerLatLon(+hHalf, -vHalf),
			cornerLatLon(+hHalf, +vHalf),
			cornerLatLon(-hHalf, +vHalf)
		];
		// close
		corners.push(corners[0]);

		return {
			type: 'Feature',
			geometry: {
				type: 'Polygon',
				coordinates: [corners]
			},
			properties: {}
		};
	} catch (e) {
		console.error('Error computing coverage polygon:', e);
		// fallback => degenerate polygon
		return {
			type: 'Feature',
			geometry: {
				type: 'Polygon',
				coordinates: [
					[
						[lon, lat],
						[lon, lat],
						[lon, lat],
						[lon, lat],
						[lon, lat]
					]
				]
			},
			properties: {}
		};
	}
}

/**
 * We also want a line from UAV lat/lon -> polygon centroid. We'll define a function to compute centroid & return a line Feature.
 */
function createCoverageLine(
	uavLat: number,
	uavLon: number,
	polygon: Feature<Polygon>
): GeoJSONFeature {
	let centroidLon = uavLon;
	let centroidLat = uavLat;

	try {
		const coords = polygon.geometry.coordinates[0]; // the ring
		let sumLon = 0,
			sumLat = 0;
		for (let i = 0; i < coords.length; i++) {
			sumLon += coords[i][0];
			sumLat += coords[i][1];
		}
		centroidLon = sumLon / coords.length;
		centroidLat = sumLat / coords.length;
	} catch (err) {
		console.error('Error computing coverage centroid:', err);
	}

	return {
		type: 'Feature',
		geometry: {
			type: 'LineString',
			coordinates: [
				[uavLon, uavLat],
				[centroidLon, centroidLat]
			]
		},
		properties: {}
	};
}

/**
 * Show or update the coverage polygon on the map, plus a line from UAV to centroid.
 * We'll:
 *  - create/update 'camera-fov' source/layer as a fill with a nice blue color
 *  - create/update 'camera-fov-line' source/layer as a line from UAV to centroid
 */
export function showCoverageFill(
	map: maplibregl.Map,
	coverage: Feature<Polygon>,
	sourceId = 'camera-fov',
	layerId = 'camera-fov-fill'
) {
	const coverageFC: FeatureCollection<Polygon> = {
		type: 'FeatureCollection',
		features: [coverage]
	};

	// We'll assume the UAV lat/lon is coverage's first coordinate
	const firstCoord = coverage.geometry.coordinates[0][0];
	const uavLon = firstCoord[0];
	const uavLat = firstCoord[1];

	// Also create the line feature
	const coverageLine = createCoverageLine(uavLat, uavLon, coverage);
	const lineSourceId = 'camera-fov-line';

	// 1) coverage fill
	try {
		if (!map.getSource(sourceId)) {
			map.addSource(sourceId, {
				type: 'geojson',
				data: coverageFC
			});

			// Make fill color a nice shade of blue
			map.addLayer({
				id: layerId,
				type: 'fill',
				source: sourceId,
				paint: {
					'fill-color': '#3377ff', // nice blue
					'fill-opacity': 0.3
				}
			});

			console.log('Coverage polygon added to the map.', coverage);
		} else {
			(map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(coverageFC);
		}
	} catch (err) {
		console.error('Error showing coverage fill:', err);
	}

	// 2) coverage line
	try {
		const lineFC: FeatureCollection = {
			type: 'FeatureCollection',
			features: [coverageLine]
		};

		if (!map.getSource(lineSourceId)) {
			map.addSource(lineSourceId, { type: 'geojson', data: lineFC });

			map.addLayer({
				id: 'frame-polygon-fill',
				type: 'fill',
				source: 'frame-polygon',
				paint: {
					'fill-color': '#FFFF00', // <— bright yellow
					'fill-opacity': 0.25 // optional semi-transparency
				}
			});

			console.log('Coverage line added to the map.', coverageLine);
		} else {
			(map.getSource(lineSourceId) as maplibregl.GeoJSONSource).setData(lineFC);
		}
	} catch (err) {
		console.error('Error showing coverage line:', err);
	}
}
