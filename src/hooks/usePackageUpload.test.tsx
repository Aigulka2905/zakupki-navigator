import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const post = vi.fn();
const del = vi.fn();
vi.mock("@/lib/api-client", () => ({
  default: { post: (...a: unknown[]) => post(...a), delete: (...a: unknown[]) => del(...a) },
}));

import { usePackageUpload } from "./usePackageUpload";

const file = (name: string, size = 10) => {
  const f = new File(["x"], name);
  Object.defineProperty(f, "size", { value: size });
  return f;
};
type Deferred = { resolve: (v: unknown) => void; reject: (e: unknown) => void };

describe("usePackageUpload", () => {
  let pending: Deferred[];
  beforeEach(() => {
    pending = [];
    post.mockReset();
    del.mockReset();
    post.mockImplementation((url: string) => {
      if (url === "/upload-batches") return Promise.resolve({ data: { id: "b1" } });
      if (url.endsWith("/start")) return Promise.resolve({ data: { resultId: "r1" } });
      return new Promise((resolve, reject) => pending.push({ resolve, reject }));
    });
    del.mockResolvedValue({});
  });

  it("пакет создаётся один раз; одновременно — не больше двух загрузок", async () => {
    const { result } = renderHook(() => usePackageUpload("doc_review"));
    act(() => result.current.add([file("a.pdf"), file("b.pdf"), file("c.pdf")], "doc"));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(post.mock.calls.filter(([u]) => u === "/upload-batches")).toHaveLength(1);
    await act(async () => { pending[0].resolve({ data: { fileId: "f1" } }); });
    await waitFor(() => expect(pending).toHaveLength(3));
    await act(async () => {
      pending[1].resolve({ data: { fileId: "f2" } });
      pending[2].resolve({ data: { fileId: "f3" } });
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
  });

  it("сбой загрузки — ошибка у файла; повтор загружает снова", async () => {
    const { result } = renderHook(() => usePackageUpload("doc_review"));
    act(() => result.current.add([file("a.pdf")], "doc"));
    await waitFor(() => expect(pending).toHaveLength(1));
    await act(async () => { pending[0].reject({ response: { data: { error: "Сеть недоступна" } } }); });
    await waitFor(() => expect(result.current.items[0]).toMatchObject({ status: "error", error: "Сеть недоступна", retryable: true }));
    expect(result.current.ready).toBe(false);
    act(() => result.current.retry(result.current.items[0].key));
    await waitFor(() => expect(pending).toHaveLength(2));
    await act(async () => { pending[1].resolve({ data: { fileId: "f1" } }); });
    await waitFor(() => expect(result.current.ready).toBe(true));
  });

  it("файл больше 50 МБ отклоняется сразу, без загрузки", () => {
    const { result } = renderHook(() => usePackageUpload("doc_review"));
    act(() => result.current.add([file("big.pdf", 51 * 1024 * 1024)], "doc"));
    expect(result.current.items[0]).toMatchObject({ status: "error", error: "Файл больше 50 МБ", retryable: false });
    expect(post).not.toHaveBeenCalled();
    expect(result.current.ready).toBe(false);
  });

  it("файлы участника — с номером; удаление участника убирает его файлы с сервера; запуск возвращает id", async () => {
    const { result } = renderHook(() => usePackageUpload("bid_evaluation"));
    act(() => result.current.add([file("ТЗ.pdf")], "spec"));
    act(() => result.current.add([file("КП.pdf")], "bid", 3));
    await waitFor(() => expect(pending).toHaveLength(2));
    await act(async () => {
      pending[0].resolve({ data: { fileId: "f1" } });
      pending[1].resolve({ data: { fileId: "f2" } });
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    const forms = post.mock.calls.filter(([u]) => u === "/upload-batches/b1/files").map(([, f]) => f as FormData);
    expect(forms.some((f) => f.get("role") === "bid" && f.get("participantIndex") === "3")).toBe(true);
    act(() => result.current.removeParticipant(3));
    await waitFor(() => expect(del).toHaveBeenCalledWith("/upload-batches/b1/files/f2"));
    expect(result.current.items).toHaveLength(1);
    let id = "";
    await act(async () => { id = await result.current.start({ title: "t" }); });
    expect(id).toBe("r1");
    expect(post).toHaveBeenLastCalledWith("/upload-batches/b1/start", { title: "t" });
  });

  const uploaded = async (result: { current: ReturnType<typeof usePackageUpload> }, name = "a.pdf") => {
    act(() => result.current.add([file(name)], "doc"));
    await waitFor(() => expect(pending.length).toBeGreaterThan(0));
    await act(async () => { pending[pending.length - 1].resolve({ data: { fileId: "f1" } }); });
    await waitFor(() => expect(result.current.ready).toBe(true));
  };

  it("сбой удаления: запуск не идёт и бросает ошибку; после успешного повтора — идёт", async () => {
    const { result } = renderHook(() => usePackageUpload("doc_review"));
    await uploaded(result);
    del.mockRejectedValueOnce(new Error("net")).mockRejectedValueOnce(new Error("net"));
    act(() => result.current.remove(result.current.items[0].key));
    await waitFor(() => expect(del).toHaveBeenCalledTimes(1));
    let err: unknown;
    await act(async () => { await result.current.start({ title: "t" }).catch((e) => { err = e; }); });
    expect((err as Error).message).toBe("Не удалось убрать из пакета удалённые файлы — повторите запуск.");
    expect(post.mock.calls.some(([u]) => String(u).endsWith("/start"))).toBe(false);
    let id = "";
    await act(async () => { id = await result.current.start({ title: "t" }); });
    expect(id).toBe("r1");
    expect(del).toHaveBeenCalledTimes(3);
  });

  it("удалить и сразу запустить: /start только после ответа на DELETE", async () => {
    const { result } = renderHook(() => usePackageUpload("doc_review"));
    await uploaded(result);
    let release!: () => void;
    del.mockReturnValueOnce(new Promise((r) => { release = () => r({}); }));
    let started: Promise<string> | undefined;
    act(() => {
      result.current.remove(result.current.items[0].key);
      started = result.current.start({ title: "t" });
    });
    await waitFor(() => expect(del).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(post.mock.calls.some(([u]) => String(u).endsWith("/start"))).toBe(false);
    await act(async () => { release(); await started; });
    expect(post).toHaveBeenLastCalledWith("/upload-batches/b1/start", { title: "t" });
  });

  it("убран файл, тело которого уже ушло целиком: по ответу его fileId удаляется, запуск ждёт", async () => {
    const { result } = renderHook(() => usePackageUpload("doc_review"));
    act(() => result.current.add([file("a.pdf")], "doc"));
    await waitFor(() => expect(pending).toHaveLength(1));
    const cfg = post.mock.calls.find(([u]) => u === "/upload-batches/b1/files")![2] as {
      onUploadProgress: (e: { loaded: number; total: number }) => void; signal: AbortSignal;
    };
    act(() => cfg.onUploadProgress({ loaded: 10, total: 10 }));
    let started: Promise<string> | undefined;
    act(() => {
      result.current.remove(result.current.items[0].key);
      started = result.current.start({ title: "t" });
    });
    expect(cfg.signal.aborted).toBe(false);
    expect(result.current.items).toHaveLength(0);
    await act(async () => { pending[0].resolve({ data: { fileId: "f9" } }); });
    await waitFor(() => expect(del).toHaveBeenCalledWith("/upload-batches/b1/files/f9"));
    await act(async () => { await started; });
    expect(result.current.items).toHaveLength(0);
    expect(Math.max(...del.mock.invocationCallOrder)).toBeLessThan(post.mock.invocationCallOrder[post.mock.calls.length - 1]);
  });
});
