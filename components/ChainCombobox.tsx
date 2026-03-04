'use client'
import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover'
import { ComboboxTrigger } from './ComboboxTrigger'

const blockchains = [
	{
		value: 'ethereum',
		label: 'Ethereum',
		icon: '⟠',
	},
	{
		value: 'solana',
		label: 'Solana',
		icon: '◎',
	},
]

interface ComboboxProps {
	value: string
	onChange: (value: string) => void
}

export function ChainCombobox({ value, onChange }: ComboboxProps) {
	const [open, setOpen] = React.useState(false)

	const selected = blockchains.find((b) => b.value === value)

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<ComboboxTrigger
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between flex items-center"
				>
					<span className="flex items-center gap-2">
						{selected ? (
							<>
								<span>{selected.icon}</span>
								<span>{selected.label}</span>
							</>
						) : (
							'Select chain...'
						)}
					</span>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</ComboboxTrigger>
			</PopoverTrigger>
			<PopoverContent className="w-full p-0">
				<Command className="w-full">
					<CommandInput placeholder="Search chain..." className="w-full" />
					<CommandList className="w-full">
						<CommandEmpty>No chain found.</CommandEmpty>
						<CommandGroup className="w-full">
							{blockchains.map((blockchain) => (
								<CommandItem
									key={blockchain.value}
									value={blockchain.value}
									onSelect={(currentValue) => {
										onChange(currentValue === value ? '' : currentValue)
										setOpen(false)
									}}
									className="w-full"
								>
									<Check
										className={cn(
											'mr-2 h-4 w-4',
											value === blockchain.value ? 'opacity-100' : 'opacity-0'
										)}
									/>
									<span className="mr-2">{blockchain.icon}</span>
									{blockchain.label}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
