import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import apiClient from "@/lib/api-client";
import { usePriceSearch } from "./usePriceSearch";
import type { PriceSearchResult } from "@/lib/price-search";

vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn(), get: vi.fn() } }));
const api = apiClient as unknown as { post: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };

const processing: PriceSearchResult = {
  status: "processing", query: "бумага а4", startedAt: 0,
  stores: [
    { store: "komus", title: "Комус", status: "ok", offers: [] },
    { store: "officemag", title: "ОфисМаг", status: "pending", offers: [] },
  ],
};
const done: PriceSearchResult = { ...processing, status: "completed", stores: [processing.stores[0], { store: "officemag", title: "ОфисМаг", status: "empty", offers: [] }] };

beforeEach(() => {
  vi.useFakeTimers();
  api.post.mockReset();
  api.get.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("usePriceSearch", () => {
  it("показывает промежуточный результат и опрашивает, пока поиск идёт", async () => {
    api.post.mockResolvedValue({ data: { searchId: "s1" } });
    api.get.mockResolvedValueOnce({ data: processing }).mockResolvedValueOnce({ data: done });
    const { result } = renderHook(() => usePriceSearch(1500));

    await act(async () => { await result.current.start("бумага а4"); });
    expect(api.post).toHaveBeenCalledWith("/price-search", { query: "бумага а4" });
    expect(result.current.result?.status).toBe("processing");
    expect(result.current.loading).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenLastCalledWith("/price-search/s1");
    expect(result.current.result?.status).toBe("completed");
    expect(result.current.loading).toBe(false);
  });

  it("новый поиск отменяет опрос прежнего — старый ответ не затирает новый", async () => {
    api.post.mockResolvedValueOnce({ data: { searchId: "old" } }).mockResolvedValueOnce({ data: { searchId: "new" } });
    api.get.mockImplementation(async (url: string) => ({ data: url.endsWith("/old") ? processing : { ...done, query: "ручка" } }));
    const { result } = renderHook(() => usePriceSearch(1500));

    await act(async () => { await result.current.start("бумага а4"); });
    await act(async () => { await result.current.start("ручка"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });

    expect(result.current.result?.query).toBe("ручка");
    expect(api.get.mock.calls.filter(([u]) => String(u).endsWith("/old"))).toHaveLength(1);
  });

  it("текст ошибки сервера — например, лимит поисков", async () => {
    api.post.mockRejectedValue({ response: { data: { error: "Превышен лимит: не более 20 поисков цен в час. Повторите позже." } } });
    const { result } = renderHook(() => usePriceSearch(1500));
    await act(async () => { await result.current.start("бумага а4"); });
    expect(result.current.error).toBe("Превышен лимит: не более 20 поисков цен в час. Повторите позже.");
    expect(result.current.loading).toBe(false);
  });

  it("после ухода со страницы опрос прекращается", async () => {
    api.post.mockResolvedValue({ data: { searchId: "s1" } });
    api.get.mockResolvedValue({ data: processing });
    const { result, unmount } = renderHook(() => usePriceSearch(1500));
    await act(async () => { await result.current.start("бумага а4"); });
    unmount();
    await vi.advanceTimersByTimeAsync(6000);
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
