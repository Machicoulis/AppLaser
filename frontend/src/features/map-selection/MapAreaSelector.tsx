import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { AddressSearch } from "./AddressSearch";
import { computeBounds, formatDistance, type BoundingBox, type LatLng } from "./geo";
import { SelectionOverlay } from "./SelectionOverlay";
import "./map-area-selector.css";

const DEFAULT_CENTER: LatLng = { lat: 45.1847, lng: 9.1582 }; // Pavia, exemple de référence du cahier des charges
const DEFAULT_ZOOM = 15;
const MAX_PLATE_MM = 400; // zone de travail max de l'Elegoo Phecda

function MapController({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView([target.lat, target.lng], DEFAULT_ZOOM);
  }, [target, map]);
  return null;
}

export interface AreaSelection {
  bbox: BoundingBox;
  plateWidthMm: number;
  plateHeightMm: number;
}

interface MapAreaSelectorProps {
  onConfirm: (selection: AreaSelection) => void;
}

export function MapAreaSelector({ onConfirm }: MapAreaSelectorProps) {
  const [plateWidthMm, setPlateWidthMm] = useState(300);
  const [plateHeightMm, setPlateHeightMm] = useState(300);
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null);
  const [widthM, setWidthM] = useState(500);

  const aspectRatio = plateWidthMm / plateHeightMm;
  const heightM = widthM / aspectRatio;
  const bbox = computeBounds(center, widthM, heightM);
  const metersPerMm = widthM / plateWidthMm;

  function handleAddressSelect(newCenter: LatLng) {
    setCenter(newCenter);
    setFlyTarget(newCenter);
  }

  return (
    <div className="map-area-selector">
      <aside className="map-area-selector__panel">
        <h2>Sélection de la zone</h2>

        <AddressSearch onSelect={handleAddressSelect} />

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
          <p>
            Zone réelle : <strong>{formatDistance(widthM)}</strong> x <strong>{formatDistance(heightM)}</strong>
          </p>
          <p>Échelle ≈ 1:{Math.round(metersPerMm * 1000)}</p>
        </div>

        <button
          type="button"
          className="map-area-selector__confirm"
          onClick={() => onConfirm({ bbox, plateWidthMm, plateHeightMm })}
        >
          Confirmer la zone
        </button>
      </aside>

      <div className="map-area-selector__map">
        <MapContainer center={[center.lat, center.lng]} zoom={DEFAULT_ZOOM} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController target={flyTarget} />
          <SelectionOverlay
            center={center}
            widthM={widthM}
            heightM={heightM}
            onCenterChange={setCenter}
            onWidthChange={setWidthM}
          />
        </MapContainer>
      </div>
    </div>
  );
}
