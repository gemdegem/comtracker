import React, { useState, useEffect } from "react";

interface AddressInputProps {
  defaultInitialAddress: string;
  defaultReceiverAddress: string;
  onAddressesChange: (initialAddress: string, receiverAddress: string) => void;
}

const AddressInput: React.FC<AddressInputProps> = ({ defaultInitialAddress, defaultReceiverAddress, onAddressesChange }) => {
  const [initialAddress, setInitialAddress] = useState(defaultInitialAddress);
  const [receiverAddress, setReceiverAddress] = useState(defaultReceiverAddress);

  useEffect(() => {
    onAddressesChange(initialAddress, receiverAddress);
  }, [initialAddress, receiverAddress, onAddressesChange]);

  const handleInitialAddressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInitialAddress(event.target.value);
  };

  const handleReceiverAddressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setReceiverAddress(event.target.value);
  };

  return (
    <div className="mb-4">
      <label htmlFor="initial-address" className="block text-sm font-medium text-gray-700">
        Initial Ethereum Address
      </label>
      <input type="text" id="initial-address" value={initialAddress} onChange={handleInitialAddressChange} placeholder="0xa09871aeadf4994ca12f5c0b6056bbd1d343c029" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black" />
      <label htmlFor="receiver-address" className="block text-sm font-medium text-gray-700">
        Receiver Ethereum Address
      </label>
      <input type="text" id="receiver-address" value={receiverAddress} onChange={handleReceiverAddressChange} placeholder="0xb3a9b79f4d5dc2cdcdc00da22869502cbf65a0a5" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black" />
    </div>
  );
};

export default AddressInput;
