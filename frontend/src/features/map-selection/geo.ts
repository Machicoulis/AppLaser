export interface LatLng {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

const METERS_PER_DEGREE_LAT = 111_320;

function metersPerDegreeLng(latDeg: number): number {
  return METERS_PER_DEGREE_LAT * Math.cos((latDeg * Math.PI) / 180);
}

/** Rectangle de sélection centré, dimensionné en mètres réels, avec le rapport largeur/hauteur de la plaque. */
export function computeBounds(center: LatLng, widthM: number, heightM: number): BoundingBox {
  const halfHeightDeg = heightM / 2 / METERS_PER_DEGREE_LAT;
  const halfWidthDeg = widthM / 2 / metersPerDegreeLng(center.lat);
  return {
    south: center.lat - halfHeightDeg,
    north: center.lat + halfHeightDeg,
    west: center.lng - halfWidthDeg,
    east: center.lng + halfWidthDeg,
  };
}

/** Largeur/hauteur réelles (mètres) d'un point du rectangle par rapport au centre — utilisé lors du redimensionnement par un coin. */
export function metersFromCenter(center: LatLng, point: LatLng): { widthM: number; heightM: number } {
  const heightM = Math.abs(point.lat - center.lat) * 2 * METERS_PER_DEGREE_LAT;
  const widthM = Math.abs(point.lng - center.lng) * 2 * metersPerDegreeLng(center.lat);
  return { widthM, heightM };
}

export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(0)} m`;
}
