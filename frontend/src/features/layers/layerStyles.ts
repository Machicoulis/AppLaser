import { distanceMeters, type LatLng } from "../map-selection/geo";

export type FixedCategory = "water" | "park" | "railway";
export type FillMode = "gravure" | "decoupe";
export type RoadLayer = "layer2" | "layer3" | "exclude";

export interface MapDataResponse {
  water: [number, number][][];
  park: [number, number][][];
  railway: [number, number][][];
  roads: Record<string, [number, number][][]>;
}

export interface CategoryStyle {
  label: string;
  stroke: string;
  fill?: string;
  defaultWidthMm: number;
  dash?: string;
  mode: FillMode;
  areaFill?: boolean;
}

export const FIXED_STYLE: Record<FixedCategory, CategoryStyle> = {
  railway: { label: "Voies ferrées", stroke: "#78350f", defaultWidthMm: 0.5, dash: "4,2", mode: "gravure" },
  park: { label: "Parcs", stroke: "#22c55e", fill: "#bbf7d0", defaultWidthMm: 0.3, mode: "gravure", areaFill: true },
  // Découpe traversante pleine : le trou laisse apparaître le Layer 1 (fond) en dessous.
  water: { label: "Plans d'eau", stroke: "#3b82f6", fill: "#93c5fd", defaultWidthMm: 0.3, mode: "decoupe", areaFill: true },
};

export const MODE_LABEL: Record<FillMode, string> = { gravure: "gravure", decoupe: "découpe" };

export const FIXED_ORDER: FixedCategory[] = ["park", "water", "railway"];

/** Catégories fixes optionnelles (toujours désactivables), indépendantes du classement des routes par type. */
export const FIXED_OPTIONAL: FixedCategory[] = ["park", "railway"];

/** Style de rendu des routes selon le layer auquel l'utilisateur les a assignées à l'étape 2. */
export const ROAD_LAYER_STYLE: Record<Exclude<RoadLayer, "exclude">, { stroke: string; mode: FillMode; defaultWidthMm: number }> = {
  layer2: { stroke: "#6b7280", mode: "gravure", defaultWidthMm: 0.6 },
  layer3: { stroke: "#1f2937", mode: "decoupe", defaultWidthMm: 2 },
};

/** Libellé FR + layer par défaut pour chaque type de route OSM (tag `highway`) couramment rencontré. */
export const HIGHWAY_META: Record<string, { label: string; defaultLayer: RoadLayer }> = {
  motorway: { label: "Autoroute", defaultLayer: "layer3" },
  motorway_link: { label: "Bretelle d'autoroute", defaultLayer: "layer3" },
  trunk: { label: "Voie rapide", defaultLayer: "layer3" },
  trunk_link: { label: "Bretelle de voie rapide", defaultLayer: "layer3" },
  primary: { label: "Route primaire", defaultLayer: "layer3" },
  primary_link: { label: "Bretelle de route primaire", defaultLayer: "layer3" },
  secondary: { label: "Route secondaire", defaultLayer: "layer2" },
  secondary_link: { label: "Bretelle de route secondaire", defaultLayer: "layer2" },
  tertiary: { label: "Route tertiaire", defaultLayer: "layer2" },
  tertiary_link: { label: "Bretelle de route tertiaire", defaultLayer: "layer2" },
  unclassified: { label: "Route non classée", defaultLayer: "layer2" },
  residential: { label: "Rue résidentielle", defaultLayer: "layer2" },
  living_street: { label: "Zone de rencontre", defaultLayer: "layer2" },
  service: { label: "Voie de service", defaultLayer: "layer2" },
  pedestrian: { label: "Zone piétonne", defaultLayer: "layer2" },
  track: { label: "Chemin agricole / forestier", defaultLayer: "layer2" },
  // Très nombreux et peu lisibles à l'échelle d'une gravure : exclus par défaut, réactivables au cas par cas.
  path: { label: "Sentier", defaultLayer: "exclude" },
  footway: { label: "Trottoir / chemin piéton", defaultLayer: "exclude" },
  cycleway: { label: "Piste cyclable", defaultLayer: "exclude" },
  steps: { label: "Escaliers", defaultLayer: "exclude" },
  bridleway: { label: "Chemin équestre", defaultLayer: "layer2" },
  construction: { label: "Route en construction", defaultLayer: "layer2" },
};

export function highwayLabel(type: string): string {
  return HIGHWAY_META[type]?.label ?? type;
}

export function highwayDefaultLayer(type: string): RoadLayer {
  return HIGHWAY_META[type]?.defaultLayer ?? "layer2";
}

/** Ordonne les types de routes présents selon la hiérarchie routière habituelle, types inconnus en dernier par ordre alphabétique. */
export function orderHighwayTypes(types: string[]): string[] {
  const known = Object.keys(HIGHWAY_META);
  return [...types].sort((a, b) => {
    const ia = known.indexOf(a);
    const ib = known.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/** Taille d'un tracé (diagonale de sa boîte englobante, en mètres) — sert de filtre pour exclure les petits éléments (ex. mares). */
export function lineSizeMeters(points: [number, number][]): number {
  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  const sw: LatLng = { lat: Math.min(...lats), lng: Math.min(...lngs) };
  const ne: LatLng = { lat: Math.max(...lats), lng: Math.max(...lngs) };
  return distanceMeters(sw, ne);
}

export function filterBySize(lines: [number, number][][], minSizeM: number): [number, number][][] {
  return lines.filter((line) => lineSizeMeters(line) >= minSizeM);
}
