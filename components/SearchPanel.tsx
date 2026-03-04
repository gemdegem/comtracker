"use client";

import React, { useState, useEffect, useRef } from "react";
import useCoinPaths from "@/hooks/useCoinPaths";
import { SearchForm } from "./SearchForm";
import { SearchObject, Transaction } from "@/lib/types";
import Link from "next/link";
import { IconSparkles } from "@tabler/icons-react";
import { demoTransactions } from "@/data/demo-transactions";

interface SearchPanelProps {
  setSearchData: (
    data: Transaction[],
    sender: string,
    receiver: string,
    chain: string,
  ) => void;
  setHasSearched: (searched: boolean) => void;
  onProgressiveStateChange?: (state: {
    canLoadMore: boolean;
    loadPreviousPeriod: () => Promise<Transaction[]>;
    currentDateRange: { from: string; till: string } | null;
    loadingMore: boolean;
    refreshData: () => Promise<Transaction[]>;
  }) => void;
}

export default function SearchPanel({ setSearchData, setHasSearched, onProgressiveStateChange }: SearchPanelProps) {
  const [formValues, setFormValues] = useState<SearchObject>({
    senderAddress: "",
    receiverAddress: "",
    chain: "ethereum",
    depth: 1,
  });
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hintDismissed, setHintDismissed] = useState(false);
  const activeSearchRef = useRef<{ senderAddress: string; receiverAddress: string; chain: string }>({
    senderAddress: "",
    receiverAddress: "",
    chain: "ethereum",
  });

  const {
    fetchCoinPaths,
    refreshData,
    loading,
    error,
    canLoadMore,
    loadPreviousPeriod,
    currentDateRange,
    loadingMore,
    data: hookData,
    resultMeta,
  } = useCoinPaths();

  // Sync progressive loading state up to dashboard whenever hook state changes
  useEffect(() => {
    if (onProgressiveStateChange) {
      onProgressiveStateChange({
        canLoadMore,
        loadPreviousPeriod,
        currentDateRange,
        loadingMore,
        refreshData,
      });
    }
  }, [canLoadMore, loadPreviousPeriod, currentDateRange, loadingMore, refreshData, onProgressiveStateChange]);

  // Sync hook data up to dashboard when loadPreviousPeriod adds new data
  useEffect(() => {
    if (hookData.length > 0) {
      const { senderAddress, receiverAddress, chain } = activeSearchRef.current;
      setSearchData(hookData, senderAddress, receiverAddress, chain);
    }
  }, [hookData, setSearchData]);

  // Elapsed timer during loading
  useEffect(() => {
    if (!loading && !isSimulating) {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(0);
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, isSimulating]);

  // Auto-dismiss the last-activity hint after 10 seconds
  const isHintError = error?.startsWith('hint:lastActivity:');
  useEffect(() => {
    if (!isHintError) {
      setHintDismissed(false);
      return;
    }
    const timer = setTimeout(() => setHintDismissed(true), 10000);
    return () => clearTimeout(timer);
  }, [isHintError, error]);

  // Auto-adjust dates when lastActivity hint is detected (7-day window ending on last activity)
  useEffect(() => {
    if (!isHintError || !error) return;
    const lastDate = error.split(':')[2];
    if (!lastDate) return;
    const till = lastDate;
    const fromD = new Date(lastDate);
    fromD.setDate(fromD.getDate() - 7);
    const fromStr = fromD.toISOString().split('T')[0];
    setFormValues(prev => ({
      ...prev,
      fromDate: fromStr,
      tillDate: till,
    }));
  }, [isHintError, error]);

  const getProgressMessage = () => {
    if (isSimulating) return "Loading demo data...";
    if (formValues.depth === 2) {
      if (elapsedSeconds < 3) return "Connecting to Bitquery...";
      if (elapsedSeconds < 10) return "Analyzing fund flow paths (Coinpath)...";
      if (elapsedSeconds < 30) return "Coinpath analysis in progress...";
      if (elapsedSeconds < 50) return "Trying alternative search method...";
      return "Finalizing results...";
    }
    if (elapsedSeconds < 3) return "Fetching transfers...";
    if (elapsedSeconds < 10) return "Processing results...";
    return "Narrowing date range...";
  };

  const getSourceLabel = (source?: string) => {
    if (!source) return null;
    if (source === "coinpath_v1") return "Coinpath V1";
    if (source === "v2_light_hop") return "V2 Light Hop";
    if (source === "v2_transfers") return "V2 Transfers";
    return source;
  };

  const findConnections = () => {
    const variables: SearchObject = {
      senderAddress: formValues.senderAddress,
      receiverAddress: formValues.receiverAddress,
      chain: formValues.chain,
      depth: formValues.depth,
      fromDate: formValues.fromDate,
      tillDate: formValues.tillDate,
    };

    setHasSearched(true);
    setHintDismissed(true);
    activeSearchRef.current = {
      senderAddress: variables.senderAddress,
      receiverAddress: variables.receiverAddress,
      chain: variables.chain,
    };

    fetchCoinPaths(variables).then((responseData) => {
      setSearchData(
        responseData,
        variables.senderAddress,
        variables.receiverAddress,
        variables.chain,
      );
    });
  };

  const handleTryDemo = () => {
    // Real 2-address 1-hop query: 12 transfers (7 out + 5 in) via 5 intermediaries
    const demoVariables: SearchObject = {
      senderAddress: "0x54bde6eea3c228c7e656d178c9c7fd0e812b9f27",
      receiverAddress: "0xF634126ca98d70D0a77b8eFc9645e9C0A6a85987",
      chain: "ethereum",
      depth: 1,
    };
    
    setFormValues(demoVariables);
    setHasSearched(true);
    setIsSimulating(true);
    activeSearchRef.current = {
      senderAddress: demoVariables.senderAddress,
      receiverAddress: demoVariables.receiverAddress,
      chain: demoVariables.chain,
    };
    
    // Simulate network delay for a better UX, then load mock data
    setTimeout(() => {
      setSearchData(
        demoTransactions,
        demoVariables.senderAddress,
        demoVariables.receiverAddress,
        demoVariables.chain,
      );
      setIsSimulating(false);
    }, 1200);
  };

  return (
    <div className="w-full h-full flex flex-col justify-between p-5">
      <div>
        <div>
          <Link
            href="/"
            className="mt-5 w-full flex justify-center text-center text-4xl md:text-5xl font-thin text-black dark:text-white"
          >
            COMTRACKER
          </Link>
          <div className="bg-gradient-to-r from-transparent via-neutral-300 dark:via-neutral-700 to-transparent my-8 h-[1px] w-full" />
        </div>

        {/* Try Demo Button */}
        <div className="flex justify-center mb-6">
          <button
            onClick={handleTryDemo}
            disabled={loading || isSimulating}
            className="group relative flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 hover:from-cyan-500/20 hover:to-indigo-500/20 border border-cyan-500/30 hover:border-cyan-500/50 rounded-full text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-all duration-300 shadow-[0_0_15px_-3px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_-3px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IconSparkles className="w-4 h-4" />
            <span>Try Demo (Mock Data)</span>
          </button>
        </div>

        <SearchForm
          formValues={formValues}
          setFormValues={setFormValues}
          findConnections={findConnections}
          loading={loading || isSimulating}
        />

        {/* Progress indicator during loading */}
        {(loading || isSimulating) && (
          <div className="mt-4 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="relative w-5 h-5 shrink-0">
                <svg className="w-5 h-5 animate-spin text-cyan-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs text-cyan-400 font-medium">{getProgressMessage()}</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">
                  {elapsedSeconds > 0 ? `${elapsedSeconds}s elapsed` : 'Starting...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && !error.startsWith('hint:') && (
          <div className="mt-4 p-3 rounded-md bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-500 flex items-center gap-2">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>{error}</span>
            </p>
          </div>
        )}

        {/* Last activity hint — auto-adjusts dates, auto-dismisses after 10s */}
        {error && error.startsWith('hint:lastActivity:') && !hintDismissed && (() => {
          const lastDate = error.split(':')[2];
          return (
            <div className="mt-4 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-400">
                No activity in the selected period. Last activity detected on <strong>{lastDate}</strong>.
                Dates have been adjusted — press <strong>Search</strong> to retry.
              </p>
            </div>
          );
        })()}

        {/* Result limitation info banner */}
        {(resultMeta?.message || resultMeta?.resultStatus || resultMeta?.source) && !loading && !isSimulating && (
          <div className={`mt-4 p-3 rounded-md ${
            resultMeta.resultStatus === 'NoResults'
              ? 'bg-slate-500/10 border border-slate-500/20'
              : resultMeta.allTimeFallback
                ? 'bg-cyan-500/10 border border-cyan-500/20'
                : resultMeta.narrowed
                  ? 'bg-amber-500/10 border border-amber-500/20'
                  : 'bg-cyan-500/10 border border-cyan-500/20'
          }`}>
            <p className={`text-sm flex items-start gap-2 ${
              resultMeta.resultStatus === 'NoResults'
                ? 'text-slate-400'
                : resultMeta.allTimeFallback
                  ? 'text-cyan-400'
                  : resultMeta.narrowed ? 'text-amber-400' : 'text-cyan-400'
            }`}>
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                {resultMeta.resultStatus && (
                  <span className={`inline-block mr-2 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
                    resultMeta.resultStatus === 'Complete'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : resultMeta.resultStatus === 'NoResults'
                        ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {resultMeta.resultStatus === 'NoResults' ? 'No Results' : resultMeta.resultStatus}
                  </span>
                )}
                {resultMeta.allTimeFallback && resultMeta.resultStatus !== 'NoResults' && (
                  <span className="inline-block mr-2 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Full History
                  </span>
                )}
                {resultMeta.source && !resultMeta.allTimeFallback && (
                  <span className="inline-block mr-2 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-slate-500/20 text-slate-300 border border-slate-500/30">
                    {getSourceLabel(resultMeta.source)}
                  </span>
                )}
                {resultMeta.message || 'Query finished.'}
              </span>
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-3 pt-2">
        <div className="text-[10px] text-slate-600 leading-relaxed text-center px-2 max-w-[260px]">
          <span className="text-slate-500">ℹ️ Free Plan</span> — This app uses Bitquery&apos;s free tier. For multi-hop searches or larger date ranges,{" "}
          <Link
            href="https://github.com/gemdegem/comtracker/issues"
            target="_blank"
            className="text-cyan-600 hover:text-cyan-400 transition-colors underline underline-offset-2"
          >
            open an issue
          </Link>{" "}
          or connect your own API key.
        </div>
        <Link
          href="https://github.com/gemdegem/comtracker"
          target="_blank"
          className="text-xs text-slate-500 hover:text-white transition-colors ease-in-out duration-300 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          Open Source on GitHub
        </Link>
      </div>
    </div>
  );
}
