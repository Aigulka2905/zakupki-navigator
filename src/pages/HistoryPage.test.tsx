import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// «История»: у пользователя — только его действия со ссылками в разделы; у администратора —
// все действия в системе с ФИО, email и организацией; чат открывается перепиской
// пользователя (окно «Чаты пользователя»), а не чатом самого администратора.
const get = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { get: (url: string, cfg?: unknown) => get(url, cfg) } }));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children, subtitle }: { children: ReactNode; subtitle?: string }) => <div><p>{subtitle}</p>{children}</div> }));
vi.mock("@/components/Reveal", () => ({ Reveal: ({ children }: { children: ReactNode }) => <>{children}</> }));
const me: { current: { id: string; role: string } } = { current: { id: "u1", role: "specialist" } };
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ data: me.current }) }));
vi.mock("@/components/admin/UserChatsDialog", () => ({
  UserChatsDialog: ({ user, initial }: { user: { email: string }; initial?: { sessionId: string | null } }) =>
    <div data-testid="chats-dialog">{user.email} · {initial?.sessionId}</div>,
}));

import HistoryPage from "./HistoryPage";

const now = new Date();
const minAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
const IVANOVA = { id: "u1", fullName: "Иванова Анна", email: "a@b.ru", organization: "ООО «Ромашка»" };
const PETROV = { id: "u2", fullName: "Петров Пётр", email: "p@x.ru", organization: "АО «Росхим»" };
const chat = { id: "chat:u1:session:s1", kind: "chat", at: minAgo(1), chat: { sessionId: "s1", procurementId: null, title: "Какие сроки подачи заявок?", count: 2, procurementTitle: null, procurementNumber: null } };
const analysis = { id: "analysis:a1", kind: "analysis", at: minAgo(2), analysis: { id: "a1", status: "completed", fileName: "ТЗ.docx", violations: 2 } };
const nmck = { id: "action:l1", kind: "action", at: minAgo(3), action: "nmck.create", entityType: "nmck", entityId: "n1", entityTitle: "Бумага офисная", details: { sources: 3 }, viaAdmin: null };
const orgUpdate = { id: "action:l6", kind: "action", at: minAgo(4), action: "org.update", entityType: "organization", entityId: null, entityTitle: null, details: { name: "ООО «Ромашка»" }, viaAdmin: { fullName: null, email: null } };

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter><HistoryPage /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  get.mockReset();
  me.current = { id: "u1", role: "specialist" };
});

describe("HistoryPage — пользователь", () => {
  beforeEach(() => {
    get.mockImplementation(async () => ({ data: { scope: "own", items: [chat, analysis, nmck, orgUpdate], nextBefore: null } }));
  });

  it("свои чаты, анализы и действия — со ссылками в разделы", async () => {
    renderPage();
    expect(await screen.findByText("Какие сроки подачи заявок?")).toBeInTheDocument();
    expect(screen.getByText("Какие сроки подачи заявок?").closest("a")).toHaveAttribute("href", "/chat?session=s1");
    expect(screen.getByText("ТЗ.docx").closest("a")).toHaveAttribute("href", "/doc-review?id=a1");
    expect(screen.getByText("Расчёт НМЦ «Бумага офисная»").closest("a")).toHaveAttribute("href", "/nmck");
    expect(screen.getByText("источников цен: 3")).toBeInTheDocument();
    expect(screen.queryByText("Иванова Анна")).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/history", { params: { type: "all" } });
  });

  it("действие администратора под пользователем помечено", async () => {
    renderPage();
    expect(await screen.findByText("Обновление профиля")).toBeInTheDocument();
    expect(screen.getByText("Сделал администратор")).toBeInTheDocument();
  });
});

describe("HistoryPage — администратор", () => {
  beforeEach(() => {
    me.current = { id: "admin", role: "admin" };
    get.mockImplementation(async (url: string, cfg?: { params?: { before?: string } }) => {
      if (url === "/admin/users") return { data: [IVANOVA, PETROV].map((u) => ({ ...u, role: "specialist" })) };
      if (cfg?.params?.before) return { data: { scope: "all", items: [{ ...analysis, id: "analysis:a9", at: minAgo(60), analysis: { ...analysis.analysis, id: "a9", fileName: "Старый.pdf" }, user: PETROV }], nextBefore: null } };
      return { data: { scope: "all", items: [{ ...chat, user: IVANOVA }, { ...nmck, user: PETROV }, { ...orgUpdate, user: null }], nextBefore: minAgo(4) } };
    });
  });

  it("все действия в системе — кто сделал: ФИО, организация, email; системные — «Система»", async () => {
    renderPage();
    expect(await screen.findByText("Все действия в системе: кто, что и когда")).toBeInTheDocument();
    expect(await screen.findByText(/Петров Пётр/)).toHaveTextContent("Петров Пётр · АО «Росхим» · p@x.ru");
    expect(screen.getByText("Система")).toBeInTheDocument();
    // Чужие расчёты администратор не открывает по ссылке.
    expect(screen.getByText("Расчёт НМЦ «Бумага офисная»").closest("a")).toBeNull();
  });

  it("чат открывает переписку пользователя, а не чат администратора", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("Какие сроки подачи заявок?"));
    expect(await screen.findByTestId("chats-dialog")).toHaveTextContent("a@b.ru · s1");
  });

  it("«Показать ещё» — следующая страница по границе", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Показать ещё" }));
    expect(await screen.findByText("Старый.pdf")).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledWith("/history", { params: { type: "all", before: minAgo(4) } }));
  });
});
