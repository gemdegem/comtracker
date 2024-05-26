import React from "react";
import useCoinPaths from "@/app/hooks/useCoinPaths";
import { query, coinPathsVariables } from "../lib/api/apiService";

const ButtonFetch: React.FC = () => {
  const { fetchCoinPaths, data, loading, error } = useCoinPaths();

  const handleClick = () => {
    fetchCoinPaths({
      query: query,
      variables: coinPathsVariables,
    });
  };

  return (
    <div>
      <button onClick={handleClick} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        {loading ? "Loading..." : "Check"}
      </button>
      {data && (
        <div>
          Data Loaded: <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
      {error && <div style={{ color: "red" }}>Error: {error.message}</div>}
    </div>
  );
};

export default ButtonFetch;
