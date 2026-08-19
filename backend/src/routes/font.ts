import { Router } from "express";

const router = Router();

// User-Agent volontairement ancien : Google Fonts sert alors du TrueType (.ttf) plutôt que WOFF2,
// un format qu'opentype.js analyse nativement côté frontend sans dépendance de décompression Brotli.
const LEGACY_USER_AGENT = "Mozilla/5.0 (Windows NT 6.1; rv:2.0.1) Gecko/20100101 Firefox/4.0.1";

router.get("/", async (req, res) => {
  const family = String(req.query.family ?? "").trim();
  const weight = String(req.query.weight ?? "400").trim();
  if (!family) return res.status(400).json({ error: "Paramètre 'family' manquant." });

  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${encodeURIComponent(weight)}&display=swap`;
    const cssRes = await fetch(cssUrl, { headers: { "User-Agent": LEGACY_USER_AGENT } });
    if (!cssRes.ok) return res.status(502).json({ error: `Google Fonts CSS a répondu ${cssRes.status}` });
    const css = await cssRes.text();
    const match = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
    if (!match) return res.status(404).json({ error: `Police "${family}" introuvable chez Google Fonts.` });

    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return res.status(502).json({ error: `Téléchargement de la police échoué (${fontRes.status})` });
    const buf = Buffer.from(await fontRes.arrayBuffer());
    res.setHeader("Content-Type", "font/ttf");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buf);
  } catch {
    res.status(502).json({ error: "Impossible de récupérer la police depuis Google Fonts." });
  }
});

export default router;
