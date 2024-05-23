import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

const client = new ApolloClient({
  ssrMode: typeof window === "undefined",
  link: new HttpLink({
    uri: "https://graphql.bitquery.io/",
    headers: {
      "X-API-KEY": process.env.BITQUERY_API_KEY as string, //V1 api key
    },
  }),
  cache: new InMemoryCache(),
});

export default client;
