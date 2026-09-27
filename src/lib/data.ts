import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from './supabase';
import { errorMessage } from './format';

/**
 * Loads data when the screen opens and every time it comes back into focus.
 * `reload()` fetches again (e.g. after a realtime event or pull-to-refresh).
 */
export function useLoad<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, error, loading, reload, setData };
}

/** Calls `onChange` whenever rows in `table` matching `filter` change (RLS still applies). */
export function useRealtime(channelName: string, table: string, filter: string | undefined, onChange: () => void, enabled = true) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, () => cb.current())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, table, filter, enabled]);
}

/** Throws the Supabase error so useLoad can show it. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw res.error;
  return res.data as T;
}
