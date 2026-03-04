import { Transaction, SearchObject } from '@/lib/types';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedEntry {
  data: Transaction[];
  timestamp: number;
}

interface ResultMeta {
  dateRange?: string;
  daysQueried?: number;
  limitPerDirection?: number;
  totalResults?: number;
  isLimited?: boolean;
  narrowed?: boolean;
  message?: string;
  resultStatus?: 'Complete' | 'Partial' | 'NoResults';
  allTimeFallback?: boolean;
  source?: string;
  limitPerDepth?: number;
  directTransfers?: number;
  intermediariesFound?: number;
}

interface CoinPathsReturn {
  fetchCoinPaths: (params: SearchObject, skipCache?: boolean) => Promise<Transaction[]>;
  refreshData: () => Promise<Transaction[]>;
  loadPreviousPeriod: () => Promise<Transaction[]>;
  data: Transaction[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  canLoadMore: boolean;
  currentDateRange: { from: string; till: string } | null;
  resultMeta: ResultMeta | null;
  reset: () => void;
}

export default function useCoinPaths(): CoinPathsReturn {
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [canLoadMore, setCanLoadMore] = useState<boolean>(false);
  const [currentDateRange, setCurrentDateRange] = useState<{ from: string; till: string } | null>(null);
  const [lastParams, setLastParams] = useState<SearchObject | null>(null);
  const [resultMeta, setResultMeta] = useState<ResultMeta | null>(null);

  // ── Fetch last activity date for Solana address (via Solana RPC) ────
  const fetchLastActivity = async (address: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/bitquery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: 'solana',
          action: 'lastActivity',
          senderAddress: address,
        }),
      });

      if (!response.ok) return null;

      const result = await response.json();
      return result.lastActivityDate || null;
    } catch {
      return null;
    }
  };

  // ── Refresh — re-fetch with same params, bypass cache ─────────────
  const refreshData = useCallback(async (): Promise<Transaction[]> => {
    if (!lastParams) return data;
    return fetchCoinPaths(lastParams, true);
  }, [lastParams, data]);

  // ── Main fetch ────────────────────────────────────────────────────
  const fetchCoinPaths = async (params: SearchObject, skipCache = false): Promise<Transaction[]> => {
    const cacheKey = `comtracker_v2_${params.senderAddress}_${params.receiverAddress}_${params.chain}_${params.depth}_${params.fromDate || ''}_${params.tillDate || ''}`;

    // Check cache with TTL (unless bypass requested)
    if (!skipCache) {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        try {
          const cached: CachedEntry = JSON.parse(cachedRaw);
          const age = Date.now() - cached.timestamp;
          if (Array.isArray(cached.data) && cached.data.length > 0 && age < CACHE_TTL_MS) {
            setLoading(true);
            await new Promise(resolve => setTimeout(resolve, 300));

            setData(cached.data);
            setLoading(false);
            setLastParams(params);

            if (params.chain === 'solana' && params.fromDate) {
              setCurrentDateRange({ from: params.fromDate, till: params.tillDate || '' });
              setCanLoadMore(true);
            }

            const hoursAgo = Math.round(age / (1000 * 60 * 60));
            toast.success(`Loaded from cache (${hoursAgo}h ago, 0 tokens used)`);
            return cached.data;
          } else {
            // Expired or empty — remove stale cache
            localStorage.removeItem(cacheKey);
          }
        } catch (e) {
          console.warn("Failed to parse cached data, fetching fresh.");
          localStorage.removeItem(cacheKey);
        }
      }
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/bitquery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);

        // Prioritize explicit error messages sent by our backend API 
        // (like WHALE_WALLET or QUERY_TOO_COMPLEX) over generic status codes.
        if (errorData.error) {
          throw new Error(errorData.error);
        }

        let userMessage = 'Something went wrong while fetching transaction data.';
        if (response.status === 504) {
          userMessage = 'Query timed out. Try a shorter period or reduce depth to 1.';
        } else if (response.status === 401 || response.status === 403) {
          userMessage = 'API authentication failed. Please check your Bitquery API key.';
        } else if (response.status === 429) {
          userMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (response.status >= 500) {
          userMessage = 'The Bitquery API is currently unavailable. Please try again later.';
        }

        throw new Error(userMessage);
      }

      const result = await response.json();

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0]?.message || 'GraphQL query returned errors.');
      }

      // Extract _meta from response if present (ETH single-address mode)
      if (result._meta) {
        setResultMeta(result._meta as ResultMeta);
      } else {
        setResultMeta(null);
      }

      let formattedData: Transaction[] = [];
      const isSolana = params.chain === 'solana';

      if (isSolana) {
        formattedData = parseSolanaResponse(result);
      } else {
        formattedData = parseEthereumResponse(result);
      }

      // Save params for progressive loading
      setLastParams(params);

      if (isSolana && params.fromDate) {
        setCurrentDateRange({ from: params.fromDate, till: params.tillDate || '' });
        setCanLoadMore(true);
      } else {
        setCanLoadMore(false);
      }

      // Cache result with timestamp — but never cache empty results
      if (formattedData.length > 0) {
        try {
          const entry: CachedEntry = { data: formattedData, timestamp: Date.now() };
          localStorage.setItem(cacheKey, JSON.stringify(entry));
        } catch (storageErr) {
          console.warn("Could not save to localStorage (quota exceeded?)", storageErr);
        }
      }

      setData(formattedData);
      setLoading(false);

      // ── Auto-detect and auto-retry if 0 results on Solana ────────
      if (isSolana && formattedData.length === 0) {
        toast.info('No transactions in this period. Checking for last activity...');

        const lastDate = await fetchLastActivity(params.senderAddress);
        if (lastDate) {
          // Auto-retry with a 7-day window around last activity (like ETH does)
          const retryFrom = addDays(lastDate, -3);
          const retryTill = addDays(lastDate, 4);
          toast.info(`Last activity on ${lastDate}. Auto-searching ${retryFrom} – ${retryTill}...`, {
            duration: 5000,
          });

          setCurrentDateRange({ from: retryFrom, till: retryTill });

          try {
            const retryParams: SearchObject = {
              ...params,
              fromDate: retryFrom,
              tillDate: retryTill,
            };
            const retryResponse = await fetch('/api/bitquery', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(retryParams),
            });

            if (retryResponse.ok) {
              const retryResult = await retryResponse.json();
              const retryData = parseSolanaResponse(retryResult);

              if (retryData.length > 0) {
                setData(retryData);
                setLastParams(retryParams);
                setCanLoadMore(true);
                toast.success(`Found ${retryData.length} transfers around last activity (${retryFrom} – ${retryTill})`);

                // Cache the retry result
                try {
                  const retryCacheKey = `comtracker_v2_${retryParams.senderAddress}_${retryParams.receiverAddress}_${retryParams.chain}_${retryParams.depth}_${retryFrom}_${retryTill}`;
                  const entry: CachedEntry = { data: retryData, timestamp: Date.now() };
                  localStorage.setItem(retryCacheKey, JSON.stringify(entry));
                } catch {}

                return retryData;
              }
            }
          } catch {}

          // Auto-retry also returned 0 results
          toast.warning(`No transfers found within ±3 days of last activity (${lastDate}).`, {
            duration: 8000,
          });
          setError(`hint:lastActivity:${lastDate}`);
          return formattedData;
        } else {
          toast.warning('This address has no transfer history on Solana.');
        }
      } else if (formattedData.length > 0) {
        toast.success(`Found ${formattedData.length} active paths`);
      } else {
        toast.info('No transactions found between these addresses.');
      }

      return formattedData;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      console.error('Fetch error:', err);

      // If Solana coinpath fails with "too complex", try lastActivity detection + auto-retry
      const isSolana = params.chain === 'solana';
      if (isSolana && (
        errorMessage.includes('too complex') ||
        errorMessage.includes('Query too complex') ||
        errorMessage.includes('timed out') ||
        errorMessage.includes('Try a shorter')
      )) {
        toast.warning('Query too complex for this period. Checking for last activity...');
        setLoading(false);

        const lastDate = await fetchLastActivity(params.senderAddress);
        if (lastDate) {
          const retryFrom = addDays(lastDate, -3);
          const retryTill = addDays(lastDate, 4);
          toast.info(`Last activity on ${lastDate}. Auto-searching ${retryFrom} – ${retryTill}...`, {
            duration: 5000,
          });
          setCurrentDateRange({ from: retryFrom, till: retryTill });

          try {
            const retryParams: SearchObject = {
              ...params,
              fromDate: retryFrom,
              tillDate: retryTill,
            };
            const retryResponse = await fetch('/api/bitquery', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(retryParams),
            });

            if (retryResponse.ok) {
              const retryResult = await retryResponse.json();
              const retryData = parseSolanaResponse(retryResult);

              if (retryData.length > 0) {
                setData(retryData);
                setLastParams(retryParams);
                setCanLoadMore(true);
                toast.success(`Found ${retryData.length} transfers around last activity (${retryFrom} – ${retryTill})`);
                return retryData;
              }
            }
          } catch {}

          toast.warning(`No transfers found within ±3 days of last activity (${lastDate}).`, {
            duration: 8000,
          });
          setError(`hint:lastActivity:${lastDate}`);
          return [];
        } else {
          toast.error('Could not find any transfer history for this address.');
          setError(errorMessage);
          return [];
        }
      }

      toast.error(errorMessage);
      setError(errorMessage);
      setData([]);
      setResultMeta(null);
      setLoading(false);
      return [];
    }
  };

  // ── Load previous 30-day period ───────────────────────────────────
  const loadPreviousPeriod = useCallback(async (): Promise<Transaction[]> => {
    if (!lastParams || !currentDateRange) return data;

    const newTill = addDays(currentDateRange.from, -1);
    const newFrom = addDays(newTill, -30);

    setLoadingMore(true);

    try {
      const params: SearchObject = {
        ...lastParams,
        fromDate: newFrom,
        tillDate: newTill,
      };

      const response = await fetch('/api/bitquery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load previous period.');
      }

      const result = await response.json();

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0]?.message || 'GraphQL query returned errors.');
      }

      const newData = parseSolanaResponse(result);

      // Deduplicate by sender+receiver+amount+currency+depth
      const existingKeys = new Set(
        data.map(tx => `${tx.sender}:${tx.receiver}:${tx.amount}:${tx.currency}:${tx.depth}`)
      );
      const uniqueNew = newData.filter(
        tx => !existingKeys.has(`${tx.sender}:${tx.receiver}:${tx.amount}:${tx.currency}:${tx.depth}`)
      );

      const mergedData = [...data, ...uniqueNew];
      setData(mergedData);
      setCurrentDateRange({ from: newFrom, till: currentDateRange.till });
      setLoadingMore(false);

      if (uniqueNew.length > 0) {
        toast.success(`Loaded ${uniqueNew.length} more paths from previous period`);
      } else {
        toast.info('No additional transactions found in the previous period.');
      }

      return mergedData;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load previous period.';
      toast.error(errorMessage);
      setLoadingMore(false);
      return data;
    }
  }, [lastParams, currentDateRange, data]);

  const reset = () => {
    setData([]);
    setError(null);
    setLoading(false);
    setLoadingMore(false);
    setCanLoadMore(false);
    setCurrentDateRange(null);
    setLastParams(null);
    setResultMeta(null);
  };

  return {
    fetchCoinPaths,
    refreshData,
    loadPreviousPeriod,
    data,
    loading,
    loadingMore,
    error,
    canLoadMore,
    currentDateRange,
    resultMeta,
    reset,
  };
}

// ── Helper ───────────────────────────────────────────────────────────
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── Ethereum response parser (handles both coinpath + transfers format) ──
function parseEthereumResponse(result: any): Transaction[] {
  let formattedData: Transaction[] = [];

  const mapEthTx = (tx: any, direction: 'inbound' | 'outbound'): Transaction => {
    const symbol = tx.currency?.symbol || 'ETH';
    let formattedAmount: string;
    const rawAmount = Number(tx.amount);
    const absAmount = Math.abs(rawAmount);
    // Handle extreme dust/spam token amounts (e.g., 1.15e+50)
    if (!isFinite(rawAmount) || absAmount >= 1e12) {
      formattedAmount = String(tx.amount);
    } else if (absAmount < 1 && absAmount > 0) {
      // Small amounts — keep precision (up to 6 decimals)
      formattedAmount = parseFloat(rawAmount.toFixed(6)).toString();
    } else if (absAmount < 10000) {
      // Normal range — keep up to 2 decimals
      formattedAmount = parseFloat(rawAmount.toFixed(2)).toString();
    } else {
      // Large amounts — round to integer
      formattedAmount = Math.round(rawAmount).toString();
    }

    // coinpath uses tx.transactions[0].txHash, transfers uses tx.transaction.hash
    const txHash = tx.transactions?.[0]?.txHash
      || tx.transaction?.hash
      || 'Unknown';

    // coinpath uses tx.transaction.time.time, transfers uses tx.block.timestamp.time
    const txTime = tx.transaction?.time?.time
      || tx.block?.timestamp?.time
      || new Date().toISOString();

    let amountUSD = tx.amountUSD != null ? Number(tx.amountUSD) : undefined;
    if (amountUSD === undefined) {
      const sym = symbol.toUpperCase();
      if (sym === 'ETH' || sym === 'WETH') amountUSD = absAmount * 3000;
      else if (sym === 'BTC' || sym === 'WBTC') amountUSD = absAmount * 60000;
      else if (sym === 'BNB' || sym === 'WBNB') amountUSD = absAmount * 500;
      else if (sym === 'SOL') amountUSD = absAmount * 150;
      else if (['USDC', 'USDT', 'DAI', 'FDUSD'].includes(sym)) amountUSD = absAmount;
    }

    return {
      sender: tx.sender?.address || 'Unknown',
      receiver: tx.receiver?.address || 'Unknown',
      amount: formattedAmount,
      currency: symbol,
      currencyName: tx.currency?.name || undefined,
      depth: tx.depth || 1,
      count: tx.count || 1,
      txHash,
      txTime,
      direction,
      senderAnnotation: tx.sender?.annotation || undefined,
      receiverAnnotation: tx.receiver?.annotation || undefined,
      amountUSD,
    };
  };

  if (result.data?.ethereum?.outbound) {
    formattedData = [
      ...formattedData,
      ...result.data.ethereum.outbound.map((tx: any) => mapEthTx(tx, 'outbound')),
    ];
  }

  if (result.data?.ethereum?.inbound) {
    formattedData = [
      ...formattedData,
      ...result.data.ethereum.inbound.map((tx: any) => mapEthTx(tx, 'inbound')),
    ];
  }

  return formattedData;
}

// ── Solana response parser ──────────────────────────────────────────
function parseSolanaResponse(result: any): Transaction[] {
  let formattedData: Transaction[] = [];

  const mapSolanaTx = (tx: any, direction: 'inbound' | 'outbound'): Transaction => {
    // Currency resolution: symbol → name → shortened mint address → 'Unknown Token'
    const rawSymbol = tx.currency?.symbol;
    const rawName = tx.currency?.name;
    const mintAddress = tx.currency?.address;
    let symbol: string;
    if (rawSymbol && rawSymbol !== '-' && rawSymbol.trim() !== '') {
      symbol = rawSymbol;
    } else if (rawName && rawName !== '-' && rawName.trim() !== '') {
      symbol = rawName;
    } else if (mintAddress && mintAddress.length > 8) {
      symbol = `${mintAddress.slice(0, 4)}...${mintAddress.slice(-3)}`;
    } else {
      symbol = 'Unknown Token';
    }

    let formattedAmount: string;
    const rawAmount = Number(tx.amount);
    const absAmount = Math.abs(rawAmount);
    if (!isFinite(rawAmount) || absAmount >= 1e12) {
      formattedAmount = String(tx.amount);
    } else if (absAmount < 1 && absAmount > 0) {
      formattedAmount = parseFloat(rawAmount.toFixed(6)).toString();
    } else if (absAmount < 10000) {
      formattedAmount = parseFloat(rawAmount.toFixed(2)).toString();
    } else {
      formattedAmount = Math.round(rawAmount).toString();
    }

    let amountUSD = tx.amountUSD != null ? Number(tx.amountUSD) : undefined;
    if (amountUSD === undefined) {
      const sym = symbol.toUpperCase();
      if (sym === 'SOL' || sym === 'WSOL') amountUSD = absAmount * 150;
      else if (['USDC', 'USDT', 'DAI'].includes(sym)) amountUSD = absAmount;
    }

    return {
      sender: tx.sender?.address || 'Unknown',
      receiver: tx.receiver?.address || 'Unknown',
      amount: formattedAmount,
      currency: symbol,
      depth: tx.depth || 1,
      count: 1,
      txHash: tx.transaction?.signature || 'Unknown',
      txTime: tx.block?.timestamp?.time || new Date().toISOString(),
      direction,
      senderAnnotation: tx.sender?.annotation || undefined,
      receiverAnnotation: tx.receiver?.annotation || undefined,
      currencyName: rawName || undefined,
      amountUSD,
    };
  };

  if (result.data?.solana?.outbound) {
    formattedData = [
      ...formattedData,
      ...result.data.solana.outbound.map((tx: any) => mapSolanaTx(tx, 'outbound')),
    ];
  }

  if (result.data?.solana?.inbound) {
    formattedData = [
      ...formattedData,
      ...result.data.solana.inbound.map((tx: any) => mapSolanaTx(tx, 'inbound')),
    ];
  }

  return formattedData;
}
