import React, { useState } from "react";
import AddressInput from "./AddressInput";
import ButtonFetch from "./ButtonFetch";
import useCoinPaths from "@/app/hooks/useCoinPaths";
import { query, coinPathsVariables } from "@/lib/api/apiService";

interface MainComponentProps {
  setData: React.Dispatch<React.SetStateAction<any[]>>;
}

const MainComponent: React.FC<MainComponentProps> = ({ setData }) => {
  const [initialAddress, setInitialAddress] = useState(coinPathsVariables.firstAddress);
  const [receiverAddress, setReceiverAddress] = useState(coinPathsVariables.secondAddress);
  const { fetchCoinPaths, data, loading, error } = useCoinPaths();

  const handleCheckConnections = () => {
    const variables = {
      firstAddress: initialAddress,
      secondAddress: receiverAddress,
    };
    fetchCoinPaths({ query, variables }).then((responseData) => {
      setData(responseData);
    });
  };

  const handleAddressesChange = (initialAddress: string, receiverAddress: string) => {
    setInitialAddress(initialAddress);
    setReceiverAddress(receiverAddress);
  };

  return (
    <div className="p-4">
      <AddressInput defaultInitialAddress={initialAddress} defaultReceiverAddress={receiverAddress} onAddressesChange={handleAddressesChange} />
      <ButtonFetch onClick={handleCheckConnections} loading={loading} />
      {data && (
        <div>
          {data.map((tx: any, index: number) => (
            <div key={index}>
              <p>Sender: {tx.sender}</p>
              <p>Receiver: {tx.receiver}</p>
              <p>Amount: {tx.amount}</p>
              <p>Currency: {tx.currency}</p>
              <p>Depth: {tx.depth}</p>
              <p>Count: {tx.count}</p>
              <p>Transaction Hash: {tx.txHash}</p>
              <hr />
            </div>
          ))}
        </div>
      )}
      {error && <div style={{ color: "red" }}>Error: {error.message}</div>}
    </div>
  );
};

export default MainComponent;
