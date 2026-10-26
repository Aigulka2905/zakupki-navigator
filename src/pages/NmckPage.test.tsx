import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

// Обоснование НМЦ всегда ссылалось на 44-ФЗ, даже для закупок по 223-ФЗ. Теперь закон
// выбирается перед формированием и уходит на сервер (по умолчанию — 223-ФЗ).
const calc = {
  id: "c1", title: "Бумага офисная", status: "completed", createdAt: "2026-10-20T09:00:00.000Z",
  positions: [{ name: "Бумага А4", unit: "пачка", quantity: 10, prices: [
    { source: "КП 1", unitPrice: 300 }, { source: "КП 2", unitPrice: 310 }, { source: "КП 3", unitPrice: 320 },
  ] }],
  nmck: 3100, cvMax: 3.2, justification: null, sources: [{ name: "КП 1" }, { name: "КП 2" }, { name: "КП 3" }],
};
const get = vi.fn();
const post = vi.fn();
const put = vi.fn();

vi.mock("@/lib/api-client", () => ({ default: {
  get: (url: string) => get(url),
  post: (url: string, body: unknown) => post(url, body),
  put: (url: string, body: unknown) => put(url, body),
} }));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import NmckPage from "./NmckPage";

beforeEach(() => {
  get.mockReset(); post.mockReset(); put.mockReset();
  get.mockImplementation(async (url: string) => (url === "/nmck"
    ? { data: [{ id: "c1", title: calc.title, status: "completed", nmck: 3100, createdAt: calc.createdAt }] }
    : { data: calc }));
  put.mockResolvedValue({ data: calc });
  post.mockResolvedValue({ data: { ...calc, justification: "Текст обоснования" } });
});

async function openCalc() {
  render(<MemoryRouter><NmckPage /></MemoryRouter>);
  fireEvent.click(await screen.findByText(calc.title));
  return screen.findByRole("button", { name: /Сформировать обоснование/ });
}

describe("NmckPage: закон для обоснования", () => {
  it("по умолчанию — 223-ФЗ", async () => {
    fireEvent.click(await openCalc());
    await waitFor(() => expect(post).toHaveBeenCalledWith("/nmck/c1/justify", { law: "223" }));
  });

  it("выбран 44-ФЗ — уходит 44", async () => {
    const button = await openCalc();
    fireEvent.change(screen.getByLabelText("Закон закупки"), { target: { value: "44" } });
    fireEvent.click(button);
    await waitFor(() => expect(post).toHaveBeenCalledWith("/nmck/c1/justify", { law: "44" }));
  });
});

// Отчёт НМЦД: у цены виден источник (наименование в КП, обоснование сопоставления ИИ), у
// позиции — КП, где её нет, и поиск в ЕИС прямо из позиции; найденные контракты добавляются
// ценами этой позиции (тип ЕИС, ссылка). Исключённая цена — с причиной.
describe("NmckPage: источники цен и поиск в ЕИС из позиции", () => {
  const EIS_URL = "https://zakupki.gov.ru/epz/contract/contractCard/common-info.html?reestrNumber=3772";
  const calc2 = {
    id: "c2", title: "Бумага для офиса", status: "completed", createdAt: "2026-10-27T09:00:00.000Z",
    sources: [{ name: "КП_Альфа.pdf", date: "12.10.2026" }, { name: "КП_Бета.docx", date: null }],
    positions: [{ name: "Бумага А4", unit: "пачка", quantity: 10, vatRate: 22, prices: [
      { source: "КП_Альфа.pdf", unitPrice: 300, vatRate: 22, kind: "kp", offerName: "Бумага Снегурочка А4", matchNote: "Тот же формат и плотность, другой бренд" },
      { source: "Прайс с сайта", unitPrice: 310, vatRate: 22, kind: "manual" },
    ] }],
    nmck: 3050, cvMax: 2.3, justification: null,
  };
  const item = {
    contractNumber: "3772", customer: "ГБУ", supplier: "ООО «Бумага»", supplierInn: "7700000000",
    positionName: "Бумага для офисной техники А4", unit: "пачка", quantity: 100, unitPrice: 320,
    contractPrice: 32000, date: "12.03.2026", url: EIS_URL,
  };

  beforeEach(() => {
    get.mockImplementation(async (url: string) => {
      if (url === "/nmck") return { data: [{ id: "c2", title: calc2.title, status: "completed", nmck: 3050, createdAt: calc2.createdAt }] };
      if (url === "/eis/search/s1") return { data: { status: "completed", items: [item] } };
      return { data: calc2 };
    });
    post.mockImplementation(async (url: string) => (url === "/eis/search" ? { data: { searchId: "s1" } } : { data: calc2 }));
    put.mockResolvedValue({ data: calc2 });
  });

  async function openCalc2() {
    render(<MemoryRouter><NmckPage /></MemoryRouter>);
    fireEvent.click(await screen.findByText(calc2.title));
    await screen.findByDisplayValue("Бумага А4");
  }

  it("наименование в КП, обоснование ИИ, «нет в КП», минимум и медиана", async () => {
    await openCalc2();
    expect(screen.getByText(/Бумага Снегурочка А4/)).toBeInTheDocument();
    expect(screen.getByText(/Тот же формат и плотность, другой бренд/)).toBeInTheDocument();
    expect(screen.getByText(/нет в КП: КП_Бета\.docx/)).toBeInTheDocument();
    expect(screen.getByText(/мин\.: 300/)).toBeInTheDocument();
    expect(screen.getByText(/медиана: 305/)).toBeInTheDocument();
  });

  it("«Найти в ЕИС» у позиции: запрос — её наименование, контракт добавляется ценой этой позиции", async () => {
    await openCalc2();
    fireEvent.click(screen.getByRole("button", { name: /Найти в ЕИС/ }));
    const panel = within(screen.getByRole("region", { name: /для позиции/ }));
    expect(panel.getByDisplayValue("Бумага А4")).toBeInTheDocument(); // запрос — наименование позиции
    fireEvent.click(panel.getByRole("button", { name: /^Найти$/ }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/eis/search", { query: "Бумага А4", unit: "пачка" }));
    fireEvent.click(await panel.findByRole("checkbox"));
    fireEvent.click(panel.getByRole("button", { name: /Добавить к позиции/ }));
    fireEvent.click(screen.getByRole("button", { name: /Пересчитать и сохранить/ }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    const sent = put.mock.calls.at(-1)![1] as { positions: { prices: unknown[] }[] };
    expect(sent.positions).toHaveLength(1);
    expect(sent.positions[0].prices[2]).toMatchObject({ kind: "eis", url: EIS_URL, unitPrice: 320, offerName: "Бумага для офисной техники А4" });
  });

  it("ручное исключение — поле для причины", async () => {
    await openCalc2();
    fireEvent.click(screen.getAllByRole("button", { name: /искл\./ })[1]);
    fireEvent.change(screen.getByPlaceholderText(/Причина исключения/), { target: { value: "цена устарела" } });
    fireEvent.click(screen.getByRole("button", { name: /Пересчитать и сохранить/ }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    const sent = put.mock.calls.at(-1)![1] as { positions: { prices: { excluded?: boolean; excludeReason?: string }[] }[] };
    expect(sent.positions[0].prices[1]).toMatchObject({ excluded: true, excludeReason: "цена устарела" });
  });
});
