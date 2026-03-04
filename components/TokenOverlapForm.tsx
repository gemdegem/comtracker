'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Info, CheckCircle2, XCircle } from 'lucide-react';
import { ChainCombobox } from './ChainCombobox';

interface TokenOverlapFormProps {
  onSearch: (chain: string, token1: string, token2: string) => void;
  loading: boolean;
}

const isValidEvmAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);
const isValidSolanaAddress = (addr: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);

/** Detect chain from address format. Returns null if ambiguous/unknown. */
function detectChain(addr: string): 'ethereum' | 'solana' | null {
  const trimmed = addr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('0x')) return 'ethereum';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return 'solana';
  return null;
}

/** Validate a token address for a specific chain */
function validateAddress(addr: string, chain: string): { valid: boolean; error?: string } {
  const trimmed = addr.trim();
  if (!trimmed) return { valid: false };

  const isEvm = chain === 'ethereum';

  // Check if address looks like the wrong chain
  if (isEvm && !trimmed.startsWith('0x') && isValidSolanaAddress(trimmed)) {
    return { valid: false, error: 'This looks like a Solana address — switch network or paste an Ethereum address' };
  }
  if (!isEvm && trimmed.startsWith('0x') && isValidEvmAddress(trimmed)) {
    return { valid: false, error: 'This looks like an Ethereum address — switch network or paste a Solana address' };
  }

  const validator = isEvm ? isValidEvmAddress : isValidSolanaAddress;
  if (!validator(trimmed)) {
    return { valid: false, error: `Invalid ${isEvm ? 'Ethereum' : 'Solana'} address format` };
  }
  return { valid: true };
}

export function TokenOverlapForm({ onSearch, loading }: TokenOverlapFormProps) {
  const [chain, setChain] = useState('ethereum');
  const [token1, setToken1] = useState('');
  const [token2, setToken2] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Auto-detect chain from pasted address and switch if both fields agree
  const autoDetectAndSet = useCallback((value: string, otherValue: string, setter: (v: string) => void) => {
    setter(value);
    setError(null);
    const detected = detectChain(value.trim());
    if (!detected) return;

    const otherDetected = otherValue.trim() ? detectChain(otherValue.trim()) : null;

    // Auto-switch chain if:
    // 1. This address clearly belongs to a different chain, AND
    // 2. The other field is either empty or matches the same detected chain
    if (detected !== chain && (!otherDetected || otherDetected === detected)) {
      setChain(detected);
    }
  }, [chain]);

  const handleToken1Change = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    autoDetectAndSet(e.target.value, token2, setToken1);
  }, [autoDetectAndSet, token2]);

  const handleToken2Change = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    autoDetectAndSet(e.target.value, token1, setToken2);
  }, [autoDetectAndSet, token1]);

  // Real-time validation state
  const t1Trimmed = token1.trim();
  const t2Trimmed = token2.trim();
  const t1Validation = t1Trimmed ? validateAddress(t1Trimmed, chain) : null;
  const t2Validation = t2Trimmed ? validateAddress(t2Trimmed, chain) : null;
  const duplicateError = t1Trimmed && t2Trimmed && t1Trimmed.toLowerCase() === t2Trimmed.toLowerCase();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!t1Trimmed || !t2Trimmed) {
      setError('Both token addresses are required');
      return;
    }

    if (t1Validation && !t1Validation.valid) {
      setError(t1Validation.error || 'Invalid address for Token 1');
      return;
    }

    if (t2Validation && !t2Validation.valid) {
      setError(t2Validation.error || 'Invalid address for Token 2');
      return;
    }

    if (duplicateError) {
      setError('Tokens must be different');
      return;
    }

    onSearch(chain, t1Trimmed, t2Trimmed);
  };

  const ValidationIcon = ({ validation }: { validation: { valid: boolean; error?: string } | null }) => {
    if (!validation) return null;
    if (validation.valid) return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f1c]">
      <div className="p-6 border-b border-white/5 space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-cyan-400" />
            Token Overlap
          </h2>
          <p className="text-sm text-slate-400">
            Find common holders between two tokens.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
              Network
              {t1Trimmed && detectChain(t1Trimmed) && (
                <span className="normal-case tracking-normal font-normal text-[10px] text-cyan-500 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                  auto-detected from address
                </span>
              )}
            </label>
            <ChainCombobox value={chain} onChange={setChain} />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Token 1 Contract Address
            </label>
            <div className="relative">
              <Input
                placeholder={chain === 'solana' ? 'e.g. DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' : 'e.g. 0x6982508145454Ce325dDbE47a25d4ec3d2311933'}
                value={token1}
                onChange={handleToken1Change}
                className={`bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 font-mono text-sm pr-8 ${
                  t1Validation
                    ? t1Validation.valid
                      ? 'border-emerald-500/30 focus:border-emerald-500/50'
                      : 'border-red-500/30 focus:border-red-500/50'
                    : ''
                }`}
                required
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <ValidationIcon validation={t1Validation} />
              </div>
            </div>
            {t1Validation?.error && (
              <p className="text-[11px] text-red-400">{t1Validation.error}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Token 2 Contract Address
            </label>
            <div className="relative">
              <Input
                placeholder={chain === 'solana' ? 'e.g. EKpQGSJtjMFqKZ9KQanUKXbZihU6oG417WwF5JvH7D5S' : 'e.g. 0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE'}
                value={token2}
                onChange={handleToken2Change}
                className={`bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 font-mono text-sm pr-8 ${
                  t2Validation
                    ? t2Validation.valid
                      ? 'border-emerald-500/30 focus:border-emerald-500/50'
                      : 'border-red-500/30 focus:border-red-500/50'
                    : ''
                }`}
                required
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <ValidationIcon validation={t2Validation} />
              </div>
            </div>
            {t2Validation?.error && (
              <p className="text-[11px] text-red-400">{t2Validation.error}</p>
            )}
          </div>

          {duplicateError && (
            <div className="p-3 text-sm text-amber-400 bg-amber-950/30 border border-amber-900/50 rounded-lg">
              Both fields contain the same token address
            </div>
          )}

          {error && (
            <div className="p-3 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg">
              {error}
            </div>
          )}

          <div className="p-4 bg-cyan-950/20 border border-cyan-900/30 rounded-lg flex items-start gap-3">
            <Info className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-300">
              Queries the top 500 (Ethereum) or 1000 (Solana) largest receivers of both tokens and finds intersecting addresses. 
              Useful for discovering smart money or developer wallets.
            </p>
          </div>

          <Button 
            type="submit" 
            disabled={loading || (!!t1Validation && !t1Validation.valid) || (!!t2Validation && !t2Validation.valid) || !!duplicateError}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(8,145,178,0.2)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scanning Top Holders...
              </span>
            ) : (
              'Find Overlap'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
