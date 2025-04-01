import { SearchObject } from '@/lib/types';
import { useState } from 'react';
import { toast } from 'sonner';
import config from '@/lib/config';

interface QueryVariables {
  query: string;
  variables: SearchObject;
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

    try {
      const response = await fetch('/api/bitquery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(variables),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Error - ${response.status} - ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();

      // Przetwarzanie danych outbound
      let formattedData = [];

      if (result.data && result.data.ethereum && result.data.ethereum.outbound) {
        formattedData = result.data.ethereum.outbound.map((tx: any) => {
          let formattedAmount;
          if (tx.currency.symbol === 'ETH' || tx.currency.symbol === 'BTC') {
            formattedAmount = tx.amount.toFixed(2);
          } else {
            formattedAmount = tx.amount.toFixed(0);
          }

          return {
            sender: tx.sender.address,
            receiver: tx.receiver.address,
            amount: formattedAmount,
            currency: tx.currency.symbol,
            depth: 1, // Stała wartość, bo mamy lteq: 1
            count: 1, // Stała wartość
            txHash: tx.transactions[0]?.txHash || 'Unknown',
            txTime: tx.transaction?.time?.time || new Date().toISOString(),
          };
        });
      }

      // Dodajemy także dane inbound, jeśli istnieją
      if (result.data && result.data.ethereum && result.data.ethereum.inbound) {
        const inboundData = result.data.ethereum.inbound.map((tx: any) => {
          let formattedAmount;
          if (tx.currency.symbol === 'ETH' || tx.currency.symbol === 'BTC') {
            formattedAmount = tx.amount.toFixed(2);
          } else {
            formattedAmount = tx.amount.toFixed(0);
          }

          return {
            sender: tx.sender.address,
            receiver: tx.receiver.address,
            amount: formattedAmount,
            currency: tx.currency.symbol,
            depth: 1, // Stała wartość, bo mamy lteq: 1
            count: 1, // Stała wartość
            txHash: tx.transactions[0]?.txHash || 'Unknown',
            txTime: tx.transaction?.time?.time || new Date().toISOString(),
          };
        });

        // Łączymy dane outbound i inbound
        formattedData = [...formattedData, ...inboundData];
      }

      setData(formattedData);
      setLoading(false);

      return formattedData;
    } catch (error: any) {
      console.error('Fetch error:', error);
      toast.error(error.message);

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
