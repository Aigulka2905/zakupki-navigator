import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KomusPricelistCard } from "./KomusPricelistCard";
import { useStorePrices, useUploadKomusPricelist } from "@/hooks/useAdmin";

vi.mock("@/hooks/useAdmin", () => ({ useStorePrices: vi.fn(), useUploadKomusPricelist: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mutate = vi.fn();

beforeEach(() => {
  mutate.mockReset();
  vi.mocked(useUploadKomusPricelist).mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<typeof useUploadKomusPricelist>);
});

describe("KomusPricelistCard", () => {
  it("сведения о текущем прайсе: дата, число товаров, кто загрузил", () => {
    vi.mocked(useStorePrices).mockReturnValue({
      data: { komus: { priceDate: "2026-10-13", itemsCount: 41105, fileName: "komus_opt_price_9.xlsx", uploadedBy: "admin@zakupkiai.ru", uploadedAt: "2026-10-13T09:00:00Z" } },
    } as unknown as ReturnType<typeof useStorePrices>);
    render(<KomusPricelistCard />);
    expect(screen.getByText("13.10.2026")).toBeInTheDocument();
    expect(screen.getByText(/^41\s105$/)).toBeInTheDocument(); // разделитель тысяч — неразрывный пробел
    expect(screen.getByText(/admin@zakupkiai\.ru \(komus_opt_price_9\.xlsx\)/)).toBeInTheDocument();
  });

  it("прайса нет — так и сказано; выбранный файл уходит на загрузку", () => {
    vi.mocked(useStorePrices).mockReturnValue({ data: { komus: null } } as unknown as ReturnType<typeof useStorePrices>);
    render(<KomusPricelistCard />);
    expect(screen.getByText(/Прайс не загружен/)).toBeInTheDocument();

    const file = new File(["x"], "komus_opt_price_9.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Файл прайс-листа Комуса"), { target: { files: [file] } });
    expect(screen.getByText("komus_opt_price_9.csv")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Загрузить прайс/ }));
    expect(mutate).toHaveBeenCalledWith(file, expect.any(Object));
  });
});
