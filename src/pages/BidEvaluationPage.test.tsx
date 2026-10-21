import { describe, it, expect, vi, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/ProtocolDialog", () => ({ ProtocolDialog: () => null }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ data: { organization: { orgType: "customer" } } }) }));
const get = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { get: (...a: unknown[]) => get(...a), post: vi.fn(), delete: vi.fn() } }));

// Хук подменяется только в тестах запуска; в остальных работает настоящий.
let hookOverride: unknown = null;
vi.mock("@/hooks/usePackageUpload", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePackageUpload")>("@/hooks/usePackageUpload");
  return { ...actual, usePackageUpload: (...a: Parameters<typeof actual.usePackageUpload>) => (hookOverride ?? actual.usePackageUpload(...a)) as ReturnType<typeof actual.usePackageUpload> };
});

import BidEvaluationPage from "./BidEvaluationPage";

afterEach(() => { vi.useRealTimers(); get.mockReset(); hookOverride = null; });

describe("BidEvaluationPage", () => {
  it("ссылка из уведомления (?id=) открывает анализ и показывает прогресс", async () => {
    get.mockImplementation((url: string) => (url === "/bid-evaluation"
      ? Promise.resolve({ data: [] })
      : Promise.resolve({ data: { id: "e1", title: "Насосы", status: "processing", bidCount: 3, createdAt: new Date().toISOString(),
          progress: { stage: "participants", current: 2, total: 3, label: "Участник 2 из 3: ООО Бета" } } })));
    render(<MemoryRouter initialEntries={["/bid-evaluation?id=e1"]}><BidEvaluationPage /></MemoryRouter>);
    expect(await screen.findByText("Участник 2 из 3: ООО Бета")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/bid-evaluation/e1");
  });

  it("неуспешный анализ — сообщение из записи", async () => {
    get.mockImplementation((url: string) => (url === "/bid-evaluation"
      ? Promise.resolve({ data: [] })
      : Promise.resolve({ data: { id: "e2", title: "Т", status: "failed", bidCount: 1, createdAt: new Date().toISOString(),
          summary: "Не удалось извлечь текст из документации закупки (ТЗ)" } })));
    render(<MemoryRouter initialEntries={["/bid-evaluation?id=e2"]}><BidEvaluationPage /></MemoryRouter>);
    expect(await screen.findByText(/Не удалось извлечь текст из документации закупки/)).toBeInTheDocument();
  });

  it("не больше 20 участников", async () => {
    get.mockResolvedValue({ data: [] });
    render(<MemoryRouter initialEntries={["/bid-evaluation"]}><BidEvaluationPage /></MemoryRouter>);
    await act(async () => {}); // загрузка истории завершается внутри act
    const add = screen.getByRole("button", { name: /Добавить участника/ });
    for (let i = 0; i < 20; i++) fireEvent.click(add);
    expect(screen.getAllByPlaceholderText(/название организации/)).toHaveLength(20);
    expect(screen.getByText("Не больше 20 участников за один раз")).toBeInTheDocument();
  });

  it("ошибка start(): текст виден, остаёмся на шаге загрузки, reset не вызван", async () => {
    get.mockResolvedValue({ data: [] });
    const msg = "Не удалось убрать из пакета удалённые файлы — повторите запуск.";
    const reset = vi.fn();
    const mk = (name: string, role: string, participantIndex?: number) =>
      ({ key: name, file: new File(["x"], name), role, participantIndex, status: "done", progress: 100, fileId: name, retryable: true });
    hookOverride = {
      items: [mk("ТЗ.pdf", "spec"), mk("Заявка.pdf", "bid", 0)],
      add: vi.fn(), remove: vi.fn(), retry: vi.fn(), removeParticipant: vi.fn(),
      start: vi.fn().mockRejectedValue(new Error(msg)), reset, ready: true, busy: false,
    };
    render(<MemoryRouter initialEntries={["/bid-evaluation"]}><BidEvaluationPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Проанализировать заявки/ }));
    expect(await screen.findByText(msg)).toBeInTheDocument();
    expect(screen.getByText("ТЗ.pdf")).toBeInTheDocument();
    expect(screen.getByText("Заявка.pdf")).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
  });

  it("временный сбой опроса при processing не останавливает опрос", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const rec = (status: string, extra = {}) => ({ data: { id: "e3", title: "Т", status, bidCount: 2, createdAt: new Date().toISOString(), ...extra } });
    let n = 0;
    get.mockImplementation((url: string) => {
      if (url === "/bid-evaluation") return Promise.resolve({ data: [] });
      n += 1;
      if (n === 1) return Promise.resolve(rec("processing", { progress: { stage: "participants", current: 1, total: 2, label: "Идёт анализ" } }));
      if (n === 2) return Promise.reject(new Error("Network Error"));
      return Promise.resolve(rec("completed", { summary: "Готово", results: [] }));
    });
    render(<MemoryRouter initialEntries={["/bid-evaluation?id=e3"]}><BidEvaluationPage /></MemoryRouter>);
    expect(await screen.findByText("Идёт анализ")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(3000); });
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(await screen.findByText("Общий вывод по закупке")).toBeInTheDocument();
    expect(screen.queryByText("Не удалось загрузить оценку")).not.toBeInTheDocument();
  });
});
