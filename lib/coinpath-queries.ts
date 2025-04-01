export const query = `
query MyQuery($senderAddress: String!, $receiverAddress: String!) {
  ethereum(network: ethereum) {
    inbound: coinpath(
      initialAddress: { is: $senderAddress }
      sender: { is: $receiverAddress }
      depth: { lteq: 1 }
      options: { limit: 5 }
    ) {
      sender {
        address
      }
      receiver {
        address
      }
      amount
      currency {
        symbol
      }
      transactions {
        txHash
      }
      transaction {
        time {
          time
        }
      }
    }
    outbound: coinpath(
      initialAddress: { is: $senderAddress }
      receiver: { is: $receiverAddress }
      depth: { lteq: 1 }
      options: { limit: 5 }
    ) {
      sender {
        address
      }
      receiver {
        address
      }
      amount
      currency {
        symbol
      }
      transactions {
        txHash
      }
      transaction {
        time {
          time
        }
      }
    }
  }
}
`;
