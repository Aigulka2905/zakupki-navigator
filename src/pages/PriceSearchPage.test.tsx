import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import PriceSearchPage from "./PriceSearchPage";

vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/price-search/BatchSearch", () => ({ BatchSearch: () => <div>список из файла</div> }));
vi.mock("@/hooks/usePriceSearch", () => ({ usePriceSearch: () => ({ start: vi.fn(), result: null, loading: false, error: null }) }));

const renderAt = (url: string) => render(<MemoryRouter initialEntries={[url]}><PriceSearchPage /></MemoryRouter>);
const panel = (text: string) => screen.getByText(text).closest("[role=tabpanel]");

describe("PriceSearchPage", () => {
  it("вкладки «Один товар» и «Список из Excel»; по умолчанию — один товар; Маркета нет", () => {
    renderAt("/price-search");
    expect(screen.getByRole("tab", { name: "Один товар" })).toHaveAttribute("aria-selected", "true");
    // Обе вкладки смонтированы (результат не теряется), неактивная скрыта классом по data-state.
    expect(panel("Наименование товара")).toHaveAttribute("data-state", "active");
    expect(panel("список из файла")).toHaveAttribute("data-state", "inactive");
    expect(screen.queryByText(/Маркет/)).toBeNull();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Список из Excel" }));
    expect(screen.getByRole("tab", { name: "Список из Excel" })).toHaveAttribute("aria-selected", "true");
    expect(panel("список из файла")).toHaveAttribute("data-state", "active");
    expect(panel("Наименование товара")).toHaveAttribute("data-state", "inactive");
  });

  it("в адресе номер списка — открыта вкладка «Список из Excel»", () => {
    renderAt("/price-search?batch=b1");
    expect(screen.getByRole("tab", { name: "Список из Excel" })).toHaveAttribute("aria-selected", "true");
  });
});
