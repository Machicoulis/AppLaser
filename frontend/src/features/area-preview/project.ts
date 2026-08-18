import type { BoundingBox } from "../map-selection/geo";

export const VIEWBOX_SIZE = 1000;

/** Projette un point lat/lng dans le repère SVG (0..VIEWBOX_SIZE), nord en haut. Approximation équirectangulaire, suffisante à l'échelle d'une plaque. */
export function project(bbox: BoundingBox, lat: number, lng: number, width: number, height: number): [number, number] {
  const x = ((lng - bbox.west) / (bbox.east - bbox.west)) * width;
  const y = ((bbox.north - lat) / (bbox.north - bbox.south)) * height;
  return [x, y];
}

export function pointsToSvg(points: [number, number][]): string {
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

export function isClosedWay(points: [number, number][]): boolean {
  if (points.length < 3) return false;
  const [firstLat, firstLng] = points[0];
  const [lastLat, lastLng] = points[points.length - 1];
  return firstLat === lastLat && firstLng === lastLng;
}
