import React, { useState } from 'react'
import useCoinPaths from '@/hooks/useCoinPaths'
import { query } from '@/lib/coinpath-queries'
import { SearchForm } from './SearchForm'
import { SearchObject } from '@/lib/types'
import Link from 'next/link'

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
				<SearchForm
					formValues={formValues}
					setFormValues={setFormValues}
					findConnections={findConnections}
					loading={loading}
				/>
			</div>
			<div className="mx-auto text-xs">
				Powered by{' '}
				<Link
					href="https://communeai.org"
					target="_blank"
					className="hover:text-green-500 transition-colors ease-in-out duration-300"
				>
					Commune AI
				</Link>
			</div>
		</div>
	)
}
