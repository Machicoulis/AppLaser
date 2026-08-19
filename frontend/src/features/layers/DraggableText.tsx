import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

export interface TextPosition {
  x: number;
  y: number;
  rotationDeg: number;
}

function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const transformed = pt.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

interface DraggableTextProps {
  svgRef: RefObject<SVGSVGElement | null>;
  position: TextPosition;
  onChange: (position: TextPosition) => void;
  fontFamily: string;
  fontSize: number;
  fill: string;
  children: string;
}

/** Texte déplaçable (glisser le texte) et orientable (glisser la poignée ronde au-dessus), en coordonnées SVG. */
export function DraggableText({ svgRef, position, onChange, fontFamily, fontSize, fill, children }: DraggableTextProps) {
  const dragStart = useRef<{ pointerX: number; pointerY: number; origX: number; origY: number } | null>(null);
  const handleDistance = fontSize * 1.6;
  // Zone de clic généreuse pour le déplacement : plus fiable qu'un hit-test sur les seuls traits des glyphes (espaces, contre-formes...).
  const hitWidth = Math.max(children.length * fontSize * 0.7, fontSize * 2);
  const hitHeight = fontSize * 1.4;

  function handleTranslateStart(e: ReactPointerEvent) {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const p = toSvgPoint(svg, e.clientX, e.clientY);
    dragStart.current = { pointerX: p.x, pointerY: p.y, origX: position.x, origY: position.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handleTranslateMove(e: ReactPointerEvent) {
    if (!dragStart.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const p = toSvgPoint(svg, e.clientX, e.clientY);
    const dx = p.x - dragStart.current.pointerX;
    const dy = p.y - dragStart.current.pointerY;
    onChange({ ...position, x: dragStart.current.origX + dx, y: dragStart.current.origY + dy });
  }

  function handleTranslateEnd() {
    dragStart.current = null;
  }

  function handleRotateMove(e: ReactPointerEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const p = toSvgPoint(svg, e.clientX, e.clientY);
    const angleDeg = (Math.atan2(p.y - position.y, p.x - position.x) * 180) / Math.PI;
    onChange({ ...position, rotationDeg: angleDeg + 90 });
  }

  function handleRotateStart(e: ReactPointerEvent) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  return (
    <g transform={`translate(${position.x},${position.y}) rotate(${position.rotationDeg})`}>
      <line x1={0} y1={0} x2={0} y2={-handleDistance} className="draggable-text__rotate-guide" pointerEvents="none" />
      <text x={0} y={0} textAnchor="middle" fontFamily={fontFamily} fontSize={fontSize} fill={fill} pointerEvents="none">
        {children}
      </text>
      <rect
        x={-hitWidth / 2}
        y={-hitHeight}
        width={hitWidth}
        height={hitHeight}
        fill="transparent"
        className="draggable-text__hit-area"
        onPointerDown={handleTranslateStart}
        onPointerMove={handleTranslateMove}
        onPointerUp={handleTranslateEnd}
      />
      <circle
        cx={0}
        cy={-handleDistance}
        r={fontSize * 0.3}
        className="draggable-text__rotate-handle"
        onPointerDown={handleRotateStart}
        onPointerMove={handleRotateMove}
        onPointerUp={handleTranslateEnd}
      />
    </g>
  );
}
