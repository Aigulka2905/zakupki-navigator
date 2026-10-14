import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "@/lib/api-client";
import type { PriceSearchResult } from "@/lib/price-search";

const errorText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;

/**
 * «Цены в магазинах»: запуск поиска и опрос результата, пока живые магазины не ответят.
 * Промежуточный результат (Комус уже есть, ОфисМаг «ищем…») показывается сразу.
 */
export function usePriceSearch(pollMs = 1500) {
  const [result, setResult] = useState<PriceSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  // Номер текущего поиска: ответы прежнего поиска (и пришедшие после ухода со страницы)
  // отбрасываются, новый опрос не планируется.
  const run = useRef(0);

  useEffect(() => () => {
    run.current += 1;
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const start = useCallback(async (query: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    const my = ++run.current;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const { data } = await apiClient.post<{ searchId: string }>("/price-search", { query });
      const poll = async (): Promise<void> => {
        try {
          const { data: r } = await apiClient.get<PriceSearchResult>(`/price-search/${data.searchId}`);
          if (my !== run.current) return;
          setResult(r);
          if (r.status === "processing") timer.current = window.setTimeout(poll, pollMs);
          else setLoading(false);
        } catch (e) {
          if (my !== run.current) return;
          setLoading(false);
          setError(errorText(e, "Не удалось получить результат поиска"));
        }
      };
      if (my === run.current) await poll();
    } catch (e) {
      if (my !== run.current) return;
      setLoading(false);
      setError(errorText(e, "Не удалось запустить поиск"));
    }
  }, [pollMs]);

  return { start, result, loading, error };
}
