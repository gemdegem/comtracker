// api/PathApi.ts

const GET_COIN_PATHS_QUERY = `
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

export const getCoinPaths = async (variables: { network: string; address: string; inboundDepth: number; outboundDepth: number; limit: number; currency: string; from: string | null; till: string | null }) => {
  const url = "https://graphql.bitquery.io/";
  const opts = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": process.env.BITQUERY_API_KEY as string, //V1 api key
    },
    body: JSON.stringify({
      query: GET_COIN_PATHS_QUERY,
      variables,
    }),
  };

  try {
    const response = await fetch(url, opts);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching data from GraphQL API: ", error);
    throw error;
  }
};

export const testCoinPaths = async () => {
  const variables = {
    network: "ethereum",
    address: "0x26835Ef626C41605E26e7C65dD34720E170222c4",
    inboundDepth: 1,
    outboundDepth: 1,
    limit: 10,
    currency: "ETH",
    from: "2022-01-01",
    till: "2024-05-12",
  };

  try {
    const data = await getCoinPaths(variables);
    console.log("Test CoinPaths Data:", data);
    return data;
  } catch (error) {
    console.error("Test CoinPaths Error:", error);
    throw error;
  }
};
