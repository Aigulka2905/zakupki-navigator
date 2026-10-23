import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Главная участника: при пустом профиле блок рекомендаций навсегда показывал «Закупки
// загружаются…», а у закупок без цены (сервер отдаёт "0.00") стояло «0 ₽».
const get = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { get: (url: string) => get(url) } }));
vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ data: { id: "u1", fullName: "Айгуль", organization: { id: "o1", orgType: "participant" } }, isLoading: false }),
}));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/Reveal", () => ({ Reveal: ({ children }: { children: ReactNode }) => <>{children}</> }));

import Dashboard from "./Dashboard";

const noPrice = {
  id: "p1", number: "8056", title: "Поставка картриджей без цены", status: "active", statusLabel: "Идёт прием заявок",
  etpId: "e1", customerId: "o2", initialPrice: "0.00", currency: "RUB",
  publicationDate: "2026-10-20T09:00:00.000Z", applicationDeadline: "2026-11-02T09:00:00.000Z",
  documentationUrl: null, relevanceScore: 0, createdAt: "", updatedAt: "",
};

beforeEach(() => {
  get.mockReset();
  get.mockImplementation(async (url: string) => {
    if (url === "/dashboard/stats") return { data: { totalProcurements: 1, activeProcurements: 1, deadlinesThisWeek: 0, nextDeadline: null, completedAnalyses: 0 } };
    if (url === "/dashboard/recent") return { data: [noPrice] };
    return { data: [] };
  });
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter><Dashboard /></MemoryRouter></QueryClientProvider>);
}

describe("Dashboard участника", () => {
  it("рекомендаций нет — так и сказано, без вечного «загружаются»", async () => {
    renderPage();
    expect(await screen.findByText(/Пока нет рекомендаций/)).toBeInTheDocument();
    expect(screen.queryByText(/Закупки загружаются/)).not.toBeInTheDocument();
  });

  it("закупка без цены — без «0 ₽»", async () => {
    renderPage();
    await screen.findAllByText("Поставка картриджей без цены");
    expect(screen.queryByText(/^0\s?₽$/)).not.toBeInTheDocument();
  });
});
