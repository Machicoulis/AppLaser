import { Router } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";

const PROJECTS_DIR = new URL("../../data/projects/", import.meta.url).pathname;

const router = Router();

router.get("/", async (_req, res) => {
  await mkdir(PROJECTS_DIR, { recursive: true });
  const files = (await readdir(PROJECTS_DIR)).filter((f) => f.endsWith(".json"));
  const projects = await Promise.all(
    files.map(async (f) => {
      const raw = await readFile(PROJECTS_DIR + f, "utf-8");
      const project = JSON.parse(raw);
      return { id: project.id, name: project.name, updatedAt: project.updatedAt };
    })
  );
  res.json(projects);
});

router.get("/:id", async (req, res) => {
  try {
    const raw = await readFile(`${PROJECTS_DIR}${req.params.id}.json`, "utf-8");
    res.json(JSON.parse(raw));
  } catch {
    res.status(404).json({ error: "Projet introuvable" });
  }
});

router.post("/", async (req, res) => {
  const id = randomUUID();
  const project = { ...req.body, id, updatedAt: new Date().toISOString() };
  await mkdir(PROJECTS_DIR, { recursive: true });
  await writeFile(`${PROJECTS_DIR}${id}.json`, JSON.stringify(project, null, 2), "utf-8");
  res.status(201).json(project);
});

router.put("/:id", async (req, res) => {
  const project = { ...req.body, id: req.params.id, updatedAt: new Date().toISOString() };
  await mkdir(PROJECTS_DIR, { recursive: true });
  await writeFile(`${PROJECTS_DIR}${req.params.id}.json`, JSON.stringify(project, null, 2), "utf-8");
  res.json(project);
});

router.delete("/:id", async (req, res) => {
  try {
    await rm(`${PROJECTS_DIR}${req.params.id}.json`);
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Projet introuvable" });
  }
});

export default router;
