/** Découpage géométrique d'un tracé par un polygone convexe (le contour de la zone sélectionnée est toujours
 * convexe : rectangle, cercle approximé, ou polygone régulier). Nécessaire pour l'export réel : contrairement
 * à l'aperçu à l'écran (qui masque juste visuellement le dépassement via un clipPath SVG), les données OSM
 * brutes dépassent souvent largement la zone choisie (Overpass renvoie des tronçons entiers, pas pré-découpés),
 * donc un export sans découpage réel envoie des tracés qui partent loin hors de la plaque. */

function centroidOf(points: [number, number][]): [number, number] {
  const cx = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const cy = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  return [cx, cy];
}

// Signe du côté "intérieur" d'une arête (a,b) du polygone convexe : celui où se trouve le centroïde
// (fonctionne quel que soit le sens de parcours des points, pas besoin de connaître l'orientation à l'avance).
function insideSignOf(a: [number, number], b: [number, number], centroid: [number, number]): number {
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const sign = Math.sign(ex * (centroid[1] - a[1]) - ey * (centroid[0] - a[0]));
  return sign === 0 ? 1 : sign;
}

/** Découpe un segment [p0,p1] par l'intersection de tous les demi-plans du polygone convexe (Cyrus-Beck).
 * Renvoie le sous-segment restant à l'intérieur, ou null s'il est entièrement à l'extérieur. */
function clipSegmentToConvexPolygon(
  p0: [number, number],
  p1: [number, number],
  polygon: [number, number][],
  centroid: [number, number]
): [[number, number], [number, number]] | null {
  let tLow = 0;
  let tHigh = 1;
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const insideSign = insideSignOf(a, b, centroid);
    const d0 = insideSign * (ex * (p0[1] - a[1]) - ey * (p0[0] - a[0]));
    const d1 = insideSign * (ex * (p1[1] - a[1]) - ey * (p1[0] - a[0]));

    if (d0 < 0 && d1 < 0) return null;
    if (d0 < 0 || d1 < 0) {
      const t = d0 / (d0 - d1);
      if (d0 < 0) tLow = Math.max(tLow, t);
      else tHigh = Math.min(tHigh, t);
    }
    if (tLow > tHigh) return null;
  }

  return [
    [p0[0] + tLow * dx, p0[1] + tLow * dy],
    [p0[0] + tHigh * dx, p0[1] + tHigh * dy],
  ];
}

/** Découpe une ligne ouverte (route, voie ferrée...) par un polygone convexe. Peut produire plusieurs
 * tronçons disjoints si la ligne sort et rentre plusieurs fois dans la zone. */
export function clipPolylineToConvexPolygon(points: [number, number][], polygon: [number, number][]): [number, number][][] {
  if (points.length < 2 || polygon.length < 3) return [];
  const centroid = centroidOf(polygon);
  const subPaths: [number, number][][] = [];
  let current: [number, number][] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const clipped = clipSegmentToConvexPolygon(points[i], points[i + 1], polygon, centroid);
    if (!clipped) {
      if (current.length >= 2) subPaths.push(current);
      current = [];
      continue;
    }
    const [cp0, cp1] = clipped;
    if (current.length === 0) {
      current.push(cp0, cp1);
    } else {
      const last = current[current.length - 1];
      if (Math.hypot(last[0] - cp0[0], last[1] - cp0[1]) < 1e-6) {
        current.push(cp1);
      } else {
        if (current.length >= 2) subPaths.push(current);
        current = [cp0, cp1];
      }
    }
  }
  if (current.length >= 2) subPaths.push(current);
  return subPaths;
}

/** Découpe un polygone fermé (plan d'eau, parc...) par un polygone convexe (Sutherland-Hodgman). */
export function clipPolygonToConvexPolygon(subject: [number, number][], polygon: [number, number][]): [number, number][] {
  if (subject.length < 3 || polygon.length < 3) return [];
  const centroid = centroidOf(polygon);
  let output = subject;

  for (let i = 0; i < polygon.length && output.length > 0; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const insideSign = insideSignOf(a, b, centroid);
    const side = (p: [number, number]) => insideSign * (ex * (p[1] - a[1]) - ey * (p[0] - a[0]));
    const intersect = (p0: [number, number], p1: [number, number]): [number, number] => {
      const d0 = side(p0);
      const d1 = side(p1);
      const t = d0 / (d0 - d1);
      return [p0[0] + t * (p1[0] - p0[0]), p0[1] + t * (p1[1] - p0[1])];
    };

    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const curr = input[j];
      const prev = input[(j - 1 + input.length) % input.length];
      const currInside = side(curr) >= 0;
      const prevInside = side(prev) >= 0;
      if (currInside) {
        if (!prevInside) output.push(intersect(prev, curr));
        output.push(curr);
      } else if (prevInside) {
        output.push(intersect(prev, curr));
      }
    }
  }
  return output;
}
