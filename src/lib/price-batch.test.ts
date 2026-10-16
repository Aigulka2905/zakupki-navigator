import { describe, it, expect } from "vitest";
import { batchTotal, pickOffer, positionMin, positionSum, type BatchPosition } from "./price-batch";
import type { StoreResult } from "./price-search";

const offer = (name: string, price: number) => ({ name, price, unit: "шт.", stock: null, url: "https://x", priceDate: "2026-10-13", note: null });
const komus = (offers: ReturnType<typeof offer>[], extra: Partial<StoreResult> = {}): StoreResult => ({ store: "komus", title: "Комус", status: "ok", offers, ...extra });
const om = (offers: ReturnType<typeof offer>[], extra: Partial<StoreResult> = {}): StoreResult => ({ store: "officemag", title: "ОфисМаг", status: "ok", offers, ...extra });
const pos = (n: number, stores: StoreResult[], extra: Partial<BatchPosition> = {}): BatchPosition => ({ n, name: `Позиция ${n}`, qty: 2, unit: "шт", stores, ...extra });

describe("pickOffer", () => {
  it("по умолчанию — первый вариант; выбранный — по индексу; за пределами выдачи — первый", () => {
    const s = komus([offer("A", 10), offer("B", 8)]);
    expect(pickOffer(s)).toMatchObject({ index: 0, counted: true });
    expect(pickOffer(s, 1)).toMatchObject({ index: 1, counted: true, offer: { name: "B" } });
    expect(pickOffer(s, 7)).toMatchObject({ index: 0 });
  });

  it("«похожие» засчитываются только выбранными явно; нет предложений — null", () => {
    const s = komus([offer("A", 10)], { similar: true });
    expect(pickOffer(s)).toMatchObject({ counted: false });
    expect(pickOffer(s, 0)).toMatchObject({ counted: true });
    expect(pickOffer(om([], { status: "pending" }))).toBeNull();
    expect(pickOffer(undefined)).toBeNull();
  });
});

describe("минимум, сумма, итог", () => {
  const positions = [
    pos(1, [komus([offer("A", 462)]), om([offer("B", 394), offer("C", 380)])]),
    pos(2, [komus([offer("D", 100)], { similar: true }), om([], { status: "empty" })]),
    pos(3, [komus([offer("E", 50)]), om([], { status: "unavailable" })], { qty: null }),
    pos(4, [], { error: "наименование короче 3 символов" }),
  ];

  it("минимум — по засчитанным вариантам; выбор меняет минимум; «похожие» без выбора не в счёт", () => {
    expect(positionMin(positions[0], {})).toEqual({ price: 394, title: "ОфисМаг" });
    expect(positionMin(positions[0], { 1: { officemag: 1 } })).toEqual({ price: 380, title: "ОфисМаг" });
    expect(positionMin(positions[1], {})).toBeNull();
    expect(positionMin(positions[1], { 2: { komus: 0 } })).toEqual({ price: 100, title: "Комус" });
    expect(positionMin(positions[3], {})).toBeNull();
  });

  it("сумма — минимум × количество; без количества — пусто", () => {
    expect(positionSum(positions[0], {})).toBe(788);
    expect(positionSum(positions[2], {})).toBeNull();
  });

  it("итог — по позициям с ценой и количеством; сколько с ценой и сколько без количества", () => {
    expect(batchTotal(positions, {})).toEqual({ sum: 788, priced: 2, noQty: 1, total: 4 });
    expect(batchTotal(positions, { 2: { komus: 0 } })).toEqual({ sum: 988, priced: 3, noQty: 1, total: 4 });
  });
});
