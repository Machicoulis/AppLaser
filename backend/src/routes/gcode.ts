import { Router } from "express";

const router = Router();

// TODO : génération G-code réelle (raster + vecteur, par layer) — cf. section 4.3 du cahier des charges.
// Stub volontaire pour ce squelette initial du projet.
router.post("/generate", async (_req, res) => {
  res.status(501).json({ error: "Génération G-code pas encore implémentée" });
});

export default router;
