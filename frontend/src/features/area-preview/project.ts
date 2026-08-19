import { METERS_PER_DEGREE_LAT, metersPerDegreeLng, pointAtDistance, type BoundingBox } from "../map-selection/geo";
import type { AreaSelection } from "../map-selection/MapAreaSelector";

export const VIEWBOX_SIZE = 1000;

/** Bbox à utiliser pour la projection (`project`) : pour un cercle/polygone régulier, une bbox géographique
 * n'est en général pas carrée en mètres réels (ex. hexagone pointe en haut ≈ 1.73R × 2R) alors que le viewBox
 * SVG est forcé carré (`computeViewBoxSize`) — projeter directement sur `selection.bbox` étirerait donc la forme
 * de façon anisotrope (arêtes inégales). On agrandit la bbox sur son plus petit axe (en mètres, centrée) pour que
 * largeur et hauteur représentent la même distance réelle, garantissant une échelle identique en x et en y.
 * Le rectangle n'a pas ce problème : sa bbox est construite directement avec le ratio largeur/hauteur de la plaque. */
export function projectionBbox(selection: AreaSelection): BoundingBox {
  if (selection.shape.type === "rectangle") return selection.bbox;
  const { bbox } = selection;
  const centerLat = (bbox.north + bbox.south) / 2;
  const centerLng = (bbox.east + bbox.west) / 2;
  const mPerLng = metersPerDegreeLng(centerLat);
  const widthM = (bbox.east - bbox.west) * mPerLng;
  const heightM = (bbox.north - bbox.south) * METERS_PER_DEGREE_LAT;
  const sizeM = Math.max(widthM, heightM);
  const halfWidthDeg = sizeM / 2 / mPerLng;
  const halfHeightDeg = sizeM / 2 / METERS_PER_DEGREE_LAT;
  return {
    west: centerLng - halfWidthDeg,
    east: centerLng + halfWidthDeg,
    south: centerLat - halfHeightDeg,
    north: centerLat + halfHeightDeg,
  };
}

/** Taille du viewBox SVG selon la forme : le format de plaque (largeur/hauteur) ne s'applique qu'au rectangle ;
 * cercle et polygone régulier sont intrinsèquement symétriques, un viewBox carré évite toute déformation. */
export function computeViewBoxSize(selection: AreaSelection): { viewWidth: number; viewHeight: number } {
  if (selection.shape.type === "rectangle") {
    const aspectRatio = selection.plateWidthMm / selection.plateHeightMm;
    return aspectRatio >= 1
      ? { viewWidth: VIEWBOX_SIZE, viewHeight: VIEWBOX_SIZE / aspectRatio }
      : { viewWidth: VIEWBOX_SIZE * aspectRatio, viewHeight: VIEWBOX_SIZE };
  }
  return { viewWidth: VIEWBOX_SIZE, viewHeight: VIEWBOX_SIZE };
}

/** Contour de la forme de sélection, projeté en coordonnées SVG — toujours renvoyé comme une liste de points
 * (le cercle est approximé par un polygone à 64 sommets) pour rester utilisable comme <polygon> de contour ou de clip. */
export function projectShapeOutline(selection: AreaSelection, viewWidth: number, viewHeight: number): [number, number][] {
  if (selection.shape.type === "rectangle") {
    return [
      [0, 0],
      [viewWidth, 0],
      [viewWidth, viewHeight],
      [0, viewHeight],
    ];
  }
  const bbox = projectionBbox(selection);
  if (selection.shape.type === "polygon") {
    return selection.shape.points.map((p) => project(bbox, p.lat, p.lng, viewWidth, viewHeight));
  }
  const { center, radiusM } = selection.shape;
  const sides = 64;
  const points: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const p = pointAtDistance(center, radiusM, (360 / sides) * i);
    points.push(project(bbox, p.lat, p.lng, viewWidth, viewHeight));
  }
  return points;
}

/** Projette un point lat/lng dans le repère SVG (0..VIEWBOX_SIZE), nord en haut. Approximation équirectangulaire, suffisante à l'échelle d'une plaque. */
export function project(bbox: BoundingBox, lat: number, lng: number, width: number, height: number): [number, number] {
  const x = ((lng - bbox.west) / (bbox.east - bbox.west)) * width;
  const y = ((bbox.north - lat) / (bbox.north - bbox.south)) * height;
  return [x, y];
}

/** Agrandit un contour (déjà en coordonnées SVG) d'une marge donnée, en l'écartant de son centroïde.
 * Exact pour un cercle (tous les points équidistants du centre) ; approximation raisonnable pour un polygone régulier. */
export function offsetShapeOutline(points: [number, number][], marginSvg: number): [number, number][] {
  const cx = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const cy = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  return points.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const scale = (dist + marginSvg) / dist;
    return [cx + dx * scale, cy + dy * scale];
  });
}

/** Point d'intersection exact entre un rayon (depuis cx,cy dans la direction dirX,dirY) et le contour d'un polygone.
 * Utilisé pour accrocher un élément à la frontière réelle d'une forme non rectangulaire (l'écart entre sommets
 * n'est pas uniforme une fois projeté en SVG, un simple rayon moyen sous- ou sur-estime la vraie limite locale). */
export function raycastToPolygon(cx: number, cy: number, dirX: number, dirY: number, points: [number, number][]): [number, number] {
  let bestT: number | null = null;
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    const ex = bx - ax;
    const ey = by - ay;
    const denom = dirX * ey - dirY * ex;
    if (Math.abs(denom) < 1e-9) continue;
    const rx = ax - cx;
    const ry = ay - cy;
    const t = (rx * ey - ry * ex) / denom;
    const s = (rx * dirY - ry * dirX) / denom;
    if (t > 1e-6 && s >= -1e-6 && s <= 1 + 1e-6 && (bestT === null || t < bestT)) {
      bestT = t;
    }
  }
  const t = bestT ?? 0;
  return [cx + dirX * t, cy + dirY * t];
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
