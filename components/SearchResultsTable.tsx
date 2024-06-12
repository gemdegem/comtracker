import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

interface SearchResultsTableProps {
  searchData: any;
}

const truncateAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatTime = (time: string) => {
  const date = new Date(time);
  return date.toISOString().split("T")[0];
};

export default function SearchResultsTable({ searchData }: SearchResultsTableProps) {
  return (
    <div className="p-5">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Depth</TableHead>
            <TableHead>Sender</TableHead>
            <TableHead>Receiver</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead>Transaction Hash</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {searchData &&
            searchData.map((tx: any, index: number) => (
              <TableRow key={index}>
                <TableCell>{formatTime(tx.txTime)}</TableCell>
                <TableCell>{tx.depth}</TableCell>
                <TableCell>
                  <a href={`https://etherscan.io/address/${tx.sender}`} target="_blank" rel="noopener noreferrer">
                    {truncateAddress(tx.sender)}
                  </a>
                </TableCell>
                <TableCell>
                  <a href={`https://etherscan.io/address/${tx.receiver}`} target="_blank" rel="noopener noreferrer">
                    {truncateAddress(tx.receiver)}
                  </a>
                </TableCell>
                <TableCell>{tx.amount}</TableCell>
                <TableCell>{tx.currency}</TableCell>
                <TableCell>
                  <a href={`https://etherscan.io/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer">
                    {truncateAddress(tx.txHash)}
                  </a>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
