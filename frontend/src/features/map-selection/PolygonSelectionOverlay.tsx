import L from "leaflet";
import { Marker, Polygon, useMapEvents } from "react-leaflet";
import type { LatLng } from "./geo";

const vertexIcon = L.divIcon({
  className: "selection-handle selection-handle--corner",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

interface PolygonSelectionOverlayProps {
  points: LatLng[];
  drawing: boolean;
  onAddPoint: (point: LatLng) => void;
  onMovePoint: (index: number, point: LatLng) => void;
}

function ClickCapture({ active, onClick }: { active: boolean; onClick: (point: LatLng) => void }) {
  useMapEvents({
    click: (e) => {
      if (active) onClick(e.latlng);
    },
  });
  return null;
}

export function PolygonSelectionOverlay({ points, drawing, onAddPoint, onMovePoint }: PolygonSelectionOverlayProps) {
  return (
    <>
      <ClickCapture active={drawing} onClick={onAddPoint} />
      {points.length >= 2 && (
        <Polygon
          positions={points.map((p) => [p.lat, p.lng])}
          pathOptions={{ color: "#2563eb", weight: 2, fillOpacity: 0.08 }}
        />
      )}
      {points.map((point, i) => (
        <Marker
          key={i}
          position={point}
          icon={vertexIcon}
          draggable
          eventHandlers={{ drag: (e) => onMovePoint(i, e.target.getLatLng()) }}
        />
      ))}
    </>
  );
}
