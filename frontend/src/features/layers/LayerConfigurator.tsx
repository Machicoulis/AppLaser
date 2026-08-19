import { useRef, useState } from "react";
import { computeViewBoxSize, isClosedWay, offsetShapeOutline, pointsToSvg, project, projectShapeOutline } from "../area-preview/project";
import type { WidthSettings } from "../area-preview/AreaPreview";
import type { AreaSelection } from "../map-selection/MapAreaSelector";
import { DraggableText, type TextPosition } from "./DraggableText";
import {
  FIXED_OPTIONAL,
  FIXED_STYLE,
  ROAD_LAYER_STYLE,
  type CategoryStyle,
  type FixedCategory,
  type MapDataResponse,
  type RoadLayer,
} from "./layerStyles";
import "./layer-configurator.css";

type Tab = "layer1" | "layer2" | "layer3";
type Line = [number, number][];

const FONT_GROUPS = [
  {
    label: "Gravure (formes pleines)",
    options: [
      { value: "Arial, sans-serif", label: "Sans-serif" },
      { value: "Georgia, serif", label: "Serif" },
    ],
  },
  {
    label: "Gravure — polices grasses (traits épais, bien visibles)",
    options: [
      { value: "'Archivo Black', sans-serif", label: "Archivo Black" },
      { value: "'Anton', sans-serif", label: "Anton" },
      { value: "'Poppins', sans-serif", label: "Poppins" },
      { value: "'Montserrat', sans-serif", label: "Montserrat" },
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

const WEIGHT_OPTIONS = [
  { value: 400, label: "Normal" },
  { value: 700, label: "Gras" },
  { value: 900, label: "Extra gras" },
];

// Épaisseur fixe du cadre autour de la carte — pas encore configurable, cf. limitations en fin de développement.
const FRAME_THICKNESS_MM = 25;

interface LayerConfiguratorProps {
  selection: AreaSelection;
  data: MapDataResponse;
  roadAssignment: Record<string, RoadLayer>;
  initialWidthsMm: WidthSettings;
  onBack: () => void;
}

export function LayerConfigurator({ selection, data, roadAssignment, initialWidthsMm, onBack }: LayerConfiguratorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tab, setTab] = useState<Tab>("layer1");
  const [widthsMm, setWidthsMm] = useState(initialWidthsMm);
  const [fixedEnabled, setFixedEnabled] = useState<Record<string, boolean>>({ park: true, railway: true });

  const [cityName, setCityName] = useState("");
  const [font, setFont] = useState(FONT_GROUPS[0].options[0].value);
  const [fontWeight, setFontWeight] = useState(700);
  const [titleSizeMm, setTitleSizeMm] = useState(12);
  const [outerRadiusMm, setOuterRadiusMm] = useState(8);
  const [innerRadiusMm, setInnerRadiusMm] = useState(4);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [titleMode, setTitleMode] = useState<"gravure" | "decoupe">("gravure");

  const { viewWidth, viewHeight } = computeViewBoxSize(selection);
  const mmToSvg = viewWidth / selection.plateWidthMm;
  const shapeOutline = projectShapeOutline(selection, viewWidth, viewHeight);
  const isRect = selection.shape.type === "rectangle";

  // Regroupe les lignes de chaque type de route selon l'affectation choisie à l'étape précédente.
  const layer2Roads: Line[] = Object.entries(data.roads).flatMap(([type, lines]) => (roadAssignment[type] === "layer2" ? lines : []));
  let layer3Roads: Line[] = Object.entries(data.roads).flatMap(([type, lines]) => (roadAssignment[type] === "layer3" ? lines : []));
  // Aucune route affectée au Layer 3 : les routes du Layer 2 servent de repli en découpe, sinon le Layer 3 serait vide.
  const majorRoadFallback = layer3Roads.length === 0 && layer2Roads.length > 0;
  if (majorRoadFallback) layer3Roads = layer2Roads;

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

  // Mode découpe : le texte doit chevaucher le cadre de 1mm (comme les routes principales qui traversent la bordure)
  // pour rester rattaché au cadre une fois découpé, plutôt que de former des lettres isolées et détachées.
  function snapToFrame(pos: TextPosition): TextPosition {
    const overlapSvg = 1 * mmToSvg;
    if (isRect) {
      const distances = {
        top: pos.y,
        bottom: viewHeight - pos.y,
        left: pos.x,
        right: viewWidth - pos.x,
      };
      const nearestEdge = (Object.entries(distances) as [keyof typeof distances, number][]).reduce((a, b) =>
        b[1] < a[1] ? b : a
      )[0];
      if (nearestEdge === "top") return { ...pos, y: -overlapSvg };
      if (nearestEdge === "bottom") return { ...pos, y: viewHeight + overlapSvg };
      if (nearestEdge === "left") return { ...pos, x: -overlapSvg };
      return { ...pos, x: viewWidth + overlapSvg };
    }
    // Cercle/polygone : accroche radiale depuis le centroïde de la forme.
    const cx = shapeOutline.reduce((sum, [x]) => sum + x, 0) / shapeOutline.length;
    const cy = shapeOutline.reduce((sum, [, y]) => sum + y, 0) / shapeOutline.length;
    const shapeRadius = shapeOutline.reduce((sum, [x, y]) => sum + Math.hypot(x - cx, y - cy), 0) / shapeOutline.length;
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const targetDist = shapeRadius + overlapSvg;
    return { ...pos, x: cx + (dx / dist) * targetDist, y: cy + (dy / dist) * targetDist };
  }

  function handleTitleDragEnd(pos: TextPosition) {
    if (titleMode === "decoupe") setTitlePos(snapToFrame(pos));
  }

  function renderLine(key: string, style: Pick<CategoryStyle, "stroke" | "fill" | "mode" | "dash" | "areaFill">, strokeWidth: number, line: Line, i: number) {
    const projected = line.map(([lat, lng]) => project(selection.bbox, lat, lng, viewWidth, viewHeight));
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

  function renderLayer2() {
    return (
      <>
        <defs>
          <clipPath id="layer2-clip">
            <polygon points={pointsToSvg(shapeOutline)} />
          </clipPath>
        </defs>
        <g clipPath="url(#layer2-clip)">
          {fixedEnabled.park && data.park.map((line, i) => renderLine("park", FIXED_STYLE.park, 0, line, i))}
          {data.water.map((line, i) => renderLine("water", FIXED_STYLE.water, 0, line, i))}
          {fixedEnabled.railway &&
            data.railway.map((line, i) => renderLine("railway", FIXED_STYLE.railway, widthsMm.railway * mmToSvg, line, i))}
          {layer2Roads.map((line, i) => renderLine("layer2Road", ROAD_LAYER_STYLE.layer2, widthsMm.layer2Road * mmToSvg, line, i))}
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
        <g clipPath="url(#layer3-clip)">
          {layer3Roads.map((line, i) => renderLine("layer3Road", ROAD_LAYER_STYLE.layer3, widthsMm.layer3Road * mmToSvg, line, i))}
        </g>

        {cityName && (
          <DraggableText
            svgRef={svgRef}
            position={titlePos}
            onChange={setTitlePos}
            onDragEnd={handleTitleDragEnd}
            fontFamily={font}
            fontWeight={fontWeight}
            fontSize={titleSizeSvg}
            fill={titleMode === "decoupe" ? "#1e3a8a" : "#1f2937"}
          >
            {cityName.toUpperCase()}
          </DraggableText>
        )}
        {showCoordinates && (
          <DraggableText
            svgRef={svgRef}
            position={coordsPos}
            onChange={setCoordsPos}
            fontFamily={font}
            fontWeight={fontWeight}
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
            <p className="layer-configurator__hint">
              Les plans d'eau ({data.water.length}) sont affichés en transparence à titre indicatif — un repère pour la
              peinture, pas un élément gravé ou découpé sur cette plaque.
            </p>
          </div>
        )}

        {tab === "layer2" && (
          <div className="layer-configurator__section">
            <p className="layer-configurator__hint">
              Routes assignées au Layer 2 à l'étape précédente ({layer2Roads.length}) et plans d'eau toujours inclus. Parcs et
              voies ferrées sont optionnels.
            </p>
            {FIXED_OPTIONAL.map((cat: FixedCategory) => (
              <label key={cat} className="layer-configurator__checkbox">
                <input
                  type="checkbox"
                  checked={fixedEnabled[cat]}
                  onChange={(e) => setFixedEnabled((prev) => ({ ...prev, [cat]: e.target.checked }))}
                />
                {FIXED_STYLE[cat].label} ({data[cat].length})
              </label>
            ))}
            <ul className="layer-configurator__legend">
              <li>
                <span className="layer-configurator__swatch" style={{ background: ROAD_LAYER_STYLE.layer2.stroke }} />
                Routes ({layer2Roads.length})
                <span className="layer-configurator__mode layer-configurator__mode--gravure">gravure</span>
                <label className="layer-configurator__width-input">
                  <input
                    type="number"
                    min={0.1}
                    max={5}
                    step={0.1}
                    value={widthsMm.layer2Road}
                    onChange={(e) => setWidthsMm((prev) => ({ ...prev, layer2Road: Number(e.target.value) }))}
                  />
                  mm
                </label>
              </li>
              <li>
                <span className="layer-configurator__swatch" style={{ background: FIXED_STYLE.water.fill }} />
                {FIXED_STYLE.water.label}
                <span className="layer-configurator__mode layer-configurator__mode--decoupe">découpe</span>
                <span className="layer-configurator__fill-only">pleine</span>
              </li>
              {fixedEnabled.park && (
                <li>
                  <span className="layer-configurator__swatch" style={{ background: FIXED_STYLE.park.fill }} />
                  {FIXED_STYLE.park.label}
                  <span className="layer-configurator__mode layer-configurator__mode--gravure">gravure</span>
                  <span className="layer-configurator__fill-only">pleine</span>
                </li>
              )}
              {fixedEnabled.railway && (
                <li>
                  <span className="layer-configurator__swatch" style={{ background: FIXED_STYLE.railway.stroke }} />
                  {FIXED_STYLE.railway.label}
                  <span className="layer-configurator__mode layer-configurator__mode--gravure">gravure</span>
                  <label className="layer-configurator__width-input">
                    <input
                      type="number"
                      min={0.1}
                      max={5}
                      step={0.1}
                      value={widthsMm.railway}
                      onChange={(e) => setWidthsMm((prev) => ({ ...prev, railway: Number(e.target.value) }))}
                    />
                    mm
                  </label>
                </li>
              )}
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
                value={widthsMm.layer3Road}
                onChange={(e) => setWidthsMm((prev) => ({ ...prev, layer3Road: Number(e.target.value) }))}
              />
              mm — Routes Layer 3 ({layer3Roads.length})
            </label>
            {majorRoadFallback && (
              <p className="layer-configurator__fallback-note">
                Aucune route affectée au Layer 3 à l'étape précédente : les routes du Layer 2 sont utilisées en découpe à la
                place, pour que le Layer 3 ne reste pas vide.
              </p>
            )}

            <fieldset>
              <legend>Cadre et titre</legend>
              <p className="layer-configurator__hint">Faites glisser le texte pour le déplacer, la poignée ronde au-dessus pour l'orienter.</p>
              <label>
                Nom de la ville
                <input type="text" value={cityName} onChange={(e) => setCityName(e.target.value)} placeholder="ex. Pavia" />
              </label>
              <div className="layer-configurator__mode-toggle">
                <button
                  type="button"
                  className={titleMode === "gravure" ? "active" : ""}
                  onClick={() => setTitleMode("gravure")}
                >
                  Gravure
                </button>
                <button
                  type="button"
                  className={titleMode === "decoupe" ? "active" : ""}
                  onClick={() => setTitleMode("decoupe")}
                >
                  Découpe (accroché au cadre)
                </button>
              </div>
              {titleMode === "decoupe" && (
                <p className="layer-configurator__hint">
                  Déplacez le texte près d'un bord : il s'accroche automatiquement en débordant de 1mm sur le cadre, comme
                  les routes du Layer 3, pour ne pas se détacher à la découpe.
                </p>
              )}
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
                Graisse
                <select value={fontWeight} onChange={(e) => setFontWeight(Number(e.target.value))}>
                  {WEIGHT_OPTIONS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
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
          {tab === "layer1" && (
            <>
              <polygon points={pointsToSvg(shapeOutline)} fill="white" stroke="#1f2937" strokeWidth={2} />
              <defs>
                <clipPath id="layer1-clip">
                  <polygon points={pointsToSvg(shapeOutline)} />
                </clipPath>
              </defs>
              <g clipPath="url(#layer1-clip)" opacity={0.5}>
                {data.water.map((line, i) => renderLine("water-preview", FIXED_STYLE.water, 0, line, i))}
              </g>
            </>
          )}
          {tab === "layer2" && renderLayer2()}
          {tab === "layer3" && renderLayer3()}
        </svg>
      </div>
    </div>
  );
}
