import React, { useState, useRef, useCallback } from "react";
import { Handle, Position } from "reactflow";
import type { EntityType } from "@/lib/types";

type CustomNodeProps = {
  data: {
    transactionCount: number;
    label: string;
    shortLabel: string;
    type: "sender" | "receiver" | "intermediate";
    isExpanded?: boolean;
    isLoading?: boolean;
    isCluster?: boolean;
    onExpand?: (address: string, direction: "inbound" | "outbound") => void;
    // Label data
    addressLabel?: string;      // human-readable name from label engine
    entityType?: EntityType;    // scam, exchange, defi, mixer, project, custom
    labelSource?: string;       // scamsniffer, dawsbot & etherscan, custom, bitquery
  };
};

// Base node colors by structural type (sender/receiver/intermediate)
const nodeColors = {
  sender: { bg: "rgba(34, 197, 94, 0.15)", border: "rgba(34, 197, 94, 0.5)", text: "#22c55e" },
  receiver: { bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.5)", text: "#ef4444" },
  intermediate: { bg: "rgba(59, 130, 246, 0.15)", border: "rgba(59, 130, 246, 0.5)", text: "#3b82f6" },
};

// Cluster node colors (grayed out)
const clusterColors = {
  bg: "rgba(100, 116, 139, 0.08)",
  border: "rgba(100, 116, 139, 0.35)",
  text: "#64748b",
};

// Entity-type border override colors
const entityColors: Record<string, { border: string; icon: string; glow: string }> = {
  scam:     { border: "#ef4444", icon: "⚠️", glow: "rgba(239, 68, 68, 0.25)" },
  mixer:    { border: "#ef4444", icon: "🌀", glow: "rgba(239, 68, 68, 0.25)" },
  exchange: { border: "#22c55e", icon: "🏦", glow: "rgba(34, 197, 94, 0.2)" },
  defi:     { border: "#3b82f6", icon: "🦄", glow: "rgba(59, 130, 246, 0.2)" },
  project:  { border: "#a78bfa", icon: "📋", glow: "rgba(167, 139, 250, 0.15)" },
  custom:   { border: "#f59e0b", icon: "🏷️", glow: "rgba(245, 158, 11, 0.15)" },
};

const CustomNode = ({ data }: CustomNodeProps) => {
  const isCluster = data.isCluster || false;
  const colors = isCluster ? clusterColors : (nodeColors[data.type] || nodeColors.intermediate);
  const entity = data.entityType ? entityColors[data.entityType] : null;
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => {
      setHovered(false);
      setMenuOpen(false);
    }, 200);
  }, []);

  const copyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(data.label);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  const handleExpandDirection = (e: React.MouseEvent, direction: "inbound" | "outbound") => {
    e.stopPropagation();
    setMenuOpen(false);
    data.onExpand?.(data.label, direction);
  };

  // Determine what to show as the display name
  const displayName = data.addressLabel || data.shortLabel;

  // Border color: entity type overrides structural color
  const borderColor = isCluster ? clusterColors.border : (entity ? entity.border : (data.isExpanded ? "#06b6d4" : colors.border));
  const boxShadowValue = isCluster ? undefined : (entity
    ? `0 0 14px ${entity.glow}, inset 0 0 20px ${entity.glow}`
    : (data.isExpanded ? "0 0 12px rgba(6,182,212,0.3)" : undefined));

  return (
    <div
      style={{
        width: 250,
        minHeight: 100,
        padding: "16px",
        borderRadius: 12,
        backgroundColor: colors.bg,
        border: `2px ${isCluster ? "dashed" : "solid"} ${borderColor}`,
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        position: "relative",
        boxShadow: boxShadowValue,
        opacity: isCluster ? 0.7 : 1,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{ background: isCluster ? clusterColors.text : (entity ? entity.border : colors.text), width: 8, height: 8, left: -4 }} 
      />
      
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {/* Entity type icon */}
          {entity && !isCluster && (
            <span className="text-sm" title={`Type: ${data.entityType}`}>{entity.icon}</span>
          )}
          {/* Cluster icon */}
          {isCluster && (
            <span className="text-sm" title="Grouped addresses">📦</span>
          )}
          <span
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: isCluster ? clusterColors.text : (entity ? entity.border : colors.text) }}
          >
            {isCluster ? "cluster" : (data.entityType && data.entityType !== 'project' 
              ? data.entityType 
              : data.type)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Expand button — always visible for all nodes */}
          {data.onExpand && (
            <button
              onClick={handleExpandClick}
              className="text-neutral-500 hover:text-cyan-400 transition-colors p-1 rounded hover:bg-white/10"
              title="Explore connections"
            >
              {data.isLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              )}
            </button>
          )}
          {!isCluster && (
            <button
              onClick={copyAddress}
              className="text-neutral-500 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
              title="Copy full address"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main display: label name or short address */}
      <div 
        className={`mt-2 font-mono text-base ${isCluster ? "italic text-slate-400" : "text-white"}`} 
        title={data.label}
      >
        {displayName}
      </div>

      {/* Show short address below label name (if we have a label name) */}
      {data.addressLabel && !isCluster && (
        <div className="mt-0.5 font-mono text-xs text-slate-500" title={data.label}>
          {data.shortLabel}
        </div>
      )}

      {/* Source badge on hover */}
      {hovered && data.labelSource && (
        <div 
          className="mt-1 text-[10px] text-slate-500 uppercase tracking-wider"
          style={{ opacity: 0.7 }}
        >
          Source: {data.labelSource}
        </div>
      )}

      {/* Expand menu dropdown */}
      {menuOpen && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 rounded-lg border border-white/10 backdrop-blur-md overflow-hidden"
          style={{ background: "rgba(10,15,28,0.95)", minWidth: 160 }}
        >
          <button
            onClick={(e) => handleExpandDirection(e, "inbound")}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            Explore Inbound
          </button>
          <button
            onClick={(e) => handleExpandDirection(e, "outbound")}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            Explore Outbound
          </button>
        </div>
      )}

      <Handle 
        type="source" 
        position={Position.Right} 
        style={{ background: isCluster ? clusterColors.text : (entity ? entity.border : colors.text), width: 8, height: 8, right: -4 }} 
      />
    </div>
  );
};

export default CustomNode;
