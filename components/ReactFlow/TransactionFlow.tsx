import React, { useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, Node, Edge, useNodesState, useEdgesState, Position } from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import CustomNode from "./CustomNode";
import GraphControls from "./GraphControls";
import ParallelEdge, { ParallelEdgeData, ParallelEdgeLine } from './ParallelEdge';
import { Transaction, AddressLabel, EntityType, shortenAddress } from "@/lib/types";

// Format large numbers: 4000 → 4k, 86500 → 86.5k, 1500000 → 1.5M, 2300000000 → 2.3B
const formatCompactNumber = (num: number): string => {
  if (!isFinite(num)) return "∞";
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (abs >= 1e12) return ">1T";
  if (abs >= 1_000_000_000) {
    const val = abs / 1_000_000_000;
    return sign + (val % 1 === 0 ? val.toFixed(0) : parseFloat(val.toFixed(1))) + "B";
  }
  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    return sign + (val % 1 === 0 ? val.toFixed(0) : parseFloat(val.toFixed(1))) + "M";
  }
  if (abs >= 1_000) {
    const val = abs / 1_000;
    return sign + (val % 1 === 0 ? val.toFixed(0) : parseFloat(val.toFixed(1))) + "k";
  }
  // Under 1000 — show as integer if whole, otherwise up to 2 decimals
  return sign + (abs % 1 === 0 ? abs.toFixed(0) : parseFloat(abs.toFixed(2)).toString());
};

interface CustomNodeData {
  label: string;
  shortLabel: string;
  transactionCount: number;
  type: "sender" | "receiver" | "intermediate";
  isExpanded?: boolean;
  isLoading?: boolean;
  isCluster?: boolean;
  onExpand?: (address: string, direction: "inbound" | "outbound") => void;
  // Label data
  addressLabel?: string;
  entityType?: EntityType;
  labelSource?: string;
}

interface CustomEdgeData {
  label: string;
}

interface TransactionFlowProps {
  transactions: Transaction[];
  hasSearched: boolean;
  loading: boolean;
  searchedSender: string;
  searchedReceiver: string;
  minAmount: number;
  onMinAmountChange: (value: number) => void;
  // Expand
  onExpandNode?: (address: string, direction: "inbound" | "outbound") => void;
  expandedNodes?: Set<string>;
  expandingNode?: string | null;
}

const nodeTypes = { custom: CustomNode };
const edgeTypes = { parallel: ParallelEdge };

interface AggregatedEdge {
  sourceId: string;
  targetId: string;
  sender: string;
  receiver: string;
  currency: string;
  totalAmount: number;
  count: number;
  direction: "inbound" | "outbound";
  pathRole: string;
}

// ── Edge color scheme by pathRole ──
const ROLE_COLORS: Record<string, { stroke: string; label: string }> = {
  main_path:       { stroke: "#06b6d4", label: "#ffffff" },  // cyan
  source_of_funds: { stroke: "#22c55e", label: "#bbf7d0" },  // green
  cash_out:        { stroke: "#ef4444", label: "#fecaca" },  // red
  expanded:        { stroke: "#6b7280", label: "#9ca3af" },  // gray
};

// Max individual leaf nodes shown per direction before grouping into "Others"
const MAX_VISIBLE_LEAVES = 5;

const getLayoutedElements = (
  nodes: Node[],
  visualEdges: Edge[],
  layoutEdges: { source: string; target: string }[],
  direction = "LR",
  senderNodeId?: string,
  receiverNodeId?: string
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const isHorizontal = direction === "LR";
  const nodeCount = nodes.length;
  const maxLabelLen = visualEdges.reduce((max, e) => {
    const pEdges = e.data?.lines as ParallelEdgeLine[] | undefined;
    if (pEdges) {
      const pMax = pEdges.reduce((m, l) => Math.max(m, l.pillText.length), 0);
      return Math.max(max, pMax);
    }
    const len = typeof e.label === "string" ? e.label.length : 0;
    return Math.max(max, len);
  }, 0);
  const nodesep = nodeCount <= 3 ? 80 : nodeCount <= 6 ? 150 : 250;
  const ranksep = nodeCount <= 3
    ? Math.max(330, 220 + maxLabelLen * 3.5)
    : nodeCount <= 6 ? 330 : 385;
  dagreGraph.setGraph({ rankdir: direction, nodesep, ranksep });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 250, height: 100 });
  });

  layoutEdges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // ── Pin sender LEFT of receiver ──
  // Only add a single phantom edge: sender → receiver.
  // This guarantees sender is left of receiver in the layout.
  // All other nodes are positioned naturally by their real edges:
  //   - Nodes that send TO sender → appear LEFT of sender (source of funds)
  //   - Nodes between sender and receiver → appear in the MIDDLE (intermediaries)
  //   - Nodes that receive FROM receiver → appear RIGHT of receiver (cash-out)
  const nodeIds = new Set(nodes.map((n) => n.id));
  if (senderNodeId && receiverNodeId && nodeIds.has(senderNodeId) && nodeIds.has(receiverNodeId)) {
    if (!dagreGraph.hasEdge(senderNodeId, receiverNodeId) && !dagreGraph.hasEdge(receiverNodeId, senderNodeId)) {
      dagreGraph.setEdge(senderNodeId, receiverNodeId, { minlen: 1 });
    }
  }

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - 125,
        y: nodeWithPosition.y - 50,
      },
    };
    return newNode;
  });

  return { nodes: newNodes, edges: visualEdges };
};

export default function TransactionFlow({
  transactions,
  hasSearched,
  loading,
  searchedSender,
  searchedReceiver,
  minAmount,
  onMinAmountChange,

  onExpandNode,
  expandedNodes,
  expandingNode,
}: TransactionFlowProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [addressLabels, setAddressLabels] = useState<Record<string, AddressLabel>>({});

  // ── Fetch address labels whenever transactions change ──
  useEffect(() => {
    if (transactions.length === 0) {
      setAddressLabels({});
      return;
    }

    const uniqueAddresses = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.sender && tx.sender !== 'Unknown') uniqueAddresses.add(tx.sender);
      if (tx.receiver && tx.receiver !== 'Unknown') uniqueAddresses.add(tx.receiver);
    });

    if (uniqueAddresses.size === 0) return;

    const controller = new AbortController();

    fetch('/api/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: Array.from(uniqueAddresses) }),
      signal: controller.signal,
    })
      .then(res => res.ok ? res.json() : {})
      .then((labels: Record<string, AddressLabel>) => {
        // Merge with Bitquery annotations as fallback
        const merged = { ...labels };
        transactions.forEach((tx) => {
          const sAddr = tx.sender?.toLowerCase();
          const rAddr = tx.receiver?.toLowerCase();
          if (sAddr && !merged[sAddr] && tx.senderAnnotation) {
            merged[sAddr] = { name: tx.senderAnnotation, type: 'project', source: 'bitquery' };
          }
          if (rAddr && !merged[rAddr] && tx.receiverAnnotation) {
            merged[rAddr] = { name: tx.receiverAnnotation, type: 'project', source: 'bitquery' };
          }
        });
        setAddressLabels(merged);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('[Labels] Failed to fetch address labels:', err);
        }
      });

    return () => controller.abort();
  }, [transactions]);

  // ── Cluster expansion state ──
  // Track which clusters (by their ID) are currently expanded
  const [expandedClusters, setExpandedClusters] = React.useState<Set<string>>(new Set());

  // Handle clicking a cluster node to expand it
  const handleNodeClick = React.useCallback((_: React.MouseEvent, node: Node) => {
    if (node.id.startsWith("cluster-")) {
      setExpandedClusters((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        return next;
      });
    }
  }, []);

  // Determine if expanded nodes exist for the toggle visibility
  const hasExpandedNodes = useMemo(() => {
    return transactions.some((tx) => tx.pathRole === "expanded");
  }, [transactions]);

  // ── Filter transactions by dust threshold and active layers ──
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Dust filter: check raw amount
      if (minAmount > 0) {
        const amt = Math.abs(parseFloat(tx.amount) || 0);
        // If we have USD amount use that, otherwise check raw amount
        const checkAmt = tx.amountUSD != null ? tx.amountUSD : amt;
        if (checkAmt < minAmount) return false;
      }
      return true;
    });
  }, [transactions, minAmount]);

  useEffect(() => {
    if (filteredTransactions.length === 0) {
      // If we have transactions but they're all filtered out, show the sender/receiver nodes still
      if (transactions.length > 0 && (searchedSender || searchedReceiver)) {
        const placeholderNodes: Node<CustomNodeData>[] = [];
        if (searchedSender) {
          placeholderNodes.push({
            id: `node-${searchedSender}`,
            data: {
              label: searchedSender,
              shortLabel: shortenAddress(searchedSender),
              transactionCount: 0,
              type: "sender",
              onExpand: onExpandNode,
              isExpanded: expandedNodes?.has(searchedSender),
              isLoading: expandingNode === searchedSender,
            },
            position: { x: 0, y: 0 },
            type: "custom",
          });
        }
        if (searchedReceiver) {
          placeholderNodes.push({
            id: `node-${searchedReceiver}`,
            data: {
              label: searchedReceiver,
              shortLabel: shortenAddress(searchedReceiver),
              transactionCount: 0,
              type: "receiver",
              onExpand: onExpandNode,
              isExpanded: expandedNodes?.has(searchedReceiver),
              isLoading: expandingNode === searchedReceiver,
            },
            position: { x: 400, y: 0 },
            type: "custom",
          });
        }
        setNodes(placeholderNodes);
        setEdges([]);
        return;
      }
      setNodes([]);
      setEdges([]);
      return;
    }

    // --- Step 0: Identify Leaf Nodes for Peripheral Clustering ---
    // We split leaf nodes into separate IN and OUT clusters per neighbor.
    // Addresses that have BOTH IN and OUT are shown individually (not clustered).
    const adjacency: Record<string, Set<string>> = {};
    const nodeVolume: Record<string, number> = {};

    // Track directed edges: which nodeId sends to which, and receives from which
    const sendsTo: Record<string, Set<string>> = {};   // nodeId -> set of targets it sends to
    const receivesFrom: Record<string, Set<string>> = {}; // nodeId -> set of sources it receives from

    filteredTransactions.forEach((tx) => {
      const sourceId = `node-${tx.sender.toLowerCase()}`;
      const targetId = `node-${tx.receiver.toLowerCase()}`;
      if (!adjacency[sourceId]) adjacency[sourceId] = new Set();
      if (!adjacency[targetId]) adjacency[targetId] = new Set();
      adjacency[sourceId].add(targetId);
      adjacency[targetId].add(sourceId);

      if (!sendsTo[sourceId]) sendsTo[sourceId] = new Set();
      sendsTo[sourceId].add(targetId);
      if (!receivesFrom[targetId]) receivesFrom[targetId] = new Set();
      receivesFrom[targetId].add(sourceId);

      const amt = tx.amountUSD != null ? tx.amountUSD : (parseFloat(tx.amount) || 0);
      nodeVolume[sourceId] = (nodeVolume[sourceId] || 0) + amt;
      nodeVolume[targetId] = (nodeVolume[targetId] || 0) + amt;
    });

    const searchedSenderId = searchedSender ? `node-${searchedSender.toLowerCase()}` : "";
    const searchedReceiverId = searchedReceiver ? `node-${searchedReceiver.toLowerCase()}` : "";

    // Classify leaf nodes by direction relative to their single neighbor
    // leafOut: leaf SENDS to neighbor (leaf is source)
    // leafIn:  leaf RECEIVES from neighbor (leaf is target)
    const leafOutByNeighbor: Record<string, string[]> = {};
    const leafInByNeighbor: Record<string, string[]> = {};

    Object.keys(adjacency).forEach((nodeId) => {
      if (nodeId === searchedSenderId || nodeId === searchedReceiverId) return;
      const neighbors = Array.from(adjacency[nodeId]);
      if (neighbors.length !== 1) return;
      const neighbor = neighbors[0];

      const sends = sendsTo[nodeId]?.has(neighbor) || false;
      const receives = receivesFrom[nodeId]?.has(neighbor) || false;

      // Bidirectional with neighbor → show individually
      if (sends && receives) return;

      if (sends) {
        if (!leafOutByNeighbor[neighbor]) leafOutByNeighbor[neighbor] = [];
        leafOutByNeighbor[neighbor].push(nodeId);
      } else if (receives) {
        if (!leafInByNeighbor[neighbor]) leafInByNeighbor[neighbor] = [];
        leafInByNeighbor[neighbor].push(nodeId);
      }
    });

    const clusterMap: Record<string, string> = {}; // raw lowercase address -> cluster Node ID
    const clusterCounts: Record<string, number> = {}; // cluster Node ID -> number of clustered addresses

    // Cluster OUT leaves (addresses that send TO the neighbor)
    Object.entries(leafOutByNeighbor).forEach(([neighbor, leaves]) => {
      if (leaves.length > MAX_VISIBLE_LEAVES) {
        leaves.sort((a, b) => (nodeVolume[b] || 0) - (nodeVolume[a] || 0));
        const leavesToCluster = leaves.slice(MAX_VISIBLE_LEAVES);
        const clusterId = `cluster-out-${neighbor}`;
        clusterCounts[clusterId] = leavesToCluster.length;
        leavesToCluster.forEach((leaf) => {
          const address = leaf.replace("node-", "");
          if (!expandedClusters.has(clusterId)) {
            clusterMap[address] = clusterId;
          }
        });
      }
    });

    // Cluster IN leaves (addresses that receive FROM the neighbor)
    Object.entries(leafInByNeighbor).forEach(([neighbor, leaves]) => {
      if (leaves.length > MAX_VISIBLE_LEAVES) {
        leaves.sort((a, b) => (nodeVolume[b] || 0) - (nodeVolume[a] || 0));
        const leavesToCluster = leaves.slice(MAX_VISIBLE_LEAVES);
        const clusterId = `cluster-in-${neighbor}`;
        clusterCounts[clusterId] = leavesToCluster.length;
        leavesToCluster.forEach((leaf) => {
          const address = leaf.replace("node-", "");
          if (!expandedClusters.has(clusterId)) {
            clusterMap[address] = clusterId;
          }
        });
      }
    });

    // --- Step 1: Aggregate by source-target-currency ---
    const perCurrencyMap: { [key: string]: AggregatedEdge } = {};

    filteredTransactions.forEach((tx) => {
      // Normalize to lowercase for node IDs
      const rawSender = tx.sender.toLowerCase();
      const rawReceiver = tx.receiver.toLowerCase();
      
      const sourceId = clusterMap[rawSender] || `node-${rawSender}`;
      const targetId = clusterMap[rawReceiver] || `node-${rawReceiver}`;
      
      const currency = tx.currency;
      const key = `${sourceId}-${targetId}-${currency}`;
      const amount = parseFloat(tx.amount) || 0;
      const role = tx.pathRole || "main_path";

      if (!perCurrencyMap[key]) {
        perCurrencyMap[key] = {
          sourceId,
          targetId,
          sender: clusterMap[rawSender] ? `cluster` : tx.sender,
          receiver: clusterMap[rawReceiver] ? `cluster` : tx.receiver,
          currency,
          totalAmount: amount,
          count: 1,
          direction: tx.direction,
          pathRole: role,
        };
      } else {
        perCurrencyMap[key].totalAmount += amount;
        perCurrencyMap[key].count += 1;
      }
    });

    // --- Step 2: Group all currencies into one edge per directed pair ---
    interface PairEdge {
      sourceId: string;
      targetId: string;
      sender: string;
      receiver: string;
      direction: "inbound" | "outbound";
      tokens: { currency: string; totalAmount: number; count: number }[];
      pathRole: string;
    }

    const pairMap: { [key: string]: PairEdge } = {};

    Object.values(perCurrencyMap).forEach((agg) => {
      const pairKey = `${agg.sourceId}->${agg.targetId}`;

      if (!pairMap[pairKey]) {
        pairMap[pairKey] = {
          sourceId: agg.sourceId,
          targetId: agg.targetId,
          sender: agg.sender,
          receiver: agg.receiver,
          direction: agg.direction,
          tokens: [],
          pathRole: agg.pathRole,
        };
      }

      pairMap[pairKey].tokens.push({
        currency: agg.currency,
        totalAmount: agg.totalAmount,
        count: agg.count,
      });
      // Promote role: main_path > source_of_funds > cash_out > expanded
      const rolePriority = { main_path: 3, source_of_funds: 2, cash_out: 2, expanded: 1 };
      const existingPriority = rolePriority[pairMap[pairKey].pathRole as keyof typeof rolePriority] || 0;
      const newPriority = rolePriority[agg.pathRole as keyof typeof rolePriority] || 0;
      if (newPriority > existingPriority) {
        pairMap[pairKey].pathRole = agg.pathRole;
      }
    });

    const pairEdges = Object.values(pairMap);

    // --- Step 3: Group into Undirected Pairs for Parallel Edges ---
    const undirectedPairMap: {
      [key: string]: {
        sourceId: string;
        targetId: string;
        forward?: PairEdge;
        backward?: PairEdge;
      };
    } = {};

    let initialNodes: Node<CustomNodeData>[] = [];
    let initialEdges: Edge<ParallelEdgeData>[] = [];

    const getNodeType = (addr: string): "sender" | "receiver" | "intermediate" => {
      if (addr.toLowerCase() === searchedSender.toLowerCase()) return "sender";
      if (searchedReceiver && addr.toLowerCase() === searchedReceiver.toLowerCase()) return "receiver";
      return "intermediate";
    };

    pairEdges.forEach((pair) => {
      const { sourceId, targetId, sender, receiver } = pair;

      // Add source node
      if (!initialNodes.some((node) => node.id === sourceId)) {
        const isCluster = sourceId.startsWith("cluster-");
        const clusterCount = isCluster ? clusterCounts[sourceId] || 0 : 0;
        const clusterDir = sourceId.startsWith("cluster-in-") ? "IN" : "OUT";
        const senderLabel = addressLabels[sender.toLowerCase()];
        initialNodes.push({
          id: sourceId,
          data: {
            label: isCluster ? `Others ${clusterDir} (${clusterCount})` : sender,
            shortLabel: isCluster ? `Others ${clusterDir} (${clusterCount})` : shortenAddress(sender),
            transactionCount: 1,
            type: getNodeType(sender),
            isCluster,
            onExpand: isCluster ? undefined : onExpandNode,
            isExpanded: expandedNodes?.has(sender),
            isLoading: expandingNode === sender,
            addressLabel: isCluster ? undefined : senderLabel?.name,
            entityType: isCluster ? undefined : senderLabel?.type,
            labelSource: isCluster ? undefined : senderLabel?.source,
          },
          position: { x: 0, y: 0 },
          type: "custom",
        });
      }

      // Add target node
      if (!initialNodes.some((node) => node.id === targetId)) {
        const isCluster = targetId.startsWith("cluster-");
        const clusterCount = isCluster ? clusterCounts[targetId] || 0 : 0;
        const clusterDir = targetId.startsWith("cluster-in-") ? "IN" : "OUT";
        const receiverLabel = addressLabels[receiver.toLowerCase()];
        initialNodes.push({
          id: targetId,
          data: {
            label: isCluster ? `Others ${clusterDir} (${clusterCount})` : receiver,
            shortLabel: isCluster ? `Others ${clusterDir} (${clusterCount})` : shortenAddress(receiver),
            transactionCount: 1,
            type: getNodeType(receiver),
            isCluster,
            onExpand: isCluster ? undefined : onExpandNode,
            isExpanded: expandedNodes?.has(receiver),
            isLoading: expandingNode === receiver,
            addressLabel: isCluster ? undefined : receiverLabel?.name,
            entityType: isCluster ? undefined : receiverLabel?.type,
            labelSource: isCluster ? undefined : receiverLabel?.source,
          },
          position: { x: 0, y: 0 },
          type: "custom",
        });
      }

      // Group into undirected pairs (lexicographic ordering of sourceId and targetId)
      const isForward = sourceId < targetId;
      const key = isForward ? `${sourceId}--${targetId}` : `${targetId}--${sourceId}`;
      
      if (!undirectedPairMap[key]) {
        undirectedPairMap[key] = {
          sourceId: isForward ? sourceId : targetId,
          targetId: isForward ? targetId : sourceId,
        };
      }
      
      if (isForward) {
        undirectedPairMap[key].forward = pair;
      } else {
        undirectedPairMap[key].backward = pair;
      }
    });

    // ── Build visual edges AND layout edges in one unified pass ──
    const layoutEdgesData: { source: string; target: string }[] = [];

    Object.values(undirectedPairMap).forEach((group) => {
      const { forward, backward } = group;

      // ── Step A: Determine LEFT→RIGHT direction for this pair ──
      // In dagre LR layout, source goes LEFT, target goes RIGHT.
      // We use the ACTUAL transaction flow to determine direction.
      let leftNode: string;
      let rightNode: string;

      if (forward && backward) {
        // Bidirectional: always put the other node to the RIGHT of searched sender
        const nodeA = forward.sourceId;
        const nodeB = forward.targetId;
        if (nodeA === searchedSenderId) {
          leftNode = nodeA;
          rightNode = nodeB;
        } else if (nodeB === searchedSenderId) {
          leftNode = nodeB;
          rightNode = nodeA;
        } else if (nodeA === searchedReceiverId) {
          leftNode = nodeA;
          rightNode = nodeB;
        } else if (nodeB === searchedReceiverId) {
          leftNode = nodeB;
          rightNode = nodeA;
        } else {
          // Neither is searched sender/receiver — follow forward flow
          leftNode = nodeA;
          rightNode = nodeB;
        }
      } else if (forward) {
        // Single direction: actual transaction sender → receiver
        leftNode = forward.sourceId;
        rightNode = forward.targetId;
      } else if (backward) {
        // Single direction: actual transaction sender → receiver
        leftNode = backward.sourceId;
        rightNode = backward.targetId;
      } else {
        // Should not happen
        leftNode = group.sourceId;
        rightNode = group.targetId;
      }

      // ── Step B: Build line data for each direction in this pair ──
      const buildLineData = (pair: PairEdge): ParallelEdgeLine => {
        const { sender, receiver, direction, tokens, pathRole } = pair;
        
        const totalTxCount = tokens.reduce((sum, t) => sum + t.count, 0);
        const sortedTokens = [...tokens].sort((a, b) => b.totalAmount - a.totalAmount);
        const displayTokens = sortedTokens.slice(0, 3);
        const hiddenCount = sortedTokens.length - displayTokens.length;

        const labelParts = displayTokens.map((t) => {
          let formattedAmount: string;
          const absTotalAmount = Math.abs(t.totalAmount);
          if (["ETH", "BTC", "WBTC", "WETH", "STETH", "SOL"].includes(t.currency) && t.totalAmount > 0) {
            formattedAmount = t.totalAmount >= 1000
              ? formatCompactNumber(t.totalAmount)
              : parseFloat(t.totalAmount.toFixed(6)).toString();
          } else if (absTotalAmount < 1 && absTotalAmount > 0) {
            formattedAmount = parseFloat(t.totalAmount.toFixed(6)).toString();
          } else if (absTotalAmount >= 1000) {
            formattedAmount = formatCompactNumber(Math.round(t.totalAmount));
          } else {
            // Keep precision for amounts under 1000
            formattedAmount = parseFloat(t.totalAmount.toFixed(2)).toString();
          }
          return t.count > 1
            ? `${formattedAmount} ${t.currency} (${t.count} txs)`
            : `${formattedAmount} ${t.currency}`;
        });

        if (hiddenCount > 0) labelParts.push(`+${hiddenCount} more`);

        const isMainPath = pathRole === "main_path";

        // Check if either end is a known exchange/defi entity (for pill badge only)
        const sourceEntityLabel = addressLabels[sender.toLowerCase()];
        const targetEntityLabel = addressLabels[receiver.toLowerCase()];
        const knownEntity = [sourceEntityLabel, targetEntityLabel].find(
          l => l?.type === 'exchange' || l?.type === 'defi'
        );

        // Direction-based colors — always green (IN) / red (OUT)
        let lineColor: string;
        let pillColor: string;

        if (direction === "inbound") {
          lineColor = "#22c55e"; // green
          pillColor = "#4ade80"; // light green for text
        } else {
          lineColor = "#ef4444"; // red
          pillColor = "#f87171"; // light red for text
        }

        let prefix = "";
        if (direction === "inbound") prefix = "[↓] IN: ";
        else if (direction === "outbound") prefix = "[↑] OUT: ";

        // Add subtle entity badge (🏦 exchange / 🦄 defi) so user knows what's on the other end
        const entityBadge = knownEntity
          ? (knownEntity.type === 'exchange' ? "🏦 " : "🦄 ")
          : "";
        const pillText = entityBadge + prefix + labelParts.join(" | ");

        const dashArray: string | undefined = "4 4";

        // isForward means the line flows from leftNode → rightNode
        // (same direction as the ReactFlow edge source→target)
        const isLineForward = pair.sourceId === leftNode;

        return {
          isForward: isLineForward,
          color: lineColor,
          isFalsePositive: false,
          dashArray,
          pillText,
          pillColor,
          strokeWidth: isMainPath ? 3 : 2,
          opacity: isMainPath ? 0.9 : 0.6,
          animated: isMainPath,
          direction: direction,
        };
      };

      const lines: ParallelEdgeLine[] = [];
      if (forward) lines.push(buildLineData(forward));
      if (backward) lines.push(buildLineData(backward));

      // Sort lines so IN comes before OUT in the pill
      lines.sort((a, b) => {
        if (a.direction === "inbound" && b.direction !== "inbound") return -1;
        if (b.direction === "inbound" && a.direction !== "inbound") return 1;
        return 0;
      });

      // ── Step C: Create BOTH visual edge AND layout edge with SAME direction ──
      layoutEdgesData.push({ source: leftNode, target: rightNode });

      initialEdges.push({
        id: `e-${leftNode}-${rightNode}`,
        source: leftNode,
        target: rightNode,
        type: "parallel",
        data: { lines },
      });
    });

    // ── Always ensure sender and receiver nodes exist ──
    if (searchedSender) {
      const senderNodeId = `node-${searchedSender.toLowerCase()}`;
      if (!initialNodes.some((node) => node.id === senderNodeId)) {
        initialNodes.push({
          id: senderNodeId,
          data: {
            label: searchedSender,
            shortLabel: shortenAddress(searchedSender),
            transactionCount: 0,
            type: "sender",
            onExpand: onExpandNode,
            isExpanded: expandedNodes?.has(searchedSender),
            isLoading: expandingNode === searchedSender,
          },
          position: { x: 0, y: 0 },
          type: "custom",
        });
      }
    }
    if (searchedReceiver) {
      const receiverNodeId = `node-${searchedReceiver.toLowerCase()}`;
      if (!initialNodes.some((node) => node.id === receiverNodeId)) {
        initialNodes.push({
          id: receiverNodeId,
          data: {
            label: searchedReceiver,
            shortLabel: shortenAddress(searchedReceiver),
            transactionCount: 0,
            type: "receiver",
            onExpand: onExpandNode,
            isExpanded: expandedNodes?.has(searchedReceiver),
            isLoading: expandingNode === searchedReceiver,
          },
          position: { x: 0, y: 0 },
          type: "custom",
        });
      }
    }

    // Pass sender/receiver IDs so dagre pins sender LEFT, receiver RIGHT
    const senderLayoutId = searchedSender ? `node-${searchedSender.toLowerCase()}` : undefined;
    const receiverLayoutId = searchedReceiver ? `node-${searchedReceiver.toLowerCase()}` : undefined;
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes, initialEdges, layoutEdgesData, "LR", senderLayoutId, receiverLayoutId
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [filteredTransactions, setNodes, setEdges, searchedSender, searchedReceiver, onExpandNode, expandedNodes, expandingNode, transactions, expandedClusters, addressLabels]);

  // Empty / loading states
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-950/50">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-slate-600 border-t-cyan-500 rounded-full animate-spin mb-3" />
          <p className="text-sm text-slate-400">Searching for transactions...</p>
        </div>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-950/50">
        <div className="text-center max-w-md px-4">
          <svg className="w-12 h-12 mx-auto mb-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-slate-400 text-sm mb-6">
            Enter wallet addresses and click <span className="text-white font-medium">&quot;Find Connections&quot;</span> to visualize the transaction flow between them.
          </p>

          {/* Graph Legend */}
          <div className="text-left bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-4">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Graph Legend</h4>

            {/* Node colors */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Nodes</p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 ring-1 ring-green-500/30" />
                  <span className="text-[11px] text-slate-400">Sender</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 ring-1 ring-red-500/30" />
                  <span className="text-[11px] text-slate-400">Receiver</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-1 ring-blue-500/30" />
                  <span className="text-[11px] text-slate-400">Intermediate</span>
                </div>
              </div>
            </div>

            {/* Edge colors */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Edges</p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-green-500 rounded" />
                  <span className="text-[11px] text-slate-400">Inbound</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-red-500 rounded" />
                  <span className="text-[11px] text-slate-400">Outbound</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-gray-500 rounded" />
                  <span className="text-[11px] text-slate-400">Expanded</span>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Tips</p>
              <ul className="text-[11px] text-slate-400 space-y-1 list-none">
                <li className="flex items-start gap-1.5">
                  <span className="text-cyan-500 mt-px">＋</span>
                  <span>Click <strong className="text-slate-300">+/−</strong> on nodes to expand their inbound/outbound neighbors</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-cyan-500 mt-px">⊘</span>
                  <span>Use <strong className="text-slate-300">Min Amount</strong> slider to filter small transfers</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-cyan-500 mt-px">🏷</span>
                  <span>Known addresses are labeled (exchanges, DeFi, scam)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (hasSearched && transactions.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-950/50">
        <div className="text-center max-w-sm px-4">
          <svg className="w-12 h-12 mx-auto mb-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-slate-400 text-sm">
            No transactions found between these addresses.
          </p>
          <p className="text-slate-500 text-xs mt-1">
            Try different addresses or check the address format.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Graph Controls overlay */}
      <GraphControls
        minAmount={minAmount}
        onMinAmountChange={onMinAmountChange}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3, minZoom: 0.7, maxZoom: 1 }}
        minZoom={0.1}
      >
        <Background color="#333" gap={20} size={1} />
        <Controls
          style={{
            backgroundColor: "rgba(0,0,0,0.6)",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        />
        <MiniMap
          nodeColor={(node) => {
            const type = (node.data as CustomNodeData)?.type;
            if (type === "sender") return "#22c55e";
            if (type === "receiver") return "#ef4444";
            return "#3b82f6";
          }}
          style={{
            backgroundColor: "rgba(0,0,0,0.6)",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
          maskColor="rgba(0,0,0,0.5)"
        />
      </ReactFlow>
    </div>
  );
}
