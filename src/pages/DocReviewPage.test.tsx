import { describe, it, expect, vi, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { AxiosError } from "axios";
import { MemoryRouter, Link } from "react-router-dom";

vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
const get = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { get: (...a: unknown[]) => get(...a), post: vi.fn(), delete: vi.fn() } }));

// Хук подменяется только в тесте запуска; в остальных работает настоящий.
let hookOverride: unknown = null;
vi.mock("@/hooks/usePackageUpload", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePackageUpload")>("@/hooks/usePackageUpload");
  return { ...actual, usePackageUpload: (...a: Parameters<typeof actual.usePackageUpload>) => (hookOverride ?? actual.usePackageUpload(...a)) as ReturnType<typeof actual.usePackageUpload> };
});

import DocReviewPage from "./DocReviewPage";

afterEach(() => { vi.useRealTimers(); get.mockReset(); hookOverride = null; });

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

  it("ошибка start(): текст виден, остаёмся на шаге загрузки, reset не вызван", async () => {
    const msg = "Не удалось убрать из пакета удалённые файлы — повторите запуск.";
    const reset = vi.fn();
    hookOverride = {
      items: [{ key: "f1", file: new File(["x"], "ТЗ.pdf"), role: "doc", status: "done", progress: 100, fileId: "x", retryable: true }],
      add: vi.fn(), remove: vi.fn(), retry: vi.fn(), removeParticipant: vi.fn(),
      start: vi.fn().mockRejectedValue(new Error(msg)), reset, ready: true, busy: false,
    };
    render(<MemoryRouter initialEntries={["/doc-review"]}><DocReviewPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Проверить документацию/ }));
    expect(await screen.findByText(msg)).toBeInTheDocument();
    expect(screen.getByText("ТЗ.pdf")).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it("временный сбой опроса при processing не останавливает опрос", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    get
      .mockResolvedValueOnce({ data: { id: "a3", status: "processing", progress: { stage: "ai", current: 1, total: 4, label: "Идёт анализ" } } })
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce({ data: { id: "a3", status: "completed", analysisResult: { overallRisk: "низкий", summary: "Готово", risks: [] } } });
    render(<MemoryRouter initialEntries={["/doc-review?id=a3"]}><DocReviewPage /></MemoryRouter>);
    expect(await screen.findByText("Идёт анализ")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(3000); });
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(await screen.findByText(/Общий риск: низкий/)).toBeInTheDocument();
    expect(screen.queryByText("Не удалось загрузить проверку")).not.toBeInTheDocument();
  });

  it("смена ?id= снимает прежнюю ошибку загрузки", async () => {
    get
      .mockRejectedValueOnce(new Error("404"))
      .mockResolvedValueOnce({ data: { id: "b", status: "processing", progress: { stage: "ai", current: 1, total: 2, label: "Вторая проверка" } } });
    render(
      <MemoryRouter initialEntries={["/doc-review?id=a"]}>
        <Link to="/doc-review?id=b">к другой</Link>
        <DocReviewPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Не удалось загрузить проверку")).toBeInTheDocument();
    fireEvent.click(screen.getByText("к другой"));
    expect(await screen.findByText("Вторая проверка")).toBeInTheDocument();
    expect(screen.queryByText("Не удалось загрузить проверку")).not.toBeInTheDocument();
  });

  it("сетевой сбой start(): русский текст вместо «Network Error»", async () => {
    hookOverride = {
      items: [{ key: "f1", file: new File(["x"], "ТЗ.pdf"), role: "doc", status: "done", progress: 100, fileId: "x", retryable: true }],
      add: vi.fn(), remove: vi.fn(), retry: vi.fn(), removeParticipant: vi.fn(),
      start: vi.fn().mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK")), reset: vi.fn(), ready: true, busy: false,
    };
    render(<MemoryRouter initialEntries={["/doc-review"]}><DocReviewPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Проверить документацию/ }));
    expect(await screen.findByText(/Нет связи с сервером/)).toBeInTheDocument();
    expect(screen.queryByText("Network Error")).not.toBeInTheDocument();
  });
});
