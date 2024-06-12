export const query = `
query MyQuery($senderAddress: String!, $receiverAddress: String!) {
  ethereum(network: ethereum) {
    inbound: coinpath(
      initialAddress: { is: $senderAddress }
      sender: { is: $receiverAddress }
      currency: {}
      depth: { lteq: 2 }
      options: { direction: inbound, asc: "depth", desc: "amount", limitBy: { each: "depth", limit: 10 } }
      date: { since: null, till: null }
    ) {
      sender {
        address
        annotation
        smartContract {
          contractType
          currency {
            symbol
            name
          }
        }
        receiversCount
        sendersCount
      }
      receiver {
        address
        annotation
        smartContract {
          contractType
          currency {
            symbol
            name
          }
        }
        receiversCount
        sendersCount
      }
      amount
      currency {
        symbol
      }
      depth
      count
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
      currency: {}
      depth: { lteq: 2 }
      options: { asc: "depth", desc: "amount", limitBy: { each: "depth", limit: 10 } }
      date: { since: null, till: null }
    ) {
      sender {
        address
        annotation
        smartContract {
          contractType
          currency {
            symbol
            name
          }
        }
        receiversCount
        sendersCount
      }
      receiver {
        address
        annotation
        smartContract {
          contractType
          currency {
            symbol
            name
          }
        }
        receiversCount
        sendersCount
      }
      amount
      currency {
        symbol
      }
      depth
      count
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
