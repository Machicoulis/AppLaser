import { Router } from "express";
import { fetchOverpass } from "../lib/overpassClient.js";

const router = Router();

// Reçoit une requête Overpass QL déjà construite par l'appelant (usage direct/débogage)
router.post("/query", async (req, res) => {
  const { query } = req.body as { query?: string };
  if (!query) return res.status(400).json({ error: "Paramètre 'query' manquant" });

  try {
    const data = await fetchOverpass(query);
    res.json(data);
  } catch {
    res.status(502).json({ error: "Impossible de contacter Overpass API" });
  }
});

export default router;
