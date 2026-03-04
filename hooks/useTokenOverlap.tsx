import { useState, useCallback } from 'react';

export interface OverlapResult {
  address: string;
  amount1: number;
  amount2: number;
}

interface UseTokenOverlapProps {
  chain: string;
  token1: string;
  token2: string;
}

export function useTokenOverlap() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlapData, setOverlapData] = useState<OverlapResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [token1Symbol, setToken1Symbol] = useState<string>('Token 1');
  const [token2Symbol, setToken2Symbol] = useState<string>('Token 2');
  const [token1Price, setToken1Price] = useState<number>(0);
  const [token2Price, setToken2Price] = useState<number>(0);

  const fetchOverlap = useCallback(async ({ chain, token1, token2 }: UseTokenOverlapProps) => {
    setLoading(true);
    setError(null);
    setHasSearched(true);
    setOverlapData([]);

    try {
      const response = await fetch('/api/bitquery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'tokenOverlap',
          chain,
          token1,
          token2,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to fetch overlap data');
      }

      setOverlapData(data.overlap || []);
      setToken1Symbol(data.token1Symbol || 'Token 1');
      setToken2Symbol(data.token2Symbol || 'Token 2');
      setToken1Price(data.token1Price || 0);
      setToken2Price(data.token2Price || 0);
    } catch (err: any) {
      console.error('Error fetching token overlap:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    overlapData,
    hasSearched,
    token1Symbol,
    token2Symbol,
    token1Price,
    token2Price,
    fetchOverlap,
  };
}
