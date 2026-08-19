import { Router } from "express";
import { generateGcode, validatePaths, type GcodeRequest } from "../lib/gcodeGen.js";

const router = Router();

router.post("/generate", async (req, res) => {
  const body = req.body as Partial<GcodeRequest>;

  if (!Array.isArray(body.paths) || body.paths.length === 0) {
    return res.status(400).json({ error: "Aucun tracé à exporter." });
  }
  if (!body.plateWidthMm || !body.plateHeightMm) {
    return res.status(400).json({ error: "Dimensions de plaque manquantes." });
  }
  if (!body.settings?.gravure || !body.settings?.decoupe) {
    return res.status(400).json({ error: "Réglages puissance/vitesse/passes manquants." });
  }

  const gcodeReq: GcodeRequest = {
    plateWidthMm: body.plateWidthMm,
    plateHeightMm: body.plateHeightMm,
    sMax: body.sMax ?? 1000,
    settings: body.settings,
    paths: body.paths,
  };

  const error = validatePaths(gcodeReq);
  if (error) return res.status(400).json({ error });

  const { gcode, estimatedSeconds } = generateGcode(gcodeReq);
  res.json({ gcode, estimatedSeconds });
});

export default router;
