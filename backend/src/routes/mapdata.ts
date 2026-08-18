import { Router } from "express";
import { fetchOverpass, type OverpassNode, type OverpassWay } from "../lib/overpassClient.js";
import { buildAreaQuery, classifyWay, type BoundingBox, type WayCategory } from "../lib/mapQuery.js";

const router = Router();

export type LayerLines = Record<WayCategory, [number, number][][]>;

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

    const layers: LayerLines = { majorRoad: [], minorRoad: [], path: [], water: [], park: [], railway: [] };

    for (const el of data.elements) {
      if (el.type !== "way") continue;
      const way = el as OverpassWay;
      const category = classifyWay(way.tags);
      if (!category) continue;
      const points = way.nodes.map((id) => nodes.get(id)).filter((p): p is [number, number] => Boolean(p));
      if (points.length >= 2) layers[category].push(points);
    }

    res.json(layers);
  } catch {
    res.status(502).json({ error: "Impossible de récupérer les données OpenStreetMap" });
  }
});

export default router;
