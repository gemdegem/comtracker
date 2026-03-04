export interface SearchObject {
	senderAddress: string
	receiverAddress: string
	chain: string
	depth: number
	// Solana-specific fields
	fromDate?: string
	tillDate?: string
}

export type PathRole = 'main_path' | 'source_of_funds' | 'cash_out' | 'expanded'

export type ViewLayer = 'main_path' | 'source_of_funds' | 'cash_out' | 'expanded'

export interface GraphFilter {
	minAmount: number
	activeLayers: Set<ViewLayer>
}

export interface Transaction {
	sender: string
	receiver: string
	amount: string
	currency: string
	depth: number
	count: number
	txHash: string
	txTime: string
	direction: 'inbound' | 'outbound'
	senderAnnotation?: string
	receiverAnnotation?: string
	currencyName?: string
	pathRole?: PathRole
	amountUSD?: number
	senderLabel?: AddressLabel
	receiverLabel?: AddressLabel
}

// ── Address labeling types ──────────────────────────────────────────
export type EntityType = 'scam' | 'exchange' | 'defi' | 'mixer' | 'project' | 'custom'

export interface AddressLabel {
	name: string        // human-readable name (e.g. "Binance: Hot Wallet 4")
	type: EntityType
	source: 'scamsniffer' | 'dawsbot & etherscan' | 'custom' | 'bitquery'
}

export function isValidEthAddress(address: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// Solana addresses: base58 encoded, typically 32-44 characters
// Base58 alphabet excludes 0, O, I, l
export function isValidSolanaAddress(address: string): boolean {
	return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
}

// Universal validator that picks the correct check based on the selected chain
export function isValidAddress(address: string, chain: string): boolean {
	if (chain === 'solana') return isValidSolanaAddress(address)
	return isValidEthAddress(address)
}

export function shortenAddress(address: string, chars = 6): string {
	if (!address) return ''
	return `${address.slice(0, chars)}...${address.slice(-4)}`
}
