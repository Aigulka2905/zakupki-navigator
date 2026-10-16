import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { BatchSearch } from "./BatchSearch";
import { saveBatchTemplate, saveBatchXlsx, usePriceBatch } from "@/hooks/usePriceBatch";
import type { PriceBatch } from "@/lib/price-batch";
import type { StoreOffer } from "@/lib/price-search";

vi.mock("@/hooks/usePriceBatch", () => ({ usePriceBatch: vi.fn(), saveBatchTemplate: vi.fn(), saveBatchXlsx: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const offer = (name: string, price: number, url = `https://www.komus.ru/search?text=${price}`): StoreOffer =>
  ({ name, price, unit: "шт.", stock: null, url, priceDate: "2026-10-13", note: null });

const BATCH: PriceBatch = {
  batchId: "b1", fileName: "Канцтовары.xlsx", createdAt: 0, status: "processing", progress: { done: 1, total: 3 },
  positions: [
    { n: 1, name: "Бумага А4", qty: 10, unit: "пачка", stores: [
      { store: "komus", title: "Комус", status: "ok", priceDate: "2026-08-01", stale: true, offers: [offer("Бумага SvetoCopy А4", 462)] },
      { store: "officemag", title: "ОфисМаг", status: "ok", offers: [offer("Бумага офисная SvetoCopy", 394, "https://www.officemag.ru/catalog/goods/110086/")] },
    ] },
    { n: 2, name: "Ластик", qty: 3, unit: null, stores: [
      { store: "komus", title: "Комус", status: "ok", similar: true, offers: [offer("Ластик Koh-i-Noor", 100), offer("Ластик Faber-Castell", 90)] },
      { store: "officemag", title: "ОфисМаг", status: "pending", offers: [] },
    ] },
    { n: 3, name: "Степлер №10", qty: null, unit: null, stores: [
      { store: "komus", title: "Комус", status: "ok", offers: [offer("Степлер №10 Attache", 150)] },
      { store: "officemag", title: "ОфисМаг", status: "unavailable", offers: [] },
    ] },
    { n: 4, name: "аб", qty: null, unit: null, error: "наименование короче 3 символов", stores: [] },
    { n: 5, name: "Кресло", qty: 1, unit: null, stores: [
      { store: "komus", title: "Комус", status: "empty", offers: [] },
      { store: "officemag", title: "ОфисМаг", status: "too_broad", offers: [], suggestions: ["Кресла для руководителей", "Кресла для персонала"] },
    ] },
  ],
};

const upload = vi.fn();
const restore = vi.fn();
const hook = (over: Partial<ReturnType<typeof usePriceBatch>> = {}) =>
  vi.mocked(usePriceBatch).mockReturnValue({ upload, restore, batch: BATCH, loading: false, error: null, ...over });

function Location() {
  return <div data-testid="search">{useLocation().search}</div>;
}
const renderAt = (url = "/price-search") => render(
  <MemoryRouter initialEntries={[url]}>
    <BatchSearch />
    <Location />
  </MemoryRouter>,
);
const row = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  hook();
});

describe("BatchSearch", () => {
  it("по ?batch= список восстанавливается при открытии страницы", () => {
    renderAt("/price-search?batch=b1");
    expect(restore).toHaveBeenCalledWith("b1");
  });

  it("прогресс, цены со ссылками, «похожие» вне минимума, статусы, пропущенная позиция и итог", () => {
    renderAt();
    expect(screen.getByText("Комус — готово · ОфисМаг: 1 из 3")).toBeInTheDocument();
    expect(screen.getByText("Прайс Комуса от 01.08.2026 — мог устареть")).toBeInTheDocument();

    const paper = row("Бумага А4");
    expect(within(paper).getByRole("link", { name: /Бумага офисная SvetoCopy/ })).toHaveAttribute("href", "https://www.officemag.ru/catalog/goods/110086/");
    expect(within(paper).getAllByText("394 ₽")).toHaveLength(2); // цена ОфисМага и минимум
    expect(within(paper).getByText("3 940 ₽")).toBeInTheDocument();

    const eraser = row("Ластик");
    expect(within(eraser).getByText("похожие")).toBeInTheDocument();
    expect(within(eraser).getByText("ищем…")).toBeInTheDocument();
    expect(within(eraser).getAllByText("—")).toHaveLength(2); // ни минимума, ни суммы

    expect(within(row("Степлер №10")).getByText("временно недоступен")).toBeInTheDocument();
    expect(screen.getByText("пропущена: наименование короче 3 символов")).toBeInTheDocument();
    expect(screen.getByText(/с ценой: 2 из 5/)).toBeInTheDocument();
    expect(screen.getByText(/без количества: 1 — в итог не вошли/)).toBeInTheDocument();
  });

  it("общий запрос: «уточните», разделы магазина — в раскрытой строке", () => {
    renderAt();
    expect(within(row("Кресло")).getByText("запрос слишком общий — уточните наименование")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Варианты: Кресло" }));
    expect(screen.getByText("Разделы магазина: Кресла для руководителей, Кресла для персонала")).toBeInTheDocument();
  });

  it("выбор варианта: минимум, сумма и итог пересчитываются, выбор уходит в Excel", async () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Варианты: Ластик" }));
    fireEvent.click(screen.getByRole("button", { name: "Выбрать: Ластик Faber-Castell" }));

    const eraser = row("Ластик");
    expect(within(eraser).queryByText("похожие")).toBeNull();
    expect(within(eraser).getByText("270 ₽")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Выбран: Ластик Faber-Castell" })).toBeDisabled();
    expect(screen.getByText(/с ценой: 3 из 5/)).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Скачать Excel/ })); });
    expect(saveBatchXlsx).toHaveBeenCalledWith("b1", { 2: { komus: 1 } });
  });

  it("загрузка файла: номер списка — в адрес страницы; другой список можно загрузить, пока ищется прежний", async () => {
    upload.mockResolvedValue("b2");
    hook({ loading: true }); // прежний список ещё опрашивается
    renderAt();
    const file = new File(["x"], "Канцтовары.xlsx");
    fireEvent.change(screen.getByLabelText("Файл списка товаров"), { target: { files: [file] } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Найти цены/ })); });
    expect(upload).toHaveBeenCalledWith(file);
    expect(screen.getByTestId("search")).toHaveTextContent("?batch=b2");
  });

  it("пока идёт сама загрузка файла — «Найти цены» недоступна", () => {
    hook({ batch: null, loading: true });
    renderAt();
    fireEvent.change(screen.getByLabelText("Файл списка товаров"), { target: { files: [new File(["x"], "a.xlsx")] } });
    expect(screen.getByRole("button", { name: /Найти цены/ })).toBeDisabled();
  });

  it("шаблон скачивается; ошибка скачивания — тост с текстом", async () => {
    hook({ batch: null });
    vi.mocked(saveBatchTemplate).mockRejectedValueOnce(new Error("Не удалось скачать шаблон"));
    renderAt();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Скачать шаблон/ })); });
    expect(saveBatchTemplate).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Не удалось скачать шаблон");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("ошибка сервера при загрузке — текст под формой", () => {
    hook({ batch: null, error: "В файле 73 позиции, максимум 50 — разделите список." });
    renderAt();
    expect(screen.getByText("В файле 73 позиции, максимум 50 — разделите список.")).toBeInTheDocument();
  });
});
