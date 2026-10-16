// «Цены в магазинах»: типы ответа /api/price-search и форматирование.

export type StoreStatus = "ok" | "empty" | "too_broad" | "pending" | "unavailable" | "no_pricelist";

export interface StoreOffer {
  name: string;
  price: number;
  unit: string | null;
  stock: string | null;
  url: string;
  priceDate: string; // YYYY-MM-DD
  note: string | null;
  rrcPrice?: number | null; // Комус: рекомендованная розничная цена (в выгрузке списка — отдельной колонкой)
  match?: boolean; // ОфисМаг: подходит ли товар по словам запроса; false — «похожие», в минимум не идёт
}

export interface StoreResult {
  store: string;
  title: string;
  status: StoreStatus;
  offers: StoreOffer[];
  priceDate?: string;
  stale?: boolean; // прайсу больше 30 дней
  similar?: boolean; // точных совпадений нет — показаны похожие товары
  suggestions?: string[]; // too_broad: разделы, которые показал магазин
  cached?: boolean;
}

export interface PriceSearchResult {
  status: "processing" | "completed";
  query: string;
  startedAt: number;
  stores: StoreResult[];
}

export const STATUS_TEXT: Record<Exclude<StoreStatus, "ok">, string> = {
  pending: "ищем…",
  empty: "ничего не найдено",
  too_broad: "запрос слишком общий — уточните наименование",
  unavailable: "временно недоступен",
  no_pricelist: "прайс не загружен",
};

export const formatRub = (n: number) => `${n.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;

// Ссылку на товар рисуем только для http(s): адрес приходит со стороннего сайта.
export const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);

// «2026-10-13» → «13.10.2026» без Date: дата прайса — календарная, часовой пояс не нужен.
export const formatDate = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");

/**
 * Минимальная цена среди найденных товаров. «Похожие» (это другой товар) не участвуют — и вся
 * выдача с пометкой similar, и отдельные предложения, не подходящие по словам (match: false).
 */
export function overallMin(stores: StoreResult[]): { price: number; title: string } | null {
  let best: { price: number; title: string } | null = null;
  for (const s of stores) {
    if (s.status !== "ok" || s.similar) continue;
    for (const o of s.offers) {
      if (o.match === false) continue;
      if (!best || o.price < best.price) best = { price: o.price, title: s.title };
    }
  }
  return best;
}
