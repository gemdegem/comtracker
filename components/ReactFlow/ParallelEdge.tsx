import React from 'react';
import { EdgeProps, BaseEdge, EdgeLabelRenderer } from 'reactflow';

export interface ParallelEdgeLine {
  isForward: boolean;
  color: string;
  isFalsePositive?: boolean;
  dashArray?: string;
  pillText: string;
  pillColor: string;
  strokeWidth: number;
  opacity: number;
  animated: boolean;
  direction?: 'inbound' | 'outbound' | string;
}

export interface ParallelEdgeData {
  lines: ParallelEdgeLine[];
}

export default function ParallelEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerEnd,
}: EdgeProps<ParallelEdgeData>) {
  if (!data || !data.lines || data.lines.length === 0) return null;

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;

  const centerPointX = (sourceX + targetX) / 2;
  const centerPointY = (sourceY + targetY) / 2;

  const isBidirectional = data.lines.length > 1;
  
  // We want to sort lines so OUT is on top, IN is on bottom in the pill?
  // Let's just map them exactly as they are passed.
  // Actually, UI requirement: "Wyrównanie: Wszystko równane do lewej strony..."
  
  const getLinePath = (isForward: boolean, direction?: string) => {
    let offset = 0;
    if (isBidirectional) {
      // If it's outbound, we shift "up/left" (+4 in normal space usually depends on graph orientation).
      // Let's use a predictable visual shift based on 'isForward'
      // The requirement says: OUT shifted 4px "up", IN shifted 4px "down".
      // We'll map OUT (outbound) to +4 and IN (inbound) to -4 if direction is known,
      // otherwise use isForward ? 4 : -4
      if (direction === "outbound") {
        offset = 4;
      } else if (direction === "inbound") {
        offset = -4;
      } else {
        offset = isForward ? 4 : -4;
      }
    }

    const sx = sourceX + nx * offset;
    const sy = sourceY + ny * offset;
    const tx = targetX + nx * offset;
    const ty = targetY + ny * offset;

    if (isForward) {
      return `M ${sx} ${sy} L ${tx} ${ty}`;
    } else {
      // If it's backward, draw from target to source
      return `M ${tx} ${ty} L ${sx} ${sy}`;
    }
  };

  return (
    <>
      {data.lines.map((line, idx) => {
        const path = getLinePath(line.isForward, line.direction);
        return (
          <path
            key={idx}
            id={`edge-path-${idx}`}
            className="react-flow__edge-path"
            d={path}
            markerEnd={line.isForward ? markerEnd : undefined} // Only adding marker if standard, but we might hide it
            style={{
              stroke: line.color,
              strokeWidth: line.strokeWidth,
              opacity: line.opacity,
              strokeDasharray: line.dashArray,
              fill: 'none',
              animation: line.animated ? 'dashdraw 0.5s linear infinite' : 'none',
            }}
          />
        );
      })}

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${centerPointX}px, ${centerPointY}px)`,
            zIndex: 1000,
            pointerEvents: 'all',
            background: 'rgba(15, 15, 15, 0.95)',
            backdropFilter: 'blur(4px)',
            border: '1px solid #333',
            borderRadius: '6px',
            padding: '4px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            alignItems: 'flex-start',
            fontFamily: '"Fira Code", "Roboto Mono", "Courier New", monospace',
            fontSize: '11px',
            lineHeight: '1.2',
            whiteSpace: 'nowrap',
          }}
          className="nodrag nopan"
        >
          {data.lines.map((line, idx) => (
            <div key={idx} style={{ color: line.pillColor, fontWeight: 600 }}>
              {line.pillText}
            </div>
          ))}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
