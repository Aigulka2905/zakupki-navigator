import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KomusPricelistCard } from "./KomusPricelistCard";
import { useStorePrices, useSyncKomusApi, useUploadKomusPricelist } from "@/hooks/useAdmin";

vi.mock("@/hooks/useAdmin", () => ({ useStorePrices: vi.fn(), useUploadKomusPricelist: vi.fn(), useSyncKomusApi: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mutate = vi.fn();
const syncMutate = vi.fn();
type StoreData = ReturnType<typeof useStorePrices>;
const withData = (data: unknown) => vi.mocked(useStorePrices).mockReturnValue({ data } as unknown as StoreData);
const FILE_PRICE = { priceDate: "2026-10-13", itemsCount: 41105, source: "file", fileName: "komus_opt_price_9.xlsx", uploadedBy: "admin@zakupkiai.ru", uploadedAt: "2026-10-13T09:00:00Z" };

beforeEach(() => {
  mutate.mockReset();
  syncMutate.mockReset();
  vi.mocked(useUploadKomusPricelist).mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<typeof useUploadKomusPricelist>);
  vi.mocked(useSyncKomusApi).mockReturnValue({ mutate: syncMutate, isPending: false } as unknown as ReturnType<typeof useSyncKomusApi>);
});

describe("KomusPricelistCard", () => {
  it("сведения о текущем прайсе: дата, число товаров, кто загрузил", () => {
    withData({ komus: FILE_PRICE, api: { configured: false, sync: null } });
    render(<KomusPricelistCard />);
    expect(screen.getByText("13.10.2026")).toBeInTheDocument();
    expect(screen.getByText(/^41\s105$/)).toBeInTheDocument(); // разделитель тысяч — неразрывный пробел
    expect(screen.getByText(/admin@zakupkiai\.ru \(komus_opt_price_9\.xlsx\)/)).toBeInTheDocument();
  });

  it("прайса нет — так и сказано; выбранный файл уходит на загрузку", () => {
    withData({ komus: null, api: { configured: false, sync: null } });
    render(<KomusPricelistCard />);
    expect(screen.getByText(/Прайс не загружен/)).toBeInTheDocument();

    const file = new File(["x"], "komus_opt_price_9.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Файл прайс-листа Комуса"), { target: { files: [file] } });
    expect(screen.getByText("komus_opt_price_9.csv")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Загрузить прайс/ }));
    expect(mutate).toHaveBeenCalledWith(file, expect.any(Object));
  });

  it("API не настроен — подсказка про KOMUS_API_TOKEN, кнопки обновления нет", () => {
    withData({ komus: FILE_PRICE, api: { configured: false, sync: null } });
    render(<KomusPricelistCard />);
    expect(screen.getByText(/KOMUS_API_TOKEN/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Обновить из API/ })).toBeNull();
  });

  it("прайс из API: источник в сведениях, итог последнего обновления, кнопка запускает обновление", () => {
    withData({
      komus: { ...FILE_PRICE, source: "api", itemsCount: 48012, fileName: null, uploadedBy: "API Комус ОПТ", uploadedAt: "2026-10-15T02:32:41Z" },
      api: { configured: true, sync: { state: "done", finishedAt: "2026-10-15T02:32:41Z", itemsCount: 48012, skipped: 3 } },
    });
    render(<KomusPricelistCard />);
    expect(screen.getByText(/обновлён из API/)).toBeInTheDocument();
    expect(screen.getByText(/Последнее обновление из API:.*товаров 48\s012/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Обновить из API/ }));
    expect(syncMutate).toHaveBeenCalledTimes(1);
  });

  it("обновление идёт — кнопка недоступна; не удалось — показана причина", () => {
    withData({ komus: FILE_PRICE, api: { configured: true, sync: { state: "running", startedAt: "2026-10-15T09:00:00Z" } } });
    const { unmount } = render(<KomusPricelistCard />);
    expect(screen.getByText(/Обновление из API идёт/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Обновить из API/ })).toBeDisabled();
    unmount();

    withData({ komus: FILE_PRICE, api: { configured: true, sync: { state: "failed", error: "API Комуса отклонил токен: он неверный или временно заблокирован." } } });
    render(<KomusPricelistCard />);
    expect(screen.getByText(/не удалось: API Комуса отклонил токен/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Обновить из API/ })).toBeEnabled();
  });
});
