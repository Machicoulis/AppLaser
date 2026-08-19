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

export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * METERS_PER_DEGREE_LAT;
  const dLng = (b.lng - a.lng) * metersPerDegreeLng(a.lat);
  return Math.hypot(dLat, dLng);
}

/** Point à une distance donnée (mètres) et un angle donné (degrés, 0 = est) d'un centre. */
export function pointAtDistance(center: LatLng, distanceM: number, angleDeg: number): LatLng {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    lat: center.lat + (distanceM * Math.sin(angleRad)) / METERS_PER_DEGREE_LAT,
    lng: center.lng + (distanceM * Math.cos(angleRad)) / metersPerDegreeLng(center.lat),
  };
}

/** Bbox englobant un cercle centré, de rayon donné en mètres. */
export function computeCircleBounds(center: LatLng, radiusM: number): BoundingBox {
  return computeBounds(center, radiusM * 2, radiusM * 2);
}

/** Sommets d'un polygone régulier (équilatéral) : triangle, carré, pentagone, etc. selon `sides`. */
export function computeRegularPolygonPoints(center: LatLng, radiusM: number, sides: number): LatLng[] {
  const points: LatLng[] = [];
  for (let i = 0; i < sides; i++) {
    const angleDeg = 90 + (360 / sides) * i; // premier sommet pointé vers le nord (base à plat en bas pour un triangle)
    points.push(pointAtDistance(center, radiusM, angleDeg));
  }
  return points;
}

/** Bbox englobant une liste de points (polygone). */
export function computePolygonBounds(points: LatLng[]): BoundingBox {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return { south: Math.min(...lats), north: Math.max(...lats), west: Math.min(...lngs), east: Math.max(...lngs) };
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
