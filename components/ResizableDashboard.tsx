'use client'

import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable'
import SearchPanel from './SearchPanel'
import TransactionFlow from './ReactFlow/TransactionFlow'
import React, { useState } from 'react'
import SearchResultsTable from './SearchResultsTable'

export function ResizableDashboard() {
	const [searchData, setSearchData] = useState<any>([])

	return (
		<ResizablePanelGroup direction="horizontal" className="min-h-screen w-full">
			<ResizablePanel defaultSize={25} minSize={20} maxSize={30}>
				<SearchPanel setSearchData={setSearchData} />
			</ResizablePanel>
			<ResizableHandle />
			<ResizablePanel>
				<ResizablePanelGroup direction="vertical">
					<ResizablePanel defaultSize={55} maxSize={95}>
						<TransactionFlow transactions={searchData} />
					</ResizablePanel>
					<ResizableHandle />
					<ResizablePanel defaultSize={45} maxSize={95}>
						<SearchResultsTable searchData={searchData} />
					</ResizablePanel>
				</ResizablePanelGroup>
			</ResizablePanel>
		</ResizablePanelGroup>
	)
}
