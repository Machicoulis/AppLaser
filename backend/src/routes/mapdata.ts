import { Router } from "express";
import { fetchOverpass, type OverpassNode, type OverpassWay } from "../lib/overpassClient.js";
import { buildAreaQuery, classifyFixed, classifyHighway, type BoundingBox, type FixedCategory } from "../lib/mapQuery.js";

const router = Router();

export type MapDataResponse = Record<FixedCategory, [number, number][][]> & {
  roads: Record<string, [number, number][][]>;
};

router.post("/", async (req, res) => {
  const { bbox } = req.body as { bbox?: BoundingBox };
  if (!bbox) return res.status(400).json({ error: "Paramètre 'bbox' manquant" });

  try {
    const data = await fetchOverpass(buildAreaQuery(bbox));

    const nodes = new Map<number, [number, number]>();
    for (const el of data.elements) {
      if (el.type === "node") {
        const n = el as OverpassNode;
        nodes.set(n.id, [n.lat, n.lon]);
      }
    }

    const result: MapDataResponse = { water: [], park: [], railway: [], roads: {} };

    for (const el of data.elements) {
      if (el.type !== "way") continue;
      const way = el as OverpassWay;
      const points = way.nodes.map((id) => nodes.get(id)).filter((p): p is [number, number] => Boolean(p));
      if (points.length < 2) continue;

      const fixed = classifyFixed(way.tags);
      if (fixed) {
        result[fixed].push(points);
        continue;
      }
      const highway = classifyHighway(way.tags);
      if (highway) {
        (result.roads[highway] ??= []).push(points);
      }
    }

    res.json(result);
  } catch (err) {
    console.error("Erreur /api/mapdata :", err);
    res.status(502).json({ error: "Impossible de récupérer les données OpenStreetMap" });
  }
});

export default router;
