'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OverlapResult } from '@/hooks/useTokenOverlap';
import { ExternalLink, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TokenOverlapTableProps {
  data: OverlapResult[];
  loading: boolean;
  hasSearched: boolean;
  chain: string;
  token1Symbol?: string;
  token2Symbol?: string;
  token1Price?: number;
  token2Price?: number;
}

export function TokenOverlapTable({ 
  data, 
  loading, 
  hasSearched, 
  chain, 
  token1Symbol = 'Token 1', 
  token2Symbol = 'Token 2',
  token1Price = 0,
  token2Price = 0
}: TokenOverlapTableProps) {
  if (!hasSearched) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-[#0a0f1c]/50">
        <Users className="w-12 h-12 mb-4 opacity-20" />
        <p>Enter two token addresses to find overlapping holders</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-[#0a0f1c]/50">
        <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4" />
        <p>Scanning top receivers and intersecting...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-[#0a0f1c]/50">
        <p className="text-lg mb-2">No overlap found.</p>
        <p className="text-sm opacity-60">The top receivers for these two tokens do not intersect.</p>
      </div>
    );
  }

  const getExplorerLink = (address: string) => {
    if (chain === 'solana') {
      return `https://solscan.io/account/${address}`;
    }
    return `https://etherscan.io/address/${address}`;
  };

  const formatAmount = (num: number) => {
    const abs = Math.abs(num);
    if (abs >= 1_000_000_000) { const v = abs / 1_000_000_000; return (v % 1 === 0 ? v.toFixed(0) : parseFloat(v.toFixed(1))) + 'B'; }
    if (abs >= 1_000_000) { const v = abs / 1_000_000; return (v % 1 === 0 ? v.toFixed(0) : parseFloat(v.toFixed(1))) + 'M'; }
    if (abs >= 1_000) { const v = abs / 1_000; return (v % 1 === 0 ? v.toFixed(0) : parseFloat(v.toFixed(1))) + 'k'; }
    return abs % 1 === 0 ? abs.toFixed(0) : parseFloat(abs.toFixed(2)).toString();
  };

  const formatValue = (num: number, price: number) => {
    if (price === 0) return null;
    const value = num * price;
    if (value < 0.01) return '<$0.01';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f1c]">
      <div className="flex-none p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Common Holders found
          </h2>
          <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/20">
            {data.length} Addresses
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="rounded-lg border border-white/5 overflow-hidden bg-slate-900/40">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/5 hover:bg-transparent">
                <TableHead className="text-slate-400 font-medium">Address</TableHead>
                <TableHead className="text-slate-400 font-medium text-right">{token1Symbol}</TableHead>
                <TableHead className="text-slate-400 font-medium text-right">{token2Symbol}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow 
                  key={row.address + i}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                >
                  <TableCell className="font-mono text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="truncate w-32 md:w-auto">
                        {row.address}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 opacity-50 hover:opacity-100 hover:text-cyan-400 hover:bg-cyan-500/10"
                        onClick={() => window.open(getExplorerLink(row.address), '_blank')}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    <div className="text-slate-300">{formatAmount(row.amount1)}</div>
                    {token1Price > 0 && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        {formatValue(row.amount1, token1Price)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    <div className="text-slate-300">{formatAmount(row.amount2)}</div>
                    {token2Price > 0 && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        {formatValue(row.amount2, token2Price)}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
