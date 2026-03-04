"use client";
import React from "react";

interface GraphControlsProps {
  minAmount: number;
  onMinAmountChange: (value: number) => void;
}

export default function GraphControls({
  minAmount,
  onMinAmountChange,
}: GraphControlsProps) {
  return (
    <div
      className="absolute top-3 right-3 z-50 flex flex-col gap-2"
      style={{ pointerEvents: "auto" }}
    >
      {/* Dust Filter */}
      <div
        className="rounded-xl px-4 py-3 border border-white/10 backdrop-blur-md"
        style={{ background: "rgba(10,15,28,0.85)" }}
      >
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">
            Min Amount
          </span>
          <span className="text-xs font-mono text-cyan-400">
            {minAmount === 0 ? "OFF" : `$${minAmount.toLocaleString()}`}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="10000"
          step="100"
          value={minAmount}
          onChange={(e) => onMinAmountChange(Number(e.target.value))}
          className="w-36 h-1.5 bg-neutral-700 rounded-full appearance-none cursor-pointer accent-cyan-500"
        />
        <div className="flex justify-between text-[10px] text-neutral-500 mt-0.5">
          <span>$0</span>
          <span>$10K</span>
        </div>
      </div>
    </div>
  );
}
