import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Заказчику в карточке закупки показывалась «AI оценка релевантности» и вкладка «AI Анализ»
// с советами участнику («Рекомендуем участие…»): он смотрит свои закупки, оценка ему не нужна,
// а запрос /why зря тратил вызов модели.
let orgType = "participant";
const get = vi.fn();

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ data: { id: "u1", organization: { id: "o1", orgType } }, isLoading: false }),
}));
vi.mock("@/lib/api-client", () => ({ default: { get: (url: string) => get(url), post: vi.fn() } }));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import ProcurementDetailPage from "./ProcurementDetailPage";

const procurement = {
  id: "p1", number: "8056", title: "Поставка бумаги", status: "active", statusLabel: "Идёт прием заявок",
  etpId: "e1", customerId: "o1", initialPrice: "100000.00", currency: "RUB",
  publicationDate: "2026-10-01T09:00:00.000Z", applicationDeadline: "2026-10-29T09:00:00.000Z",
  documentationUrl: null, relevanceScore: 0, createdAt: "", updatedAt: "",
};

beforeEach(() => {
  get.mockReset();
  get.mockImplementation(async (url: string) => {
    if (url.endsWith("/live")) return { data: { procurement, live: null } };
    if (url.endsWith("/why")) return { data: { score: 80, explanation: "Совпадает с видами деятельности" } };
    return { data: [] };
  });
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/procurements/p1"]}>
        <Routes><Route path="/procurements/:id" element={<ProcurementDetailPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProcurementDetailPage: релевантность", () => {
  it("участник видит оценку и вкладку «AI Анализ»", async () => {
    orgType = "participant";
    renderPage();
    await screen.findByText("Поставка бумаги");
    expect(screen.getByText("Релевантность")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /AI Анализ/ })).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledWith("/procurements/p1/why"));
  });

  it("заказчик — без оценки, без вкладки и без запроса к модели", async () => {
    orgType = "customer";
    renderPage();
    await screen.findByText("Поставка бумаги");
    expect(screen.queryByText("Релевантность")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /AI Анализ/ })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Чат/ })).toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith("/procurements/p1/why");
  });
});

// Шапка карточки: у закупки без цены (сервер отдаёт "0.00") стояло «0 ₽».
describe("ProcurementDetailPage: цена", () => {
  it("цены нет — «Не указана», без «0 ₽»", async () => {
    orgType = "customer";
    get.mockImplementation(async (url: string) => (url.endsWith("/live")
      ? { data: { procurement: { ...procurement, initialPrice: "0.00" }, live: null } }
      : { data: [] }));
    renderPage();
    await screen.findByText("Поставка бумаги");
    expect(screen.getByText("Не указана")).toBeInTheDocument();
    expect(screen.queryByText(/^0\s?₽$/)).not.toBeInTheDocument();
  });

  it("цена есть — в рублях", async () => {
    orgType = "customer";
    renderPage();
    await screen.findByText("Поставка бумаги");
    expect(screen.getByText(/100\s000\s₽/)).toBeInTheDocument();
  });
});
