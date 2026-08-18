import cors from "cors";
import express from "express";
import gcodeRouter from "./routes/gcode.js";
import geocodeRouter from "./routes/geocode.js";
import mapdataRouter from "./routes/mapdata.js";
import overpassRouter from "./routes/overpass.js";
import presetsRouter from "./routes/presets.js";
import projectsRouter from "./routes/projects.js";

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/overpass", overpassRouter);
app.use("/api/geocode", geocodeRouter);
app.use("/api/mapdata", mapdataRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/presets", presetsRouter);
app.use("/api/gcode", gcodeRouter);

app.listen(PORT, () => {
  console.log(`Backend AppLaser en écoute sur http://localhost:${PORT}`);
});
