import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { api, ApiFailure } from "./api";

/** Loads on every screen focus. A failed refresh keeps the last data so the screen stays useful offline. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const latest = useRef(path);
  latest.current = path;

  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      const body = await api<T>(path);
      if (latest.current === path) {
        setData(body);
        setError(null);
      }
    } catch (e) {
      if (latest.current === path) setError(e instanceof ApiFailure ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { data, error, loading, reload: load };
}
