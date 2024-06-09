import { useEffect } from "react";
import ReactFlow, { Background, Controls, Node, Edge, useNodesState, useEdgesState } from "reactflow";
import "reactflow/dist/style.css";

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
}

interface CustomEdgeData {
  label: string;
}

interface TransactionFlowProps {
  transactions: Transaction[];
}

const nodeStyles = {
  width: 320,
  padding: 10,
  borderRadius: 5,
  backgroundColor: "#fff",
  border: "1px solid #ddd",
};

const TransactionFlow: React.FC<TransactionFlowProps> = ({ transactions }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (transactions.length === 0) return; // Avoid processing when no transactions are available

    const nodesTemp: Node<CustomNodeData>[] = [];
    const edgesTemp: Edge<CustomEdgeData>[] = [];
    let xOffset = 150; // Start position for the first transaction horizontally

    const edgeCounts: { [key: string]: number } = {};

    transactions.forEach((tx, index) => {
      const sourceId = `node-${tx.sender}`;
      const targetId = `node-${tx.receiver}`;

      const sourcePosition = { x: xOffset, y: 300 };
      const targetPosition = { x: xOffset, y: 450 };

      if (!nodesTemp.some((node) => node.id === sourceId)) {
        nodesTemp.push({
          id: sourceId,
          data: { label: tx.sender },
          position: sourcePosition,
          style: nodeStyles,
        });
      }

      if (!nodesTemp.some((node) => node.id === targetId)) {
        nodesTemp.push({
          id: targetId,
          data: { label: tx.receiver },
          position: targetPosition,
          style: nodeStyles,
        });
      }

      const edgeKey = `${sourceId}-${targetId}`;
      const edgeOffset = (edgeCounts[edgeKey] || 0) * 10;
      edgeCounts[edgeKey] = (edgeCounts[edgeKey] || 0) + 1;

      edgesTemp.push({
        id: `e${index}-${tx.txHash}`,
        source: sourceId,
        target: targetId,
        label: `${tx.amount} ${tx.currency}`,
        animated: true,
        style: { stroke: "#ffcc00" },
        labelStyle: { transform: `translateY(${edgeOffset}px)` },
      });

      xOffset += 300; // Increase xOffset for the next transaction
    });

    setNodes(nodesTemp);
    setEdges(edgesTemp);
  }, [transactions]);

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
