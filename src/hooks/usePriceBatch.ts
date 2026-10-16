import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "@/lib/api-client";
import type { BatchChoices, PriceBatch } from "@/lib/price-batch";

const errorText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;

const readText = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsText(blob);
});

// У запросов файла (responseType: blob) тело ошибки — тоже Blob с JSON внутри.
async function blobErrorText(e: unknown, fallback: string): Promise<string> {
  const data = (e as { response?: { data?: unknown } })?.response?.data;
  if (!(data instanceof Blob)) return errorText(e, fallback);
  try {
    return (JSON.parse(await readText(data)) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Скачать шаблон списка. Ошибка — исключение с понятным текстом. */
export async function saveBatchTemplate() {
  try {
    const res = await apiClient.get("/price-search/template", { responseType: "blob" });
    saveBlob(res.data as Blob, "Шаблон_цены_в_магазинах.xlsx");
  } catch (e) {
    throw new Error(await blobErrorText(e, "Не удалось скачать шаблон"));
  }
}

/** Скачать Excel с результатом списка с учётом выбранных вариантов. */
export async function saveBatchXlsx(batchId: string, choices: BatchChoices) {
  try {
    const res = await apiClient.post(`/price-search/batch/${batchId}/export`, { choices }, { responseType: "blob" });
    saveBlob(res.data as Blob, `Цены_в_магазинах_${new Date().toLocaleDateString("ru-RU")}.xlsx`);
  } catch (e) {
    throw new Error(await blobErrorText(e, "Не удалось сформировать Excel"));
  }
}

/**
 * «Цены в магазинах», список из Excel: загрузка файла, восстановление по номеру из адреса и
 * опрос, пока ОфисМаг не ответит по всем позициям. Таблица показывается сразу (Комус готов).
 */
export function usePriceBatch(pollMs = 2000) {
  const [batch, setBatch] = useState<PriceBatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  // Номер текущей загрузки: ответы прежней (и пришедшие после ухода со страницы) отбрасываются.
  const run = useRef(0);

  useEffect(() => () => {
    run.current += 1;
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const begin = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setError(null);
    setBatch(null);
    setLoading(true);
    return ++run.current;
  }, []);

  const follow = useCallback(async (batchId: string, my: number) => {
    const poll = async (): Promise<void> => {
      try {
        const { data } = await apiClient.get<PriceBatch>(`/price-search/batch/${batchId}`);
        if (my !== run.current) return;
        setBatch(data);
        if (data.status === "processing") timer.current = window.setTimeout(poll, pollMs);
        else setLoading(false);
      } catch (e) {
        if (my !== run.current) return;
        setLoading(false);
        setError(errorText(e, "Не удалось получить результат по списку"));
      }
    };
    await poll();
  }, [pollMs]);

  /** Загрузить файл; вернёт номер списка (для адреса страницы) или null при ошибке. */
  const upload = useCallback(async (file: File): Promise<string | null> => {
    const my = begin();
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post<{ batchId: string; total: number }>("/price-search/batch", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (my !== run.current) return null;
      await follow(data.batchId, my);
      return data.batchId;
    } catch (e) {
      if (my !== run.current) return null;
      setLoading(false);
      setError(errorText(e, "Не удалось загрузить список"));
      return null;
    }
  }, [begin, follow]);

  /** Показать список по номеру из адреса — после обновления страницы. */
  const restore = useCallback(async (batchId: string) => {
    await follow(batchId, begin());
  }, [begin, follow]);

  return { upload, restore, batch, loading, error };
}
