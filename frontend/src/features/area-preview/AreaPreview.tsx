import { useEffect, useState } from "react";
import {
  filterBySize,
  FIXED_ORDER,
  FIXED_STYLE,
  highwayDefaultLayer,
  highwayLabel,
  MODE_LABEL,
  orderHighwayTypes,
  ROAD_LAYER_STYLE,
  type FixedCategory,
  type MapDataResponse,
  type RoadLayer,
} from "../layers/layerStyles";
import type { AreaSelection } from "../map-selection/MapAreaSelector";
import { computeViewBoxSize, isClosedWay, pointsToSvg, project, projectionBbox, projectShapeOutline } from "./project";
import "./area-preview.css";

export interface WidthSettings {
  water: number;
  railway: number;
  layer2Road: number;
  layer3Road: number;
}

const DEFAULT_WIDTHS: WidthSettings = { water: 0.3, railway: 0.5, layer2Road: 0.6, layer3Road: 2 };

const ROAD_LAYER_OPTIONS: { value: RoadLayer; label: string }[] = [
  { value: "layer2", label: "Layer 2 (gravure)" },
  { value: "layer3", label: "Layer 3 (découpe)" },
  { value: "exclude", label: "Exclure" },
];

interface AreaPreviewProps {
  selection: AreaSelection;
  onBack: () => void;
  onContinue: (data: MapDataResponse, roadAssignment: Record<string, RoadLayer>, widthsMm: WidthSettings) => void;
}

export function AreaPreview({ selection, onBack, onContinue }: AreaPreviewProps) {
  const [data, setData] = useState<MapDataResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [widthsMm, setWidthsMm] = useState<WidthSettings>(DEFAULT_WIDTHS);
  const [minWaterSizeM, setMinWaterSizeM] = useState(15);
  const [roadAssignment, setRoadAssignment] = useState<Record<string, RoadLayer>>({});

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
      .then((result: MapDataResponse) => {
        setData(result);
        setRoadAssignment(Object.fromEntries(Object.keys(result.roads).map((type) => [type, highwayDefaultLayer(type)])));
      })
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
  const projBbox = projectionBbox(selection);
  // exclut les petits plans d'eau (mares, fontaines...) en dessous du seuil choisi
  const displayData: MapDataResponse | null = data && { ...data, water: filterBySize(data.water, minWaterSizeM) };
  const roadTypes = data ? orderHighwayTypes(Object.keys(data.roads)) : [];

  function setWidth<K extends keyof WidthSettings>(key: K, mm: number) {
    setWidthsMm((prev) => ({ ...prev, [key]: mm }));
  }

  function renderLine(key: string, style: { stroke: string; fill?: string; mode: "gravure" | "decoupe"; dash?: string; areaFill?: boolean }, strokeWidth: number, line: [number, number][], i: number) {
    const projected = line.map(([lat, lng]) => project(projBbox, lat, lng, viewWidth, viewHeight));
    const closed = isClosedWay(line);
    if (closed && style.fill) {
      return (
        <polygon
          key={`${key}-${i}`}
          points={pointsToSvg(projected)}
          fill={style.fill}
          stroke={style.areaFill ? "none" : style.stroke}
          strokeWidth={style.areaFill ? 0 : strokeWidth * 0.5}
        />
      );
    }
    return (
      <polyline
        key={`${key}-${i}`}
        points={pointsToSvg(projected)}
        fill="none"
        stroke={style.stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={style.dash}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  return (
    <div className="area-preview">
      <aside className="area-preview__panel">
        <button type="button" onClick={onBack} className="area-preview__back">
          ← Retour à la sélection
        </button>
        <h2>Aperçu des données</h2>
        <p className="area-preview__hint">Choisissez, pour chaque type de route trouvé, s'il va au Layer 2 (gravure), au Layer 3 (découpe), ou s'il est exclu.</p>

        {loading && <p>Récupération des données OpenStreetMap…</p>}
        {error && <p className="area-preview__error">{error}</p>}

        {displayData && (
          <>
            <ul className="area-preview__legend">
              {FIXED_ORDER.map((cat: FixedCategory) => {
                const style = FIXED_STYLE[cat];
                return (
                  <li key={cat}>
                    <span className="area-preview__swatch" style={{ background: style.fill ?? style.stroke }} />
                    <span className="area-preview__legend-label">
                      {style.label} ({displayData[cat].length})
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
                          value={widthsMm.railway}
                          onChange={(e) => setWidth("railway", Number(e.target.value))}
                        />
                        mm
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>

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

            <fieldset className="area-preview__road-types">
              <legend>Types de routes (OpenStreetMap)</legend>
              {roadTypes.length === 0 && <p className="area-preview__hint">Aucune route trouvée dans cette zone.</p>}
              {roadTypes.map((type) => {
                const assignment = roadAssignment[type] ?? "layer2";
                return (
                  <div key={type} className="area-preview__road-row">
                    <span className="area-preview__road-label">
                      {highwayLabel(type)} ({data!.roads[type].length})
                    </span>
                    <select
                      value={assignment}
                      onChange={(e) => setRoadAssignment((prev) => ({ ...prev, [type]: e.target.value as RoadLayer }))}
                    >
                      {ROAD_LAYER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </fieldset>

            <div className="area-preview__road-widths">
              <label className="area-preview__width-input">
                <input
                  type="number"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={widthsMm.layer2Road}
                  onChange={(e) => setWidth("layer2Road", Number(e.target.value))}
                />
                mm — routes Layer 2
              </label>
              <label className="area-preview__width-input">
                <input
                  type="number"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={widthsMm.layer3Road}
                  onChange={(e) => setWidth("layer3Road", Number(e.target.value))}
                />
                mm — routes Layer 3
              </label>
            </div>

            <button
              type="button"
              className="area-preview__continue"
              onClick={() => onContinue(displayData, roadAssignment, widthsMm)}
            >
              Continuer vers la configuration des layers →
            </button>
          </>
        )}
      </aside>

      <div className="area-preview__canvas">
        {displayData && (
          <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="area-preview__svg">
            <defs>
              <clipPath id="area-preview-shape-clip">
                <polygon points={pointsToSvg(shapeOutline)} />
              </clipPath>
            </defs>
            <rect x={0} y={0} width={viewWidth} height={viewHeight} fill="#fafaf9" />
            <g clipPath="url(#area-preview-shape-clip)">
              {FIXED_ORDER.map((cat: FixedCategory) => {
                const style = FIXED_STYLE[cat];
                const strokeWidth = (cat === "railway" ? widthsMm.railway : widthsMm.water) * mmToSvg;
                return displayData[cat].map((line, i) => renderLine(cat, style, strokeWidth, line, i));
              })}
              {roadTypes.map((type) => {
                const assignment = roadAssignment[type] ?? "layer2";
                if (assignment === "exclude") return null;
                const style = ROAD_LAYER_STYLE[assignment];
                const strokeWidth = (assignment === "layer2" ? widthsMm.layer2Road : widthsMm.layer3Road) * mmToSvg;
                return displayData.roads[type].map((line, i) => renderLine(type, style, strokeWidth, line, i));
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
