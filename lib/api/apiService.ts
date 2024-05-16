// services/apiService.ts

export const query = `
query GetCoinPaths($network: EthereumNetwork!, $address: String!, $inboundDepth: Int!, $outboundDepth: Int!, $limit: Int!, $currency: String!, $from: ISO8601DateTime, $till: ISO8601DateTime) {
    ethereum(network: $network) {
      inbound: coinpath(
        initialAddress: {is: $address}
        currency: {is: $currency}
        depth: {lteq: $inboundDepth}
        options: {direction: inbound, asc: "depth", desc: "amount", limitBy: {each: "depth", limit: $limit}}
        date: {since: $from, till: $till}
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
      }
      outbound: coinpath(
        initialAddress: {is: $address}
        currency: {is: $currency}
        depth: {lteq: $outboundDepth}
        options: {asc: "depth", desc: "amount", limitBy: {each: "depth", limit: $limit}}
        date: {since: $from, till: $till}
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
      }
    }
  }
`;

export const coinPathsVariables = {
  network: "ethereum",
  address: "0x26835Ef626C41605E26e7C65dD34720E170222c4",
  inboundDepth: 1,
  outboundDepth: 1,
  limit: 10,
  currency: "ETH",
  from: "2022-01-01",
  till: "2024-05-12",
};
