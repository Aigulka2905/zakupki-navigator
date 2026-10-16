// «Цены в магазинах», список из Excel: типы ответа /api/price-search/batch и расчёт по
// выбранным вариантам. Те же правила — в выгрузке Excel на бэкенде
// (backend/src/utils/price-batch-xlsx.js): таблица и файл должны совпадать.
import type { StoreOffer, StoreResult } from "./price-search";

export interface BatchPosition {
  n: number;
  name: string;
  qty: number | null;
  unit: string | null;
  error?: string; // позиция пропущена, напр. «наименование короче 3 символов»
  stores: StoreResult[];
}

export interface PriceBatch {
  batchId: string;
  fileName: string;
  createdAt: number;
  status: "processing" | "completed";
  progress: { done: number; total: number }; // позиции, по которым ответили все магазины
  positions: BatchPosition[];
}

/** Выбор пользователя: номер позиции → магазин → индекс варианта в выдаче. */
export type BatchChoices = Record<number, Record<string, number>>;

export interface OfferPick {
  offer: StoreOffer;
  index: number;
  counted: boolean; // идёт в минимум
}

/**
 * Вариант магазина: выбранный пользователем, иначе первый в выдаче (ближайший по названию).
 * «Похожие» засчитываются только выбранными явно — выбор подтверждает, что товар тот.
 */
export function pickOffer(s: StoreResult | undefined, choice?: number): OfferPick | null {
  if (!s || s.status !== "ok" || !s.offers.length) return null;
  if (choice !== undefined && Number.isInteger(choice) && choice >= 0 && choice < s.offers.length) {
    return { offer: s.offers[choice], index: choice, counted: true };
  }
  return { offer: s.offers[0], index: 0, counted: !s.similar };
}

/** Минимальная цена позиции среди засчитанных вариантов; при равенстве — магазин раньше по порядку. */
export function positionMin(p: BatchPosition, choices: BatchChoices): { price: number; title: string } | null {
  if (p.error) return null;
  let best: { price: number; title: string } | null = null;
  for (const s of p.stores) {
    const pick = pickOffer(s, choices[p.n]?.[s.store]);
    if (pick?.counted && (!best || pick.offer.price < best.price)) best = { price: pick.offer.price, title: s.title };
  }
  return best;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Сумма по минимальной цене; без количества — null. */
export function positionSum(p: BatchPosition, choices: BatchChoices): number | null {
  const min = positionMin(p, choices);
  return min && p.qty != null ? round2(min.price * p.qty) : null;
}

/**
 * Итог над таблицей: сумма по позициям с ценой и количеством; priced — позиций с ценой;
 * noQty — из них без количества (в сумму не вошли); total — всего позиций.
 */
export function batchTotal(positions: BatchPosition[], choices: BatchChoices) {
  let sum = 0;
  let priced = 0;
  let noQty = 0;
  for (const p of positions) {
    if (!positionMin(p, choices)) continue;
    priced += 1;
    const s = positionSum(p, choices);
    if (s == null) noQty += 1;
    else sum += s;
  }
  return { sum: round2(sum), priced, noQty, total: positions.length };
}
