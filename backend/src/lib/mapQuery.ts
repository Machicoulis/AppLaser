export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export type WayCategory = "majorRoad" | "minorRoad" | "path" | "water" | "park" | "railway";

const MAJOR_HIGHWAYS = new Set(["motorway", "trunk", "primary", "motorway_link", "trunk_link", "primary_link"]);
const MINOR_HIGHWAYS = new Set(["secondary", "tertiary", "residential", "unclassified", "living_street", "secondary_link", "tertiary_link"]);
const PATH_HIGHWAYS = new Set(["path", "footway", "cycleway", "track", "pedestrian", "service"]);

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

/** Classe un way OSM dans une des catégories utilisées pour l'aperçu / les layers de la carte. */
export function classifyWay(tags: Record<string, string> | undefined): WayCategory | null {
  if (!tags) return null;
  if (tags.natural === "water" || tags.waterway) return "water";
  if (tags.leisure === "park" || tags.landuse === "park") return "park";
  if (tags.railway === "rail") return "railway";
  if (tags.highway) {
    if (MAJOR_HIGHWAYS.has(tags.highway)) return "majorRoad";
    if (MINOR_HIGHWAYS.has(tags.highway)) return "minorRoad";
    if (PATH_HIGHWAYS.has(tags.highway)) return "path";
    return "minorRoad";
  }
  return null;
}
