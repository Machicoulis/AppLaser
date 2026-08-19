export type GcodeMode = "gravure" | "decoupe";

export interface GcodePathSpec {
  points: [number, number][];
  closed: boolean;
  mode: GcodeMode;
  /** Épaisseur de trait réelle (mm) — n'a de sens que pour la gravure (une largeur de trait engravé) ;
   * ignorée pour la découpe, où le laser suit un seul tracé vectoriel fin (pas de notion d'épaisseur). */
  widthMm: number;
}

export interface ModeSettings {
  powerPercent: number;
  speedMmPerMin: number;
  passes: number;
}

// Trait fin pour la découpe : un simple tracé vectoriel, pas une forme épaisse — la largeur de coupe réelle
// (kerf) vient du faisceau laser, pas de ce qu'on dessine.
const DECOUPE_STROKE_MM = 0.1;

/** SVG autonome en unités mm réelles (indépendant du DOM affiché) — rouge = découpe (tracé fin, l'outline
 * seule), noir = gravure (épaisseur réelle du trait, selon le réglage de largeur), une convention courante
 * des logiciels de pilotage laser (LightBurn et proches). */
export function pathsToSvgString(paths: GcodePathSpec[], plateWidthMm: number, plateHeightMm: number): string {
  const elements = paths.map((p) => {
    const pointsStr = p.points.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(" ");
    const stroke = p.mode === "decoupe" ? "#ff0000" : "#000000";
    const strokeWidth = p.mode === "decoupe" ? DECOUPE_STROKE_MM : p.widthMm;
    const tag = p.closed ? "polygon" : "polyline";
    return `  <${tag} points="${pointsStr}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth.toFixed(3)}" />`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${plateWidthMm.toFixed(1)}mm" height="${plateHeightMm.toFixed(1)}mm" viewBox="0 0 ${plateWidthMm.toFixed(3)} ${plateHeightMm.toFixed(3)}">`,
    ...elements,
    "</svg>",
    "",
  ].join("\n");
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function requestGcode(
  paths: GcodePathSpec[],
  plateWidthMm: number,
  plateHeightMm: number,
  sMax: number,
  gravure: ModeSettings,
  decoupe: ModeSettings
): Promise<{ gcode: string; estimatedSeconds: number }> {
  const res = await fetch("http://localhost:4000/api/gcode/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plateWidthMm, plateHeightMm, sMax, settings: { gravure, decoupe }, paths }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
  return json;
}

export function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return minutes > 0 ? `${minutes} min ${seconds}s` : `${seconds}s`;
}
