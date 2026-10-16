import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import apiClient from "@/lib/api-client";
import { saveBatchXlsx, usePriceBatch } from "./usePriceBatch";
import type { PriceBatch } from "@/lib/price-batch";

vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn(), get: vi.fn() } }));
const api = apiClient as unknown as { post: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };

const processing: PriceBatch = {
  batchId: "b1", fileName: "Канцтовары.xlsx", createdAt: 0, status: "processing", progress: { done: 0, total: 1 },
  positions: [{ n: 1, name: "Бумага А4", qty: 10, unit: "пачка", stores: [
    { store: "komus", title: "Комус", status: "ok", offers: [] },
    { store: "officemag", title: "ОфисМаг", status: "pending", offers: [] },
  ] }],
};
const done: PriceBatch = { ...processing, status: "completed", progress: { done: 1, total: 1 } };
const file = new File(["x"], "Канцтовары.xlsx");

beforeEach(() => {
  vi.useFakeTimers();
  api.post.mockReset();
  api.get.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("usePriceBatch", () => {
  it("загрузка: файл уходит формой, таблица видна сразу, опрос — пока ОфисМаг ищет; возвращает номер списка", async () => {
    api.post.mockResolvedValue({ data: { batchId: "b1", total: 1 } });
    api.get.mockResolvedValueOnce({ data: processing }).mockResolvedValueOnce({ data: done });
    const { result } = renderHook(() => usePriceBatch(2000));

    let id: string | null = null;
    await act(async () => { id = await result.current.upload(file); });
    expect(id).toBe("b1");
    const [url, form] = api.post.mock.calls[0];
    expect(url).toBe("/price-search/batch");
    expect((form as FormData).get("file")).toBe(file);
    expect(result.current.batch?.status).toBe("processing");
    expect(result.current.loading).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(api.get).toHaveBeenLastCalledWith("/price-search/batch/b1");
    expect(result.current.batch?.status).toBe("completed");
    expect(result.current.loading).toBe(false);
  });

  it("восстановление по номеру из адреса; устаревший список — текст сервера", async () => {
    api.get.mockResolvedValueOnce({ data: done });
    const { result } = renderHook(() => usePriceBatch(2000));
    await act(async () => { await result.current.restore("b1"); });
    expect(result.current.batch?.batchId).toBe("b1");

    api.get.mockRejectedValueOnce({ response: { data: { error: "Список не найден или устарел" } } });
    await act(async () => { await result.current.restore("old"); });
    expect(result.current.batch).toBeNull();
    expect(result.current.error).toBe("Список не найден или устарел");
  });

  it("ошибка загрузки — текст сервера (лимит, не тот файл), номер не возвращается", async () => {
    api.post.mockRejectedValue({ response: { data: { error: "Не больше 5 списков в час. Повторите позже." } } });
    const { result } = renderHook(() => usePriceBatch(2000));
    let id: string | null = "x";
    await act(async () => { id = await result.current.upload(file); });
    expect(id).toBeNull();
    expect(result.current.error).toBe("Не больше 5 списков в час. Повторите позже.");
    expect(result.current.loading).toBe(false);
  });

  it("новая загрузка отменяет опрос прежнего списка — старый ответ не затирает новый", async () => {
    api.post.mockResolvedValueOnce({ data: { batchId: "old", total: 1 } }).mockResolvedValueOnce({ data: { batchId: "new", total: 1 } });
    api.get.mockImplementation(async (url: string) => ({ data: url.endsWith("/old") ? processing : { ...done, batchId: "new" } }));
    const { result } = renderHook(() => usePriceBatch(2000));

    await act(async () => { await result.current.upload(file); });
    await act(async () => { await result.current.upload(new File(["y"], "Мебель.xlsx")); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });

    expect(result.current.batch?.batchId).toBe("new");
    expect(api.get.mock.calls.filter(([u]) => String(u).endsWith("/old"))).toHaveLength(1);
  });

  it("после ухода со страницы опрос прекращается", async () => {
    api.post.mockResolvedValue({ data: { batchId: "b1", total: 1 } });
    api.get.mockResolvedValue({ data: processing });
    const { result, unmount } = renderHook(() => usePriceBatch(2000));
    await act(async () => { await result.current.upload(file); });
    unmount();
    await vi.advanceTimersByTimeAsync(10000);
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});

describe("saveBatchXlsx", () => {
  it("выбор вариантов уходит на сервер; ошибка — текст из тела-Blob", async () => {
    vi.useRealTimers(); // FileReader в jsdom отвечает через таймер
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    api.post.mockResolvedValueOnce({ data: new Blob(["xlsx"]) });
    await saveBatchXlsx("b1", { 1: { komus: 2 } });
    expect(api.post).toHaveBeenCalledWith("/price-search/batch/b1/export", { choices: { 1: { komus: 2 } } }, { responseType: "blob" });
    expect(click).toHaveBeenCalledTimes(1);

    api.post.mockRejectedValueOnce({ response: { data: new Blob([JSON.stringify({ error: "Список не найден или устарел" })]) } });
    await expect(saveBatchXlsx("b1", {})).rejects.toThrow("Список не найден или устарел");
    click.mockRestore();
  });
});
