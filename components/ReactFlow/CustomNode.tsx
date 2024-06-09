import React from "react";
import { Handle, Position } from "reactflow";

const CustomNode = ({ data }: { data: any }) => {
  const handles = [];

  if (data.transactionCount > 0) {
    const handleSpacing = 30;

    for (let i = 0; i < data.transactionCount; i++) {
      if (data.hasSourceHandles) {
        handles.push(<Handle key={`source-${i}`} type="source" position={Position.Bottom} id={`source-${i}`} style={{ left: `${(i + 1) * (100 / (data.transactionCount + 1))}%`, marginLeft: handleSpacing * i }} />);
      }
      if (data.hasTargetHandles) {
        handles.push(<Handle key={`target-${i}`} type="target" position={Position.Top} id={`target-${i}`} style={{ left: `${(i + 1) * (100 / (data.transactionCount + 1))}%`, marginLeft: handleSpacing * i }} />);
      }
    }
  }

  return (
    <div style={{ width: 410, padding: 10, borderRadius: 5, backgroundColor: "#fff", border: "1px solid #ddd", color: "black" }}>
      <div>{data.label}</div>
      {handles}
    </div>
  );
};

export default CustomNode;
