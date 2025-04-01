import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

// Używamy naszego własnego API proxy zamiast bezpośredniego dostępu do Bitquery
const client = new ApolloClient({
  ssrMode: typeof window === 'undefined',
  link: new HttpLink({
    uri: '/api/bitquery', // Używamy endpointu API proxy
    headers: {
      'Content-Type': 'application/json',
    },
  }),
  cache: new InMemoryCache(),
});

export default client;
