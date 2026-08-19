import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { AddressSearch } from "./AddressSearch";
import { CircleSelectionOverlay } from "./CircleSelectionOverlay";
import {
  computeBounds,
  computeCircleBounds,
  computePolygonBounds,
  computeRegularPolygonPoints,
  formatDistance,
  type BoundingBox,
  type LatLng,
} from "./geo";
import { RegularPolygonSelectionOverlay } from "./RegularPolygonSelectionOverlay";
import { SelectionOverlay } from "./SelectionOverlay";
import "./map-area-selector.css";

const DEFAULT_CENTER: LatLng = { lat: 45.1847, lng: 9.1582 }; // Pavia, exemple de référence du cahier des charges
const DEFAULT_ZOOM = 15;
const MAX_PLATE_MM = 400; // zone de travail max de l'Elegoo Phecda
const MIN_POLYGON_SIDES = 3;
const MAX_POLYGON_SIDES = 12;

type ShapeMode = "rectangle" | "circle" | "polygon";

function MapController({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView([target.lat, target.lng], DEFAULT_ZOOM);
  }, [target, map]);
  return null;
}

export type ShapeInfo =
  | { type: "rectangle" }
  | { type: "circle"; center: LatLng; radiusM: number }
  | { type: "polygon"; points: LatLng[]; sides: number };

export interface AreaSelection {
  bbox: BoundingBox;
  plateWidthMm: number;
  plateHeightMm: number;
  shape: ShapeInfo;
}

interface MapAreaSelectorProps {
  onConfirm: (selection: AreaSelection) => void;
}

export function MapAreaSelector({ onConfirm }: MapAreaSelectorProps) {
  const [plateWidthMm, setPlateWidthMm] = useState(300);
  const [plateHeightMm, setPlateHeightMm] = useState(300);
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null);
  const [shapeMode, setShapeMode] = useState<ShapeMode>("rectangle");

  // rectangle
  const [rectCenter, setRectCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [rectWidthM, setRectWidthM] = useState(500);

  // cercle
  const [circleCenter, setCircleCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [radiusM, setRadiusM] = useState(250);

  // polygone régulier
  const [polygonCenter, setPolygonCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [polygonRadiusM, setPolygonRadiusM] = useState(250);
  const [polygonSides, setPolygonSides] = useState(3);

  const aspectRatio = plateWidthMm / plateHeightMm;
  const rectHeightM = rectWidthM / aspectRatio;

  let bbox: BoundingBox;
  let shape: ShapeInfo;
  if (shapeMode === "rectangle") {
    bbox = computeBounds(rectCenter, rectWidthM, rectHeightM);
    shape = { type: "rectangle" };
  } else if (shapeMode === "circle") {
    bbox = computeCircleBounds(circleCenter, radiusM);
    shape = { type: "circle", center: circleCenter, radiusM };
  } else {
    const points = computeRegularPolygonPoints(polygonCenter, polygonRadiusM, polygonSides);
    bbox = computePolygonBounds(points);
    shape = { type: "polygon", points, sides: polygonSides };
  }

  function handleAddressSelect(newCenter: LatLng) {
    setFlyTarget(newCenter);
    if (shapeMode === "rectangle") setRectCenter(newCenter);
    if (shapeMode === "circle") setCircleCenter(newCenter);
    if (shapeMode === "polygon") setPolygonCenter(newCenter);
  }

  function handleShapeModeChange(mode: ShapeMode) {
    setShapeMode(mode);
  }

  return (
    <div className="map-area-selector">
      <aside className="map-area-selector__panel">
        <h2>Sélection de la zone</h2>

        <AddressSearch onSelect={handleAddressSelect} />

        <fieldset>
          <legend>Forme de la zone</legend>
          <div className="map-area-selector__shape-buttons">
            <button
              type="button"
              className={shapeMode === "rectangle" ? "active" : ""}
              onClick={() => handleShapeModeChange("rectangle")}
            >
              Rectangle
            </button>
            <button type="button" className={shapeMode === "circle" ? "active" : ""} onClick={() => handleShapeModeChange("circle")}>
              Cercle
            </button>
            <button
              type="button"
              className={shapeMode === "polygon" ? "active" : ""}
              onClick={() => handleShapeModeChange("polygon")}
            >
              Polygone
            </button>
          </div>
        </fieldset>

        {shapeMode === "polygon" && (
          <label className="map-area-selector__sides-input">
            Nombre de côtés
            <input
              type="number"
              min={MIN_POLYGON_SIDES}
              max={MAX_POLYGON_SIDES}
              value={polygonSides}
              onChange={(e) =>
                setPolygonSides(Math.min(MAX_POLYGON_SIDES, Math.max(MIN_POLYGON_SIDES, Number(e.target.value))))
              }
            />
          </label>
        )}

        <fieldset>
          <legend>Format de la plaque</legend>
          <label>
            Largeur (mm)
            <input
              type="number"
              min={50}
              max={MAX_PLATE_MM}
              value={plateWidthMm}
              onChange={(e) => setPlateWidthMm(Number(e.target.value))}
            />
          </label>
          <label>
            Hauteur (mm)
            <input
              type="number"
              min={50}
              max={MAX_PLATE_MM}
              value={plateHeightMm}
              onChange={(e) => setPlateHeightMm(Number(e.target.value))}
            />
          </label>
          {(plateWidthMm > MAX_PLATE_MM || plateHeightMm > MAX_PLATE_MM) && (
            <p className="map-area-selector__warning">
              La zone de travail de la Phecda est limitée à {MAX_PLATE_MM}x{MAX_PLATE_MM}mm.
            </p>
          )}
        </fieldset>

        <div className="map-area-selector__info">
          {shapeMode === "rectangle" && (
            <>
              <p>
                Zone réelle : <strong>{formatDistance(rectWidthM)}</strong> x <strong>{formatDistance(rectHeightM)}</strong>
              </p>
              <p>Échelle ≈ 1:{Math.round((rectWidthM / plateWidthMm) * 1000)}</p>
            </>
          )}
          {shapeMode === "circle" && (
            <>
              <p>
                Diamètre réel : <strong>{formatDistance(radiusM * 2)}</strong>
              </p>
              <p>Échelle ≈ 1:{Math.round(((radiusM * 2) / plateWidthMm) * 1000)}</p>
            </>
          )}
          {shapeMode === "polygon" && (
            <>
              <p>
                Rayon réel : <strong>{formatDistance(polygonRadiusM)}</strong> ({polygonSides} côtés)
              </p>
              <p>Échelle ≈ 1:{Math.round(((polygonRadiusM * 2) / plateWidthMm) * 1000)}</p>
            </>
          )}
        </div>

        <button type="button" className="map-area-selector__confirm" onClick={() => onConfirm({ bbox, plateWidthMm, plateHeightMm, shape })}>
          Confirmer la zone
        </button>
      </aside>

      <div className="map-area-selector__map">
        <MapContainer center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]} zoom={DEFAULT_ZOOM} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController target={flyTarget} />
          {shapeMode === "rectangle" && (
            <SelectionOverlay
              center={rectCenter}
              widthM={rectWidthM}
              heightM={rectHeightM}
              onCenterChange={setRectCenter}
              onWidthChange={setRectWidthM}
            />
          )}
          {shapeMode === "circle" && (
            <CircleSelectionOverlay
              center={circleCenter}
              radiusM={radiusM}
              onCenterChange={setCircleCenter}
              onRadiusChange={setRadiusM}
            />
          )}
          {shapeMode === "polygon" && (
            <RegularPolygonSelectionOverlay
              center={polygonCenter}
              radiusM={polygonRadiusM}
              sides={polygonSides}
              onCenterChange={setPolygonCenter}
              onRadiusChange={setPolygonRadiusM}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
