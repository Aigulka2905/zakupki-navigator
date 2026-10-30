import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Администратор: чаты пользователя — список диалогов, переписка целиком, удаление диалога
// и всех чатов (с подтверждением).
const get = vi.fn();
const del = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { get: (url: string, cfg?: unknown) => get(url, cfg), delete: (url: string) => del(url) } }));

import { UserChatsDialog } from "./UserChatsDialog";

const USER = { id: "u1", email: "a@b.ru", fullName: "Иванова Анна" };
const CHATS = [
  { sessionId: "s1", procurementId: null, title: "Какие сроки подачи заявок по 223-ФЗ?", lastMessage: "…", lastAt: "2026-10-28T10:02:00.000Z", count: 2, documents: 1, procurementTitle: null, procurementNumber: null },
  { sessionId: null, procurementId: "p1", title: "Какой срок поставки?", lastMessage: "…", lastAt: "2026-10-28T10:03:00.000Z", count: 1, documents: 0, procurementTitle: "Поставка бумаги", procurementNumber: "8056" },
];

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><UserChatsDialog user={USER} open onOpenChange={() => {}} /></QueryClientProvider>);
}

beforeEach(() => {
  get.mockReset(); del.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  get.mockImplementation(async (url: string, cfg?: { params?: Record<string, string> }) => {
    if (url === "/admin/users/u1/chats") return { data: { user: USER, chats: CHATS } };
    if (url === "/admin/users/u1/chats/messages" && cfg?.params?.sessionId === "s1") return { data: {
      messages: [
        { id: "m1", role: "user", content: "Какие сроки подачи заявок по 223-ФЗ?", createdAt: "2026-10-28T10:01:00.000Z" },
        { id: "m2", role: "assistant", content: "Сроки устанавливаются положением о закупке.", createdAt: "2026-10-28T10:02:00.000Z" },
      ],
      documents: [{ id: "d1", fileName: "ТЗ.docx", fileSize: 1000, status: "ready", createdAt: "2026-10-28T10:00:00.000Z" }],
    } };
    return { data: { messages: [], documents: [] } };
  });
  del.mockResolvedValue({ data: { messages: 2, documents: 1 } });
});

describe("UserChatsDialog", () => {
  it("список диалогов: подпись, тип, число сообщений", async () => {
    renderDialog();
    expect(await screen.findByText("Какие сроки подачи заявок по 223-ФЗ?")).toBeInTheDocument();
    expect(screen.getByText(/Закупка № 8056/)).toBeInTheDocument();
    expect(screen.getByText(/2 сообщ/)).toBeInTheDocument();
  });

  it("открытый диалог — переписка целиком и прикреплённые документы", async () => {
    renderDialog();
    fireEvent.click(await screen.findByText("Какие сроки подачи заявок по 223-ФЗ?"));
    expect(await screen.findByText("Сроки устанавливаются положением о закупке.")).toBeInTheDocument();
    expect(screen.getByText(/ТЗ\.docx/)).toBeInTheDocument();
  });

  it("удаление диалога — с подтверждением, по ключу диалога", async () => {
    renderDialog();
    fireEvent.click(await screen.findByText("Какие сроки подачи заявок по 223-ФЗ?"));
    fireEvent.click(await screen.findByRole("button", { name: /Удалить диалог/ }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("/admin/users/u1/chats/session/s1"));
    expect(window.confirm).toHaveBeenCalled();
  });

  it("из «Истории» — сразу открыт нужный диалог", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={qc}><UserChatsDialog user={USER} open onOpenChange={() => {}} initial={{ sessionId: "s1", procurementId: null }} /></QueryClientProvider>);
    expect(await screen.findByText("Сроки устанавливаются положением о закупке.")).toBeInTheDocument();
  });

  it("чат по закупке удаляется по номеру закупки; без сессии — как legacy", async () => {
    renderDialog();
    fireEvent.click(await screen.findByText("Какой срок поставки?"));
    fireEvent.click(await screen.findByRole("button", { name: /Удалить диалог/ }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("/admin/users/u1/chats/procurement/p1"));
  });

  it("«Удалить все чаты» — все чаты пользователя; отмена подтверждения — ничего не удаляется", async () => {
    renderDialog();
    await screen.findByText("Какой срок поставки?");
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: /Удалить все чаты/ }));
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Удалить все чаты/ }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("/admin/users/u1/chats"));
  });
});
