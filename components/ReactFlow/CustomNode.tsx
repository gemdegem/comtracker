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
    let positionOffset;
    if (data.transactionCount === 1) {
      positionOffset = 50;
    } else if (data.transactionCount === 2) {
      positionOffset = i === 0 ? 20 : 80;
    } else {
      positionOffset = (i * 100) / (data.transactionCount - 1); //many handles
    }

    handles.push(<Handle key={`source-${i}`} type="source" position={Position.Bottom} id={`source-${i}`} style={{ left: `${positionOffset}%` }} />);
    handles.push(<Handle key={`target-${i}`} type="target" position={Position.Top} id={`target-${i}`} style={{ left: `${positionOffset}%` }} />);
  }

  return (
    <div
      style={{
        width: 410,
        padding: 10,
        borderRadius: 5,
        backgroundColor: "#fff",
        border: "1px solid #ddd",
        color: "black",
      }}
    >
      <div>{data.label}</div>
      {handles}
    </div>
  );
};

export default CustomNode;
