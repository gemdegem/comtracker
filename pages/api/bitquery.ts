import type { NextApiRequest, NextApiResponse } from 'next';
import { labelEngine } from '@/lib/label-engine';


// Determine the best limit for a given depth
function getLimitForDepth(depth: number): number {
    return depth <= 1 ? 20 : 10;
}

// ── Token Overlap Queries ───────────────────────────────────────────
function buildTokenReceiversEthQuery(limit: number = 500): string {
    return `
query TokenReceivers($token: String!) {
  ethereum {
    transfers(
      currency: { is: $token }
      options: { desc: "amount", limit: ${limit} }
    ) {
      receiver {
        address
      }
      currency {
        symbol
        name
      }
      amount(calculate: sum)
    }
  }
}
`;
}

function buildTokenReceiversSolQuery(limit: number = 500): string {
    return `
query TokenReceiversSol($token: String!, $from: ISO8601DateTime!) {
  solana {
    transfers(
      currency: { is: $token }
      date: { since: $from }
      options: { desc: "amount", limit: ${limit} }
    ) {
      receiver {
        address
      }
      currency {
        symbol
        name
      }
      amount(calculate: sum)
    }
  }
}
`;
}

// ── Ethereum direct transfers query (depth 1) ───────────────────────
function buildEthDirectTransfersQuery(limit: number): string {
    return `
query EthDirectTransfers($senderAddress: String!, $receiverAddress: String!, $limit: Int!, $since: ISO8601DateTime) {
  ethereum(network: ethereum) {
    outbound: transfers(
      sender: { is: $senderAddress }
      receiver: { is: $receiverAddress }
      options: { desc: "block.timestamp.time", limit: $limit }
      amount: { gt: 0 }
      date: { since: $since }
    ) {
      sender { address }
      receiver { address }
      amount
      amountUSD: amount(in: USD)
      currency { symbol name }
      transaction { hash }
      block { timestamp { time } }
    }
    inbound: transfers(
      sender: { is: $receiverAddress }
      receiver: { is: $senderAddress }
      options: { desc: "block.timestamp.time", limit: $limit }
      amount: { gt: 0 }
      date: { since: $since }
    ) {
      sender { address }
      receiver { address }
      amount
      amountUSD: amount(in: USD)
      currency { symbol name }
      transaction { hash }
      block { timestamp { time } }
    }
  }
}
`;
}


// ── Ethereum transfers query (single-address mode, with date filter) ──
function buildEthTransfersQuery(limit: number): string {
    return `
query EthSingleAddress($address: String!, $limit: Int!, $since: ISO8601DateTime) {
  ethereum(network: ethereum) {
    outbound: transfers(
      sender: { is: $address }
      options: { desc: "amount", limit: $limit }
      amount: { gt: 0 }
      date: { since: $since }
    ) {
      sender { address annotation }
      receiver { address annotation }
      amount
      currency { symbol name address }
      transaction { hash }
      block { timestamp { time } }
    }
    inbound: transfers(
      receiver: { is: $address }
      options: { desc: "amount", limit: $limit }
      amount: { gt: 0 }
      date: { since: $since }
    ) {
      sender { address annotation }
      receiver { address annotation }
      amount
      currency { symbol name address }
      transaction { hash }
      block { timestamp { time } }
    }
  }
}
`;
}

// ── Solana transfers query (replaced expensive coinpath) ────────────
function buildSolanaTransfersQuery(): string {
    return `query SolanaTransfers(
  $network: SolanaNetwork!,
  $address: String!,
  $limit: Int!,
  $from: ISO8601DateTime,
  $till: ISO8601DateTime
) {
  solana(network: $network) {
    inbound: transfers(
      receiverAddress: {is: $address}
      date: {since: $from, till: $till}
      options: {desc: "amount", limit: $limit}
      amount: {gt: 0}
      currency: {notIn: ["So11111111111111111111111111111111111111112"]}
    ) {
      sender {
        address
      }
      receiver {
        address
      }
      amount
      currency {
        symbol
        name
        address
      }
      transaction {
        signature
      }
      block {
        timestamp {
          time
        }
      }
    }
    outbound: transfers(
      senderAddress: {is: $address}
      date: {since: $from, till: $till}
      options: {desc: "amount", limit: $limit}
      amount: {gt: 0}
      currency: {notIn: ["So11111111111111111111111111111111111111112"]}
    ) {
      sender {
        address
      }
      receiver {
        address
      }
      amount
      currency {
        symbol
        name
        address
      }
      transaction {
        signature
      }
      block {
        timestamp {
          time
        }
      }
    }
  }
}
`;
}

// ── Solana last-activity query (lightweight, no coinpath) ───────────
function buildSolanaLastActivityQuery(): string {
    return `
query SolanaLastActivity($network: SolanaNetwork!, $address: String!) {
  solana(network: $network) {
    transfers(
      any: {senderAddress: {is: $address}}
      options: {limit: 1, desc: "block.timestamp.time"}
    ) {
      block {
        timestamp {
          time
        }
      }
    }
    received: transfers(
      any: {receiverAddress: {is: $address}}
      options: {limit: 1, desc: "block.timestamp.time"}
    ) {
      block {
        timestamp {
          time
        }
      }
    }
  }
}
`;
}
// ── Helpers ────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
    return new Promise((resolve)=>setTimeout(resolve, ms));
}
function isValidEthAddress(addr: any): boolean {
    return typeof addr === "string" && /^0x[a-fA-F0-9]{40}$/.test(addr);
}
function isValidSolanaAddress(addr: any): boolean {
    return typeof addr === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}
const MAX_DATE_RANGE_DAYS = 8;
function getDateDiffDays(from: string, till: string): number {
    const f = new Date(from);
    const t = new Date(till);
    return Math.ceil((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24));
}
// ── Handler ────────────────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({
            message: "Method not allowed"
        });
    }
    const apiKey = process.env.BITQUERY_API_KEY;
    if (!apiKey) {
        console.error("BITQUERY_API_KEY is not configured");
        return res.status(500).json({
            error: "API key not configured. Please set BITQUERY_API_KEY in your .env file."
        });
    }
    const { chain, action } = req.body || {};
    // 
// ── Last activity check (lightweight) ──────────────────────────────
    if (action === "lastActivity") {
        return handleLastActivity(req, res, apiKey);
    }
    // 
// ── Token Overlap ──────────────────────────────────────────────────
    if (action === "tokenOverlap") {
        return handleTokenOverlap(req, res, apiKey);
    }
    //
// ── Expand Node (on-demand neighborhood fetch) ────────────────────
    if (action === "expand_node") {
        return handleExpandNode(req, res, apiKey);
    }
    // 
// ── Solana coinpath ───────────────────────────────────────────────
    if (chain === "solana") {
        return handleSolana(req, res, apiKey);
    }
    // 
// ── Ethereum coinpath (default) ───────────────────────────────────
    return handleEthereum(req, res, apiKey);
}

// ── Last Activity handler (uses Solana public RPC, NOT Bitquery) ───
async function handleLastActivity(req: NextApiRequest, res: NextApiResponse, _apiKey: string) {
    const { senderAddress } = req.body || {};
    if (!isValidSolanaAddress(senderAddress)) {
        return res.status(400).json({
            error: "Invalid Solana address."
        });
    }
    try {
        const rpcResponse = await fetch("https://api.mainnet-beta.solana.com", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "getSignaturesForAddress",
                params: [
                    senderAddress,
                    {
                        limit: 1
                    }
                ]
            })
        });
        if (!rpcResponse.ok) {
            return res.status(502).json({
                error: "Solana RPC request failed."
            });
        }
        const rpcData = await rpcResponse.json();
        if (rpcData.error) {
            console.error("Solana RPC error:", rpcData.error);
            return res.status(502).json({
                error: "Solana RPC error: " + rpcData.error.message
            });
        }
        const signatures = rpcData.result || [];
        if (signatures.length === 0) {
            return res.status(200).json({
                lastActivityDate: null
            });
        }
        // blockTime is a Unix timestamp
        const blockTime = signatures[0].blockTime;
        if (!blockTime) {
            return res.status(200).json({
                lastActivityDate: null
            });
        }
        const date = new Date(blockTime * 1000);
        const dateStr = date.toISOString().split("T")[0];
        return res.status(200).json({
            lastActivityDate: dateStr
        });
    } catch (error) {
        console.error("Solana RPC fetch error:", error);
        return res.status(502).json({
        });
    }
}

// ── Token Overlap handler ──────────────────────────────────────────
async function handleTokenOverlap(req: NextApiRequest, res: NextApiResponse, apiKey: string) {
    const { chain, token1, token2 } = req.body || {};
    if (!token1 || !token2) {
        return res.status(400).json({
            error: "Both token1 and token2 addresses are required."
        });
    }
    const isSolana = chain === "solana";
    if (isSolana) {
        if (!isValidSolanaAddress(token1) || !isValidSolanaAddress(token2)) {
            return res.status(400).json({
                error: "Invalid Solana token address."
            });
        }
    } else {
        if (!isValidEthAddress(token1) || !isValidEthAddress(token2)) {
            return res.status(400).json({
                error: "Invalid Ethereum token address."
            });
        }
    }
    const query = isSolana ? buildTokenReceiversSolQuery(1000) : buildTokenReceiversEthQuery(500);
    // We need to make 2 separate requests to Bitquery, one for each token
    // because GraphQL alias limits or complexities might cause issues with huge queries.
    // Then we intersect on our server.
    const fetchTokenReceivers = async (token: string)=>{
        const TIMEOUT_MS = 60000;
        try {
            if (isSolana) {
                // Use Bitquery V2 Streaming for Solana Holders
                const queryV2 = `query MyQuery($token1: String) {
          Solana {
            BalanceUpdates(
              limit: { count: 300 }
              orderBy: { descendingByField: "BalanceUpdate_balance" }
              where: {
                BalanceUpdate: { Currency: { MintAddress: { is: $token1 } } }
                Transaction: { Result: { Success: true } }
              }
            ) {
              BalanceUpdate {
                Account { Token { Owner } }
                balance: PostBalance(maximum: Block_Slot)
                Currency { MintAddress Name Symbol }
              }
            }
          }
        }`;
                const result = await callBitqueryV2Raw(queryV2, apiKey, TIMEOUT_MS, "tokenOverlap solana holders", {
                    token1: token
                });
                if (!result.ok) throw new Error(result.error || "GraphQL Error");
                const data = result.data;
                // Transform V2 results into the same format the loop expects: { receiver: { address }, amount, currency }
                const updates = data?.data?.Solana?.BalanceUpdates || [];
                // Deduplicate owners
                const uniqueOwners = new Map();
                for (const u of updates){
                    const owner = u.BalanceUpdate?.Account?.Token?.Owner;
                    if (owner && !uniqueOwners.has(owner)) {
                        uniqueOwners.set(owner, {
                            receiver: {
                                address: owner
                            },
                            amount: parseFloat(u.BalanceUpdate.balance || "0"),
                            currency: {
                                symbol: u.BalanceUpdate.Currency?.Symbol || "",
                                name: u.BalanceUpdate.Currency?.Name || ""
                            }
                        });
                    }
                }
                return Array.from(uniqueOwners.values());
            } else {
                // EVM stays on V1
                const controller = new AbortController();
                const timeoutId = setTimeout(()=>controller.abort(), TIMEOUT_MS);
                const response = await fetch("https://graphql.bitquery.io/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        query,
                        variables: {
                            token
                        }
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (!response.ok) throw new Error(`Bitquery HTTP error ${response.status}`);
                const data = await response.json();
                if (data.errors) throw new Error(data.errors[0]?.message || "GraphQL Error");
                return data.data?.ethereum?.transfers || [];
            }
        } catch (err) {
            throw err;
        }
    };
    try {
        const [transfers1, transfers2] = await Promise.all([
            fetchTokenReceivers(token1),
            fetchTokenReceivers(token2)
        ]);
        // Create a map for fast lookup: { address -> amount }
        const map1 = new Map();
        for (const t of transfers1){
            if (t.receiver?.address) {
                const addr = isSolana ? t.receiver.address : t.receiver.address.toLowerCase();
                map1.set(addr, Number(t.amount));
            }
        }
        // Find initial intersection of receivers
        const initialOverlap = [];
        for (const t of transfers2){
            if (t.receiver?.address) {
                const addr = isSolana ? t.receiver.address : t.receiver.address.toLowerCase();
                if (map1.has(addr)) {
                    initialOverlap.push(t.receiver.address);
                }
            }
        }
        // Now fetch real balances for EVM, but trust Bitquery V2 for Solana
        const overlap = [];
        if (initialOverlap.length > 0) {
            if (isSolana) {
                // Solana: We trust the Bitquery V2 BalanceUpdates. Just map them.
                for (const address of initialOverlap){
                    const bal1 = map1.get(address) || 0;
                    // We need to find bal2 from transfers2
                    const t2 = transfers2.find((t: any)=>t.receiver?.address === address);
                    const bal2 = t2 ? Number(t2.amount) : 0;
                    if (bal1 > 0 && bal2 > 0) {
                        overlap.push({
                            address,
                            amount1: bal1,
                            amount2: bal2
                        });
                    }
                }
            } else {
                // EVM: Use Bitquery balances API in two queries
                const fetchEvmBalances = async (addresses: string[], token: string)=>{
                    const bQuery = `query {
            ethereum {
              address(address: {in: ${JSON.stringify(addresses)}}) {
                address
                balances(currency: {is: "${token}"}) { value }
              }
            }
          }`;
                    try {
                        const res = await fetch("https://graphql.bitquery.io/", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${apiKey}`
                            },
                            body: JSON.stringify({
                                query: bQuery
                            })
                        });
                        const data = await res.json();
                        const map = new Map();
                        const items = data?.data?.ethereum?.address || [];
                        for (const item of items){
                            const val = item.balances?.[0]?.value || 0;
                            map.set(item.address.toLowerCase(), val);
                        }
                        return map;
                    } catch (e) {
                        return new Map();
                    }
                };
                const chunked = [];
                for(let i = 0; i < initialOverlap.length; i += 200){
                    chunked.push(initialOverlap.slice(i, i + 200));
                }
                for (const chunk of chunked){
                    const [mapToken1, mapToken2] = await Promise.all([
                        fetchEvmBalances(chunk, token1),
                        fetchEvmBalances(chunk, token2)
                    ]);
                    for (const rawAddr of chunk){
                        const lowerAddr = rawAddr.toLowerCase();
                        const bal1 = mapToken1.get(lowerAddr) || 0;
                        const bal2 = mapToken2.get(lowerAddr) || 0;
                        if (bal1 > 0 && bal2 > 0) {
                            overlap.push({
                                address: rawAddr,
                                amount1: bal1,
                                amount2: bal2
                            });
                        }
                    }
                }
            }
        }
        // Sort overlap by total pseudo-amount for display, or just token1 amount
        overlap.sort((a, b)=>(b.amount1 || 0) - (a.amount1 || 0));
        // Extract token symbols and prices from DexScreener if available
        const getTokenInfo = async (transfers: any[], defaultVal: string, address: string)=>{
            let symbol = defaultVal;
            let price = 0;
            const entry = transfers.find((t: any)=>t.currency?.symbol && t.currency.symbol !== "-" || t.currency?.name && t.currency.name !== "-");
            const bqSymbol = entry?.currency?.symbol && entry.currency.symbol !== "-" ? entry.currency.symbol : entry?.currency?.name && entry.currency.name !== "-" ? entry.currency.name : null;
            if (bqSymbol) {
                symbol = bqSymbol;
            }
            // Try DexScreener API for price only
            try {
                const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
                if (dexRes.ok) {
                    const dexData = await dexRes.json();
                    if (dexData.pairs && dexData.pairs.length > 0) {
                        const pair = dexData.pairs[0];
                        if (pair.priceUsd) {
                            price = parseFloat(pair.priceUsd);
                        }
                    }
                }
            } catch (err) {
                console.error("DexScreener API fallback failed", err);
            }
            // Fallback 2: Shortened address
            if (symbol === defaultVal && address.length > 10) {
                symbol = `${address.slice(0, 4)}...${address.slice(-4)}`;
            }
            return {
                symbol,
                price
            };
        };
        const token1Info = await getTokenInfo(transfers1, "Token 1", token1);
        const token2Info = await getTokenInfo(transfers2, "Token 2", token2);
        return res.status(200).json({
            overlap,
            token1Symbol: token1Info.symbol,
            token2Symbol: token2Info.symbol,
            token1Price: token1Info.price,
            token2Price: token2Info.price
        });
    } catch (error) {
        console.error("Token Overlap API error:", error);
        return res.status(500).json({
            error: "Failed to fetch token receivers from Bitquery.",
            details: error instanceof Error ? error.message : String(error)
        });
    }
}

// ── Expand Node handler (on-demand neighborhood fetch) ──────────────
async function handleExpandNode(req: NextApiRequest, res: NextApiResponse, apiKey: string) {
    const { address, direction, chain, limit = 20, dateFrom, dateTill } = req.body || {};
    if (!address) {
        return res.status(400).json({ error: "Address is required." });
    }
    const isSolana = chain === "solana";
    if (isSolana) {
        if (!isValidSolanaAddress(address)) {
            return res.status(400).json({ error: "Invalid Solana address." });
        }
    } else {
        if (!isValidEthAddress(address)) {
            return res.status(400).json({ error: "Invalid Ethereum address." });
        }
    }
    const expandDirection = direction === "inbound" ? "inbound" : "outbound";
    const fetchLimit = Math.min(Math.max(Number(limit) || 20, 5), 50);

    // ── Compute effective date range with margins ──
    const marginDays = isSolana ? 30 : 90;
    let effectiveFrom: string;
    let effectiveTill: string;
    let rangeLabel: string;

    if (dateFrom && dateTill) {
        // Adaptive: use transaction-derived dates ± margin
        const from = new Date(new Date(dateFrom).getTime() - marginDays * 86400000);
        const till = new Date(new Date(dateTill).getTime() + marginDays * 86400000);
        // Cap effectiveTill to today (don't query into the future)
        const today = new Date();
        effectiveFrom = from.toISOString().split('T')[0];
        effectiveTill = (till > today ? today : till).toISOString().split('T')[0];
        rangeLabel = `${effectiveFrom} to ${effectiveTill}`;
        console.log(`[EXPAND] Adaptive dates: anchor ${dateFrom}–${dateTill}, margin ±${marginDays}d → ${rangeLabel}`);
    } else {
        // Fallback: hardcoded window from today
        const fallbackDays = isSolana ? 90 : 180;
        effectiveFrom = daysAgoISO(fallbackDays);
        effectiveTill = new Date().toISOString().split('T')[0];
        rangeLabel = `last ${fallbackDays} days`;
        console.log(`[EXPAND] Fallback dates: ${rangeLabel}`);
    }

    const dateFilterStr = `Block: { Date: { after: "${effectiveFrom}", before: "${effectiveTill}" } }`;

    if (isSolana) {
        // Solana: use V1 API (V2 Streaming has different schema for Solana Transfers)
        const query = buildSolanaTransfersQuery();
        const variables = {
            network: "solana",
            address,
            limit: fetchLimit,
            from: `${effectiveFrom}T00:00:00Z`,
            till: `${effectiveTill}T23:59:59Z`
        };

        try {
            const result = await callBitqueryRaw(query, variables, apiKey, 30000);
            if (!result.ok) throw new Error(result.error || "V1 error");
            const data = result.data?.data?.solana;
            // Pick only the relevant direction
            const rawTransfers = expandDirection === "outbound"
                ? (data?.outbound || [])
                : (data?.inbound || []);
            // Normalize transaction field for consistency (V1 uses transaction.signature, not transaction.hash)
            const transfersRaw = rawTransfers.map((t: any) => ({
                ...t,
                transactions: [{ txHash: t.transaction?.signature }],
            }));
            const isInbound = expandDirection === "inbound";
            const transfers = filterScamTransfers(transfersRaw, isInbound);
            console.log(`[EXPAND] Solana ${expandDirection}: ${transfersRaw.length} raw → ${transfers.length} after filter`);
            const key = expandDirection === "outbound" ? "outbound" : "inbound";
            return res.status(200).json({
                data: { ethereum: { [key]: transfers } },
                _meta: { expandedNode: address, direction: expandDirection, count: transfers.length, rawCount: transfersRaw.length, rangeLabel, searchedFrom: effectiveFrom, searchedTill: effectiveTill }
            });
        } catch (err) {
            return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
        }
    }

    // ETH: Use V2 streaming
    const transferFilter = expandDirection === "outbound"
        ? `Transfer: { Sender: { is: "${address}" } }`
        : `Transfer: { Receiver: { is: "${address}" } }`;
    const query = `{
      EVM(dataset: archive, network: eth) {
        Transfers(
          where: { ${transferFilter}, ${dateFilterStr} }
          limit: { count: ${fetchLimit} }
          orderBy: { descending: Block_Time }
        ) {
          Transfer { Receiver Sender Amount Currency { Symbol Name SmartContract } }
          Transaction { Hash }
          Block { Time }
        }
      }
    }`;

    try {
        const result = await callBitqueryV2Raw(query, apiKey, 15000, `expand_node ethereum (${rangeLabel})`);
        if (!result.ok) throw new Error(result.error || "V2 error");
        const data = result.data;
        const transfersRaw = (data?.data?.EVM?.Transfers || []).map((t: any) => ({
            sender: { address: t.Transfer.Sender },
            receiver: { address: t.Transfer.Receiver },
            amount: t.Transfer.Amount,
            currency: { symbol: t.Transfer.Currency?.Symbol, name: t.Transfer.Currency?.Name, address: t.Transfer.Currency?.SmartContract },
            depth: 0, count: 1,
            transactions: [{ txHash: t.Transaction?.Hash }],
            transaction: { time: { time: t.Block?.Time } },
        }));
        const isInbound = expandDirection === "inbound";
        const transfers = filterScamTransfers(transfersRaw, isInbound);
        console.log(`[EXPAND] ETH ${expandDirection}: ${transfersRaw.length} raw → ${transfers.length} after filter`);
        const key = expandDirection === "outbound" ? "outbound" : "inbound";
        return res.status(200).json({
            data: { ethereum: { [key]: transfers } },
            _meta: { expandedNode: address, direction: expandDirection, count: transfers.length, rawCount: transfersRaw.length, rangeLabel, searchedFrom: effectiveFrom, searchedTill: effectiveTill }
        });
    } catch (err) {
        return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
}

// ── Ethereum handler ────────────────────────────────────────────────
async function handleEthereum(req: NextApiRequest, res: NextApiResponse, apiKey: string) {
    const { senderAddress, receiverAddress, depth } = req.body || {};
    if (!isValidEthAddress(senderAddress)) {
        return res.status(400).json({
            error: "Invalid or missing sender address."
        });
    }
    const hasReceiver = !!receiverAddress && receiverAddress.trim() !== "";
    // Single-address mode: use transfers API
    if (!hasReceiver) {
        return handleEthSingleAddress(senderAddress, apiKey, res);
    }
    if (!isValidEthAddress(receiverAddress)) {
        return res.status(400).json({
            error: "Invalid receiver address."
        });
    }
    if (senderAddress.toLowerCase() === receiverAddress.toLowerCase()) {
        return res.status(400).json({
            error: "Sender and receiver must be different."
        });
    }
    let depthValue = 1;
    if (depth !== undefined) {
        const parsedDepth = Number(depth);
        if (isNaN(parsedDepth) || parsedDepth < 1 || parsedDepth > 2) {
            return res.status(400).json({
                error: "Depth must be 1 or 2."
            });
        }
        depthValue = parsedDepth;
    }

    const mergeTransferSets = (baseOutbound: any[], baseInbound: any[], extraOutbound: any[], extraInbound: any[])=>{
        const outbound = [...baseOutbound];
        const inbound = [...baseInbound];
        const makeKey = (tx: any)=>{
            const txHash = tx?.transactions?.[0]?.txHash;
            if (txHash) return `hash:${txHash.toLowerCase()}`;
            const sender = tx?.sender?.address || "";
            const receiver = tx?.receiver?.address || "";
            const amount = tx?.amount || "";
            const symbol = tx?.currency?.symbol || "";
            const time = tx?.transaction?.time?.time || "";
            return `raw:${sender}:${receiver}:${amount}:${symbol}:${time}`;
        };
        const seen = new Set<string>([
            ...outbound.map((tx)=>makeKey(tx)),
            ...inbound.map((tx)=>makeKey(tx))
        ]);
        const pushUnique = (target: any[], source: any[])=>{
            for (const tx of source){
                const key = makeKey(tx);
                if (!seen.has(key)) {
                    target.push(tx);
                    seen.add(key);
                }
            }
        };
        pushUnique(outbound, extraOutbound);
        pushUnique(inbound, extraInbound);
        return {
            outbound,
            inbound
        };
    };

    const mapV2Rows = (rows: any[], fixedSender: string, fixedReceiver: string, hopDepth: number)=>rows.map((t: any)=>({
                sender: {
                    address: fixedSender
                },
                receiver: {
                    address: fixedReceiver
                },
                amount: t.Transfer?.Amount,
                currency: {
                    symbol: t.Transfer?.Currency?.Symbol,
                    name: t.Transfer?.Currency?.Name
                },
                depth: hopDepth,
                count: 1,
                transactions: t.Transaction?.Hash ? [
                    {
                        txHash: t.Transaction.Hash
                    }
                ] : [],
                transaction: {
                    time: {
                        time: t.Block?.Time
                    }
                }
            }));

    const fetchDirectPairV2 = async (dayWindows: number[], directLimit: number)=>{
        for (const days of dayWindows){
            const label = `last ${days} days`;
            const since = daysAgoISO(days);
            const query = `{
              EVM(dataset: archive, network: eth) {
                outbound: Transfers(
                  where: {
                    Transfer: { Sender: { is: "${senderAddress}" }, Receiver: { is: "${receiverAddress}" } }
                    Block: { Date: { after: "${since}" } }
                  }
                  limit: { count: ${directLimit} }
                  orderBy: { descending: Block_Time }
                ) {
                  Transfer { Receiver Sender Amount Currency { Symbol Name } }
                  Transaction { Hash }
                  Block { Time }
                }
                inbound: Transfers(
                  where: {
                    Transfer: { Sender: { is: "${receiverAddress}" }, Receiver: { is: "${senderAddress}" } }
                    Block: { Date: { after: "${since}" } }
                  }
                  limit: { count: ${directLimit} }
                  orderBy: { descending: Block_Time }
                ) {
                  Transfer { Receiver Sender Amount Currency { Symbol Name } }
                  Transaction { Hash }
                  Block { Time }
                }
              }
            }`;
            const result = await callBitqueryV2Raw(query, apiKey, 12000, `ETH direct pair ${label}`);
            if (!result.ok) {
                if (result.code === "QUERY_TOO_COMPLEX" || result.code === "SIMULTANEOUS_REQUEST") {
                    console.log(`ETH direct V2: ${label} too complex/busy, trying wider window...`);
                    continue;
                }
                console.log(`ETH direct V2: ${label} failed (${result.error}), trying wider window...`);
                continue;
            }
            const outRaw = result.data?.data?.EVM?.outbound || [];
            const inRaw = result.data?.data?.EVM?.inbound || [];
            const outbound = mapV2Rows(outRaw, senderAddress, receiverAddress, 0);
            const inbound = mapV2Rows(inRaw, receiverAddress, senderAddress, 0);
            return {
                ok: true,
                outbound,
                inbound,
                days,
                label,
                isLimited: outRaw.length >= directLimit || inRaw.length >= directLimit
            };
        }
        return {
            ok: false,
            outbound: [],
            inbound: [],
            days: dayWindows[dayWindows.length - 1] || 30,
            label: `last ${dayWindows[dayWindows.length - 1] || 30} days`,
            isLimited: false
        };
    };

    // ── All-time fallback: no date filter, finds ANY historical transfer between pair ──
    const fetchAllTimePairV2 = async (limit: number = 50) => {
        const query = `{
          EVM(dataset: archive, network: eth) {
            outbound: Transfers(
              where: {
                Transfer: { Sender: { is: "${senderAddress}" }, Receiver: { is: "${receiverAddress}" } }
              }
              limit: { count: ${limit} }
              orderBy: { descending: Block_Time }
            ) {
              Transfer { Receiver Sender Amount Currency { Symbol Name } }
              Transaction { Hash }
              Block { Time }
            }
            inbound: Transfers(
              where: {
                Transfer: { Sender: { is: "${receiverAddress}" }, Receiver: { is: "${senderAddress}" } }
              }
              limit: { count: ${limit} }
              orderBy: { descending: Block_Time }
            ) {
              Transfer { Receiver Sender Amount Currency { Symbol Name } }
              Transaction { Hash }
              Block { Time }
            }
          }
        }`;
        console.log(`ETH all-time pair: searching full history (no date filter, limit=${limit})...`);
        const result = await callBitqueryV2Raw(query, apiKey, 30000, "ETH all-time pair fallback");
        if (!result.ok) {
            console.log(`ETH all-time pair: failed (${result.error})`);
            return { ok: false as const, outbound: [], inbound: [] };
        }
        const outRaw = result.data?.data?.EVM?.outbound || [];
        const inRaw = result.data?.data?.EVM?.inbound || [];
        const outbound = mapV2Rows(outRaw, senderAddress, receiverAddress, 0);
        const inbound = mapV2Rows(inRaw, receiverAddress, senderAddress, 0);
        const total = outbound.length + inbound.length;
        console.log(`ETH all-time pair: found ${total} historical transfers`);
        return {
            ok: true as const,
            outbound,
            inbound,
            isLimited: outRaw.length >= limit || inRaw.length >= limit
        };
    };

    const detectWhalePairV2 = async ()=>{
        const whaleLimit = 500;
        const whaleQuery = `{
          EVM(dataset: archive, network: eth) {
            senderActivity: Transfers(
              where: {
                Transfer: { Sender: { is: "${senderAddress}" } }
                Block: { Date: { after: "${daysAgoISO(30)}" } }
              }
              limit: { count: ${whaleLimit} }
            ) { Transfer { Receiver } }
            receiverActivity: Transfers(
              where: {
                Transfer: { Receiver: { is: "${receiverAddress}" } }
                Block: { Date: { after: "${daysAgoISO(30)}" } }
              }
              limit: { count: ${whaleLimit} }
            ) { Transfer { Sender } }
          }
        }`;
        const result = await callBitqueryV2Raw(whaleQuery, apiKey, 9000, "ETH whale check");
        if (!result.ok) {
            console.log(`ETH whale check unavailable (${result.error}), treating as non-whale.`);
            return {
                isWhale: false,
                senderCount: 0,
                receiverCount: 0,
                reliable: false
            };
        }
        const senderCount = result.data?.data?.EVM?.senderActivity?.length || 0;
        const receiverCount = result.data?.data?.EVM?.receiverActivity?.length || 0;
        const isWhale = senderCount >= whaleLimit && receiverCount >= whaleLimit;
        return {
            isWhale,
            senderCount,
            receiverCount,
            reliable: true
        };
    };

    const fetchLightHopV2 = async (hopLimit: number, dateHints?: { oldest: string; newest: string })=>{
        // Build date filter from date hints or use all-time
        let dateFilter: string;
        let label: string;
        if (dateHints) {
            const oldest = new Date(dateHints.oldest);
            const newest = new Date(dateHints.newest);
            const margin = 30 * 24 * 60 * 60 * 1000; // 30 days
            const from = new Date(oldest.getTime() - margin).toISOString().split('T')[0];
            const till = new Date(newest.getTime() + margin).toISOString().split('T')[0];
            dateFilter = `Block: { Date: { after: "${from}", before: "${till}" } }`;
            label = `around direct transfers (${from} to ${till})`;
        } else {
            dateFilter = ``; // all-time
            label = `all time`;
        }
        const dateFilterLine = dateFilter ? `\n                    ${dateFilter}` : '';
        {
            const senderOutQuery = `{
              EVM(dataset: archive, network: eth) {
                Transfers(
                  where: {
                    Transfer: { Sender: { is: "${senderAddress}" } }${dateFilterLine}
                  }
                  limit: { count: ${hopLimit} }
                  orderBy: { descending: Block_Time }
                ) {
                  Transfer { Receiver Sender Amount Currency { Symbol Name } }
                  Transaction { Hash }
                  Block { Time }
                }
              }
            }`;
            const receiverInQuery = `{
              EVM(dataset: archive, network: eth) {
                Transfers(
                  where: {
                    Transfer: { Receiver: { is: "${receiverAddress}" } }${dateFilterLine}
                  }
                  limit: { count: ${hopLimit} }
                  orderBy: { descending: Block_Time }
                ) {
                  Transfer { Receiver Sender Amount Currency { Symbol Name } }
                  Transaction { Hash }
                  Block { Time }
                }
              }
            }`;
            console.log(`ETH light-hop: trying ${label}, limit=${hopLimit}...`);
            const senderResult = await callBitqueryV2Raw(senderOutQuery, apiKey, 20000, `ETH sender neighborhood ${label}`);
            if (!senderResult.ok) {
                console.log(`ETH light-hop: sender side ${label} failed (${senderResult.error || senderResult.code})`);
                return { ok: false, outbound: [], inbound: [], intermediariesFound: 0, neighborhoodSearched: { sender: 0, receiver: 0 }, isLimited: false, days: 0, label };
            }
            const receiverResult = await callBitqueryV2Raw(receiverInQuery, apiKey, 20000, `ETH receiver neighborhood ${label}`);
            if (!receiverResult.ok) {
                console.log(`ETH light-hop: receiver side ${label} failed (${receiverResult.error || receiverResult.code})`);
                return { ok: false, outbound: [], inbound: [], intermediariesFound: 0, neighborhoodSearched: { sender: 0, receiver: 0 }, isLimited: false, days: 0, label };
            }
            const senderOutTransfers = senderResult.data?.data?.EVM?.Transfers || [];
            const receiverInTransfers = receiverResult.data?.data?.EVM?.Transfers || [];
            const senderReceivers = new Set(senderOutTransfers.map((t: any)=>t.Transfer?.Receiver?.toLowerCase()));
            const receiverSenders = new Set(receiverInTransfers.map((t: any)=>t.Transfer?.Sender?.toLowerCase()));
            const senderLower = senderAddress.toLowerCase();
            const receiverLower = receiverAddress.toLowerCase();
            const intermediaries = new Set<string>();
            labelEngine.load();
            let defiFiltered = 0;
            senderReceivers.forEach((addr) => {
                if (typeof addr !== "string") return;
                if (receiverSenders.has(addr) && addr !== senderLower && addr !== receiverLower) {
                    // Skip DeFi/exchange contracts — they're shared by everyone, not real intermediaries
                    const label = labelEngine.getLabel(addr);
                    if (label && (label.type === 'defi' || label.type === 'exchange')) {
                        console.log(`ETH light-hop: skipping ${label.type} intermediary: ${addr} (${label.name})`);
                        defiFiltered++;
                        return;
                    }
                    intermediaries.add(addr);
                }
            });
            if (defiFiltered > 0) console.log(`ETH light-hop: filtered out ${defiFiltered} DeFi/exchange intermediaries`);
            const outbound: any[] = [];
            const inbound: any[] = [];
            for (const t of senderOutTransfers){
                const target = t.Transfer?.Receiver?.toLowerCase();
                if (target && intermediaries.has(target)) {
                    outbound.push({
                        sender: {
                            address: senderAddress
                        },
                        receiver: {
                            address: t.Transfer?.Receiver
                        },
                        amount: t.Transfer?.Amount,
                        currency: {
                            symbol: t.Transfer?.Currency?.Symbol,
                            name: t.Transfer?.Currency?.Name
                        },
                        depth: 1,
                        count: 1,
                        transactions: t.Transaction?.Hash ? [
                            {
                                txHash: t.Transaction.Hash
                            }
                        ] : [],
                        transaction: {
                            time: {
                                time: t.Block?.Time
                            }
                        }
                    });
                }
            }
            for (const t of receiverInTransfers){
                const source = t.Transfer?.Sender?.toLowerCase();
                if (source && intermediaries.has(source)) {
                    inbound.push({
                        sender: {
                            address: t.Transfer?.Sender
                        },
                        receiver: {
                            address: receiverAddress
                        },
                        amount: t.Transfer?.Amount,
                        currency: {
                            symbol: t.Transfer?.Currency?.Symbol,
                            name: t.Transfer?.Currency?.Name
                        },
                        depth: 1,
                        count: 1,
                        transactions: t.Transaction?.Hash ? [
                            {
                                txHash: t.Transaction.Hash
                            }
                        ] : [],
                        transaction: {
                            time: {
                                time: t.Block?.Time
                            }
                        }
                    });
                }
            }
            console.log(`ETH light-hop: found ${intermediaries.size} intermediaries from ${senderOutTransfers.length} sender txs + ${receiverInTransfers.length} receiver txs`);
            return {
                ok: true,
                outbound,
                inbound,
                intermediariesFound: intermediaries.size,
                neighborhoodSearched: {
                    sender: senderOutTransfers.length,
                    receiver: receiverInTransfers.length
                },
                isLimited: senderOutTransfers.length >= hopLimit || receiverInTransfers.length >= hopLimit,
                days: 0,
                label
            };
        }
    };


	// ── Depth 1 (Direct): all-time, last 50 transfers ──
	if (depthValue === 1) {
		console.log(`ETH depth=1: all-time direct search (limit=50)...`);
		const allTime = await fetchAllTimePairV2(50);

		if (!allTime.ok) {
			return res.status(500).json({
				error: "Failed to fetch direct transfers from Bitquery.",
				code: "API_ERROR"
			});
		}

		const total = allTime.outbound.length + allTime.inbound.length;

		if (total === 0) {
			return res.status(200).json({
				data: { ethereum: { outbound: [], inbound: [] } },
				_meta: {
					depthUsed: 1,
					dateRange: "all time",
					totalResults: 0,
					isLimited: false,
					resultStatus: "NoResults",
					message: "No direct transfers found between these addresses (full history searched)."
				}
			});
		}

		// Compute actual date span from results
		const allDates = [...allTime.outbound, ...allTime.inbound]
			.map((t: any) => t.transaction?.time?.time)
			.filter(Boolean)
			.sort();
		const oldest = allDates[0] || '';
		const newest = allDates[allDates.length - 1] || '';
		const fmtD = (iso: string) => { try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return iso; } };
		const spanLabel = oldest ? `${fmtD(oldest)} – ${fmtD(newest)}` : 'all time';

		console.log(`ETH depth=1: found ${total} direct transfers (${spanLabel})`);
		return res.status(200).json({
			data: { ethereum: { outbound: allTime.outbound, inbound: allTime.inbound } },
			_meta: {
				depthUsed: 1,
				dateRange: spanLabel,
				limitPerDirection: 50,
				totalResults: total,
				isLimited: allTime.isLimited,
				resultStatus: allTime.isLimited ? "Partial" : "Complete",
				message: allTime.isLimited
					? `Showing last 50 direct transfers per direction (${spanLabel}).`
					: `Found ${total} direct transfer(s) between these addresses (${spanLabel}).`
			}
		});
	}

// ── Depth 2 (1-Hop): guaranteed direct result first, then best-effort enrichment ──
    const directBaseline = await fetchAllTimePairV2(50);
    let outbound = directBaseline.outbound;
    let inbound = directBaseline.inbound;

    // Compute date hints from direct baseline for coinpath window
    const directDates = [...outbound, ...inbound]
        .map((t: any) => t.transaction?.time?.time)
        .filter(Boolean)
        .sort();
    const directDateHints = directDates.length > 0
        ? { oldest: directDates[0], newest: directDates[directDates.length - 1] }
        : undefined;

    const whaleInfo = await detectWhalePairV2();
    const isWhale = whaleInfo.isWhale;

    if (isWhale) {
        console.log(`ETH depth=2: high-volume wallet detected (sender=${whaleInfo.senderCount}, receiver=${whaleInfo.receiverCount}). Skipping 1-hop, returning direct only.`);
        const total = outbound.length + inbound.length;

        // Compute date span from direct results
        const allDates = [...outbound, ...inbound]
            .map((t: any) => t.transaction?.time?.time)
            .filter(Boolean)
            .sort();
        const fmtD = (iso: string) => { try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return iso; } };
        const spanLabel = allDates.length > 0 ? `${fmtD(allDates[0])} – ${fmtD(allDates[allDates.length - 1])}` : 'all time';

        if (total === 0) {
            return res.status(200).json({
                data: { ethereum: { outbound: [], inbound: [] } },
                _meta: {
                    depthUsed: 2,
                    dateRange: "all time",
                    totalResults: 0,
                    isLimited: false,
                    whaleFallback: true,
                    resultStatus: "NoResults",
                    message: "No connection found. Both addresses are high-volume wallets — 1-hop intermediary search is not available for this pair on the current plan, and no direct transfers exist between them."
                }
            });
        }

        return res.status(200).json({
            data: {
                ethereum: {
                    outbound,
                    inbound
                }
            },
            _meta: {
                depthUsed: 2,
                source: "v2_transfers",
                dateRange: spanLabel,
                totalResults: total,
                directTransfers: total,
                intermediariesFound: 0,
                isLimited: directBaseline.isLimited,
                whaleFallback: true,
                resultStatus: directBaseline.isLimited ? "Partial" : "Complete",
                message: `High-volume wallet detected — 1-hop intermediary search is not supported for this address type on the current plan. Showing ${total} direct transfer(s) (${spanLabel}).`
            }
        });
    }

    // ── V2 light 1-hop search (always, no coinpath fallback) ──
    console.log(`ETH depth=2: running V2 light 1-hop (limit=250)...`);
    const lightHop = await fetchLightHopV2(250, directDateHints);
    const merged = mergeTransferSets(outbound, inbound, lightHop.outbound, lightHop.inbound);
    outbound = merged.outbound;
    inbound = merged.inbound;

    const total = outbound.length + inbound.length;
    const directCount = outbound.filter((t: any)=>(t.depth || 0) === 0).length + inbound.filter((t: any)=>(t.depth || 0) === 0).length;

    // ── 0 results from all strategies ──
    if (total === 0) {
        return res.status(200).json({
            data: { ethereum: { outbound: [], inbound: [] } },
            _meta: {
                depthUsed: 2,
                dateRange: "all time",
                totalResults: 0,
                isLimited: false,
                resultStatus: "NoResults",
                message: "No connection found between these addresses — no direct transfers and no shared 1-hop intermediaries detected (full history searched)."
            }
        });
    }

    const isPartial = lightHop.isLimited || directBaseline.isLimited;

    // Build informative message describing both 1-hop and direct results
    const messageParts: string[] = [];
    if (lightHop.intermediariesFound > 0) {
        messageParts.push(`Found ${lightHop.intermediariesFound} shared intermediary(ies) via 1-hop search (${lightHop.label}).`);
    } else {
        messageParts.push(`No intermediate addresses found via 1-hop search (${lightHop.label}).`);
    }
    if (directCount > 0) {
        messageParts.push(`Found ${directCount} direct transfer(s) between the addresses.`);
    }
    if (isPartial) {
        messageParts.push(`Results may be partial due to query limits.`);
    }
    const statusMessage = messageParts.join(" ");

    return res.status(200).json({
        data: {
            ethereum: {
                outbound,
                inbound
            }
        },
        _meta: {
            depthUsed: 2,
            source: "v2_transfers",
            dateRange: lightHop.label,
            daysQueried: lightHop.days,
            totalResults: total,
            directTransfers: directCount,
            intermediariesFound: lightHop.intermediariesFound,
            neighborhoodSearched: lightHop.neighborhoodSearched,
            isLimited: isPartial,
            resultStatus: isPartial ? "Partial" : "Complete",
            message: statusMessage
        }
    });
}

// ── ETH single-address handler (transfers API with progressive retry) ──
function daysAgoISO(days: number) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
}

// ── Scam & Fake Token Filter ──
const KNOWN_TOKENS: Record<string, string[]> = {
    // Symbol: [Valid Contract Addresses (lowercase)]
    "USDC": ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"],
    "USDT": ["0xdac17f958d2ee523a2206206994597c13d831ec7"],
    "WETH": ["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"],
    "WBTC": ["0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"],
    "DAI":  ["0x6b175474e89094c44da98b954eedeac495271d0f"],
    "LINK": ["0x514910771af9ca656af840dff83e8264ecf986ca"],
    "UNI":  ["0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"],
    "SHIB": ["0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce"],
    "PEPE": ["0x6982508145454ce325ddbe47a25d4ec3d2311933"],
    "AAVE": ["0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9"],
    "MKR":  ["0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2"],
    "CRV":  ["0xd533a949740bb3306d119cc777fa900ba034cd52"],
    "COMP": ["0xc00e94cb662c3520282e6f5717214004a7f26888"],
    "SNX":  ["0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f"],
    "MATIC":["0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0"],
    "LDO":  ["0x5a98fcbea516cf06857215779fd812ca3bef1b32"],
    "ARB":  ["0xb50721bcf8d664c30412cfbc6cf7a15145234ad1"],
    "STETH":["0xae7ab96520de3a18e5e111b5eaab095312d7fe84"],
    // ETH native usually has no address or '-' in Bitquery V1, '' in V2, and '0x' for SmartContract in V2
    "ETH":  ["", "-", "0x", null, undefined] as any[], 
};

// Symbols that are always considered legitimate regardless of contract address
const WHITELISTED_SYMBOLS = new Set(
    Object.keys(KNOWN_TOKENS).map(s => s.toUpperCase())
);

const SCAM_KEYWORDS = [
    ".com", ".io", ".net", ".org", "http", "www", 
    "claim", "airdrop", "free", "reward", "gift", "visit", "bonus"
];

// Amount threshold: inbound transfers of unknown tokens below this are filtered
const INBOUND_USD_THRESHOLD = 10;   // $10 USD minimum for non-whitelisted inbound
const INBOUND_RAW_THRESHOLD = 10;   // raw token amount threshold when no USD price

function filterScamTransfers(transfers: any[], isInbound: boolean = false): any[] {
    // Ensure label engine is loaded (singleton — only loads once)
    labelEngine.load();

    return transfers.filter((t) => {
        const symbol = t.currency?.symbol?.toLowerCase() || "";
        const name = t.currency?.name?.toLowerCase() || "";
        const address = typeof t.currency?.address === 'string' ? t.currency.address.toLowerCase() : t.currency?.address;
        const amt = t.amount ?? t.amountUSD ?? '?';
        const senderAddr = t.sender?.address || '?';
        const receiverAddr = t.receiver?.address || '?';
        const rawAmount = Math.abs(parseFloat(t.amount) || 0);

        // 0. Universal: reject any transfer worth ≤ $10 USD (dust/noise)
        // BUT: if USD=0 and raw amount > 0, treat as missing price data (Bitquery often returns USD=0 for native ETH)
        const usdValue = t.amountUSD != null ? Math.abs(Number(t.amountUSD)) : null;
        if (usdValue != null && usdValue <= 10 && rawAmount <= 0.001) {
            // Both USD and raw amount are negligible → definitely dust
            console.log(`[FILTER] REJECTED (dust): ${symbol} "${name}" amount=${amt} USD=${usdValue} sender=${senderAddr}`);
            return false;
        }
        if (usdValue != null && usdValue > 0 && usdValue <= 10) {
            // USD price is known and small → dust
            console.log(`[FILTER] REJECTED (≤$10 USD): ${symbol} "${name}" amount=${amt} USD=${usdValue} sender=${senderAddr}`);
            return false;
        }
        // If USD=0 but raw amount > 0 → missing price data, let it through to other checks
        if (usdValue == null && rawAmount <= 0) {
            console.log(`[FILTER] REJECTED (zero amount): ${symbol} "${name}" amount=${amt} sender=${senderAddr}`);
            return false;
        }

        // 1. Heuristic: Filter out obvious spam domains/words in name or symbol
        const isSpamKeyword = SCAM_KEYWORDS.some(kw => symbol.includes(kw) || name.includes(kw));
        if (isSpamKeyword) {
            console.log(`[FILTER] REJECTED (spam keyword): ${symbol} "${name}" amount=${amt} sender=${senderAddr}`);
            return false;
        }

        // 2. CA Verification: If it claims to be a popular token, verify its address
        const upperSymbol = t.currency?.symbol?.toUpperCase() || "";
        if (upperSymbol && KNOWN_TOKENS[upperSymbol]) {
            const validAddresses = KNOWN_TOKENS[upperSymbol];
            if (!validAddresses.includes(address)) {
                console.log(`[FILTER] REJECTED (fake CA): ${upperSymbol} contractAddr=${address} (valid: ${validAddresses.join(',')}) amount=${amt} sender=${senderAddr}`);
                return false;
            }
        }

        // 3. ScamSniffer: If sender is a known scam address → scam airdrop
        if (senderAddr && labelEngine.isScam(senderAddr)) {
            console.log(`[FILTER] REJECTED (scam sender): ${symbol} amount=${amt} sender=${senderAddr}`);
            return false;
        }

        // 4. Inbound-only: filter non-whitelisted tokens with tiny amounts (scam airdrops)
        if (isInbound && !WHITELISTED_SYMBOLS.has(upperSymbol)) {
            if (t.amountUSD != null) {
                if (Math.abs(Number(t.amountUSD)) < INBOUND_USD_THRESHOLD) {
                    console.log(`[FILTER] REJECTED (low USD inbound): ${symbol} "${name}" amount=${amt} USD=${t.amountUSD} sender=${senderAddr}`);
                    return false;
                }
            } else {
                const rawAmount = Math.abs(parseFloat(t.amount) || 0);
                if (rawAmount <= INBOUND_RAW_THRESHOLD) {
                    console.log(`[FILTER] REJECTED (low amount inbound): ${symbol} "${name}" amount=${amt} sender=${senderAddr}`);
                    return false;
                }
            }
        }

        return true;
    });
}

async function handleEthSingleAddress(address: string, apiKey: string, res: NextApiResponse) {
    // Strategy: V2 Streaming FIRST (fast & reliable), then V1 as fallback.
    // V2 uses streaming.bitquery.io — much faster than legacy graphql.bitquery.io.
    // "last year" = 365 days ago → NOW, so always includes the latest transfers.

    // Helper: map V2 raw rows to V1-compatible format
    function mapV2Row(t: any, direction: 'out' | 'in') {
        return {
            sender: { address: direction === 'out' ? address : t.Transfer.Sender },
            receiver: { address: direction === 'out' ? t.Transfer.Receiver : address },
            amount: t.Transfer.Amount,
            amountUSD: t.Transfer.AmountInUSD != null ? Number(t.Transfer.AmountInUSD) : undefined,
            currency: { symbol: t.Transfer.Currency?.Symbol, name: t.Transfer.Currency?.Name, address: t.Transfer.Currency?.SmartContract },
            depth: 0, count: 1,
            transactions: [{ txHash: t.Transaction?.Hash }],
            transaction: { time: { time: t.Block?.Time } }
        };
    }

    // Helper: format date for display (e.g. "Mar 2, 2026")
    function fmtDate(iso: string): string {
        try {
            const d = new Date(iso);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch { return iso; }
    }

    // Helper: compute actual date span from transfer data
    function computeDateSpan(transfers: any[]): { oldest: string | null; newest: string | null; spanLabel: string } {
        const dates = transfers
            .map(t => t.transaction?.time?.time)
            .filter(Boolean)
            .sort();
        if (dates.length === 0) return { oldest: null, newest: null, spanLabel: "no data" };
        const oldest = dates[0];
        const newest = dates[dates.length - 1];
        return { oldest, newest, spanLabel: `${fmtDate(oldest)} – ${fmtDate(newest)}` };
    }

    // Helper: build response metadata
    function buildMeta(limit: number, total: number, spamFiltered: number, isLimited: boolean, source: string, spanLabel: string) {
        const _meta: any = {
            dateRange: spanLabel,
            limitPerDirection: limit,
            totalResults: total,
            spamFiltered,
            isLimited,
            source,
            resultStatus: isLimited ? "Partial" : "Complete"
        };
        if (isLimited) {
            _meta.message = `Showing top ${limit} transfers per direction (${spanLabel}). This address has high activity — provide a specific receiver address for a complete view.`;
        } else if (spamFiltered > 0) {
            _meta.message = `Showing all transfers (${spanLabel}). Filtered out ${spamFiltered} suspected scam/fake tokens.`;
        } else {
            _meta.message = `Showing all transfers (${spanLabel}).`;
        }
        return _meta;
    }

    // ════════════════════════════════════════════════════════════════
    // STEP 1: Try V2 Streaming API first (fast, reliable)
    // ════════════════════════════════════════════════════════════════
    const v2Ranges = [
        { days: 180, label: "last 6 months", timeout: 30000 },
        { days: 90,  label: "last 90 days", timeout: 20000 },
    ];

    for (const range of v2Ranges) {
        const sinceV2 = daysAgoISO(range.days);
        const v2Query = `{
          EVM(dataset: archive, network: eth) {
            outbound: Transfers(
              where: {
                Transfer: { Sender: { is: "${address}" }, Amount: { gt: "0" } }
                Block: { Date: { after: "${sinceV2}" } }
              }
              limit: { count: 100 }
              orderBy: { descending: Block_Time }
            ) {
              Transfer { Receiver Sender Amount AmountInUSD Currency { Symbol Name SmartContract } }
              Transaction { Hash }
              Block { Time }
            }
            inbound: Transfers(
              where: {
                Transfer: { Receiver: { is: "${address}" }, AmountInUSD: { gt: "10" } }
                Block: { Date: { after: "${sinceV2}" } }
              }
              limit: { count: 100 }
              orderBy: { descending: Block_Time }
            ) {
              Transfer { Receiver Sender Amount AmountInUSD Currency { Symbol Name SmartContract } }
              Transaction { Hash }
              Block { Time }
            }
          }
        }`;

        console.log(`ETH single-address V2: trying ${range.label}, timeout=${range.timeout}ms...`);
        try {
            const v2Result = await callBitqueryV2Raw(v2Query, apiKey, range.timeout, `single-addr ${range.label}`);
            if (v2Result.ok && !v2Result.data?.errors?.[0]) {
                const outRaw = v2Result.data?.data?.EVM?.outbound || [];
                const inRaw = v2Result.data?.data?.EVM?.inbound || [];

                const outboundRaw = outRaw.map((t: any) => mapV2Row(t, 'out'));
                const inboundRaw = inRaw.map((t: any) => mapV2Row(t, 'in'));

                const outbound = filterScamTransfers(outboundRaw, false);
                const inbound = filterScamTransfers(inboundRaw, true);
                const total = outbound.length + inbound.length;
                const spamFiltered = (outboundRaw.length + inboundRaw.length) - total;
                const isLimited = outbound.length >= 100 || inbound.length >= 100;

                if (total > 0) {
                    const { spanLabel } = computeDateSpan([...outbound, ...inbound]);
                    console.log(`ETH single-address V2: success with ${range.label} (${total} transfers, filtered=${spamFiltered}, span=${spanLabel})`);
                    return res.status(200).json({
                        data: { ethereum: { outbound, inbound } },
                        _meta: buildMeta(100, total, spamFiltered, isLimited, "v2_streaming", spanLabel)
                    });
                }
                // 0 results for "last 6 months" → try all time via V2 before giving up
                if (range.days >= 180) {
                    console.log(`ETH single-address V2: 0 results for ${range.label}, will try V1 all time...`);
                    break;
                }
                console.log(`ETH single-address V2: 0 results for ${range.label}`);
            } else {
                console.log(`ETH single-address V2: ${range.label} failed (${v2Result.code || v2Result.error || 'unknown'}), trying next...`);
            }
        } catch (err) {
            console.error(`ETH single-address V2 ${range.label} error:`, err);
        }
    }

    // ════════════════════════════════════════════════════════════════
    // STEP 2: V2 failed — fallback to V1 (progressive narrowing)
    // ════════════════════════════════════════════════════════════════
    console.log("ETH single-address: V2 didn't return results, trying V1...");
    const v1Attempts = [
        { days: 180,  limit: 50, label: "last 6 months", timeout: 45000 },
        { days: 90,   limit: 40, label: "last 90 days", timeout: 30000 },
        { days: 30,   limit: 30, label: "last 30 days", timeout: 25000 },
        { days: 7,    limit: 25, label: "last 7 days", timeout: 20000 },
    ];

    for (const attempt of v1Attempts) {
        const since = daysAgoISO(attempt.days);
        const query = buildEthTransfersQuery(attempt.limit);
        const variables = { address, limit: attempt.limit, since };

        console.log(`ETH single-address V1: trying ${attempt.label} with limit=${attempt.limit}, timeout=${attempt.timeout}ms...`);
        const result = await callBitqueryRaw(query, variables, apiKey, attempt.timeout);

        if (result.ok) {
            const outboundRaw = result.data?.data?.ethereum?.outbound || [];
            const inboundRaw = result.data?.data?.ethereum?.inbound || [];
            const outbound = filterScamTransfers(outboundRaw, false);
            const inbound = filterScamTransfers(inboundRaw, true);
            const total = outbound.length + inbound.length;
            const spamFiltered = (outboundRaw.length + inboundRaw.length) - total;
            const isLimited = outboundRaw.length >= attempt.limit || inboundRaw.length >= attempt.limit;

            if (total > 0) {
                const { spanLabel } = computeDateSpan([...outbound, ...inbound]);
                console.log(`ETH single-address V1: success with ${attempt.label} (${total} transfers, limited=${isLimited}, filtered=${spamFiltered}, span=${spanLabel})`);
                return res.status(200).json({
                    data: { ethereum: { outbound, inbound } },
                    _meta: buildMeta(attempt.limit, total, spamFiltered, isLimited, "v1_legacy", spanLabel)
                });
            }

            // 0 results on "last 6 months" → try all time for old wallets
            if (attempt.days >= 180) {
                console.log(`ETH single-address V1: 0 results for ${attempt.label}, trying all time...`);
                const allTimeSince = daysAgoISO(4000);
                const allTimeQuery = buildEthTransfersQuery(50);
                const allTimeResult = await callBitqueryRaw(allTimeQuery, { address, limit: 50, since: allTimeSince }, apiKey, 45000);
                if (allTimeResult.ok) {
                    const atOutRaw = allTimeResult.data?.data?.ethereum?.outbound || [];
                    const atInRaw = allTimeResult.data?.data?.ethereum?.inbound || [];
                    const atOut = filterScamTransfers(atOutRaw, false);
                    const atIn = filterScamTransfers(atInRaw, true);
                    const atTotal = atOut.length + atIn.length;
                    const atSpam = (atOutRaw.length + atInRaw.length) - atTotal;
                    if (atTotal > 0) {
                        const { spanLabel: atSpanLabel } = computeDateSpan([...atOut, ...atIn]);
                        console.log(`ETH single-address V1: found ${atTotal} old transfers (span=${atSpanLabel})`);
                        return res.status(200).json({
                            data: { ethereum: { outbound: atOut, inbound: atIn } },
                            _meta: buildMeta(50, atTotal, atSpam, atOutRaw.length >= 50 || atInRaw.length >= 50, "v1_legacy", atSpanLabel)
                        });
                    }
                }
                // All time also empty or failed
                console.log("ETH single-address V1: all time also empty/failed");
                return res.status(200).json({
                    data: { ethereum: { outbound: [], inbound: [] } },
                    _meta: { dateRange: "all time", totalResults: 0, isLimited: false, resultStatus: "Complete", message: "No transfers found for this address." }
                });
            }

            console.log(`ETH single-address V1: 0 results for ${attempt.label}, returning empty`);
            return res.status(200).json({
                data: { ethereum: { outbound: [], inbound: [] } },
                _meta: { dateRange: attempt.label, totalResults: 0, resultStatus: "Partial" }
            });
        }

        if (result.code === "QUERY_TOO_COMPLEX") {
            console.log(`ETH single-address V1: too complex for ${attempt.label}, narrowing...`);
            continue;
        }

        return res.status(result.status || 500).json({ error: result.error, code: result.code });
    }

    // All V1 + V2 exhausted
    return res.status(200).json({
        data: { ethereum: { outbound: [], inbound: [] } },
        _meta: {
            totalResults: 0,
            isLimited: true,
            resultStatus: "Partial",
            message: "No transfers returned before timeout. Bitquery servers may be busy — retry later or provide a specific receiver address."
        }
    });
}


// ── Solana handler ───────────────────────────────────────────────────
async function handleSolana(req: NextApiRequest, res: NextApiResponse, apiKey: string) {
    const { senderAddress, receiverAddress, depth, fromDate, tillDate } = req.body || {};
    if (!isValidSolanaAddress(senderAddress)) {
        return res.status(400).json({
            error: "Invalid or missing Solana center address."
        });
    }
    const hasReceiver = !!receiverAddress && isValidSolanaAddress(receiverAddress);
    if (receiverAddress && !isValidSolanaAddress(receiverAddress)) {
        return res.status(400).json({
            error: "Invalid Solana final address."
        });
    }
    if (hasReceiver && senderAddress === receiverAddress) {
        return res.status(400).json({
            error: "Sender and receiver must be different."
        });
    }
    let depthValue = 1;
    if (depth !== undefined) {
        const parsedDepth = Number(depth);
        if (isNaN(parsedDepth) || parsedDepth < 1 || parsedDepth > 2) {
            return res.status(400).json({
                error: "Depth must be 1 or 2."
            });
        }
        depthValue = parsedDepth;
    }
    if (!fromDate || !tillDate) {
        return res.status(400).json({
            error: "Date range (fromDate, tillDate) is required for Solana."
        });
    }
    // Server-side: cap date range at 31 days
    const diffDays = getDateDiffDays(fromDate, tillDate);
    if (diffDays > MAX_DATE_RANGE_DAYS) {
        return res.status(400).json({
            error: `Date range too large (${diffDays} days). Maximum allowed is ${MAX_DATE_RANGE_DAYS} days per query.`,
            code: "DATE_RANGE_TOO_LARGE"
        });
    }

    const formattedFrom = `${fromDate}T00:00:00Z`;
    const formattedTill = `${tillDate}T23:59:59Z`;
    const dateLabel = `${fromDate} – ${tillDate}`;

    // ── Single-address mode: fetch all transfers for the address ──
    if (!hasReceiver) {
        const limit = getLimitForDepth(depthValue);
        const query = buildSolanaTransfersQuery();
        const variables = {
            network: "solana",
            address: senderAddress,
            limit,
            from: formattedFrom,
            till: formattedTill
        };
        const result = await callBitqueryRaw(query, variables, apiKey);
        if (!result.ok) {
            return res.status(result.status || 500).json({ error: result.error, code: result.code });
        }
        const outbound = result.data?.data?.solana?.outbound || [];
        const inbound = result.data?.data?.solana?.inbound || [];
        const total = outbound.length + inbound.length;
        return res.status(200).json({
            data: { solana: { outbound, inbound } },
            _meta: {
                depthUsed: depthValue,
                dateRange: dateLabel,
                totalResults: total,
                isLimited: outbound.length >= limit || inbound.length >= limit,
                resultStatus: total === 0 ? "NoResults" : (outbound.length >= limit || inbound.length >= limit ? "Partial" : "Complete"),
                message: total === 0
                    ? `No transfers found for this address (${dateLabel}).`
                    : `Found ${total} transfer(s) for this address (${dateLabel}).`
            }
        });
    }

    // ── Two-address mode ──

    // Helper: fetch direct pair transfers (A→B and B→A)
    const fetchDirectPairSolana = async (limit: number) => {
        const query = `query SolanaDirectPair(
  $network: SolanaNetwork!,
  $sender: String!,
  $receiver: String!,
  $limit: Int!,
  $from: ISO8601DateTime,
  $till: ISO8601DateTime
) {
  solana(network: $network) {
    outbound: transfers(
      senderAddress: {is: $sender}
      receiverAddress: {is: $receiver}
      date: {since: $from, till: $till}
      options: {desc: "amount", limit: $limit}
      amount: {gt: 0}
    ) {
      sender { address }
      receiver { address }
      amount
      currency { symbol name address }
      transaction { signature }
      block { timestamp { time } }
    }
    inbound: transfers(
      senderAddress: {is: $receiver}
      receiverAddress: {is: $sender}
      date: {since: $from, till: $till}
      options: {desc: "amount", limit: $limit}
      amount: {gt: 0}
    ) {
      sender { address }
      receiver { address }
      amount
      currency { symbol name address }
      transaction { signature }
      block { timestamp { time } }
    }
  }
}`;
        const variables = {
            network: "solana",
            sender: senderAddress,
            receiver: receiverAddress,
            limit,
            from: formattedFrom,
            till: formattedTill
        };
        console.log(`SOL direct pair: querying ${dateLabel}, limit=${limit}...`);
        const result = await callBitqueryRaw(query, variables, apiKey, 30000);
        if (!result.ok) {
            console.log(`SOL direct pair: failed (${result.error || result.code})`);
            return { ok: false as const, outbound: [] as any[], inbound: [] as any[], isLimited: false };
        }
        const outbound = result.data?.data?.solana?.outbound || [];
        const inbound = result.data?.data?.solana?.inbound || [];
        console.log(`SOL direct pair: found ${outbound.length} outbound + ${inbound.length} inbound`);
        return {
            ok: true as const,
            outbound,
            inbound,
            isLimited: outbound.length >= limit || inbound.length >= limit
        };
    };

    // Helper: fetch 1-hop intermediaries by intersecting sender outbound and receiver inbound neighborhoods
    const fetchLightHopSolana = async (hopLimit: number) => {
        // Query 1: all outbound transfers from sender
        const senderOutQuery = buildSolanaTransfersQuery();
        const senderOutVars = {
            network: "solana",
            address: senderAddress,
            limit: hopLimit,
            from: formattedFrom,
            till: formattedTill
        };
        console.log(`SOL 1-hop: fetching sender outbound (limit=${hopLimit})...`);
        const senderResult = await callBitqueryRaw(senderOutQuery, senderOutVars, apiKey, 30000);
        if (!senderResult.ok) {
            console.log(`SOL 1-hop: sender side failed (${senderResult.error || senderResult.code})`);
            return { ok: false, outbound: [] as any[], inbound: [] as any[], intermediariesFound: 0, isLimited: false };
        }

        // Query 2: all inbound transfers to receiver
        const receiverInQuery = `query SolanaReceiverInbound(
  $network: SolanaNetwork!,
  $address: String!,
  $limit: Int!,
  $from: ISO8601DateTime,
  $till: ISO8601DateTime
) {
  solana(network: $network) {
    inbound: transfers(
      receiverAddress: {is: $address}
      date: {since: $from, till: $till}
      options: {desc: "amount", limit: $limit}
      amount: {gt: 0}
    ) {
      sender { address }
      receiver { address }
      amount
      currency { symbol name address }
      transaction { signature }
      block { timestamp { time } }
    }
  }
}`;
        const receiverInVars = {
            network: "solana",
            address: receiverAddress,
            limit: hopLimit,
            from: formattedFrom,
            till: formattedTill
        };
        console.log(`SOL 1-hop: fetching receiver inbound (limit=${hopLimit})...`);
        const receiverResult = await callBitqueryRaw(receiverInQuery, receiverInVars, apiKey, 30000);
        if (!receiverResult.ok) {
            console.log(`SOL 1-hop: receiver side failed (${receiverResult.error || receiverResult.code})`);
            return { ok: false, outbound: [] as any[], inbound: [] as any[], intermediariesFound: 0, isLimited: false };
        }

        // Extract sender's outbound receivers and receiver's inbound senders
        const senderOutTransfers = senderResult.data?.data?.solana?.outbound || [];
        const receiverInTransfers = receiverResult.data?.data?.solana?.inbound || [];

        // Build sets of addresses for intersection
        const senderReceivers = new Set<string>(
            senderOutTransfers.map((t: any) => t.receiver?.address).filter(Boolean)
        );
        const receiverSenders = new Set<string>(
            receiverInTransfers.map((t: any) => t.sender?.address).filter(Boolean)
        );

        // Find intermediaries: addresses that sender sent to AND that sent to receiver
        const intermediaries = new Set<string>();
        senderReceivers.forEach(addr => {
            if (receiverSenders.has(addr) && addr !== senderAddress && addr !== receiverAddress) {
                intermediaries.add(addr);
            }
        });

        // Build outbound (sender → intermediary) and inbound (intermediary → receiver) edges
        const outbound: any[] = [];
        const inbound: any[] = [];

        for (const t of senderOutTransfers) {
            const target = t.receiver?.address;
            if (target && intermediaries.has(target)) {
                outbound.push({ ...t, depth: 1 });
            }
        }
        for (const t of receiverInTransfers) {
            const source = t.sender?.address;
            if (source && intermediaries.has(source)) {
                inbound.push({ ...t, depth: 1 });
            }
        }

        console.log(`SOL 1-hop: found ${intermediaries.size} intermediaries from ${senderOutTransfers.length} sender txs + ${receiverInTransfers.length} receiver txs`);
        return {
            ok: true,
            outbound,
            inbound,
            intermediariesFound: intermediaries.size,
            isLimited: senderOutTransfers.length >= hopLimit || receiverInTransfers.length >= hopLimit,
            neighborhoodSearched: {
                sender: senderOutTransfers.length,
                receiver: receiverInTransfers.length
            }
        };
    };

    // Helper: merge two transfer sets, deduplicating by signature
    const mergeSolanaTransferSets = (baseOut: any[], baseIn: any[], extraOut: any[], extraIn: any[]) => {
        const outbound = [...baseOut];
        const inbound = [...baseIn];
        const makeKey = (tx: any) => {
            const sig = tx?.transaction?.signature;
            if (sig) return `sig:${sig}`;
            return `raw:${tx?.sender?.address}:${tx?.receiver?.address}:${tx?.amount}:${tx?.currency?.symbol}`;
        };
        const seen = new Set<string>([
            ...outbound.map(makeKey),
            ...inbound.map(makeKey)
        ]);
        for (const tx of extraOut) {
            const key = makeKey(tx);
            if (!seen.has(key)) { outbound.push(tx); seen.add(key); }
        }
        for (const tx of extraIn) {
            const key = makeKey(tx);
            if (!seen.has(key)) { inbound.push(tx); seen.add(key); }
        }
        return { outbound, inbound };
    };

    // ── Depth 1 (Direct): filtered pair transfers only ──
    if (depthValue === 1) {
        const direct = await fetchDirectPairSolana(100);
        if (!direct.ok) {
            return res.status(500).json({
                error: "Failed to fetch direct transfers from Bitquery.",
                code: "API_ERROR"
            });
        }
        const total = direct.outbound.length + direct.inbound.length;
        if (total === 0) {
            return res.status(200).json({
                data: { solana: { outbound: [], inbound: [] } },
                _meta: {
                    depthUsed: 1,
                    dateRange: dateLabel,
                    totalResults: 0,
                    isLimited: false,
                    resultStatus: "NoResults",
                    message: `No direct transfers found between these addresses (${dateLabel}).`
                }
            });
        }
        return res.status(200).json({
            data: { solana: { outbound: direct.outbound, inbound: direct.inbound } },
            _meta: {
                depthUsed: 1,
                dateRange: dateLabel,
                totalResults: total,
                directTransfers: total,
                isLimited: direct.isLimited,
                resultStatus: direct.isLimited ? "Partial" : "Complete",
                message: direct.isLimited
                    ? `Showing top transfers per direction (${dateLabel}).`
                    : `Found ${total} direct transfer(s) between these addresses (${dateLabel}).`
            }
        });
    }

    // ── Depth 2 (1-Hop): direct baseline + intermediary search ──
    console.log(`SOL depth=2: running direct baseline + 1-hop search...`);
    const directBaseline = await fetchDirectPairSolana(100);
    let outbound = directBaseline.ok ? directBaseline.outbound : [];
    let inbound = directBaseline.ok ? directBaseline.inbound : [];

    const lightHop = await fetchLightHopSolana(200);
    if (lightHop.ok) {
        const merged = mergeSolanaTransferSets(outbound, inbound, lightHop.outbound, lightHop.inbound);
        outbound = merged.outbound;
        inbound = merged.inbound;
    }

    const total = outbound.length + inbound.length;
    const directCount = outbound.filter((t: any) => !t.depth || t.depth === 0).length
        + inbound.filter((t: any) => !t.depth || t.depth === 0).length;

    if (total === 0) {
        return res.status(200).json({
            data: { solana: { outbound: [], inbound: [] } },
            _meta: {
                depthUsed: 2,
                dateRange: dateLabel,
                totalResults: 0,
                isLimited: false,
                resultStatus: "NoResults",
                message: `No connection found between these addresses — no direct transfers and no shared 1-hop intermediaries detected (${dateLabel}).`
            }
        });
    }

    const isPartial = (directBaseline.ok && directBaseline.isLimited) || lightHop.isLimited;
    const messageParts: string[] = [];
    if (lightHop.ok && lightHop.intermediariesFound > 0) {
        messageParts.push(`Found ${lightHop.intermediariesFound} shared intermediary(ies) via 1-hop search (${dateLabel}).`);
    } else {
        messageParts.push(`No intermediate addresses found via 1-hop search (${dateLabel}).`);
    }
    if (directCount > 0) {
        messageParts.push(`Found ${directCount} direct transfer(s) between the addresses.`);
    }
    if (isPartial) {
        messageParts.push(`Results may be partial due to query limits.`);
    }

    return res.status(200).json({
        data: { solana: { outbound, inbound } },
        _meta: {
            depthUsed: 2,
            source: "v1_transfers",
            dateRange: dateLabel,
            totalResults: total,
            directTransfers: directCount,
            intermediariesFound: lightHop.ok ? lightHop.intermediariesFound : 0,
            isLimited: isPartial,
            resultStatus: isPartial ? "Partial" : "Complete",
            message: messageParts.join(" ")
        }
    });
}

// ── Shared Bitquery caller (returns response to client) ─────────────
async function callBitquery(query: string, variables: Record<string, any>, apiKey: string, res: NextApiResponse) {
    const result = await callBitqueryRaw(query, variables, apiKey);
    if (result.ok) {
        return res.status(200).json(result.data);
    }
    return res.status(result.status || 500).json({
        error: result.error,
        code: result.code
    });
}

// ── Raw Bitquery caller (returns result object, doesn't write to res) ─
// Global queue to enforce 1 simultaneous Bitquery request server-wide
let bitqueryQueue: Promise<void> = Promise.resolve();

// Wrapper to automatically handle the SIMULTANEOUS_REQUEST error globally across all Bitquery queries
async function callBitqueryRaw(query: string, variables: Record<string, any>, apiKey: string, timeoutMs: number = 60000): Promise<{ ok: boolean; data?: any; error?: string; code?: string; status?: number }> {
    // Wait for any previous Bitquery request to finish completely
    let releaseLock!: () => void;
    const nextInQueue = new Promise<void>((resolve) => {
        releaseLock = resolve;
    });

    const myTurn = bitqueryQueue;
    bitqueryQueue = myTurn.then(() => nextInQueue);

    await myTurn;

    try {
        let result;
        for (let retry = 0; retry < 3; retry++) {
            result = await _callBitqueryRawInternal(query, variables, apiKey, timeoutMs);
            if (result.code !== "SIMULTANEOUS_REQUEST") break;
            
            console.log(`Bitquery: simultaneous request concurrency detected, waiting ${10000 * (retry + 1)}ms before retry ${retry + 1}/3...`);
            await sleep(10000 * (retry + 1));
        }

        if (result?.code === "SIMULTANEOUS_REQUEST") {
            return {
                ok: false,
                error: "Bitquery servers are currently busy processing a previous complex request. Please wait 1 minute before searching again.",
                code: "QUERY_TOO_COMPLEX",
                status: 504
            };
        }

        return result || { ok: false, error: "Unknown execution error" };
    } finally {
        // Release the lock for the next API call, adding a 500ms breather for Bitquery cache clearing
        setTimeout(() => releaseLock(), 500);
    }
}

// ── Raw Bitquery V2 caller (streaming.bitquery.io) with same queue ──
async function callBitqueryV2Raw(query: string, apiKey: string, timeoutMs: number = 20000, label: string = "V2 query", variables?: Record<string, any>): Promise<{ ok: boolean; data?: any; error?: string; code?: string; status?: number }> {
    let releaseLock!: () => void;
    const nextInQueue = new Promise<void>((resolve)=>{
        releaseLock = resolve;
    });
    const myTurn = bitqueryQueue;
    bitqueryQueue = myTurn.then(()=>nextInQueue);
    await myTurn;
    try {
        let result;
        for(let retry = 0; retry < 3; retry++){
            result = await _callBitqueryV2RawInternal(query, apiKey, timeoutMs, label, variables);
            if (result.code !== "SIMULTANEOUS_REQUEST") break;
            const waitMs = 10000 * (retry + 1);
            console.log(`Bitquery V2: simultaneous request detected (${label}), waiting ${waitMs}ms before retry ${retry + 1}/3...`);
            await sleep(waitMs);
        }
        if (result?.code === "SIMULTANEOUS_REQUEST") {
            return {
                ok: false,
                error: "Bitquery V2 is still processing previous requests. Please wait and try again.",
                code: "QUERY_TOO_COMPLEX",
                status: 504
            };
        }
        return result || {
            ok: false,
            error: "Unknown V2 execution error"
        };
    } finally{
        setTimeout(()=>releaseLock(), 500);
    }
}

async function _callBitqueryV2RawInternal(query: string, apiKey: string, timeoutMs: number, label: string, variables?: Record<string, any>): Promise<{ ok: boolean; data?: any; error?: string; code?: string; status?: number }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(()=>controller.abort(), timeoutMs);
    try {
        const response = await fetch("https://streaming.bitquery.io/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                query,
                variables
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            const errorText = await response.text();
            const lowered = errorText.toLowerCase();
            console.error(`Bitquery V2 HTTP error (${label}):`, response.status, errorText);
            if (lowered.includes("simultaneous")) {
                return {
                    ok: false,
                    error: "Too many simultaneous queries.",
                    code: "SIMULTANEOUS_REQUEST",
                    status: 429
                };
            }
            if (lowered.includes("timeout") || lowered.includes("estimated query execution time") || lowered.includes("tcp socket")) {
                return {
                    ok: false,
                    error: "Query too complex for this date range. Try a shorter period or lower depth.",
                    code: "QUERY_TOO_COMPLEX",
                    status: 504
                };
            }
            return {
                ok: false,
                error: `Bitquery V2 HTTP error: ${response.status}`,
                status: response.status
            };
        }
        const data = await response.json();
        if (data.errors?.some((e: any)=>e.message?.toLowerCase()?.includes("simultaneous"))) {
            return {
                ok: false,
                error: "Too many simultaneous queries.",
                code: "SIMULTANEOUS_REQUEST",
                status: 429
            };
        }
        if (data.errors?.some((e: any)=>e.message?.toLowerCase()?.includes("timeout") || e.message?.toLowerCase()?.includes("estimated query execution time") || e.message?.toLowerCase()?.includes("tcp socket"))) {
            return {
                ok: false,
                error: "Query too complex for this date range. Try a shorter period or lower depth.",
                code: "QUERY_TOO_COMPLEX",
                status: 504
            };
        }
        if (data.errors && data.errors.length > 0 && !data.data) {
            return {
                ok: false,
                error: data.errors[0]?.message || "GraphQL query returned errors.",
                code: "GRAPHQL_ERROR",
                status: 400
            };
        }
        return {
            ok: true,
            data
        };
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
            console.error(`Bitquery V2 timed out after ${timeoutMs}ms (${label})`);
            return {
                ok: false,
                error: `Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`,
                code: "QUERY_TOO_COMPLEX",
                status: 504
            };
        }
        console.error("Bitquery V2 API error:", error);
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            status: 500
        };
    }
}

async function _callBitqueryRawInternal(query: string, variables: Record<string, any>, apiKey: string, timeoutMs: number = 60000): Promise<{ ok: boolean; data?: any; error?: string; code?: string; status?: number }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(()=>controller.abort(), timeoutMs);
    try {
        const response = await fetch("https://graphql.bitquery.io/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                query,
                variables
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Bitquery API error:", response.status, errorText);
            if (errorText.includes("Estimated query execution time") || errorText.includes("ReadTimeout") || errorText.includes("timeout")) {
                return {
                    ok: false,
                    error: "Query too complex for this date range. Try a shorter period or reduce depth to 1.",
                    code: "QUERY_TOO_COMPLEX",
                    status: 504
                };
            }
            return {
                ok: false,
                error: `Bitquery API error: ${response.status} ${response.statusText}`,
                status: response.status
            };
        }
        const data = await response.json();
        // Check for "simultaneous requests" error from Bitquery free tier
        if (data.errors?.some((e: any)=>e.message?.includes("simultaneous") || e.message?.includes("Simultaneous"))) {
            console.log("Bitquery: simultaneous request error detected");
            return {
                ok: false,
                error: "Bitquery is still processing a previous request. Retrying...",
                code: "SIMULTANEOUS_REQUEST",
                status: 429
            };
        }
        if (data.errors?.some((e: any)=>e.message?.includes("Timeout") || e.message?.includes("timeout") || e.message?.includes("Estimated query execution time"))) {
            return {
                ok: false,
                error: "Query too complex for this date range. Try a shorter period or reduce depth to 1.",
                code: "QUERY_TOO_COMPLEX",
                status: 504
            };
        }
        // If there are other errors but also data, still return ok (partial results)
        if (data.errors && data.errors.length > 0 && !data.data) {
            return {
                ok: false,
                error: data.errors[0]?.message || "GraphQL query returned errors.",
                code: "GRAPHQL_ERROR",
                status: 400
            };
        }
        return {
            ok: true,
            data
        };
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
            console.error("Bitquery request timed out after", timeoutMs, "ms");
            return {
                ok: false,
                error: `Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`,
                code: "QUERY_TOO_COMPLEX",
                status: 504
            };
        }
        console.error("API error:", error);
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            status: 500
        };
    }
}
