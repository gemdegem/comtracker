import React from "react";
import useCoinPaths from "@/app/hooks/useCoinPaths";
import { query, coinPathsVariables } from "@/lib/api/apiService";

interface ButtonFetchProps {
  onClick: () => void;
  loading: boolean;
}

const ButtonFetch: React.FC<ButtonFetchProps> = ({ onClick, loading }) => {
  return (
    <div>
      <button onClick={onClick} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        {loading ? "Loading..." : "Check"}
      </button>
    </div>
  );
};

export default ButtonFetch;
