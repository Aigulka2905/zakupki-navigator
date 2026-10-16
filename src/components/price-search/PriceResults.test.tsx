import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PriceResults } from "./PriceResults";
import type { PriceSearchResult, StoreOffer } from "@/lib/price-search";

const komusOffer: StoreOffer = {
  name: "Бумага SvetoCopy (А4, марка С, 80 г/кв.м, 500 л)", price: 462, unit: "шт.",
  stock: "Наличие на складе 57 шт.", url: "https://www.komus.ru/search?text=1029478", priceDate: "2026-08-01", note: "арт. 1029478",
};
const omOffer: StoreOffer = {
  name: "Бумага офисная А4, 80 г/м2, 500 л., SVETOCOPY ECO", price: 349, unit: "шт.", stock: "Наличие на складе 1060 шт.",
  url: "https://www.officemag.ru/catalog/goods/114324/", priceDate: "2026-10-13", note: "от 5 шт. — 344 ₽",
};

describe("PriceResults", () => {
  it("группы по магазинам: товары со ссылками, «ищем…», устаревший прайс, общий минимум", () => {
    const result: PriceSearchResult = {
      status: "processing", query: "бумага а4 svetocopy", startedAt: 0,
      stores: [
        { store: "komus", title: "Комус", status: "ok", similar: false, stale: true, priceDate: "2026-08-01", offers: [komusOffer] },
        { store: "officemag", title: "ОфисМаг", status: "pending", offers: [] },
      ],
    };
    render(<PriceResults result={result} />);

    const link = screen.getByRole("link", { name: /Бумага SvetoCopy/ });
    expect(link).toHaveAttribute("href", "https://www.komus.ru/search?text=1029478");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText("прайс от 01.08.2026 · базовая цена")).toBeInTheDocument();
    expect(screen.getByText("мог устареть")).toBeInTheDocument();
    expect(screen.getByText("ищем…")).toBeInTheDocument();
    expect(screen.getByText("от 462 ₽")).toBeInTheDocument();
  });

  it("«похожие» помечены и не попадают в минимум; минимум — по ОфисМагу", () => {
    const result: PriceSearchResult = {
      status: "completed", query: "кресло офисное", startedAt: 0,
      stores: [
        { store: "komus", title: "Комус", status: "ok", similar: true, priceDate: "2026-10-13", offers: [{ ...komusOffer, price: 100 }] },
        { store: "officemag", title: "ОфисМаг", status: "ok", priceDate: "2026-10-13", offers: [omOffer] },
      ],
    };
    render(<PriceResults result={result} />);
    expect(screen.getByText("точных совпадений нет — показаны похожие")).toBeInTheDocument();
    expect(screen.getByText("от 349 ₽")).toBeInTheDocument();
    expect(screen.getByText(/\(ОфисМаг\)/)).toBeInTheDocument();
    expect(screen.getByText("цены на сайте на 13.10.2026")).toBeInTheDocument();
    expect(screen.getByText("от 5 шт. — 344 ₽")).toBeInTheDocument();
  });

  it("предложение, не подходящее по словам, помечено «похожие» и не идёт в минимум", () => {
    const result: PriceSearchResult = {
      status: "completed", query: "клей момент супер", startedAt: 0,
      stores: [{ store: "officemag", title: "ОфисМаг", status: "ok", priceDate: "2026-10-16", offers: [
        { ...omOffer, name: "Клей Момент Супер, 3 г", price: 140, match: true },
        { ...omOffer, name: "Крем защитный 100 мл, АЛИРАНТА", price: 53.9, match: false },
      ] }],
    };
    render(<PriceResults result={result} />);
    expect(screen.getByText("от 140 ₽")).toBeInTheDocument();
    const cream = screen.getByText("Крем защитный 100 мл, АЛИРАНТА").closest("tr") as HTMLElement;
    expect(within(cream).getByText("похожие")).toBeInTheDocument();
    const glue = screen.getByText("Клей Момент Супер, 3 г").closest("tr") as HTMLElement;
    expect(within(glue).queryByText("похожие")).toBeNull();
  });

  it("адрес не http(s) — название без ссылки", () => {
    const result: PriceSearchResult = {
      status: "completed", query: "бумага", startedAt: 0,
      stores: [{ store: "officemag", title: "ОфисМаг", status: "ok", priceDate: "2026-10-13", offers: [{ ...omOffer, url: "javascript:alert(1)" }] }],
    };
    render(<PriceResults result={result} />);
    expect(screen.getByText(omOffer.name)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("сбой и отсутствие прайса — понятные статусы, минимума нет", () => {
    const result: PriceSearchResult = {
      status: "completed", query: "бумага", startedAt: 0,
      stores: [
        { store: "komus", title: "Комус", status: "no_pricelist", offers: [] },
        { store: "officemag", title: "ОфисМаг", status: "unavailable", offers: [] },
      ],
    };
    render(<PriceResults result={result} />);
    expect(screen.getByText("прайс не загружен")).toBeInTheDocument();
    expect(screen.getByText("временно недоступен")).toBeInTheDocument();
    expect(screen.getByText("Точных совпадений не найдено")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("общий запрос: магазин показал разделы — «уточните» и названия подразделов", () => {
    const result: PriceSearchResult = {
      status: "completed", query: "кресло офисное", startedAt: 0,
      stores: [{ store: "officemag", title: "ОфисМаг", status: "too_broad", offers: [], suggestions: ["Кресла для руководителей", "Кресла для персонала"] }],
    };
    render(<PriceResults result={result} />);
    expect(screen.getByText("запрос слишком общий — уточните наименование")).toBeInTheDocument();
    expect(screen.getByText("Разделы магазина: Кресла для руководителей, Кресла для персонала")).toBeInTheDocument();
  });
});
