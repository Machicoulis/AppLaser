import L from "leaflet";
import { Marker, Polygon } from "react-leaflet";
import { computeRegularPolygonPoints, distanceMeters, type LatLng } from "./geo";

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

interface RegularPolygonSelectionOverlayProps {
  center: LatLng;
  radiusM: number;
  sides: number;
  onCenterChange: (center: LatLng) => void;
  onRadiusChange: (radiusM: number) => void;
}

export function RegularPolygonSelectionOverlay({
  center,
  radiusM,
  sides,
  onCenterChange,
  onRadiusChange,
}: RegularPolygonSelectionOverlayProps) {
  const points = computeRegularPolygonPoints(center, radiusM, sides);
  const radiusHandle = points[0]; // premier sommet, sert de poignée de redimensionnement

  return (
    <>
      <Polygon
        positions={points.map((p) => [p.lat, p.lng])}
        pathOptions={{ color: "#2563eb", weight: 2, fillOpacity: 0.08 }}
      />
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
