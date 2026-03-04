'use client'

import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable'
import SearchPanel from './SearchPanel'
import TransactionFlow from './ReactFlow/TransactionFlow'
import React, { useState, useCallback, useMemo } from 'react'
import SearchResultsTable from './SearchResultsTable'
import { Transaction } from '@/lib/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TokenOverlapForm } from './TokenOverlapForm'
import { TokenOverlapTable } from './TokenOverlapTable'
import { useTokenOverlap } from '@/hooks/useTokenOverlap'
import { toast } from 'sonner'

export function ResizableDashboard() {
	const [searchData, setSearchData] = useState<Transaction[]>([])
	const [hasSearched, setHasSearched] = useState(false)
	const [loading, setLoading] = useState(false)
	const [searchedSender, setSearchedSender] = useState("")
	const [searchedReceiver, setSearchedReceiver] = useState("")
	const [searchedChain, setSearchedChain] = useState("ethereum")

	// Progressive loading state — synced from hook via SearchPanel
	const [canLoadMore, setCanLoadMore] = useState(false)
	const [loadingMore, setLoadingMore] = useState(false)
	const [loadMoreFn, setLoadMoreFn] = useState<(() => Promise<Transaction[]>) | null>(null)
	const [refreshFn, setRefreshFn] = useState<(() => Promise<Transaction[]>) | null>(null)
	const [currentDateRange, setCurrentDateRange] = useState<{ from: string; till: string } | null>(null)

	const [activeTab, setActiveTab] = useState("tracker")

	const [minAmount, setMinAmount] = useState(10)

	// ── Node expand state ──
	const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
	const [expandingNode, setExpandingNode] = useState<string | null>(null)

	// Token Overlap State
	const { 
		loading: overlapLoading, 
		overlapData, 
		hasSearched: overlapHasSearched, 
		token1Symbol,
		token2Symbol,
		token1Price,
		token2Price,
		fetchOverlap 
	} = useTokenOverlap()
	const [overlapChain, setOverlapChain] = useState("ethereum")

	const handleTokenOverlapSearch = (chain: string, token1: string, token2: string) => {
		setOverlapChain(chain)
		fetchOverlap({ chain, token1, token2 })
	}

	const handleSetSearchData = useCallback((data: Transaction[], sender: string, receiver: string, chain: string) => {
		// Tag initial transactions as main_path
		const tagged = data.map((tx) => ({
			...tx,
			pathRole: tx.pathRole || ('main_path' as const),
		}))
		setSearchData(tagged)
		setSearchedSender(sender)
		setSearchedReceiver(receiver)
		setSearchedChain(chain)
		setLoading(false)
		// Reset expand state on new search
		setExpandedNodes(new Set())
		setExpandingNode(null)
	}, [])

	const handleHasSearched = useCallback((searched: boolean) => {
		setHasSearched(searched)
		if (searched) setLoading(true)
	}, [])

	// Callback from SearchPanel to sync progressive loading state
	const handleProgressiveStateChange = useCallback((state: {
		canLoadMore: boolean;
		loadPreviousPeriod: () => Promise<Transaction[]>;
		currentDateRange: { from: string; till: string } | null;
		loadingMore: boolean;
		refreshData: () => Promise<Transaction[]>;
	}) => {
		setCanLoadMore(state.canLoadMore)
		setLoadMoreFn(() => state.loadPreviousPeriod)
		setRefreshFn(() => state.refreshData)
		setCurrentDateRange(state.currentDateRange)
		setLoadingMore(state.loadingMore)
	}, [])

	const handleLoadMore = async () => {
		if (!loadMoreFn) return
		setLoadingMore(true)
		await loadMoreFn()
	}

	const handleRefresh = async () => {
		if (!refreshFn) return
		setLoading(true)
		await refreshFn()
		setLoading(false)
	}


	// ── Filtered data for table (same filters as graph) ──
	const filteredForTable = useMemo(() => {
		return searchData.filter((tx) => {
			// Dust filter
			if (minAmount > 0) {
				const amt = Math.abs(parseFloat(tx.amount) || 0)
				const checkAmt = tx.amountUSD != null ? tx.amountUSD : amt
				if (checkAmt < minAmount) return false
			}
			return true
		})
	}, [searchData, minAmount])

	// ── On-demand node expansion ──
	const handleExpandNode = useCallback(async (address: string, direction: "inbound" | "outbound") => {
		setExpandingNode(address)
		try {
			// Compute date context from existing transactions involving this node
			const addrLower = address.toLowerCase()
			const relatedTxs = searchData.filter(
				tx => tx.sender?.toLowerCase() === addrLower ||
					tx.receiver?.toLowerCase() === addrLower
			)
			const times = relatedTxs
				.map(tx => tx.txTime)
				.filter(Boolean)
				.map(t => new Date(t).getTime())
				.filter(t => !isNaN(t))

			const dateFrom = times.length > 0
				? new Date(Math.min(...times)).toISOString().split('T')[0]
				: null
			const dateTill = times.length > 0
				? new Date(Math.max(...times)).toISOString().split('T')[0]
				: null

			const response = await fetch('/api/bitquery', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'expand_node',
					address,
					direction,
					chain: searchedChain,
					limit: 15,
					dateFrom,
					dateTill,
				}),
			})
			const result = await response.json()
			if (!response.ok) {
				throw new Error(result.error || 'Failed to expand node')
			}

			// Parse the response same way as useCoinPaths
			const outbound = result.data?.ethereum?.outbound || []
			const inbound = result.data?.ethereum?.inbound || []
			const allTransfers = [...outbound, ...inbound]
			const meta = result._meta || {}

			// Map to Transaction[] with 'expanded' pathRole
			const newTransactions: Transaction[] = allTransfers.map((t: any) => ({
				sender: t.sender?.address || '',
				receiver: t.receiver?.address || '',
				amount: String(t.amount || '0'),
				currency: t.currency?.symbol || 'ETH',
				depth: 0,
				count: t.count || 1,
				txHash: t.transactions?.[0]?.txHash || '',
				txTime: t.transaction?.time?.time || '',
				direction: direction,
				currencyName: t.currency?.name || '',
				pathRole: 'expanded' as const,
			}))

			// Merge with existing data (deduplicate by txHash)
			const existingHashes = new Set(searchData.map((tx) => tx.txHash).filter(Boolean))
			const uniqueNew = newTransactions.filter((tx) => !tx.txHash || !existingHashes.has(tx.txHash))

			// Count how many will actually be visible (after minAmount + layer filters)
			const visibleNew = uniqueNew.filter((tx) => {
				if (minAmount > 0) {
					const amt = Math.abs(parseFloat(tx.amount) || 0)
					const checkAmt = tx.amountUSD != null ? tx.amountUSD : amt
					if (checkAmt < minAmount) return false
				}
				return true
			})

			// Show toast with the count that matches what user actually sees
			const rangeInfo = meta.rangeLabel ? ` (${meta.rangeLabel})` : ''
			if (visibleNew.length === 0) {
				const total = meta.rawCount || newTransactions.length
				toast.info(`No new ${direction} transfers found${rangeInfo}${total > 0 ? `, ${total} filtered` : ''}`)
			} else {
				const removedCount = (meta.rawCount || newTransactions.length) - visibleNew.length
				const filteredInfo = removedCount > 0 ? `, ${removedCount} filtered` : ''
				toast.success(`Added ${visibleNew.length} ${direction} transfers${rangeInfo}${filteredInfo}`)
			}

			setSearchData((prev) => [...prev, ...uniqueNew])
			setExpandedNodes((prev) => new Set(prev).add(address))


		} catch (err) {
			console.error('Node expansion failed:', err)
			const msg = err instanceof Error ? err.message : 'Failed to expand node'
			// Translate technical errors into user-friendly messages
			if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('too complex')) {
				const addrShort = `${address.slice(0, 6)}…${address.slice(-4)}`
				toast.info(`No ${direction} connections found for ${addrShort} in the searched range. The query may be too complex for this wallet.`)
			} else {
				toast.error(msg)
			}
		} finally {
			setExpandingNode(null)
		}
	}, [searchedChain, searchData])

	return (
		<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
			<div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
				<TabsList className="bg-slate-900/50 border border-white/10 p-1 rounded-xl glass-panel">
					<TabsTrigger value="tracker" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
						Transaction Flow
					</TabsTrigger>
					<TabsTrigger value="overlap" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
						Token Overlap
					</TabsTrigger>
				</TabsList>
			</div>

			<ResizablePanelGroup direction="horizontal" className="flex-1 w-full pt-16">
				<ResizablePanel defaultSize={25} minSize={20} maxSize={30}>
					<TabsContent value="tracker" className="h-full m-0 p-0 border-none outline-none">
						<SearchPanel
							setSearchData={handleSetSearchData}
							setHasSearched={handleHasSearched}
							onProgressiveStateChange={handleProgressiveStateChange}
						/>
					</TabsContent>
					<TabsContent value="overlap" className="h-full m-0 p-0 border-none outline-none">
						<TokenOverlapForm 
							loading={overlapLoading} 
							onSearch={handleTokenOverlapSearch} 
						/>
					</TabsContent>
				</ResizablePanel>
				<ResizableHandle className="bg-slate-800 hover:bg-cyan-500/50 transition-colors w-[2px]" />
				<ResizablePanel>
					<TabsContent value="tracker" className="h-full m-0 p-0 data-[state=inactive]:hidden">
						<ResizablePanelGroup direction="vertical">
							<ResizablePanel defaultSize={55} maxSize={95}>
								<TransactionFlow 
									transactions={searchData} 
									hasSearched={hasSearched} 
									loading={loading} 
									searchedSender={searchedSender}
									searchedReceiver={searchedReceiver}
									minAmount={minAmount}
									onMinAmountChange={setMinAmount}
									onExpandNode={handleExpandNode}
									expandedNodes={expandedNodes}
									expandingNode={expandingNode}
								/>
							</ResizablePanel>
							<ResizableHandle className="bg-slate-800 hover:bg-cyan-500/50 transition-colors h-[2px]" />
							<ResizablePanel defaultSize={45} maxSize={95}>
								<SearchResultsTable
									searchData={filteredForTable}
									hasSearched={hasSearched}
									loading={loading}
									chain={searchedChain}
									canLoadMore={canLoadMore}
									loadingMore={loadingMore}
									onLoadMore={handleLoadMore}
									onRefresh={handleRefresh}
									currentDateRange={currentDateRange}
								/>
							</ResizablePanel>
						</ResizablePanelGroup>
					</TabsContent>
					<TabsContent value="overlap" className="h-full m-0 p-0 bg-[#0a0f1c] data-[state=inactive]:hidden">
						<TokenOverlapTable 
							data={overlapData}
							loading={overlapLoading}
							hasSearched={overlapHasSearched}
							chain={overlapChain}
							token1Symbol={token1Symbol}
							token2Symbol={token2Symbol}
							token1Price={token1Price}
							token2Price={token2Price}
						/>
					</TabsContent>
				</ResizablePanel>
			</ResizablePanelGroup>
		</Tabs>
	)
}
