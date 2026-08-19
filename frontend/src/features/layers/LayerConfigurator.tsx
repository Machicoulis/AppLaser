import { useRef, useState } from "react";
import { computeViewBoxSize, isClosedWay, offsetShapeOutline, pointsToSvg, project, projectShapeOutline } from "../area-preview/project";
import type { AreaSelection } from "../map-selection/MapAreaSelector";
import { DraggableText, type TextPosition } from "./DraggableText";
import { LAYER2_OPTIONAL, LAYER_STYLE, MODE_LABEL, type LayerLines, type WayCategory } from "./layerStyles";
import "./layer-configurator.css";

type Tab = "layer1" | "layer2" | "layer3";

const FONT_GROUPS = [
  {
    label: "Gravure (formes pleines)",
    options: [
      { value: "Arial, sans-serif", label: "Sans-serif" },
      { value: "Georgia, serif", label: "Serif" },
    ],
  },
  {
    label: "Découpe (polices stencil, sans îlot)",
    options: [
      { value: "'Allerta Stencil', sans-serif", label: "Allerta Stencil" },
      { value: "'Saira Stencil One', sans-serif", label: "Saira Stencil One" },
      { value: "'Stardos Stencil', cursive", label: "Stardos Stencil" },
      { value: "'Big Shoulders Stencil Display', sans-serif", label: "Big Shoulders Stencil" },
    ],
  },
];

// Épaisseur fixe du cadre autour de la carte — pas encore configurable, cf. limitations en fin de développement.
const FRAME_THICKNESS_MM = 25;

interface LayerConfiguratorProps {
  selection: AreaSelection;
  layers: LayerLines;
  initialWidthsMm: Record<WayCategory, number>;
  onBack: () => void;
}

export function LayerConfigurator({ selection, layers, initialWidthsMm, onBack }: LayerConfiguratorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tab, setTab] = useState<Tab>("layer1");
  const [widthsMm, setWidthsMm] = useState(initialWidthsMm);
  const [layer2Enabled, setLayer2Enabled] = useState<Record<string, boolean>>({ park: true, railway: true, path: true });

  const [cityName, setCityName] = useState("");
  const [font, setFont] = useState(FONT_GROUPS[0].options[0].value);
  const [titleSizeMm, setTitleSizeMm] = useState(12);
  const [outerRadiusMm, setOuterRadiusMm] = useState(8);
  const [innerRadiusMm, setInnerRadiusMm] = useState(4);
  const [showCoordinates, setShowCoordinates] = useState(false);

  const { viewWidth, viewHeight } = computeViewBoxSize(selection);
  const mmToSvg = viewWidth / selection.plateWidthMm;
  const shapeOutline = projectShapeOutline(selection, viewWidth, viewHeight);
  const isRect = selection.shape.type === "rectangle";

  // Positions par défaut du titre/coordonnées : sous la carte, dans la marge du cadre — ajustées une fois puis laissées à l'utilisateur.
  const [titlePos, setTitlePos] = useState<TextPosition>(() => ({
    x: viewWidth / 2,
    y: viewHeight + FRAME_THICKNESS_MM * mmToSvg * 0.65,
    rotationDeg: 0,
  }));
  const [coordsPos, setCoordsPos] = useState<TextPosition>(() => ({
    x: viewWidth / 2,
    y: viewHeight + FRAME_THICKNESS_MM * mmToSvg * 0.65 + titleSizeMm * mmToSvg * 1.4,
    rotationDeg: 0,
  }));

  // Pas de grand axe routier dans la zone : les routes secondaires servent de repli en découpe, sinon le Layer 3 serait vide de routes.
  const majorRoadFallback = layers.majorRoad.length === 0 && layers.minorRoad.length > 0;
  const layer3Roads = majorRoadFallback ? layers.minorRoad : layers.majorRoad;

  function handleWidthChange(cat: WayCategory, mm: number) {
    setWidthsMm((prev) => ({ ...prev, [cat]: mm }));
  }

  function renderLine(cat: WayCategory, line: [number, number][], i: number) {
    const style = LAYER_STYLE[cat];
    const strokeWidth = widthsMm[cat] * mmToSvg;
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
  }

  function renderClippedContent(categories: WayCategory[], clipId: string) {
    return (
      <>
        <defs>
          <clipPath id={clipId}>
            <polygon points={pointsToSvg(shapeOutline)} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {categories.map((cat) => layers[cat].map((line, i) => renderLine(cat, line, i)))}
        </g>
        <polygon points={pointsToSvg(shapeOutline)} fill="none" stroke="#d1d5db" strokeWidth={2} />
      </>
    );
  }

  const centerLat = (selection.bbox.south + selection.bbox.north) / 2;
  const centerLng = (selection.bbox.west + selection.bbox.east) / 2;
  const coordinatesText = `${centerLat.toFixed(4)}° N, ${centerLng.toFixed(4)}° E`;

  function renderLayer3() {
    const marginSvg = FRAME_THICKNESS_MM * mmToSvg;
    const extraBottomSvg = showCoordinates ? titleSizeMm * mmToSvg * 1.8 : 0;
    const outerRadiusSvg = outerRadiusMm * mmToSvg;
    const innerRadiusSvg = innerRadiusMm * mmToSvg;
    const titleSizeSvg = titleSizeMm * mmToSvg;

    const outerX = -marginSvg;
    const outerY = -marginSvg;
    const outerW = viewWidth + marginSvg * 2;
    const outerH = viewHeight + marginSvg * 2 + extraBottomSvg;

    return (
      <>
        {isRect ? (
          <>
            <rect x={outerX} y={outerY} width={outerW} height={outerH} rx={outerRadiusSvg} fill="#f5f5f4" stroke="#1f2937" strokeWidth={2} />
            <rect x={0} y={0} width={viewWidth} height={viewHeight} rx={innerRadiusSvg} fill="white" stroke="#9ca3af" strokeWidth={1.5} />
          </>
        ) : (
          <>
            {/* Cercle/polygone : cadre en marge uniforme (agrandi depuis le centroïde), sans réglage d'arrondi séparé */}
            <polygon
              points={pointsToSvg(offsetShapeOutline(shapeOutline, marginSvg))}
              fill="#f5f5f4"
              stroke="#1f2937"
              strokeWidth={2}
            />
            <polygon points={pointsToSvg(shapeOutline)} fill="white" stroke="#9ca3af" strokeWidth={1.5} />
          </>
        )}

        <defs>
          <clipPath id="layer3-clip">
            <polygon points={pointsToSvg(shapeOutline)} />
          </clipPath>
        </defs>
        <g clipPath="url(#layer3-clip)">{layer3Roads.map((line, i) => renderLine("majorRoad", line, i))}</g>

        {cityName && (
          <DraggableText svgRef={svgRef} position={titlePos} onChange={setTitlePos} fontFamily={font} fontSize={titleSizeSvg} fill="#1f2937">
            {cityName.toUpperCase()}
          </DraggableText>
        )}
        {showCoordinates && (
          <DraggableText
            svgRef={svgRef}
            position={coordsPos}
            onChange={setCoordsPos}
            fontFamily={font}
            fontSize={titleSizeSvg * 0.55}
            fill="#4b5563"
          >
            {coordinatesText}
          </DraggableText>
        )}
      </>
    );
  }

  return (
    <div className="layer-configurator">
      <aside className="layer-configurator__panel">
        <button type="button" onClick={onBack} className="layer-configurator__back">
          ← Retour à l'aperçu
        </button>
        <h2>Configuration des layers</h2>

        <div className="layer-configurator__tabs">
          <button type="button" className={tab === "layer1" ? "active" : ""} onClick={() => setTab("layer1")}>
            Layer 1 — Fond
          </button>
          <button type="button" className={tab === "layer2" ? "active" : ""} onClick={() => setTab("layer2")}>
            Layer 2 — Gravure
          </button>
          <button type="button" className={tab === "layer3" ? "active" : ""} onClick={() => setTab("layer3")}>
            Layer 3 — Découpe
          </button>
        </div>

        {tab === "layer1" && (
          <div className="layer-configurator__section">
            <p className="layer-configurator__hint">
              Plaque pleine : seul le contour extérieur est découpé. À peindre en bleu (ou laisser neutre) après fabrication —
              elle apparaîtra par transparence à travers les découpes du Layer 2.
            </p>
          </div>
        )}

        {tab === "layer2" && (
          <div className="layer-configurator__section">
            <p className="layer-configurator__hint">Routes secondaires et plans d'eau toujours inclus. Le reste est optionnel.</p>
            {LAYER2_OPTIONAL.map((cat) => (
              <label key={cat} className="layer-configurator__checkbox">
                <input
                  type="checkbox"
                  checked={layer2Enabled[cat]}
                  onChange={(e) => setLayer2Enabled((prev) => ({ ...prev, [cat]: e.target.checked }))}
                />
                {LAYER_STYLE[cat].label} ({layers[cat].length})
              </label>
            ))}
            <ul className="layer-configurator__legend">
              {(["minorRoad", "water", ...LAYER2_OPTIONAL.filter((c) => layer2Enabled[c])] as WayCategory[]).map((cat) => (
                <li key={cat}>
                  <span className="layer-configurator__swatch" style={{ background: LAYER_STYLE[cat].fill ?? LAYER_STYLE[cat].stroke }} />
                  {LAYER_STYLE[cat].label}
                  <span className={`layer-configurator__mode layer-configurator__mode--${LAYER_STYLE[cat].mode}`}>
                    {MODE_LABEL[LAYER_STYLE[cat].mode]}
                  </span>
                  {!LAYER_STYLE[cat].areaFill && (
                    <label className="layer-configurator__width-input">
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
              ))}
            </ul>
          </div>
        )}

        {tab === "layer3" && (
          <div className="layer-configurator__section">
            <label className="layer-configurator__width-input">
              <input
                type="number"
                min={0.1}
                max={5}
                step={0.1}
                value={widthsMm.majorRoad}
                onChange={(e) => handleWidthChange("majorRoad", Number(e.target.value))}
              />
              mm — {LAYER_STYLE.majorRoad.label}
            </label>
            {majorRoadFallback && (
              <p className="layer-configurator__fallback-note">
                Aucun grand axe routier dans cette zone : les routes secondaires sont utilisées en découpe à la place, pour
                que le Layer 3 ne reste pas vide.
              </p>
            )}

            <fieldset>
              <legend>Cadre et titre</legend>
              <p className="layer-configurator__hint">Faites glisser le texte pour le déplacer, la poignée ronde au-dessus pour l'orienter.</p>
              <label>
                Nom de la ville
                <input type="text" value={cityName} onChange={(e) => setCityName(e.target.value)} placeholder="ex. Pavia" />
              </label>
              <label>
                Police
                <select value={font} onChange={(e) => setFont(e.target.value)}>
                  {FONT_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label>
                Taille du texte (mm)
                <input type="number" min={4} max={40} value={titleSizeMm} onChange={(e) => setTitleSizeMm(Number(e.target.value))} />
              </label>
              {isRect && (
                <>
                  <label>
                    Arrondi extérieur (mm)
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={outerRadiusMm}
                      onChange={(e) => setOuterRadiusMm(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Arrondi intérieur (mm)
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={innerRadiusMm}
                      onChange={(e) => setInnerRadiusMm(Number(e.target.value))}
                    />
                  </label>
                </>
              )}
              <label className="layer-configurator__checkbox">
                <input type="checkbox" checked={showCoordinates} onChange={(e) => setShowCoordinates(e.target.checked)} />
                Afficher les coordonnées ({coordinatesText})
              </label>
            </fieldset>
          </div>
        )}
      </aside>

      <div className="layer-configurator__canvas">
        <svg
          ref={svgRef}
          viewBox={`${-FRAME_THICKNESS_MM * mmToSvg - 10} ${-FRAME_THICKNESS_MM * mmToSvg - 10} ${
            viewWidth + FRAME_THICKNESS_MM * mmToSvg * 2 + 20
          } ${viewHeight + FRAME_THICKNESS_MM * mmToSvg * 2 + (showCoordinates ? titleSizeMm * mmToSvg * 1.8 : 0) + 20}`}
          className="layer-configurator__svg"
        >
          <rect x={-5000} y={-5000} width={10000} height={10000} fill="#fafaf9" />
          {tab === "layer1" && <polygon points={pointsToSvg(shapeOutline)} fill="white" stroke="#1f2937" strokeWidth={2} />}
          {tab === "layer2" &&
            renderClippedContent(["minorRoad", "water", ...LAYER2_OPTIONAL.filter((c) => layer2Enabled[c])], "layer2-clip")}
          {tab === "layer3" && renderLayer3()}
        </svg>
      </div>
    </div>
  );
}
