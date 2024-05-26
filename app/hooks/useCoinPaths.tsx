// hooks/useCoinPaths.ts

import { useState } from "react";

interface CoinPathsVariables {
  network: string;
  address: string;
  inboundDepth: number;
  outboundDepth: number;
  limit: number;
  currency: string;
  from: string;
  till: string;
}

interface QueryVariables {
  query: string;
  variables: CoinPathsVariables;
}

export default function useCoinPaths() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCoinPaths = async (variables: QueryVariables) => {
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
      setData(result);
      setLoading(false);
    } catch (error) {
      console.error("Fetch error:", error);
      setError(error as Error);
      setLoading(false);
    }
  };

  return {
    fetchCoinPaths,
    data,
    loading,
    error,
  };
}
