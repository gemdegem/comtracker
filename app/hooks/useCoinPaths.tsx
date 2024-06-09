import { useState } from "react";

interface CoinPathsVariables {
  firstAddress: string;
  secondAddress: string;
}

interface QueryVariables {
  query: string;
  variables: CoinPathsVariables;
}

interface Transaction {
  sender: string;
  receiver: string;
  amount: string;
  currency: string;
  depth: number;
  count: number;
  txHash: string;
}

export default function useCoinPaths() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCoinPaths = async (variables: QueryVariables): Promise<Transaction[]> => {
    setLoading(true);
    console.log("Sending request with variables:", variables);
    try {
      const response = await fetch("https://graphql.bitquery.io/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": process.env.BITQUERY_API_KEY as string,
        },
        body: JSON.stringify(variables),
      });
      console.log("Response received:", response);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const result = await response.json();
      console.log("Data received:", result);

      // Format the response data
      const formattedData = result.data.ethereum.outbound.map((tx: any) => {
        let formattedAmount;
        if (tx.currency.symbol === "ETH" || tx.currency.symbol === "BTC") {
          formattedAmount = tx.amount.toFixed(1);
        } else {
          formattedAmount = tx.amount.toFixed(0);
        }

        return {
          sender: tx.sender.address,
          receiver: tx.receiver.address,
          amount: formattedAmount,
          currency: tx.currency.symbol,
          depth: tx.depth,
          count: tx.count,
          txHash: tx.transactions[0].txHash,
        };
      });

      setData(formattedData);
      setLoading(false);
      return formattedData;
    } catch (error) {
      console.error("Fetch error:", error);
      setError(error as Error);
      setLoading(false);
      return [];
    }
  };

  return {
    fetchCoinPaths,
    data,
    loading,
    error,
  };
}
