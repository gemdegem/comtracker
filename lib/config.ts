// Plik konfiguracyjny dla zmiennych, które powinny być dostępne po stronie klienta
const config = {
  // Bitquery API key - używana po stronie klienta
  // UWAGA: Nie przechowuj kluczy API w kodzie źródłowym!
  // Ten klucz powinien być dostarczony przez zmienne środowiskowe
  bitqueryApiKey: process.env.NEXT_PUBLIC_BITQUERY_API_KEY || '',
};

export default config;
