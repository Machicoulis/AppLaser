export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export type FixedCategory = "water" | "park" | "railway";

export function buildAreaQuery(bbox: BoundingBox): string {
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return `[out:json][timeout:25];
(
  way["highway"](${bboxStr});
  way["waterway"](${bboxStr});
  way["natural"="water"](${bboxStr});
  way["landuse"="park"](${bboxStr});
  way["leisure"="park"](${bboxStr});
  way["railway"="rail"](${bboxStr});
);
out body;
>;
out skel qt;`;
}

/** Catégorie fixe (eau/parc/voie ferrée) d'un way OSM, ou null si c'est une route (cf. classifyHighway) ou non pertinent. */
export function classifyFixed(tags: Record<string, string> | undefined): FixedCategory | null {
  if (!tags) return null;
  if (tags.natural === "water" || tags.waterway) return "water";
  if (tags.leisure === "park" || tags.landuse === "park") return "park";
  if (tags.railway === "rail") return "railway";
  return null;
}

/** Type de route OSM brut (valeur du tag `highway`), pour laisser l'utilisateur choisir lui-même le layer par type. */
export function classifyHighway(tags: Record<string, string> | undefined): string | null {
  return tags?.highway ?? null;
}
