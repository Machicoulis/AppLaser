import { useEffect, useState } from "react";
import type { AreaSelection } from "../map-selection/MapAreaSelector";
import { isClosedWay, pointsToSvg, project, VIEWBOX_SIZE } from "./project";
import "./area-preview.css";

type WayCategory = "majorRoad" | "minorRoad" | "path" | "water" | "park" | "railway";
type LayerLines = Record<WayCategory, [number, number][][]>;

const LAYER_STYLE: Record<WayCategory, { label: string; stroke: string; fill?: string; strokeWidth: number; dash?: string }> = {
  majorRoad: { label: "Grands axes routiers", stroke: "#1f2937", strokeWidth: 2.5 },
  minorRoad: { label: "Routes secondaires", stroke: "#6b7280", strokeWidth: 1.2 },
  path: { label: "Chemins / allées", stroke: "#9ca3af", strokeWidth: 0.6, dash: "2,2" },
  water: { label: "Plans d'eau", stroke: "#3b82f6", fill: "#93c5fd", strokeWidth: 1 },
  park: { label: "Parcs", stroke: "#22c55e", fill: "#bbf7d0", strokeWidth: 1 },
  railway: { label: "Voies ferrées", stroke: "#78350f", strokeWidth: 1, dash: "4,2" },
};

const LAYER_ORDER: WayCategory[] = ["park", "water", "path", "minorRoad", "railway", "majorRoad"];

interface AreaPreviewProps {
  selection: AreaSelection;
  onBack: () => void;
}

export function AreaPreview({ selection, onBack }: AreaPreviewProps) {
  const [layers, setLayers] = useState<LayerLines | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("http://localhost:4000/api/mapdata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bbox: selection.bbox }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        return res.json();
      })
      .then((data: LayerLines) => setLayers(data))
      .catch(() => setError("Impossible de récupérer les données OpenStreetMap (backend ou réseau indisponible)."))
      .finally(() => setLoading(false));
  }, [selection]);

  const aspectRatio = selection.plateWidthMm / selection.plateHeightMm;
  const viewWidth = aspectRatio >= 1 ? VIEWBOX_SIZE : VIEWBOX_SIZE * aspectRatio;
  const viewHeight = aspectRatio >= 1 ? VIEWBOX_SIZE / aspectRatio : VIEWBOX_SIZE;

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
                {LAYER_STYLE[cat].label} ({layers[cat].length})
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
                      strokeWidth={style.strokeWidth * 0.3}
                    />
                  );
                }
                return (
                  <polyline
                    key={`${cat}-${i}`}
                    points={pointsToSvg(projected)}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth={style.strokeWidth}
                    strokeDasharray={style.dash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              });
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
