import { useEffect, useState } from "react";
import ReactFlow, { Background, Controls, Node, Edge, useNodesState, useEdgesState } from "reactflow";
import "reactflow/dist/style.css";

interface Transaction {
  sender: { address: string };
  receiver: { address: string };
  amount: number;
  currency: { symbol: string };
}

interface CustomNodeData {
  label: string;
}

interface CustomEdgeData {
  label: string;
}

const sampleTransactions: Transaction[] = [
  {
    sender: { address: "Sender Address 1" },
    receiver: { address: "Receiver Address 1" },
    amount: 150,
    currency: { symbol: "USDT" },
  },
  {
    sender: { address: "Sender Address 2" },
    receiver: { address: "Receiver Address 2" },
    amount: 1.1,
    currency: { symbol: "ETH" },
  },
];

const TransactionFlow: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const nodesTemp: Node<CustomNodeData>[] = [];
    const edgesTemp: Edge<CustomEdgeData>[] = [];
    let xOffset = 150; // Start position for the first transaction horizontally

    sampleTransactions.forEach((tx, index) => {
      const sourceId = `node-${tx.sender.address}`;
      const targetId = `node-${tx.receiver.address}`;

      const sourcePosition = { x: xOffset, y: 300 };
      const targetPosition = { x: xOffset, y: 450 };

      if (!nodesTemp.some((node) => node.id === sourceId)) {
        nodesTemp.push({
          id: sourceId,
          data: { label: tx.sender.address },
          position: sourcePosition,
        });
      }

      if (!nodesTemp.some((node) => node.id === targetId)) {
        nodesTemp.push({
          id: targetId,
          data: { label: tx.receiver.address },
          position: targetPosition,
        });
      }

      edgesTemp.push({
        id: `e${index}`,
        source: sourceId,
        target: targetId,
        label: `${tx.amount} ${tx.currency.symbol}`,
        animated: true,
        style: { stroke: "#ffcc00" },
      });

      xOffset += 300; // Increase xOffset for the next transaction
    });

    setNodes(nodesTemp);
    setEdges(edgesTemp);
  }, []);

  return (
    <div style={{ height: 800, width: 800 }}>
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}>
        <Background color="#aaa" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default TransactionFlow;
