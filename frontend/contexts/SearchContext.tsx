/**
 * SearchContext — shared search query state between the navbar and home screen.
 *
 * Lifting search state here means:
 * - The navbar input and the home screen filter always share the same value.
 * - Clearing search from a category chip immediately updates both without
 *   relying on URL param round-trips or debounce races.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface SearchContextValue {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  clearSearch: () => void;
}

const SearchContext = createContext<SearchContextValue>({
  searchQuery: '',
  setSearchQuery: () => {},
  clearSearch: () => {},
});

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQueryState] = useState('');

  const setSearchQuery = useCallback((q: string) => {
    setSearchQueryState(q);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQueryState('');
  }, []);

  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery, clearSearch }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  return useContext(SearchContext);
}
