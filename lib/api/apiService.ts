// lib/api/apiService.ts

export interface CoinPathsVariablesInterface {
  firstAddress: string;
  secondAddress: string;
}

export const query = `
query MyQuery($firstAddress: String!, $secondAddress: String!) {
  ethereum(network: ethereum) {
    inbound: coinpath(
      initialAddress: {is: $firstAddress}
      sender: {is: $secondAddress}
      currency: {}
      depth: {lteq: 1}
      options: {direction: inbound, asc: "depth", desc: "amount", limitBy: {each: "depth", limit: 10}}
      date: {since: null, till: null}
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
    }
    outbound: coinpath(
      initialAddress: {is: $firstAddress}
      receiver: {is: $secondAddress}
      currency: {}
      depth: {lteq: 2}
      options: {asc: "depth", desc: "amount", limitBy: {each: "depth", limit: 10}}
      date: {since: null, till: null}
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
    }
  }
}
`;

export const coinPathsVariables: CoinPathsVariablesInterface = {
  firstAddress: "0xc7F67B5516cF5C841cB58a4a8a95c5353e75B117",
  secondAddress: "0x750F5a02F88B57cAdd982D6893DD29C4Af4162Fc",
};
