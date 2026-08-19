export type GcodeMode = "gravure" | "decoupe";

export interface GcodePath {
  points: [number, number][];
  closed: boolean;
  mode: GcodeMode;
}

export interface ModeSettings {
  powerPercent: number;
  speedMmPerMin: number;
  passes: number;
}

export interface GcodeRequest {
  plateWidthMm: number;
  plateHeightMm: number;
  sMax: number;
  settings: Record<GcodeMode, ModeSettings>;
  paths: GcodePath[];
}

// Vitesse de déplacement à vide (G0), cf. section 3 du cahier des charges (vitesse max Phecda).
const RAPID_SPEED_MM_MIN = 25000;

function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Vérifie que tous les points restent dans la zone de travail — cf. contrainte "400x400mm" du cahier des charges. */
export function validatePaths(req: GcodeRequest): string | null {
  const { plateWidthMm, plateHeightMm, paths } = req;
  for (let i = 0; i < paths.length; i++) {
    for (const [x, y] of paths[i].points) {
      if (x < -0.01 || y < -0.01 || x > plateWidthMm + 0.01 || y > plateHeightMm + 0.01) {
        return `Tracé #${i} hors de la zone de travail (${plateWidthMm.toFixed(0)}x${plateHeightMm.toFixed(0)}mm) : point (${x.toFixed(1)}, ${y.toFixed(1)}).`;
      }
    }
  }
  return null;
}

/** Génère un G-code GRBL (laser) à partir de tracés déjà en coordonnées mm, plaque-locales (origine 0,0).
 * Puissance en mode dynamique (M4, requiert le mode laser GRBL activé — $32=1) : la puissance réelle du laser
 * suit la vitesse de déplacement, ce qui donne un résultat de gravure/découpe plus régulier qu'en M3. */
export function generateGcode(req: GcodeRequest): { gcode: string; estimatedSeconds: number } {
  const lines: string[] = [];
  let seconds = 0;
  let cursor: [number, number] = [0, 0];

  lines.push("; Généré par AppLaser");
  lines.push(`; Plaque ${req.plateWidthMm.toFixed(1)}x${req.plateHeightMm.toFixed(1)}mm`);
  lines.push("; Mode laser dynamique (M4) — nécessite $32=1 sur le contrôleur GRBL");
  lines.push("G21 ; unités mm");
  lines.push("G90 ; coordonnées absolues");
  lines.push("M5 ; laser éteint");

  for (const path of req.paths) {
    if (path.points.length < 2) continue;
    const cfg = req.settings[path.mode];
    const sValue = Math.round((cfg.powerPercent / 100) * req.sMax);
    const sequence = path.closed ? [...path.points, path.points[0]] : path.points;
    const [startX, startY] = sequence[0];

    for (let pass = 0; pass < cfg.passes; pass++) {
      lines.push(`G0 X${startX.toFixed(3)} Y${startY.toFixed(3)}`);
      seconds += (distance(cursor, [startX, startY]) / RAPID_SPEED_MM_MIN) * 60;
      cursor = [startX, startY];

      lines.push(`M4 S${sValue} ; laser ON (${path.mode}, ${cfg.powerPercent}%)`);
      for (let i = 1; i < sequence.length; i++) {
        const [x, y] = sequence[i];
        lines.push(`G1 X${x.toFixed(3)} Y${y.toFixed(3)} F${cfg.speedMmPerMin}`);
        seconds += (distance(cursor, [x, y]) / cfg.speedMmPerMin) * 60;
        cursor = [x, y];
      }
      lines.push("M5 ; laser OFF");
    }
  }

  lines.push("G0 X0 Y0 ; retour origine");
  lines.push("M5");

  return { gcode: lines.join("\n") + "\n", estimatedSeconds: Math.round(seconds) };
}
