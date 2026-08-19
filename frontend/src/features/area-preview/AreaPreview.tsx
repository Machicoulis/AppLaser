import { useEffect, useState } from "react";
import { defaultWidths, filterBySize, LAYER_ORDER, LAYER_STYLE, MODE_LABEL, type LayerLines, type WayCategory } from "../layers/layerStyles";
import type { AreaSelection } from "../map-selection/MapAreaSelector";
import { computeViewBoxSize, isClosedWay, pointsToSvg, project, projectShapeOutline } from "./project";
import "./area-preview.css";

interface AreaPreviewProps {
  selection: AreaSelection;
  onBack: () => void;
  onContinue: (layers: LayerLines, widthsMm: Record<WayCategory, number>) => void;
}

export function AreaPreview({ selection, onBack, onContinue }: AreaPreviewProps) {
  const [layers, setLayers] = useState<LayerLines | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [widthsMm, setWidthsMm] = useState<Record<WayCategory, number>>(defaultWidths);
  const [minWaterSizeM, setMinWaterSizeM] = useState(15);

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

  const { viewWidth, viewHeight } = computeViewBoxSize(selection);
  // le viewBox SVG représente la plaque physique : ce facteur convertit un réglage en mm en unités SVG
  const mmToSvg = viewWidth / selection.plateWidthMm;
  const shapeOutline = projectShapeOutline(selection, viewWidth, viewHeight);
  // exclut les petits plans d'eau (mares, fontaines...) en dessous du seuil choisi
  const displayLayers: LayerLines | null = layers && { ...layers, water: filterBySize(layers.water, minWaterSizeM) };

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

        {displayLayers && (
          <ul className="area-preview__legend">
            {LAYER_ORDER.map((cat) => {
              const style = LAYER_STYLE[cat];
              return (
                <li key={cat}>
                  <span className="area-preview__swatch" style={{ background: style.fill ?? style.stroke }} />
                  <span className="area-preview__legend-label">
                    {style.label} ({displayLayers[cat].length})
                  </span>
                  <span className={`area-preview__mode area-preview__mode--${style.mode}`}>{MODE_LABEL[style.mode]}</span>
                  {style.areaFill ? (
                    <span className="area-preview__fill-only">pleine</span>
                  ) : (
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
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {displayLayers && (
          <label className="area-preview__min-size">
            Taille min. des plans d'eau
            <input
              type="number"
              min={0}
              max={200}
              step={5}
              value={minWaterSizeM}
              onChange={(e) => setMinWaterSizeM(Number(e.target.value))}
            />
            m
          </label>
        )}

        {displayLayers && (
          <button type="button" className="area-preview__continue" onClick={() => onContinue(displayLayers, widthsMm)}>
            Continuer vers la configuration des layers →
          </button>
        )}
      </aside>

      <div className="area-preview__canvas">
        {displayLayers && (
          <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="area-preview__svg">
            <defs>
              <clipPath id="area-preview-shape-clip">
                <polygon points={pointsToSvg(shapeOutline)} />
              </clipPath>
            </defs>
            <rect x={0} y={0} width={viewWidth} height={viewHeight} fill="#fafaf9" />
            <g clipPath="url(#area-preview-shape-clip)">
              {LAYER_ORDER.map((cat) => {
                const style = LAYER_STYLE[cat];
                const strokeWidth = widthsMm[cat] * mmToSvg;
                return displayLayers[cat].map((line, i) => {
                  const projected = line.map(([lat, lng]) => project(selection.bbox, lat, lng, viewWidth, viewHeight));
                  const closed = isClosedWay(line);
                  if (closed && style.fill) {
                    return (
                      <polygon
                        key={`${cat}-${i}`}
                        points={pointsToSvg(projected)}
                        fill={style.fill}
                        stroke={style.areaFill ? "none" : style.stroke}
                        strokeWidth={style.areaFill ? 0 : strokeWidth * 0.5}
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
            </g>
            <polygon points={pointsToSvg(shapeOutline)} fill="none" stroke="#d1d5db" strokeWidth={2} />
          </svg>
        )}
        {loading && (
          <div className="area-preview__loading">
            <div className="area-preview__spinner" />
            <p>Récupération des données OpenStreetMap…</p>
            <p className="area-preview__loading-hint">
              Ça peut prendre jusqu'à une minute si le service OpenStreetMap est lent à répondre.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
