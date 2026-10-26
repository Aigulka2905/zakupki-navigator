import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Положение о закупке в профиле организации: загрузка, ход разбора, свод правил с пунктами
// и цитатами (по нему проверка документации по 223-ФЗ ищет противоречия), ошибка разбора.
const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: {
  get: (url: string) => get(url),
  post: (url: string, body: unknown, cfg?: unknown) => post(url, body, cfg),
  delete: (url: string) => del(url),
} }));
let role = "specialist";
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ data: { id: "u1", role } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ProcurementPolicyCard } from "./ProcurementPolicyCard";

const RULES = [
  { id: "P1", topic: "сроки", rule: "Запрос котировок: заявки не менее 5 рабочих дней", clause: "7.3", quote: "Срок подачи заявок на участие в запросе котировок составляет не менее пяти рабочих дней" },
  { id: "P2", topic: "обеспечение", rule: "Обеспечение заявки не более 2 % НМЦД", clause: "", quote: "Размер обеспечения заявки не может превышать двух процентов" },
];
const READY = { id: "pol-1", fileName: "Положение_МУП.pdf", status: "ready", error: null, rules: RULES, coverage: null, updatedAt: "2026-10-26T09:00:00.000Z" };

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ProcurementPolicyCard /></QueryClientProvider>);
}

beforeEach(() => {
  get.mockReset(); post.mockReset(); del.mockReset();
  role = "specialist";
});

describe("ProcurementPolicyCard", () => {
  it("нет Положения — объяснение и кнопка загрузки", async () => {
    get.mockResolvedValue({ data: { policy: null } });
    renderCard();
    expect(await screen.findByText(/Положение не загружено/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Загрузить Положение/ })).toBeInTheDocument();
  });

  it("разобрано — файл, число правил, пункт и дословная цитата", async () => {
    get.mockResolvedValue({ data: { policy: READY } });
    renderCard();
    expect(await screen.findByText("Положение_МУП.pdf")).toBeInTheDocument();
    expect(screen.getByText(/правил для сверки: 2/)).toBeInTheDocument();
    expect(screen.getByText("п. 7.3")).toBeInTheDocument();
    expect(screen.getByText(/«Срок подачи заявок на участие в запросе котировок/)).toBeInTheDocument();
  });

  it("правило модели со строчной буквы показывается с заглавной", async () => {
    get.mockResolvedValue({ data: { policy: { ...READY, rules: [{ ...RULES[0], rule: "срок подачи заявок — не менее 5 рабочих дней" }] } } });
    renderCard();
    expect(await screen.findByText("Срок подачи заявок — не менее 5 рабочих дней")).toBeInTheDocument();
  });

  it("идёт разбор — без списка правил, с пояснением", async () => {
    get.mockResolvedValue({ data: { policy: { ...READY, status: "processing", rules: [] } } });
    renderCard();
    expect(await screen.findByText(/Выделяем правила для сверки/)).toBeInTheDocument();
  });

  it("разбор не удался — причина с сервера", async () => {
    get.mockResolvedValue({ data: { policy: { ...READY, status: "failed", rules: [], error: "В тексте не найдено правил" } } });
    renderCard();
    expect(await screen.findByText("В тексте не найдено правил")).toBeInTheDocument();
  });

  it("загрузка файла уходит полем file", async () => {
    get.mockResolvedValue({ data: { policy: null } });
    post.mockResolvedValue({ data: { policy: { ...READY, status: "processing", rules: [] } } });
    const { container } = renderCard();
    await screen.findByText(/Положение не загружено/);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "Положение.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(post).toHaveBeenCalled());
    const [url, body] = post.mock.calls[0];
    expect(url).toBe("/organization/procurement-policy");
    expect((body as FormData).get("file")).toBe(file);
  });

  it("наблюдатель (viewer) — без загрузки и удаления", async () => {
    role = "viewer";
    get.mockResolvedValue({ data: { policy: READY } });
    renderCard();
    await screen.findByText("Положение_МУП.pdf");
    expect(screen.queryByRole("button", { name: /Заменить/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Удалить/ })).not.toBeInTheDocument();
  });
});
