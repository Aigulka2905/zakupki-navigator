import { describe, it, expect } from "vitest";
import { compute, homogenize, eisToPrice, missingInKp, type Position, type EisItem } from "./nmck";

// Живой расчёт НМЦ на странице зеркалит backend/src/utils/nmck.js: минимум и медиана —
// справочно, причина исключения — при приведении к однородности. Цена из ЕИС знает
// источник (ссылка, дата, наименование в контракте); НДС — по дате контракта.
const pos = (prices: Position["prices"]): Position => ({ name: "Бумага А4", unit: "пачка", quantity: 10, vatRate: 22, prices });

describe("compute", () => {
  it("минимум, медиана, максимум — по учтённым ценам", () => {
    const { rows } = compute([pos([
      { source: "А", unitPrice: 300, vatRate: 22 }, { source: "Б", unitPrice: 320, vatRate: 22 },
      { source: "В", unitPrice: 400, vatRate: 22, excluded: true }, { source: "Г", unitPrice: 310, vatRate: 22 },
    ])]);
    expect([rows[0].min, rows[0].median, rows[0].max]).toEqual([300, 310, 320]);
  });
});

describe("homogenize", () => {
  it("исключённая цена — с причиной (как на сервере)", () => {
    const out = homogenize([
      { source: "А", unitPrice: 100 }, { source: "Б", unitPrice: 105 }, { source: "В", unitPrice: 98 }, { source: "Г", unitPrice: 300 },
    ], 22);
    const ex = out.find((p) => p.excluded)!;
    expect(ex.source).toBe("Г");
    expect(ex.excludeReason).toMatch(/^Приведение к однородности: отклонение от средней \d+(,\d+)? %, V до исключения \d+(,\d+)? %$/);
  });
});

describe("eisToPrice", () => {
  const item: EisItem = {
    contractNumber: "3772", customer: "ГБУ", supplier: "ООО «Бумага»", supplierInn: "7700000000",
    positionName: "Бумага для офисной техники А4", unit: "пачка", quantity: 100, unitPrice: 330,
    contractPrice: 33000, date: "12.03.2026", url: "https://zakupki.gov.ru/epz/contract/contractCard/common-info.html?reestrNumber=3772",
  };
  it("тип ЕИС, ссылка, дата, наименование в контракте; НДС 22 % с 2026 года", () => {
    expect(eisToPrice(item)).toMatchObject({
      kind: "eis", source: "ООО «Бумага» · контракт №3772", unitPrice: 330, vatRate: 22,
      url: item.url, date: "12.03.2026", offerName: "Бумага для офисной техники А4", contractNumber: "3772",
    });
  });
  it("контракт 2025 года — НДС 20 %", () => {
    expect(eisToPrice({ ...item, date: "20.11.2025" }).vatRate).toBe(20);
  });
});

describe("missingInKp", () => {
  const sources = [{ name: "КП_Альфа.pdf" }, { name: "КП_Бета.docx" }];
  it("КП без цены по позиции", () => {
    expect(missingInKp(pos([{ source: "КП_Альфа.pdf", unitPrice: 1, kind: "kp" }]), sources)).toEqual(["КП_Бета.docx"]);
  });
  it("старый расчёт без отметок источника — пусто", () => {
    expect(missingInKp(pos([{ source: "КП 1", unitPrice: 1 }]), sources)).toEqual([]);
  });
});
