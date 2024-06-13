import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { format, formatDistanceToNow, parseISO } from "date-fns";

interface SearchResultsTableProps {
  searchData: any;
}

const formatTime = (time: string, relative: boolean) => {
  const date = parseISO(time);
  if (relative) {
    return formatDistanceToNow(date, { addSuffix: true });
  } else {
    return format(date, "yyyy-MM-dd HH:mm");
  }
};

export default function SearchResultsTable({ searchData }: SearchResultsTableProps) {
  const [relativeTime, setRelativeTime] = React.useState<boolean>(false);

  const handleTimeClick = () => {
    setRelativeTime(!relativeTime);
  };

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
                <TableCell onClick={handleTimeClick} style={{ cursor: "pointer" }}>
                  {formatTime(tx.txTime, relativeTime)}
                </TableCell>
                <TableCell>{tx.depth}</TableCell>
                <TableCell>
                  <a href={`https://etherscan.io/address/${tx.sender}`} target="_blank" rel="noopener noreferrer">
                    {tx.sender.slice(0, 6)}...{tx.sender.slice(-4)}
                  </a>
                </TableCell>
                <TableCell>
                  <a href={`https://etherscan.io/address/${tx.receiver}`} target="_blank" rel="noopener noreferrer">
                    {tx.receiver.slice(0, 6)}...{tx.receiver.slice(-4)}
                  </a>
                </TableCell>
                <TableCell>{tx.amount}</TableCell>
                <TableCell>{tx.currency}</TableCell>
                <TableCell>
                  <a href={`https://etherscan.io/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer">
                    {tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}
                  </a>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
