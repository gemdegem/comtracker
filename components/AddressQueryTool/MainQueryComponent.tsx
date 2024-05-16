import React, { useState } from "react";
import AddressInput from "./AddressInput";
import ButtonFetch from "./ButtonFetch";
import useCoinPaths from "@/app/hooks/useCoinPaths";
import { query, coinPathsVariables, CoinPathsVariablesInterface } from "@/lib/api/apiService";

const MainComponent: React.FC = () => {
  const [initialAddress, setInitialAddress] = useState(coinPathsVariables.initialAddress);
  const [receiverAddress, setReceiverAddress] = useState(coinPathsVariables.receiverAddress);
  const { fetchCoinPaths, data, loading, error } = useCoinPaths();

  const handleCheckConnections = () => {
    const variables: CoinPathsVariablesInterface = {
      network: coinPathsVariables.network,
      initialAddress,
      receiverAddress,
      inboundDepth: coinPathsVariables.inboundDepth,
      outboundDepth: coinPathsVariables.outboundDepth,
      limit: coinPathsVariables.limit,
      currency: coinPathsVariables.currency,
      from: coinPathsVariables.from,
      till: coinPathsVariables.till,
    };
    fetchCoinPaths({ query, variables });
  };

  const handleAddressesChange = (initialAddress: string, receiverAddress: string) => {
    setInitialAddress(initialAddress);
    setReceiverAddress(receiverAddress);
  };

  return (
    <div className="p-4">
      <AddressInput defaultInitialAddress={initialAddress} defaultReceiverAddress={receiverAddress} onAddressesChange={handleAddressesChange} />
      <ButtonFetch onClick={handleCheckConnections} loading={loading} />
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
      {error && <div style={{ color: "red" }}>Error: {error.message}</div>}
    </div>
  );
};

export default MainComponent;
