import { useRef, useState } from "react";
import { clipPolygonToConvexPolygon, clipPolylineToConvexPolygon } from "../area-preview/clip";
import {
  computeViewBoxSize,
  isClosedWay,
  offsetShapeOutline,
  pointsToSvg,
  project,
  projectionBbox,
  projectShapeOutline,
  raycastToPolygon,
} from "../area-preview/project";
import type { WidthSettings } from "../area-preview/AreaPreview";
import type { AreaSelection } from "../map-selection/MapAreaSelector";
import { DraggableText, type TextPosition } from "./DraggableText";
import { formatSeconds, pathsToSvgString, requestGcode, triggerDownload, type GcodePathSpec, type ModeSettings } from "./gcodeExport";
import { applyTextTransform, loadFont, textToContours } from "./textToPath";
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

type Tab = "layer1" | "layer2" | "layer3" | "final" | "export";
type Line = [number, number][];
type LayerNumber = 1 | 2 | 3;

const FONT_GROUPS = [
  {
    label: "Gravure (formes pleines)",
    options: [
      { value: "'Open Sans', sans-serif", label: "Sans-serif" },
      { value: "'Playfair Display', serif", label: "Serif" },
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

const DEFAULT_FRAME_THICKNESS_MM = 25;

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
  const [coordsFont, setCoordsFont] = useState(FONT_GROUPS[0].options[0].value);
  const [coordsFontWeight, setCoordsFontWeight] = useState(400);
  const [titleSizeMm, setTitleSizeMm] = useState(12);
  const [frameThicknessMm, setFrameThicknessMm] = useState(DEFAULT_FRAME_THICKNESS_MM);
  const [outerRadiusMm, setOuterRadiusMm] = useState(8);
  const [innerRadiusMm, setInnerRadiusMm] = useState(4);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [coordinatesText, setCoordinatesText] = useState(() => {
    const centerLat = (selection.bbox.south + selection.bbox.north) / 2;
    const centerLng = (selection.bbox.west + selection.bbox.east) / 2;
    return `${centerLat.toFixed(4)}° N, ${centerLng.toFixed(4)}° E`;
  });
  const [titleMode, setTitleMode] = useState<"gravure" | "decoupe">("gravure");

  const [gravureSettings, setGravureSettings] = useState<ModeSettings>({ powerPercent: 55, speedMmPerMin: 3200, passes: 1 });
  const [decoupeSettings, setDecoupeSettings] = useState<ModeSettings>({ powerPercent: 85, speedMmPerMin: 900, passes: 2 });
  const [sMax, setSMax] = useState(1000);
  const [exportLoading, setExportLoading] = useState<Partial<Record<LayerNumber, boolean>>>({});
  const [exportError, setExportError] = useState<Partial<Record<LayerNumber, string>>>({});
  const [exportInfo, setExportInfo] = useState<Partial<Record<LayerNumber, string>>>({});

  const { viewWidth, viewHeight } = computeViewBoxSize(selection);
  const mmToSvg = viewWidth / selection.plateWidthMm;
  const shapeOutline = projectShapeOutline(selection, viewWidth, viewHeight);
  const projBbox = projectionBbox(selection);
  const isRect = selection.shape.type === "rectangle";

  // Contour réel du bord extérieur de la plaque du Layer 3 (le seul tracé de découpe qui existe vraiment autour
  // de la carte — le contour intérieur affiché en aperçu n'est que décoratif). Angles vifs même pour le rectangle
  // (l'arrondi éventuel n'est qu'une finition visuelle du bord, cf. limitation connue de l'export).
  const marginSvg = frameThicknessMm * mmToSvg;
  const outerW = viewWidth + marginSvg * 2;
  const outerH = viewHeight + marginSvg * 2 + (showCoordinates ? titleSizeMm * mmToSvg * 1.8 : 0);
  const frameOutline: [number, number][] = isRect
    ? [
        [-marginSvg, -marginSvg],
        [outerW - marginSvg, -marginSvg],
        [outerW - marginSvg, outerH - marginSvg],
        [-marginSvg, outerH - marginSvg],
      ]
    : offsetShapeOutline(shapeOutline, marginSvg);

  // Regroupe les lignes de chaque type de route selon l'affectation choisie à l'étape précédente.
  const layer2Roads: Line[] = Object.entries(data.roads).flatMap(([type, lines]) => (roadAssignment[type] === "layer2" ? lines : []));
  let layer3Roads: Line[] = Object.entries(data.roads).flatMap(([type, lines]) => (roadAssignment[type] === "layer3" ? lines : []));
  // Aucune route affectée au Layer 3 : les routes du Layer 2 servent de repli en découpe, sinon le Layer 3 serait vide.
  const majorRoadFallback = layer3Roads.length === 0 && layer2Roads.length > 0;
  if (majorRoadFallback) layer3Roads = layer2Roads;

  // Positions par défaut du titre/coordonnées : sous la carte, dans la marge du cadre — ajustées une fois puis laissées à l'utilisateur.
  const [titlePos, setTitlePos] = useState<TextPosition>(() => ({
    x: viewWidth / 2,
    y: viewHeight + frameThicknessMm * mmToSvg * 0.65,
    rotationDeg: 0,
  }));
  const [coordsPos, setCoordsPos] = useState<TextPosition>(() => ({
    x: viewWidth / 2,
    y: viewHeight + frameThicknessMm * mmToSvg * 0.65 + titleSizeMm * mmToSvg * 1.4,
    rotationDeg: 0,
  }));

  // Mode découpe : le texte doit chevaucher le VRAI bord extérieur de la plaque (frameOutline), pas le contour
  // intérieur décoratif — c'est la seule vraie découpe qui existe autour de la carte. L'ancrage est poussé
  // 1mm au-delà de ce bord (hors de la plaque) : à l'export, chaque lettre est découpée par ce même bord et
  // seule la portion à l'intérieur de la plaque est conservée, en tracé OUVERT (pas fermé) — comme pour les
  // routes qui traversent la bordure. Un tracé ouvert ne peut jamais former un îlot détaché, contrairement à un
  // simple chevauchement entre deux tracés fermés distincts qui resteraient sans lien réel entre eux.
  function snapToFrame(pos: TextPosition): TextPosition {
    const overlapSvg = 1 * mmToSvg;
    const cx = frameOutline.reduce((sum, [x]) => sum + x, 0) / frameOutline.length;
    const cy = frameOutline.reduce((sum, [, y]) => sum + y, 0) / frameOutline.length;
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const [bx, by] = raycastToPolygon(cx, cy, ux, uy, frameOutline);
    return { ...pos, x: bx + ux * overlapSvg, y: by + uy * overlapSvg };
  }

  function handleTitleDragEnd(pos: TextPosition) {
    if (titleMode === "decoupe") setTitlePos(snapToFrame(pos));
  }

  function renderLine(key: string, style: Pick<CategoryStyle, "stroke" | "fill" | "mode" | "dash" | "areaFill">, strokeWidth: number, line: Line, i: number) {
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

  function renderLayer3() {
    const marginSvg = frameThicknessMm * mmToSvg;
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
            fontFamily={coordsFont}
            fontWeight={coordsFontWeight}
            fontSize={titleSizeSvg * 0.55}
            fill="#4b5563"
          >
            {coordinatesText}
          </DraggableText>
        )}
      </>
    );
  }

  // Aperçu final : superpose les 3 plaques telles qu'assemblées (fond + gravure/eau découpée + cadre/routes principales/titre).
  function renderFinalPreview() {
    const marginSvg = frameThicknessMm * mmToSvg;
    const outerRadiusSvg = outerRadiusMm * mmToSvg;
    const titleSizeSvg = titleSizeMm * mmToSvg;

    const outerX = -marginSvg;
    const outerY = -marginSvg;
    const outerW = viewWidth + marginSvg * 2;
    const outerH = viewHeight + marginSvg * 2 + (showCoordinates ? titleSizeMm * mmToSvg * 1.8 : 0);

    return (
      <>
        {/* Layer 1 : plaque de fond pleine, peinte en bleu derrière les découpes */}
        <polygon points={pointsToSvg(shapeOutline)} fill="white" stroke="#1f2937" strokeWidth={1} />

        {/* Layer 3 : cadre extérieur */}
        {isRect ? (
          <rect x={outerX} y={outerY} width={outerW} height={outerH} rx={outerRadiusSvg} fill="none" stroke="#1f2937" strokeWidth={2} />
        ) : (
          <polygon points={pointsToSvg(offsetShapeOutline(shapeOutline, marginSvg))} fill="none" stroke="#1f2937" strokeWidth={2} />
        )}

        <defs>
          <clipPath id="final-clip">
            <polygon points={pointsToSvg(shapeOutline)} />
          </clipPath>
        </defs>
        <g clipPath="url(#final-clip)">
          {/* Layer 2 : gravure + plans d'eau découpés laissant apparaître le fond */}
          {fixedEnabled.park && data.park.map((line, i) => renderLine("final-park", FIXED_STYLE.park, 0, line, i))}
          {data.water.map((line, i) => renderLine("final-water", FIXED_STYLE.water, 0, line, i))}
          {fixedEnabled.railway &&
            data.railway.map((line, i) => renderLine("final-railway", FIXED_STYLE.railway, widthsMm.railway * mmToSvg, line, i))}
          {layer2Roads.map((line, i) => renderLine("final-layer2Road", ROAD_LAYER_STYLE.layer2, widthsMm.layer2Road * mmToSvg, line, i))}
          {/* Layer 3 : routes principales découpées, fondues avec le cadre */}
          {layer3Roads.map((line, i) => renderLine("final-layer3Road", ROAD_LAYER_STYLE.layer3, widthsMm.layer3Road * mmToSvg, line, i))}
        </g>

        {cityName && (
          <g transform={`translate(${titlePos.x},${titlePos.y}) rotate(${titlePos.rotationDeg})`}>
            <text
              textAnchor="middle"
              fontFamily={font}
              fontWeight={fontWeight}
              fontSize={titleSizeSvg}
              fill={titleMode === "decoupe" ? "#1e3a8a" : "#1f2937"}
            >
              {cityName.toUpperCase()}
            </text>
          </g>
        )}
        {showCoordinates && (
          <g transform={`translate(${coordsPos.x},${coordsPos.y}) rotate(${coordsPos.rotationDeg})`}>
            <text
              textAnchor="middle"
              fontFamily={coordsFont}
              fontWeight={coordsFontWeight}
              fontSize={titleSizeSvg * 0.55}
              fill="#4b5563"
            >
              {coordinatesText}
            </text>
          </g>
        )}
      </>
    );
  }

  // Convertit un point en coordonnées SVG locales vers des mm plaque-locaux, origine (0,0) en haut à gauche,
  // axe Y vers le bas — exactement la même orientation que l'aperçu affiché à l'écran (pas d'inversion d'axe :
  // un texte à l'export doit se lire à l'endroit et rester au même endroit que dans l'aperçu, pas dans une
  // convention de repère machine supposée mais non vérifiée).
  function toPlateMm([x, y]: [number, number], offsetXSvg: number, offsetYSvg: number): [number, number] {
    return [(x + offsetXSvg) / mmToSvg, (y + offsetYSvg) / mmToSvg];
  }

  // Découpe une ligne OSM brute par le contour réel de la zone AVANT de la convertir en mm : les données OSM
  // dépassent souvent largement la zone choisie (Overpass renvoie des tronçons entiers), et contrairement à
  // l'aperçu à l'écran (qui ne fait que masquer visuellement le dépassement via un clipPath SVG), un export
  // doit contenir des tracés réellement coupés à la frontière — sinon le laser reçoit des trajets qui partent
  // loin hors de la plaque.
  function clippedLineToPaths(
    line: Line,
    mode: GcodePathSpec["mode"],
    widthMm: number,
    offsetXSvg: number,
    offsetYSvg: number
  ): GcodePathSpec[] {
    const projected = line.map(([lat, lng]) => project(projBbox, lat, lng, viewWidth, viewHeight));
    const closed = isClosedWay(line);
    const pieces: { points: [number, number][]; closed: boolean }[] = closed
      ? [{ points: clipPolygonToConvexPolygon(projected, shapeOutline), closed: true }]
      : clipPolylineToConvexPolygon(projected, shapeOutline).map((points) => ({ points, closed: false }));
    return pieces
      .filter((piece) => piece.points.length >= (piece.closed ? 3 : 2))
      .map((piece) => ({
        points: piece.points.map((p) => toPlateMm(p, offsetXSvg, offsetYSvg)),
        closed: piece.closed,
        mode,
        widthMm,
      }));
  }

  // Construit les tracés exportables (G-code/SVG) d'un layer, en mm réels, indépendamment de l'onglet affiché.
  // Limitation connue : le titre et les coordonnées (texte) ne sont pas encore inclus — cf. section 9 du CDC
  // ("toujours convertir le texte en tracés vectoriels avant export"), pas encore implémenté.
  function buildLayerPaths(layerNum: LayerNumber): { paths: GcodePathSpec[]; plateWidthMm: number; plateHeightMm: number } {
    if (layerNum === 1) {
      const plateHeightMm = viewHeight / mmToSvg;
      const outline = shapeOutline.map((p) => toPlateMm(p, 0, 0));
      return {
        paths: [{ points: outline, closed: true, mode: "decoupe", widthMm: 0 }],
        plateWidthMm: selection.plateWidthMm,
        plateHeightMm,
      };
    }
    if (layerNum === 2) {
      const plateHeightMm = viewHeight / mmToSvg;
      const paths: GcodePathSpec[] = [];
      if (fixedEnabled.park) {
        for (const line of data.park) paths.push(...clippedLineToPaths(line, "gravure", FIXED_STYLE.park.defaultWidthMm, 0, 0));
      }
      for (const line of data.water) paths.push(...clippedLineToPaths(line, "decoupe", 0, 0, 0));
      if (fixedEnabled.railway) {
        for (const line of data.railway) paths.push(...clippedLineToPaths(line, "gravure", widthsMm.railway, 0, 0));
      }
      for (const line of layer2Roads) paths.push(...clippedLineToPaths(line, "gravure", widthsMm.layer2Road, 0, 0));
      return { paths, plateWidthMm: selection.plateWidthMm, plateHeightMm };
    }
    // Layer 3 : cadre + routes principales, origine plaque décalée au coin extérieur du cadre.
    // Simplification connue : les coins arrondis du cadre rectangulaire sont exportés en angles vifs pour l'instant.
    const plateWidthMm = outerW / mmToSvg;
    const plateHeightMm = outerH / mmToSvg;
    const paths: GcodePathSpec[] = [
      { points: frameOutline.map((p) => toPlateMm(p, marginSvg, marginSvg)), closed: true, mode: "decoupe", widthMm: 0 },
    ];
    for (const line of layer3Roads) paths.push(...clippedLineToPaths(line, "decoupe", 0, marginSvg, marginSvg));
    return { paths, plateWidthMm, plateHeightMm };
  }

  // Épaisseur de trait par défaut pour le texte gravé (pas de réglage dédié pour l'instant, cf. limitations).
  const TEXT_GRAVURE_WIDTH_MM = 0.3;

  // Construit les tracés complets du Layer 3 (cadre + routes principales + titre/coordonnées convertis en
  // tracés vectoriels réels). En mode découpe, chaque lettre du titre est découpée par le VRAI bord extérieur
  // de la plaque (frameOutline) — seule la portion à l'intérieur de la plaque est conservée, en tracé OUVERT.
  // Un tracé ouvert ne peut jamais former d'îlot détaché, contrairement à une simple juxtaposition de deux
  // tracés fermés distincts qui resteraient sans lien réel entre eux même en se chevauchant de quelques mm.
  async function buildLayer3ExportPaths(): Promise<{ paths: GcodePathSpec[]; plateWidthMm: number; plateHeightMm: number }> {
    const plateWidthMm = outerW / mmToSvg;
    const plateHeightMm = outerH / mmToSvg;
    const toMm = (p: [number, number]) => toPlateMm(p, marginSvg, marginSvg);

    const roadPaths: GcodePathSpec[] = [];
    for (const line of layer3Roads) roadPaths.push(...clippedLineToPaths(line, "decoupe", 0, marginSvg, marginSvg));

    const framePaths: GcodePathSpec[] = [{ points: frameOutline.map(toMm), closed: true, mode: "decoupe", widthMm: 0 }];
    const textPaths: GcodePathSpec[] = [];

    if (cityName.trim()) {
      const titleFont = await loadFont(font, fontWeight);
      const localContours = textToContours(titleFont, cityName.toUpperCase(), 0, 0, titleSizeMm * mmToSvg);
      const worldContours = localContours.map((ring) => ring.map((p) => applyTextTransform(p, titlePos.x, titlePos.y, titlePos.rotationDeg)));

      if (titleMode === "decoupe") {
        for (const ring of worldContours) {
          for (const clipped of clipPolylineToConvexPolygon([...ring, ring[0]], frameOutline)) {
            textPaths.push({ points: clipped.map(toMm), closed: false, mode: "decoupe", widthMm: 0 });
          }
        }
      } else {
        for (const ring of worldContours) textPaths.push({ points: ring.map(toMm), closed: true, mode: "gravure", widthMm: TEXT_GRAVURE_WIDTH_MM });
      }
    }

    if (showCoordinates && coordinatesText.trim()) {
      const coordsFontLoaded = await loadFont(coordsFont, coordsFontWeight);
      const localContours = textToContours(coordsFontLoaded, coordinatesText, 0, 0, titleSizeMm * mmToSvg * 0.55);
      for (const ring of localContours) {
        const worldRing = ring.map((p) => applyTextTransform(p, coordsPos.x, coordsPos.y, coordsPos.rotationDeg));
        textPaths.push({ points: worldRing.map(toMm), closed: true, mode: "gravure", widthMm: TEXT_GRAVURE_WIDTH_MM });
      }
    }

    return { paths: [...framePaths, ...roadPaths, ...textPaths], plateWidthMm, plateHeightMm };
  }

  async function handleDownloadGcode(layerNum: LayerNumber) {
    setExportError((prev) => ({ ...prev, [layerNum]: undefined }));
    setExportLoading((prev) => ({ ...prev, [layerNum]: true }));
    try {
      const { paths, plateWidthMm, plateHeightMm } = layerNum === 3 ? await buildLayer3ExportPaths() : buildLayerPaths(layerNum);
      if (paths.length === 0) throw new Error("Aucun élément à exporter sur ce layer.");
      const { gcode, estimatedSeconds } = await requestGcode(paths, plateWidthMm, plateHeightMm, sMax, gravureSettings, decoupeSettings);
      triggerDownload(new Blob([gcode], { type: "text/plain" }), `applaser-layer${layerNum}.gcode`);
      setExportInfo((prev) => ({ ...prev, [layerNum]: `${paths.length} tracés — durée estimée ${formatSeconds(estimatedSeconds)}` }));
    } catch (err) {
      setExportError((prev) => ({ ...prev, [layerNum]: err instanceof Error ? err.message : "Erreur inconnue" }));
    } finally {
      setExportLoading((prev) => ({ ...prev, [layerNum]: false }));
    }
  }

  async function handleDownloadSvg(layerNum: LayerNumber) {
    setExportError((prev) => ({ ...prev, [layerNum]: undefined }));
    try {
      const { paths, plateWidthMm, plateHeightMm } = layerNum === 3 ? await buildLayer3ExportPaths() : buildLayerPaths(layerNum);
      if (paths.length === 0) throw new Error("Aucun élément à exporter sur ce layer.");
      triggerDownload(new Blob([pathsToSvgString(paths, plateWidthMm, plateHeightMm)], { type: "image/svg+xml" }), `applaser-layer${layerNum}.svg`);
    } catch (err) {
      setExportError((prev) => ({ ...prev, [layerNum]: err instanceof Error ? err.message : "Erreur inconnue" }));
    }
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
          <button type="button" className={tab === "final" ? "active" : ""} onClick={() => setTab("final")}>
            Aperçu final
          </button>
          <button type="button" className={tab === "export" ? "active" : ""} onClick={() => setTab("export")}>
            Export
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
                  onClick={() => {
                    setTitleMode("decoupe");
                    setTitlePos((prev) => snapToFrame(prev));
                  }}
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
              <label>
                Épaisseur du cadre (mm)
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={frameThicknessMm}
                  onChange={(e) => setFrameThicknessMm(Number(e.target.value))}
                />
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
                Afficher les coordonnées
              </label>
              {showCoordinates && (
                <>
                  <label>
                    Texte des coordonnées
                    <input type="text" value={coordinatesText} onChange={(e) => setCoordinatesText(e.target.value)} />
                  </label>
                  <label>
                    Police des coordonnées
                    <select value={coordsFont} onChange={(e) => setCoordsFont(e.target.value)}>
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
                    Graisse des coordonnées
                    <select value={coordsFontWeight} onChange={(e) => setCoordsFontWeight(Number(e.target.value))}>
                      {WEIGHT_OPTIONS.map((w) => (
                        <option key={w.value} value={w.value}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </fieldset>
          </div>
        )}

        {tab === "final" && (
          <div className="layer-configurator__section">
            <p className="layer-configurator__hint">
              Superposition indicative des 3 plaques une fois assemblées : fond peint, gravure/eau découpée du Layer 2, et
              cadre + routes principales + titre du Layer 3. Utile pour visualiser le rendu global — la fabrication reste
              par plaque séparée (onglets précédents).
            </p>
          </div>
        )}

        {tab === "export" && (
          <div className="layer-configurator__section">
            <p className="layer-configurator__hint">
              Le titre et les coordonnées sont convertis en tracés vectoriels au moment du téléchargement (Layer 3) — en
              mode découpe, le titre est fusionné géométriquement avec le cadre pour ne pas se détacher à la découpe.
              Limitation connue : les coins arrondis du cadre sont exportés en angles vifs pour l'instant.
            </p>

            <fieldset>
              <legend>Réglages gravure</legend>
              <label>
                Puissance (%)
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={gravureSettings.powerPercent}
                  onChange={(e) => setGravureSettings((prev) => ({ ...prev, powerPercent: Number(e.target.value) }))}
                />
              </label>
              <label>
                Vitesse (mm/min)
                <input
                  type="number"
                  min={1}
                  max={25000}
                  value={gravureSettings.speedMmPerMin}
                  onChange={(e) => setGravureSettings((prev) => ({ ...prev, speedMmPerMin: Number(e.target.value) }))}
                />
              </label>
              <label>
                Passes
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={gravureSettings.passes}
                  onChange={(e) => setGravureSettings((prev) => ({ ...prev, passes: Number(e.target.value) }))}
                />
              </label>
            </fieldset>

            <fieldset>
              <legend>Réglages découpe</legend>
              <label>
                Puissance (%)
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={decoupeSettings.powerPercent}
                  onChange={(e) => setDecoupeSettings((prev) => ({ ...prev, powerPercent: Number(e.target.value) }))}
                />
              </label>
              <label>
                Vitesse (mm/min)
                <input
                  type="number"
                  min={1}
                  max={25000}
                  value={decoupeSettings.speedMmPerMin}
                  onChange={(e) => setDecoupeSettings((prev) => ({ ...prev, speedMmPerMin: Number(e.target.value) }))}
                />
              </label>
              <label>
                Passes
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={decoupeSettings.passes}
                  onChange={(e) => setDecoupeSettings((prev) => ({ ...prev, passes: Number(e.target.value) }))}
                />
              </label>
            </fieldset>

            <label>
              Valeur S maximale (calibration laser)
              <input type="number" min={1} max={65535} value={sMax} onChange={(e) => setSMax(Number(e.target.value))} />
            </label>
            <p className="layer-configurator__hint">
              Vérifiez avec la commande <code>$$</code> sur votre contrôleur GRBL ($30) — souvent 1000, parfois 255.
            </p>

            {([1, 2, 3] as LayerNumber[]).map((layerNum) => {
              const { paths } = buildLayerPaths(layerNum);
              const hasText = layerNum === 3 && (cityName.trim() || (showCoordinates && coordinatesText.trim()));
              return (
                <fieldset key={layerNum}>
                  <legend>Layer {layerNum}</legend>
                  <p className="layer-configurator__hint">
                    {paths.length} tracé(s) à exporter{hasText ? " + titre/coordonnées (convertis en tracés au téléchargement)" : ""}.
                  </p>
                  <div className="layer-configurator__export-actions">
                    <button type="button" onClick={() => handleDownloadSvg(layerNum)} disabled={paths.length === 0}>
                      Télécharger le SVG
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadGcode(layerNum)}
                      disabled={paths.length === 0 || exportLoading[layerNum]}
                    >
                      {exportLoading[layerNum] ? "Génération…" : "Télécharger le G-code"}
                    </button>
                  </div>
                  {exportInfo[layerNum] && <p className="layer-configurator__hint">{exportInfo[layerNum]}</p>}
                  {exportError[layerNum] && <p className="area-preview__error">{exportError[layerNum]}</p>}
                </fieldset>
              );
            })}
          </div>
        )}
      </aside>

      <div className="layer-configurator__canvas">
        <svg
          ref={svgRef}
          viewBox={`${-frameThicknessMm * mmToSvg - 10} ${-frameThicknessMm * mmToSvg - 10} ${
            viewWidth + frameThicknessMm * mmToSvg * 2 + 20
          } ${viewHeight + frameThicknessMm * mmToSvg * 2 + (showCoordinates ? titleSizeMm * mmToSvg * 1.8 : 0) + 20}`}
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
          {tab === "final" && renderFinalPreview()}
        </svg>
      </div>
    </div>
  );
}
