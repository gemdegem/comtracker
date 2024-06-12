interface SearchResultsTableProps {
  searchData: any;
}

export default function SearchResultsTable({ searchData }: SearchResultsTableProps) {
  return (
    <div className="p-5">
      {searchData &&
        searchData.map((tx: any, index: number) => (
          <div key={index}>
            <p>Time: {tx.txTime}</p>
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
  );
}
