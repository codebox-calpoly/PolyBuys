import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@polybuys/recentSearches';
const MAX_RECENT = 10;

export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as string[];
            setRecent(Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : []);
          } catch {
            setRecent([]);
          }
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const addRecent = useCallback((term: string) => {
    const trimmed = term.trim().toLowerCase();
    if (!trimmed) return;

    setRecent((prev) => {
      const filtered = prev.filter((t) => t !== trimmed);
      const next = [trimmed, ...filtered].slice(0, MAX_RECENT);
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    void AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return { recent, loaded, addRecent, clearRecent };
}
