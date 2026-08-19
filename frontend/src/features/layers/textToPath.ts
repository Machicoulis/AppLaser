import opentype from "opentype.js";

const fontCache = new Map<string, Promise<opentype.Font>>();

/** Extrait le nom de famille (ex. "Archivo Black") d'une valeur CSS font-family (ex. "'Archivo Black', sans-serif"). */
function extractFamilyName(fontFamilyCss: string): string {
  const quoted = fontFamilyCss.match(/^['"]([^'"]+)['"]/);
  return quoted ? quoted[1] : fontFamilyCss.split(",")[0].trim();
}

/** Charge (et met en cache) une police depuis le proxy backend Google Fonts, pour en extraire les tracés de glyphes. */
export function loadFont(fontFamilyCss: string, weight: number): Promise<opentype.Font> {
  const family = extractFamilyName(fontFamilyCss);
  const key = `${family}:${weight}`;
  if (!fontCache.has(key)) {
    fontCache.set(
      key,
      fetch(`http://localhost:4000/api/font?family=${encodeURIComponent(family)}&weight=${weight}`)
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? `Police "${family}" introuvable (${res.status})`);
          }
          return res.arrayBuffer();
        })
        .then((buf) => opentype.parse(buf))
    );
  }
  return fontCache.get(key)!;
}

function sampleQuadratic(p0: [number, number], p1: [number, number], p2: [number, number], steps: number): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0];
    const y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1];
    points.push([x, y]);
  }
  return points;
}

function sampleCubic(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], steps: number): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0];
    const y = mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1];
    points.push([x, y]);
  }
  return points;
}

// Segments par courbe pour l'aplatissement des Bézier — suffisant à la taille d'un titre gravé/découpé (pas de gros zoom prévu).
const CURVE_STEPS = 8;

/** Convertit un texte en contours vectoriels fermés (un par contour de glyphe : lettre pleine ou contre-forme/trou,
 * ex. le centre du "O"), aplatis à partir des courbes de Bézier de la police. Coordonnées dans le même repère SVG
 * que le reste du rendu (origine texte centrée horizontalement sur x, ligne de base à y — même convention que
 * l'élément <text textAnchor="middle"> déjà utilisé à l'écran). */
// Substitutions typographiques (ligatures...) désactivées : pas nécessaires pour un titre/des coordonnées, et
// certaines polices ont des tables GSUB avec des sous-formats qu'opentype.js ne sait pas encore analyser.
// Ligatures et crénage OpenType avancé désactivés : inutiles pour un titre/des coordonnées, et certaines polices
// ont des tables GSUB/GPOS avec des sous-formats qu'opentype.js ne sait pas encore analyser (plante sinon).
const NO_LIGATURES = { features: {}, kerning: false };

export function textToContours(font: opentype.Font, text: string, x: number, y: number, fontSizeSvg: number): [number, number][][] {
  const advanceWidth = font.getAdvanceWidth(text, fontSizeSvg, NO_LIGATURES);
  const path = font.getPath(text, x - advanceWidth / 2, y, fontSizeSvg, NO_LIGATURES);

  const contours: [number, number][][] = [];
  let current: [number, number][] = [];

  for (const cmd of path.commands) {
    if (cmd.type === "M") {
      if (current.length >= 3) contours.push(current);
      current = [[cmd.x, cmd.y]];
    } else if (cmd.type === "L") {
      current.push([cmd.x, cmd.y]);
    } else if (cmd.type === "Q") {
      const last = current[current.length - 1];
      current.push(...sampleQuadratic(last, [cmd.x1, cmd.y1], [cmd.x, cmd.y], CURVE_STEPS));
    } else if (cmd.type === "C") {
      const last = current[current.length - 1];
      current.push(...sampleCubic(last, [cmd.x1, cmd.y1], [cmd.x2, cmd.y2], [cmd.x, cmd.y], CURVE_STEPS));
    } else if (cmd.type === "Z") {
      if (current.length >= 3) contours.push(current);
      current = [];
    }
  }
  if (current.length >= 3) contours.push(current);
  return contours;
}

/** Applique la même transformation que le rendu à l'écran (translate puis rotate, cf. DraggableText) à un point local. */
export function applyTextTransform([px, py]: [number, number], x: number, y: number, rotationDeg: number): [number, number] {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [px * cos - py * sin + x, px * sin + py * cos + y];
}

