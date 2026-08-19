export type WayCategory = "majorRoad" | "minorRoad" | "path" | "water" | "park" | "railway";
export type LayerLines = Record<WayCategory, [number, number][][]>;
export type FillMode = "gravure" | "decoupe";

export interface CategoryStyle {
  label: string;
  stroke: string;
  fill?: string;
  defaultWidthMm: number;
  dash?: string;
  mode: FillMode;
  areaFill?: boolean;
}

export const LAYER_STYLE: Record<WayCategory, CategoryStyle> = {
  // Layer 3 : découpe uniquement des grands axes
  majorRoad: { label: "Grands axes routiers", stroke: "#1f2937", defaultWidthMm: 2, mode: "decoupe" },
  // Layer 2 : gravure des routes secondaires, chemins, voies ferrées, parcs
  minorRoad: { label: "Routes secondaires", stroke: "#6b7280", defaultWidthMm: 0.6, mode: "gravure" },
  path: { label: "Chemins / allées", stroke: "#9ca3af", defaultWidthMm: 0.3, dash: "2,2", mode: "gravure" },
  railway: { label: "Voies ferrées", stroke: "#78350f", defaultWidthMm: 0.5, dash: "4,2", mode: "gravure" },
  park: { label: "Parcs", stroke: "#22c55e", fill: "#bbf7d0", defaultWidthMm: 0.3, mode: "gravure", areaFill: true },
  // Layer 2 : découpe traversante pleine des plans d'eau, laisse apparaître le Layer 1 (fond) en dessous
  water: { label: "Plans d'eau", stroke: "#3b82f6", fill: "#93c5fd", defaultWidthMm: 0.3, mode: "decoupe", areaFill: true },
};

export const MODE_LABEL: Record<FillMode, string> = { gravure: "gravure", decoupe: "découpe" };

export const LAYER_ORDER: WayCategory[] = ["park", "water", "path", "minorRoad", "railway", "majorRoad"];

/** Catégories optionnelles du Layer 2, activables individuellement (routes secondaires et eau sont toujours incluses). */
export const LAYER2_OPTIONAL: WayCategory[] = ["park", "railway", "path"];

export function defaultWidths(): Record<WayCategory, number> {
  return Object.fromEntries(Object.entries(LAYER_STYLE).map(([cat, style]) => [cat, style.defaultWidthMm])) as Record<
    WayCategory,
    number
  >;
}
