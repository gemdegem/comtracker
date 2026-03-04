import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { Transaction, shortenAddress } from "@/lib/types";
import { IconLoader2, IconChevronLeft, IconRefresh } from "@tabler/icons-react";

// Format large amounts: 4000 → 4k, 86500 → 86.5k, 1500000 → 1.5M, 2300000000 → 2.3B
// Keep precision for small crypto amounts (ETH, BTC, SOL)
// Handle dust/spam tokens with absurdly large numbers
const formatCompactAmount = (raw: string, currency?: string): string => {
  const num = parseFloat(raw);
  if (isNaN(num)) return raw;
  if (!isFinite(num)) return "∞";
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  // Dust/spam tokens with absurd amounts (>1 trillion)
  if (abs >= 1e12) return ">1T";
  const upperCurrency = currency?.toUpperCase() || "";
  const isCrypto = ["ETH", "BTC", "SOL", "WBTC", "WETH", "STETH"].includes(upperCurrency);
  // Small crypto amounts — keep precision
  if (isCrypto && abs < 1000) {
    return parseFloat(num.toFixed(6)).toString();
  }
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
  // Small amounts (< 1) — keep up to 6 decimal places
  if (abs < 1 && abs > 0) {
    return parseFloat(num.toFixed(6)).toString();
  }
  // Under 1000 — show as integer if whole, otherwise 2 decimals
  return sign + (abs % 1 === 0 ? abs.toLocaleString("en-US") : parseFloat(abs.toFixed(2)).toLocaleString("en-US"));
};

interface SearchResultsTableProps {
  searchData: Transaction[];
  hasSearched: boolean;
  loading: boolean;
  chain?: string;
  canLoadMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  currentDateRange?: { from: string; till: string } | null;
}

const formatTime = (time: string, relative: boolean) => {
  if (time === "N/A") return "N/A";
  try {
    const date = parseISO(time);
    if (relative) {
      return formatDistanceToNow(date, { addSuffix: true });
    } else {
      return format(date, "yyyy-MM-dd HH:mm");
    }
  } catch {
    return "Unknown";
  }
};

function getExplorerAddressUrl(address: string, chain: string): string {
  if (chain === "solana") return `https://solscan.io/account/${address}`;
  return `https://etherscan.io/address/${address}`;
}

function getExplorerTxUrl(txHash: string, chain: string): string {
  if (chain === "solana") return `https://solscan.io/tx/${txHash}`;
  return `https://etherscan.io/tx/${txHash}`;
}

export default function SearchResultsTable({
  searchData,
  hasSearched,
  loading,
  chain = "ethereum",
  canLoadMore = false,
  loadingMore = false,
  onLoadMore,
  onRefresh,
  currentDateRange,
}: SearchResultsTableProps) {
  const [relativeTime, setRelativeTime] = React.useState<boolean>(false);

  const handleTimeClick = () => {
    setRelativeTime(!relativeTime);
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center p-5">
        <div className="text-center">
          <div className="inline-block w-6 h-6 border-2 border-slate-600 border-t-cyan-500 rounded-full animate-spin mb-2" />
          <p className="text-xs text-slate-400">Loading transactions...</p>
        </div>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="w-full h-full flex items-center justify-center p-5">
        <p className="text-sm text-slate-500">Transaction details will appear here after searching.</p>
      </div>
    );
  }

  if (hasSearched && searchData.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center p-5">
        <p className="text-sm text-slate-500">No transaction data to display.</p>
      </div>
    );
  }

  const isSolana = chain === "solana";

  return (
    <div className="p-5 overflow-auto h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-300">
          Transactions <span className="text-slate-500">({searchData.length})</span>
          {isSolana && currentDateRange && (
            <span className="text-slate-600 text-xs ml-2">
              {currentDateRange.from} → {currentDateRange.till}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {onRefresh && searchData.length > 0 && (
            <button
              onClick={onRefresh}
              className="text-xs text-slate-500 hover:text-cyan-400 transition-colors p-1.5 rounded hover:bg-white/5"
              title="Refresh data (bypass cache)"
            >
              <IconRefresh className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleTimeClick}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded hover:bg-white/5"
          >
            {relativeTime ? "Show absolute time" : "Show relative time"}
          </button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-slate-800 hover:bg-transparent">
            <TableHead className="text-slate-400 text-xs">Time</TableHead>
            <TableHead className="text-slate-400 text-xs">Direction</TableHead>
            <TableHead className="text-slate-400 text-xs">Sender</TableHead>
            <TableHead className="text-slate-400 text-xs">Receiver</TableHead>
            <TableHead className="text-slate-400 text-xs text-right">Amount</TableHead>
            <TableHead className="text-slate-400 text-xs">Currency</TableHead>
            <TableHead className="text-slate-400 text-xs">Depth</TableHead>
            <TableHead className="text-slate-400 text-xs">Count</TableHead>
            <TableHead className="text-slate-400 text-xs">Tx Hash</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {searchData.map((tx, index) => (
            <TableRow key={index} className="border-slate-800/50 hover:bg-white/[0.02]">
              <TableCell className="text-xs text-slate-300 whitespace-nowrap">
                {formatTime(tx.txTime, relativeTime)}
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    tx.direction === "inbound"
                      ? "bg-green-500/10 text-green-400 border border-green-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
                >
                  {tx.direction === "outbound" ? "↑ Out" : "↓ In"}
                </span>
              </TableCell>
              <TableCell>
                <a
                  href={getExplorerAddressUrl(tx.sender, chain)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors hover:underline"
                  title={tx.senderAnnotation ? `${tx.sender} (${tx.senderAnnotation})` : tx.sender}
                >
                  {tx.senderAnnotation || shortenAddress(tx.sender)}
                </a>
              </TableCell>
              <TableCell>
                <a
                  href={getExplorerAddressUrl(tx.receiver, chain)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors hover:underline"
                  title={tx.receiverAnnotation ? `${tx.receiver} (${tx.receiverAnnotation})` : tx.receiver}
                >
                  {tx.receiverAnnotation || shortenAddress(tx.receiver)}
                </a>
              </TableCell>
              <TableCell className="text-xs text-slate-200 text-right font-mono font-medium" title={tx.amount}>
                {formatCompactAmount(tx.amount, tx.currency)}
              </TableCell>
              <TableCell>
                <span className="text-xs text-amber-400 font-medium" title={tx.currency}>
                  {tx.currencyName || tx.currency}
                </span>
              </TableCell>
              <TableCell className="text-xs text-slate-400 text-center">
                {tx.depth}
              </TableCell>
              <TableCell className="text-xs text-slate-400 text-center">
                {tx.count}
              </TableCell>
              <TableCell>
                {tx.txHash !== "N/A" && tx.txHash !== "Unknown" ? (
                  <a
                    href={getExplorerTxUrl(tx.txHash, chain)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors hover:underline"
                    title={tx.txHash}
                  >
                    {shortenAddress(tx.txHash, 8)}
                  </a>
                ) : (
                  <span className="text-xs text-slate-600">N/A</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Load Previous Period button for Solana */}
      {isSolana && canLoadMore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <>
                <IconLoader2 className="w-4 h-4 animate-spin" />
                Loading previous period...
              </>
            ) : (
              <>
                <IconChevronLeft className="w-4 h-4" />
                Load Previous 30 Days
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
