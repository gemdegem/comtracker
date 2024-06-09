import React from "react";
import { Handle, Position } from "reactflow";

type CustomNodeProps = {
  data: {
    transactionCount: number;
    label: string;
  };
};

const CustomNode = ({ data }: CustomNodeProps) => {
  const handles = [];
  for (let i = 0; i < data.transactionCount; i++) {
    handles.push(<Handle key={`source-${i}`} type="source" position={Position.Bottom} id={`source-${i}`} style={{ left: `${(i + 1) * (100 / (data.transactionCount + 1))}%` }} />);
    handles.push(<Handle key={`target-${i}`} type="target" position={Position.Top} id={`target-${i}`} style={{ left: `${(i + 1) * (100 / (data.transactionCount + 1))}%` }} />);
  }

  return (
    <div style={{ width: 410, padding: 10, borderRadius: 5, backgroundColor: "#fff", border: "1px solid #ddd", color: "black" }}>
      <div>{data.label}</div>
      {handles}
    </div>
  );
};

export default CustomNode;
