import { Router } from "express";
import { randomUUID } from "node:crypto";
import { readJson, writeJson } from "../lib/storage.js";

const DATA_FILE = new URL("../../data/presets.json", import.meta.url).pathname;

export interface MaterialPreset {
  id: string;
  name: string;
  mode: "decoupe" | "gravure";
  powerPercent: number;
  speedMmPerMin: number;
  passes: number;
}

const DEFAULT_PRESETS: MaterialPreset[] = [
  {
    id: "peuplier-3mm-decoupe",
    name: "Peuplier 3mm — Découpe",
    mode: "decoupe",
    powerPercent: 85,
    speedMmPerMin: 900,
    passes: 2,
  },
  {
    id: "peuplier-3mm-gravure",
    name: "Peuplier 3mm — Gravure",
    mode: "gravure",
    powerPercent: 55,
    speedMmPerMin: 3200,
    passes: 1,
  },
];

const router = Router();

router.get("/", async (_req, res) => {
  const presets = await readJson(DATA_FILE, DEFAULT_PRESETS);
  res.json(presets);
});

router.post("/", async (req, res) => {
  const presets = await readJson(DATA_FILE, DEFAULT_PRESETS);
  const preset: MaterialPreset = { ...req.body, id: randomUUID() };
  presets.push(preset);
  await writeJson(DATA_FILE, presets);
  res.status(201).json(preset);
});

router.put("/:id", async (req, res) => {
  const presets = await readJson(DATA_FILE, DEFAULT_PRESETS);
  const index = presets.findIndex((p) => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Preset introuvable" });
  presets[index] = { ...presets[index], ...req.body, id: req.params.id };
  await writeJson(DATA_FILE, presets);
  res.json(presets[index]);
});

router.delete("/:id", async (req, res) => {
  const presets = await readJson(DATA_FILE, DEFAULT_PRESETS);
  const filtered = presets.filter((p) => p.id !== req.params.id);
  await writeJson(DATA_FILE, filtered);
  res.status(204).end();
});

export default router;
