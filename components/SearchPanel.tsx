import React, { useState } from 'react'
import useCoinPaths from '@/hooks/useCoinPaths'
import { query } from '@/lib/coinpath-queries'
import { SearchForm } from './SearchForm'
import { SearchObject } from '@/lib/types'

interface SearchPanelProps {
	setSearchData: (data: any) => void
}

export default function SearchPanel({ setSearchData }: SearchPanelProps) {
	const [formValues, setFormValues] = useState<SearchObject>({
		senderAddress: '0xc7F67B5516cF5C841cB58a4a8a95c5353e75B117',
		receiverAddress: '0x750F5a02F88B57cAdd982D6893DD29C4Af4162Fc',
		chain: 'ethereum',
	})

	const { fetchCoinPaths, data, loading, error } = useCoinPaths()

	const findConnections = () => {
		const variables: SearchObject = {
			senderAddress: formValues.senderAddress,
			receiverAddress: formValues.receiverAddress,
			chain: formValues.chain,
		}

		fetchCoinPaths({ query, variables }).then((responseData) => {
			setSearchData(responseData)
		})
	}

	return (
		<div className="p-5">
			<SearchForm
				formValues={formValues}
				setFormValues={setFormValues}
				findConnections={findConnections}
				loading={loading}
			/>
		</div>
	)
}
