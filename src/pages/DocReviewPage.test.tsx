import { describe, it, expect, vi, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
const get = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { get: (...a: unknown[]) => get(...a), post: vi.fn(), delete: vi.fn() } }));

import DocReviewPage from "./DocReviewPage";

afterEach(() => { vi.useRealTimers(); get.mockReset(); });

describe("DocReviewPage", () => {
  it("незавершённая проверка из «Истории»: прогресс, затем результат с файлами", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    get
      .mockResolvedValueOnce({ data: { id: "a1", status: "processing", progress: { stage: "ai", current: 3, total: 12, label: "Анализ ИИ: готово 3 из 12 частей" } } })
      .mockResolvedValueOnce({ data: { id: "a1", status: "completed", analysisResult: {
        overallRisk: "средний", summary: "Итог", mode: "44",
        risks: [{ title: "Марки без эквивалента", severity: "средний", place: "Frontbase", why: "w", fix: "f", file: "АР3.pdf" }],
        files: [{ name: "АР3.pdf", kind: "drawing", chars: 100, checked: "brand-scan", note: "чертёж — найдены марки" }],
      } } });
    render(<MemoryRouter initialEntries={["/doc-review?id=a1"]}><DocReviewPage /></MemoryRouter>);
    expect(await screen.findByText("Анализ ИИ: готово 3 из 12 частей")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(await screen.findByText(/Что проверено: файлов 1/)).toBeInTheDocument();
    expect(screen.getByText("Марки без эквивалента")).toBeInTheDocument();
    expect(screen.getAllByText("АР3.pdf").length).toBeGreaterThanOrEqual(2); // бейдж риска + строка отчёта
    expect(get).toHaveBeenCalledWith("/analysis/a1");
  });

  it("неуспешная проверка — понятное сообщение", async () => {
    get.mockResolvedValueOnce({ data: { id: "a2", status: "failed", analysisResult: { error: "Не удалось извлечь текст ни из одного файла" } } });
    render(<MemoryRouter initialEntries={["/doc-review?id=a2"]}><DocReviewPage /></MemoryRouter>);
    expect(await screen.findByText(/Не удалось извлечь текст ни из одного файла/)).toBeInTheDocument();
  });
});
