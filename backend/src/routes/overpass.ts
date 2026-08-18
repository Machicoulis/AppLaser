import { Router } from "express";
import { createHash } from "node:crypto";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h : les données OSM d'une zone ne changent pas d'une session à l'autre

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const router = Router();

// Reçoit une requête Overpass QL déjà construite par le frontend (bbox + tags sélectionnés par layer)
router.post("/query", async (req, res) => {
  const { query } = req.body as { query?: string };
  if (!query) return res.status(400).json({ error: "Paramètre 'query' manquant" });

  const key = createHash("sha256").update(query).digest("hex");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.data);
  }

  try {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: "Erreur Overpass API" });
    }
    const data = await response.json();
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    res.json(data);
  } catch {
    res.status(502).json({ error: "Impossible de contacter Overpass API" });
  }
});

export default router;
