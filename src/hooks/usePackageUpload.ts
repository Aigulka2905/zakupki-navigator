import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "@/lib/api-client";
import { rejectReason } from "@/lib/package-upload";

// Загрузка пакета документов по одному файлу на запрос: пакет любого объёма
// проходит лимит тела запроса nginx (раньше 12 файлов одним запросом → 413).
// Пакет-черновик создаётся при первом файле; одновременно — не больше 2
// загрузок; упавший файл можно повторить или убрать; запуск — когда загружено всё.

export type BatchKind = "doc_review" | "bid_evaluation";
export type FileRole = "doc" | "spec" | "bid";
export type UploadStatus = "queued" | "uploading" | "done" | "error";

export interface UploadItem {
  key: string;
  file: File;
  role: FileRole;
  participantIndex?: number;
  status: UploadStatus;
  progress: number;
  fileId?: string;
  error?: string;
  /** false — файл отклонён ещё до загрузки (формат, размер): повтор не поможет. */
  retryable: boolean;
}

const PARALLEL = 2;
let seq = 0;

const errorText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;

export function usePackageUpload(kind: BatchKind) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const batchRef = useRef<Promise<string> | null>(null);
  const inFlight = useRef(new Set<string>());
  const aborts = useRef(new Map<string, AbortController>());

  const patch = useCallback((key: string, p: Partial<UploadItem>) => {
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)));
  }, []);

  // Пакет создаём один раз; если создание упало — следующая загрузка попробует снова.
  const batchId = useCallback(() => {
    if (!batchRef.current) {
      const created = apiClient.post<{ id: string }>("/upload-batches", { kind }).then((r) => r.data.id);
      created.catch(() => { if (batchRef.current === created) batchRef.current = null; });
      batchRef.current = created;
    }
    return batchRef.current;
  }, [kind]);

  const upload = useCallback(async (item: UploadItem) => {
    const ctrl = new AbortController();
    aborts.current.set(item.key, ctrl);
    patch(item.key, { status: "uploading", progress: 0, error: undefined });
    try {
      const id = await batchId();
      const form = new FormData();
      form.append("role", item.role);
      if (item.participantIndex != null) form.append("participantIndex", String(item.participantIndex));
      form.append("file", item.file);
      const { data } = await apiClient.post<{ fileId: string }>(`/upload-batches/${id}/files`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        signal: ctrl.signal,
        onUploadProgress: (e) => {
          if (e.total) patch(item.key, { progress: Math.round((e.loaded / e.total) * 100) });
        },
      });
      patch(item.key, { status: "done", progress: 100, fileId: data.fileId });
    } catch (e) {
      if (!ctrl.signal.aborted) {
        patch(item.key, { status: "error", error: errorText(e, "Не удалось загрузить файл"), retryable: true });
      }
    } finally {
      aborts.current.delete(item.key);
    }
  }, [batchId, patch]);

  // Очередь: запускаем ожидающие файлы, пока занято меньше PARALLEL слотов.
  useEffect(() => {
    const free = PARALLEL - inFlight.current.size;
    if (free <= 0) return;
    items
      .filter((i) => i.status === "queued" && !inFlight.current.has(i.key))
      .slice(0, free)
      .forEach((i) => {
        inFlight.current.add(i.key);
        void upload(i).finally(() => {
          inFlight.current.delete(i.key);
          setItems((list) => [...list]); // освободился слот — разбудить очередь
        });
      });
  }, [items, upload]);

  const add = useCallback((files: File[], role: FileRole, participantIndex?: number) => {
    setItems((list) => {
      const accepted = list.filter((i) => i.retryable);
      let count = accepted.length;
      let totalBytes = accepted.reduce((n, i) => n + i.file.size, 0);
      const added = files.map((file): UploadItem => {
        const reason = rejectReason(file, { count, totalBytes });
        if (!reason) { count += 1; totalBytes += file.size; }
        return {
          key: `f${++seq}`, file, role, participantIndex, progress: 0,
          status: reason ? "error" : "queued", error: reason ?? undefined, retryable: !reason,
        };
      });
      return [...list, ...added];
    });
  }, []);

  const remove = useCallback((key: string) => {
    const item = itemsRef.current.find((i) => i.key === key);
    aborts.current.get(key)?.abort();
    if (item?.fileId && batchRef.current) {
      const fileId = item.fileId;
      void batchRef.current.then((id) => apiClient.delete(`/upload-batches/${id}/files/${fileId}`)).catch(() => {});
    }
    setItems((list) => list.filter((i) => i.key !== key));
  }, []);

  const retry = useCallback((key: string) => patch(key, { status: "queued", progress: 0, error: undefined }), [patch]);

  const removeParticipant = useCallback((index: number) => {
    itemsRef.current.filter((i) => i.role === "bid" && i.participantIndex === index).forEach((i) => remove(i.key));
  }, [remove]);

  const start = useCallback(async (body: Record<string, unknown>) => {
    const id = await batchId();
    const { data } = await apiClient.post<{ resultId: string }>(`/upload-batches/${id}/start`, body);
    return data.resultId;
  }, [batchId]);

  // После запуска — новый пакет для следующей проверки.
  const reset = useCallback(() => {
    aborts.current.forEach((c) => c.abort());
    batchRef.current = null;
    setItems([]);
  }, []);

  const ready = items.length > 0 && items.every((i) => i.status === "done");
  const busy = items.some((i) => i.status === "queued" || i.status === "uploading");
  return { items, add, remove, retry, removeParticipant, start, reset, ready, busy };
}
