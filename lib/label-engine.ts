import fs from 'fs'
import path from 'path'

// ── Types ────────────────────────────────────────────────────────────
export type EntityType = 'scam' | 'exchange' | 'defi' | 'mixer' | 'project' | 'custom'

export interface AddressLabel {
  name: string        // human-readable name (e.g. "Binance: Hot Wallet 4")
  type: EntityType
  source: 'scamsniffer' | 'dawsbot & etherscan' | 'custom' | 'bitquery'
}

// Raw shape of dawsbot/eth-labels accounts.json
interface DawsbotAccount {
  address: string
  chainId: number
  label: string
  nameTag: string
}

// Raw shape of scamsniffer/scam-database all.json
interface ScamSnifferAll {
  address: string[]
  domains: string[]
  combined: Record<string, string[]>
}

// ── Entity-type derivation ───────────────────────────────────────────
const EXCHANGE_KEYWORDS = [
  'exchange', 'binance', 'coinbase', 'kraken', 'okx', 'bybit', 'huobi',
  'bitfinex', 'kucoin', 'gate.io', 'gemini', 'bitstamp', 'ftx', 'crypto.com',
  'hotbit', 'mexc', 'bitget', 'poloniex', 'upbit', 'bithumb',
]

const DEFI_KEYWORDS = [
  'uniswap', 'aave', 'compound', 'lido', 'router', 'sushiswap', 'curve',
  'balancer', 'maker', 'synthetix', 'yearn', '1inch', 'paraswap', 'dydx',
  'opensea', 'seaport', 'weth', 'wrapped', 'bridge', 'gnosis', 'safe',
  'multisig', 'proxy', 'staking',
]

const MIXER_KEYWORDS = ['tornado', 'mixer', 'blender', 'fogger']

function deriveEntityType(label: string, nameTag: string): EntityType {
  const combined = `${label} ${nameTag}`.toLowerCase()
  if (MIXER_KEYWORDS.some(k => combined.includes(k))) return 'mixer'
  if (EXCHANGE_KEYWORDS.some(k => combined.includes(k))) return 'exchange'
  if (DEFI_KEYWORDS.some(k => combined.includes(k))) return 'defi'
  return 'project'
}

// ── Singleton ────────────────────────────────────────────────────────
class LabelEngine {
  private scamAddresses = new Set<string>()
  private scamDomains = new Set<string>()
  private labels = new Map<string, AddressLabel>()
  private customLabels = new Map<string, AddressLabel>()
  private loaded = false

  /**
   * Load all data sources into memory.  
   * Safe to call multiple times — only loads once.
   */
  load(): void {
    if (this.loaded) return

    const rawDir = path.join(process.cwd(), 'data', 'raw')

    // 1. ScamSniffer — all.json (address[] + domains[])
    this.loadScamSniffer(rawDir)

    // 2. Dawsbot — accounts.json (ETH-only labels)
    this.loadDawsbot(rawDir)

    // 3. Custom TXT files
    this.loadCustomTxt(rawDir)

    this.loaded = true

    console.log(
      `[LabelEngine] Loaded: ${this.scamAddresses.size} scam addresses, ` +
      `${this.scamDomains.size} scam domains, ` +
      `${this.labels.size} dawsbot & etherscan labels, ` +
      `${this.customLabels.size} custom labels`
    )
  }

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Look up label for an address.
   * Priority: scamAddresses > customLabels > dawsbot & etherscan labels
   */
  getLabel(address: string): AddressLabel | null {
    const addr = address.toLowerCase()

    // 1. Scam check (highest priority)
    if (this.scamAddresses.has(addr)) {
      return { name: 'Phishing/Scam', type: 'scam', source: 'scamsniffer' }
    }

    // 2. Custom labels (user overrides)
    const custom = this.customLabels.get(addr)
    if (custom) return custom

    // 3. Dawsbot labels
    const label = this.labels.get(addr)
    if (label) return label

    return null
  }

  /**
   * Batch lookup — returns only addresses that have labels.
   */
  getLabels(addresses: string[]): Record<string, AddressLabel> {
    const result: Record<string, AddressLabel> = {}
    for (const addr of addresses) {
      const label = this.getLabel(addr)
      if (label) {
        result[addr.toLowerCase()] = label
      }
    }
    return result
  }

  isScam(address: string): boolean {
    return this.scamAddresses.has(address.toLowerCase())
  }

  isDomainScam(domain: string): boolean {
    return this.scamDomains.has(domain.toLowerCase())
  }

  // ── Loaders ────────────────────────────────────────────────────────

  private loadScamSniffer(rawDir: string): void {
    // Try all.json first (has more addresses + domains in one file)
    const allPath = path.join(rawDir, 'scamsniffer-all.json')
    if (fs.existsSync(allPath)) {
      try {
        const data: ScamSnifferAll = JSON.parse(fs.readFileSync(allPath, 'utf-8'))
        for (const addr of data.address) {
          this.scamAddresses.add(addr.toLowerCase())
        }
        for (const domain of data.domains) {
          this.scamDomains.add(domain.toLowerCase())
        }
        return
      } catch (e) {
        console.warn('[LabelEngine] Failed to parse scamsniffer-all.json:', e)
      }
    }

    // Fallback: separate files
    const addrPath = path.join(rawDir, 'scamsniffer-address.json')
    if (fs.existsSync(addrPath)) {
      try {
        const addresses: string[] = JSON.parse(fs.readFileSync(addrPath, 'utf-8'))
        for (const addr of addresses) {
          this.scamAddresses.add(addr.toLowerCase())
        }
      } catch (e) {
        console.warn('[LabelEngine] Failed to parse scamsniffer-address.json:', e)
      }
    }

    const domainsPath = path.join(rawDir, 'scamsniffer-domains.json')
    if (fs.existsSync(domainsPath)) {
      try {
        const domains: string[] = JSON.parse(fs.readFileSync(domainsPath, 'utf-8'))
        for (const domain of domains) {
          this.scamDomains.add(domain.toLowerCase())
        }
      } catch (e) {
        console.warn('[LabelEngine] Failed to parse scamsniffer-domains.json:', e)
      }
    }
  }

  private loadDawsbot(rawDir: string): void {
    const filePath = path.join(rawDir, 'dawsbot-accounts.json')
    if (!fs.existsSync(filePath)) {
      console.warn('[LabelEngine] dawsbot-accounts.json not found — skipping')
      return
    }

    try {
      const accounts: DawsbotAccount[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      for (const acc of accounts) {
        // Only load Ethereum mainnet (chainId 1) labels
        if (acc.chainId !== 1) continue

        const addr = acc.address.toLowerCase()
        const entityType = deriveEntityType(acc.label, acc.nameTag)
        this.labels.set(addr, {
          name: acc.nameTag || acc.label,
          type: entityType,
          source: 'dawsbot & etherscan',
        })
      }
    } catch (e) {
      console.warn('[LabelEngine] Failed to parse dawsbot-accounts.json:', e)
    }
  }

  private loadCustomTxt(rawDir: string): void {
    if (!fs.existsSync(rawDir)) return

    const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.txt'))
    for (const file of files) {
      // File name (without .txt) becomes the label description
      const labelName = file.replace(/\.txt$/, '').replace(/[-_]/g, ' ')
      const filePath = path.join(rawDir, file)

      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const addresses = content
          .split('\n')
          .map(line => line.trim().toLowerCase())
          .filter(line => /^0x[a-f0-9]{40}$/.test(line))

        for (const addr of addresses) {
          this.customLabels.set(addr, {
            name: labelName,
            type: 'custom',
            source: 'custom',
          })
        }
      } catch (e) {
        console.warn(`[LabelEngine] Failed to parse ${file}:`, e)
      }
    }
  }
}

// Export singleton instance
export const labelEngine = new LabelEngine()
