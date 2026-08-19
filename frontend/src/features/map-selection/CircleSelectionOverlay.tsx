import L from "leaflet";
import { Circle, Marker } from "react-leaflet";
import { distanceMeters, pointAtDistance, type LatLng } from "./geo";

const centerIcon = L.divIcon({
  className: "selection-handle selection-handle--center",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const radiusIcon = L.divIcon({
  className: "selection-handle selection-handle--corner",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

interface CircleSelectionOverlayProps {
  center: LatLng;
  radiusM: number;
  onCenterChange: (center: LatLng) => void;
  onRadiusChange: (radiusM: number) => void;
}

export function CircleSelectionOverlay({ center, radiusM, onCenterChange, onRadiusChange }: CircleSelectionOverlayProps) {
  const radiusHandle = pointAtDistance(center, radiusM, 0); // point à l'est du centre

  return (
    <>
      <Circle center={[center.lat, center.lng]} radius={radiusM} pathOptions={{ color: "#2563eb", weight: 2, fillOpacity: 0.08 }} />
      <Marker
        position={center}
        icon={centerIcon}
        draggable
        eventHandlers={{ drag: (e) => onCenterChange(e.target.getLatLng()) }}
      />
      <Marker
        position={radiusHandle}
        icon={radiusIcon}
        draggable
        eventHandlers={{
          drag: (e) => onRadiusChange(Math.max(distanceMeters(center, e.target.getLatLng()), 1)),
        }}
      />
    </>
  );
}
