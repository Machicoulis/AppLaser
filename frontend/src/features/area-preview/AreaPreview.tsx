import { useEffect, useState } from "react";
import type { AreaSelection } from "../map-selection/MapAreaSelector";
import { isClosedWay, pointsToSvg, project, VIEWBOX_SIZE } from "./project";
import "./area-preview.css";

type WayCategory = "majorRoad" | "minorRoad" | "path" | "water" | "park" | "railway";
type LayerLines = Record<WayCategory, [number, number][][]>;

const LAYER_STYLE: Record<WayCategory, { label: string; stroke: string; fill?: string; defaultWidthMm: number; dash?: string }> = {
  majorRoad: { label: "Grands axes routiers", stroke: "#1f2937", defaultWidthMm: 1.2 },
  minorRoad: { label: "Routes secondaires", stroke: "#6b7280", defaultWidthMm: 0.6 },
  path: { label: "Chemins / allées", stroke: "#9ca3af", defaultWidthMm: 0.3, dash: "2,2" },
  water: { label: "Plans d'eau", stroke: "#3b82f6", fill: "#93c5fd", defaultWidthMm: 0.3 },
  park: { label: "Parcs", stroke: "#22c55e", fill: "#bbf7d0", defaultWidthMm: 0.3 },
  railway: { label: "Voies ferrées", stroke: "#78350f", defaultWidthMm: 0.5, dash: "4,2" },
};

function defaultWidths(): Record<WayCategory, number> {
  return Object.fromEntries(
    Object.entries(LAYER_STYLE).map(([cat, style]) => [cat, style.defaultWidthMm])
  ) as Record<WayCategory, number>;
}

const LAYER_ORDER: WayCategory[] = ["park", "water", "path", "minorRoad", "railway", "majorRoad"];

interface AreaPreviewProps {
  selection: AreaSelection;
  onBack: () => void;
}

export function AreaPreview({ selection, onBack }: AreaPreviewProps) {
  const [layers, setLayers] = useState<LayerLines | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [widthsMm, setWidthsMm] = useState<Record<WayCategory, number>>(defaultWidths);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch("http://localhost:4000/api/mapdata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bbox: selection.bbox }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        return res.json();
      })
      .then((data: LayerLines) => setLayers(data))
      .catch((err) => {
        if (err.name === "AbortError") return; // requête annulée (démontage / re-render), pas une vraie erreur
        setError("Impossible de récupérer les données OpenStreetMap (backend ou réseau indisponible).");
      })
      .finally(() => {
        // si la requête a été annulée (cf. cleanup ci-dessous), une requête plus récente est en cours : ne pas la couper court
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [selection]);

  const aspectRatio = selection.plateWidthMm / selection.plateHeightMm;
  const viewWidth = aspectRatio >= 1 ? VIEWBOX_SIZE : VIEWBOX_SIZE * aspectRatio;
  const viewHeight = aspectRatio >= 1 ? VIEWBOX_SIZE / aspectRatio : VIEWBOX_SIZE;
  // le viewBox SVG représente la plaque physique : ce facteur convertit un réglage en mm en unités SVG
  const mmToSvg = viewWidth / selection.plateWidthMm;

  function handleWidthChange(cat: WayCategory, mm: number) {
    setWidthsMm((prev) => ({ ...prev, [cat]: mm }));
  }

  return (
    <div className="area-preview">
      <aside className="area-preview__panel">
        <button type="button" onClick={onBack} className="area-preview__back">
          ← Retour à la sélection
        </button>
        <h2>Aperçu des données</h2>
        <p className="area-preview__hint">
          Vérifiez que la zone récupérée correspond à ce que vous attendiez avant de configurer les layers.
        </p>

        {loading && <p>Récupération des données OpenStreetMap…</p>}
        {error && <p className="area-preview__error">{error}</p>}

        {layers && (
          <ul className="area-preview__legend">
            {LAYER_ORDER.map((cat) => (
              <li key={cat}>
                <span className="area-preview__swatch" style={{ background: LAYER_STYLE[cat].fill ?? LAYER_STYLE[cat].stroke }} />
                <span className="area-preview__legend-label">
                  {LAYER_STYLE[cat].label} ({layers[cat].length})
                </span>
                <label className="area-preview__width-input">
                  <input
                    type="number"
                    min={0.1}
                    max={5}
                    step={0.1}
                    value={widthsMm[cat]}
                    onChange={(e) => handleWidthChange(cat, Number(e.target.value))}
                  />
                  mm
                </label>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="area-preview__canvas">
        {layers && (
          <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="area-preview__svg">
            <rect x={0} y={0} width={viewWidth} height={viewHeight} fill="#fafaf9" />
            {LAYER_ORDER.map((cat) => {
              const style = LAYER_STYLE[cat];
              const strokeWidth = widthsMm[cat] * mmToSvg;
              return layers[cat].map((line, i) => {
                const projected = line.map(([lat, lng]) => project(selection.bbox, lat, lng, viewWidth, viewHeight));
                const closed = isClosedWay(line);
                if (closed && style.fill) {
                  return (
                    <polygon
                      key={`${cat}-${i}`}
                      points={pointsToSvg(projected)}
                      fill={style.fill}
                      stroke={style.stroke}
                      strokeWidth={strokeWidth * 0.5}
                    />
                  );
                }
                return (
                  <polyline
                    key={`${cat}-${i}`}
                    points={pointsToSvg(projected)}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth={strokeWidth}
                    strokeDasharray={style.dash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              });
            })}
          </svg>
        )}
        {loading && (
          <div className="area-preview__loading">
            <div className="area-preview__spinner" />
            <p>Récupération des données OpenStreetMap…</p>
            <p className="area-preview__loading-hint">Ça peut prendre 10 à 30 secondes selon la taille de la zone.</p>
          </div>
        )}
      </div>
    </div>
  );
}
