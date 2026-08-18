import { Router } from "express";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Nominatim exige un User-Agent identifiant l'application (impossible à définir depuis le navigateur) : d'où ce proxy.
const USER_AGENT = "AppLaser/0.1 (usage personnel, generateur de cartes laser)";

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const cache = new Map<string, CacheEntry>();

const router = Router();

router.get("/search", async (req, res) => {
  const q = req.query.q as string | undefined;
  if (!q || q.trim().length === 0) {
    return res.status(400).json({ error: "Paramètre 'q' manquant" });
  }

  const key = q.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.data);
  }

  try {
    const url = `${NOMINATIM_URL}?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) {
      return res.status(response.status).json({ error: "Erreur Nominatim" });
    }
    const data = await response.json();
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    res.json(data);
  } catch (err) {
    console.error("Erreur /api/geocode/search :", err);
    res.status(502).json({ error: "Impossible de contacter Nominatim" });
  }
});

export default router;
