import { describe, it, expect } from "vitest";
import { formatDate, formatRub, overallMin, type StoreResult } from "./price-search";

const offer = (price: number) => ({ name: "Бумага", price, unit: "шт.", stock: null, url: "https://x", priceDate: "2026-10-13", note: null });

describe("overallMin", () => {
  it("самая низкая цена среди найденных товаров и её магазин", () => {
    const stores: StoreResult[] = [
      { store: "komus", title: "Комус", status: "ok", offers: [offer(462), offer(384)] },
      { store: "officemag", title: "ОфисМаг", status: "ok", offers: [offer(394)] },
    ];
    expect(overallMin(stores)).toEqual({ price: 384, title: "Комус" });
  });

  it("«похожие» и магазины без результата не участвуют; ничего нет — null", () => {
    const stores: StoreResult[] = [
      { store: "komus", title: "Комус", status: "ok", similar: true, offers: [offer(10)] },
      { store: "officemag", title: "ОфисМаг", status: "pending", offers: [] },
    ];
    expect(overallMin(stores)).toBeNull();
  });
});

describe("форматирование", () => {
  it("рубли и календарная дата", () => {
    expect(formatRub(841.99)).toBe("841,99 ₽");
    expect(formatRub(394)).toBe("394 ₽");
    expect(formatDate("2026-10-13")).toBe("13.10.2026");
  });
});
