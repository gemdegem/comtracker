// lib/api/apiService.ts

export interface CoinPathsVariablesInterface {
  network: string;
  initialAddress: string;
  receiverAddress: string;
  inboundDepth: number;
  outboundDepth: number;
  limit: number;
  currency: string;
  from: string | null;
  till: string | null;
}

export const query = `
query MyQuery($network: EthereumNetwork!, $initialAddress: String!, $receiverAddress: String!, $inboundDepth: Int!, $outboundDepth: Int!, $limit: Int!, $currency: String!, $from: ISO8601DateTime, $till: ISO8601DateTime) {
  ethereum(network: $network) {
    inbound: coinpath(
      initialAddress: {is: $initialAddress}
      depth: {lteq: $inboundDepth}
      options: {direction: inbound, asc: "depth", desc: "amount", limitBy: {each: "depth", limit: $limit}}
      date: {since: $from, till: $till}
    ) {
      sender {
        address
        annotation
        smartContract {
          contractType
          currency {
            symbol
            name
          }
        }
      }
      receiver {
        address
        annotation
        smartContract {
          contractType
          currency {
            symbol
            name
          }
        }
      }
      amount
      currency {
        symbol
      }
      depth
      count
    }
    outbound: coinpath(
      initialAddress: {is: $initialAddress}
      receiver: {is: $receiverAddress}
      currency: {is: $currency}
      depth: {lteq: $outboundDepth}
      options: {asc: "depth", desc: "amount", limitBy: {each: "depth", limit: $limit}}
      date: {since: $from, till: $till}
    ) {
      sender {
        address
        annotation
        smartContract {
          contractType
          currency {
            symbol
            name
          }
        }
      }
      receiver {
        address
        annotation
        smartContract {
          contractType
          currency {
            symbol
            name
          }
        }
      }
      amount
      currency {
        symbol
      }
      depth
      count
    }
  }
}
`;

export const coinPathsVariables: CoinPathsVariablesInterface = {
  network: "ethereum",
  initialAddress: "0xCd48E64df29Ac1972D609020d7619028f071B108",
  receiverAddress: "0xb7238bBb01F2f83631355259b8c24e329A7d0ebb",
  inboundDepth: 1,
  outboundDepth: 1,
  limit: 20,
  currency: "ETH",
  from: "2015-09-01T23:59:59",
  till: "2024-04-30T11:59:59",
};
