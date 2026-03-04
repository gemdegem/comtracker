// Dynamic limit based on depth: depth 1 = 20 results, depth 2 = 10 results
export function buildQuery(limit: number = 10): string {
  return `
query MyQuery($senderAddress: String!, $receiverAddress: String!, $depth: Int!) {
  ethereum(network: ethereum) {
    inbound: coinpath(
      initialAddress: { is: $senderAddress }
      sender: { is: $receiverAddress }
      depth: { lteq: $depth }
      options: { limit: ${limit} }
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
      }
      depth
      count
      transactions {
        txHash
      }
      transaction {
        time {
          time
        }
      }
    }
    outbound: coinpath(
      initialAddress: { is: $senderAddress }
      receiver: { is: $receiverAddress }
      depth: { lteq: $depth }
      options: { limit: ${limit} }
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
      }
      depth
      count
      transactions {
        txHash
      }
      transaction {
        time {
          time
        }
      }
    }
  }
}
`;
}

// Determine the best limit for a given depth
export function getLimitForDepth(depth: number): number {
  return depth <= 1 ? 20 : 10;
}

// ── Token Overlap Queries ──────────────────────────────────────────────

export function buildTokenReceiversEthQuery(limit: number = 500): string {
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

export function buildTokenReceiversSolQuery(limit: number = 500): string {
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
