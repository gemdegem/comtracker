import { useEffect } from "react";
import ReactFlow, { Background, Controls, Node, Edge, useNodesState, useEdgesState, Position } from "reactflow";
import "reactflow/dist/style.css";
import CustomNode from "./CustomNode";

interface Transaction {
  sender: string;
  receiver: string;
  amount: string;
  currency: string;
  depth: number;
  count: number;
  txHash: string;
}

interface CustomNodeData {
  label: string;
  transactionCount: number;
}

interface CustomEdgeData {
  label: string;
}

interface TransactionFlowProps {
  transactions: Transaction[];
}

const nodeTypes = { custom: CustomNode };

export default function TransactionFlow({ transactions }: TransactionFlowProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (transactions.length === 0) return;

    const nodesTemp: Node<CustomNodeData>[] = [];
    const edgesTemp: Edge<CustomEdgeData>[] = [];
    let xOffset = 150;

    const edgeCounts: { [key: string]: number } = {};

    transactions.forEach((tx, index) => {
      const sourceId = `node-${tx.sender}`;
      const targetId = `node-${tx.receiver}`;

      const edgeKey = `${sourceId}-${targetId}`;
      const edgeCount = edgeCounts[edgeKey] || 0;
      edgeCounts[edgeKey] = edgeCount + 1;

      const yOffsetSender = 80 * tx.depth;
      const yOffsetReceiver = 350;

      if (!nodesTemp.some((node) => node.id === sourceId)) {
        nodesTemp.push({
          id: sourceId,
          data: { label: tx.sender, transactionCount: edgeCounts[edgeKey] },
          position: { x: xOffset, y: yOffsetSender },
          type: "custom",
        });
      } else {
        const nodeIndex = nodesTemp.findIndex((node) => node.id === sourceId);
        nodesTemp[nodeIndex].data.transactionCount = edgeCounts[edgeKey];
      }

      if (!nodesTemp.some((node) => node.id === targetId)) {
        nodesTemp.push({
          id: targetId,
          data: { label: tx.receiver, transactionCount: edgeCounts[edgeKey] },
          position: { x: xOffset, y: yOffsetReceiver },
          type: "custom",
        });
      } else {
        const nodeIndex = nodesTemp.findIndex((node) => node.id === targetId);
        nodesTemp[nodeIndex].data.transactionCount = edgeCounts[edgeKey];
      }

      const sourceHandle = `source-${edgeCount}`;
      const targetHandle = `target-${edgeCount}`;

      edgesTemp.push({
        id: `e${index}-${tx.txHash}`,
        source: sourceId,
        target: targetId,
        sourceHandle: sourceHandle,
        targetHandle: targetHandle,
        label: `${tx.amount} ${tx.currency}`,
        labelStyle: { fontSize: 12 },
        animated: true,
        style: { stroke: "#ffcc00" },
      });

      xOffset += 250;
    });

    setNodes(nodesTemp);
    setEdges(edgesTemp);
  }, [transactions, setNodes, setEdges]);

  return (
    <div className="w-full h-full">
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodeTypes={nodeTypes}>
        <Background color="#aaa" gap={16} />
      </ReactFlow>
    </div>
  );
}
