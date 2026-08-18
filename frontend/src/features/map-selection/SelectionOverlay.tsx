import L from "leaflet";
import { Marker, Rectangle } from "react-leaflet";
import { computeBounds, metersFromCenter, type LatLng } from "./geo";

const centerIcon = L.divIcon({
  className: "selection-handle selection-handle--center",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const cornerIcon = L.divIcon({
  className: "selection-handle selection-handle--corner",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

interface SelectionOverlayProps {
  center: LatLng;
  widthM: number;
  heightM: number;
  onCenterChange: (center: LatLng) => void;
  onWidthChange: (widthM: number) => void;
}

export function SelectionOverlay({ center, widthM, heightM, onCenterChange, onWidthChange }: SelectionOverlayProps) {
  const bounds = computeBounds(center, widthM, heightM);
  const seCorner: LatLng = { lat: bounds.south, lng: bounds.east };

  return (
    <>
      <Rectangle
        bounds={[
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ]}
        pathOptions={{ color: "#2563eb", weight: 2, fillOpacity: 0.08 }}
      />
      <Marker
        position={center}
        icon={centerIcon}
        draggable
        eventHandlers={{
          drag: (e) => onCenterChange(e.target.getLatLng()),
        }}
      />
      <Marker
        position={seCorner}
        icon={cornerIcon}
        draggable
        eventHandlers={{
          drag: (e) => {
            const { widthM: newWidthM } = metersFromCenter(center, e.target.getLatLng());
            onWidthChange(Math.max(newWidthM, 1));
          },
        }}
      />
    </>
  );
}
