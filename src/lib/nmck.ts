// Обоснование НМЦ: типы и живой расчёт страницы. Зеркалит backend/src/utils/nmck.js
// (сервер — источник истины при сохранении): приведение к базе НДС позиции, СКО σ (n−1),
// округление денежных итогов ВНИЗ до сотых (форма Приказа №567). Исключённые (excluded)
// цены в расчёте не участвуют. Минимум и медиана — справочно для отчёта.

export type PriceKind = "kp" | "eis" | "manual";

// Цена и её источник. kind/url/date/offerName/matchNote приходят с сервера (извлечение из
// КП) или из ЕИС; excludeReason — причина исключения (для отчёта).
export interface Price {
  source: string;
  unitPrice: number | string;
  vatRate?: number | string | null;
  excluded?: boolean;
  excludeReason?: string;
  kind?: PriceKind;
  url?: string;
  date?: string;
  offerName?: string;
  matchNote?: string;
  sourcePrice?: number;
  vatExempt?: boolean;
  vatMode?: string;
  unverified?: boolean;
  contractNumber?: string;
  supplier?: string;
}
export interface Position {
  name: string; unit: string; quantity: number | string; vatRate?: number | string;
  prices: Price[]; mergedFrom?: { name: string; note: string }[];
}
export interface KpSource { name: string; date?: string | null; note?: string | null }
export interface EisItem {
  contractNumber: string; customer: string; supplier: string; supplierInn: string;
  positionName: string; unit: string; quantity: number | null; unitPrice: number;
  contractPrice: number | null; date: string; url: string;
}

export const CV_THRESHOLD = 33;
export const MIN_SOURCES = 3;
export const DEFAULT_VAT = 22; // основная ставка НДС с 01.01.2026 (ФЗ-425 от 28.11.2025)
export const VAT_OPTIONS = [22, 20, 10, 0]; // 20% — для цен из КП и контрактов до 2026 года

export const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) : "—");
const floor2 = (x: number) => Math.floor(x * 100 + 1e-6) / 100;
const round2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
export const toComparable = (raw: number, vr: number | null, target: number) =>
  vr != null && Number.isFinite(vr) && vr !== target ? (raw / (1 + vr / 100)) * (1 + target / 100) : raw;
export const priceVat = (x: Price): number | null => (x.vatRate === "" || x.vatRate == null ? null : Number(x.vatRate));
export const posVat = (p: Position) => (Number.isFinite(Number(p.vatRate)) ? Number(p.vatRate) : DEFAULT_VAT);

// Коэф. вариации по набору сопоставимых цен (для предупреждений при подборе из ЕИС).
export function cvOfPrices(prices: Price[], targetVat: number) {
  const vals = prices
    .filter((x) => !x.excluded)
    .map((x) => ({ raw: Number(x.unitPrice), c: toComparable(Number(x.unitPrice), priceVat(x), targetVat) }))
    .filter((v) => Number.isFinite(v.raw) && v.raw > 0);
  const n = vals.length;
  if (n < 2) return { cv: 0, n };
  const mean = vals.reduce((s, v) => s + v.c, 0) / n;
  if (mean <= 0) return { cv: 0, n };
  const variance = vals.reduce((s, v) => s + (v.c - mean) ** 2, 0) / (n - 1);
  return { cv: (Math.sqrt(variance) / mean) * 100, n };
}

const pct1 = (x: number) => x.toLocaleString("ru-RU", { maximumFractionDigits: 1 });

// Приведение к однородности (зеркалит backend homogenizePrices): пошагово помечает
// excluded самую отклоняющуюся цену, пока V ≤ 33% и активных источников ≥ MIN_SOURCES;
// исключённая получает причину.
export function homogenize(prices: Price[], targetVat: number): Price[] {
  const src: Price[] = prices.map(({ excludeReason: _r, ...p }) => ({ ...p, excluded: false }));
  const items = src
    .map((p, i) => ({ i, raw: Number(p.unitPrice), c: toComparable(Number(p.unitPrice), priceVat(p), targetVat) }))
    .filter((x) => Number.isFinite(x.raw) && x.raw > 0);
  const excluded = new Set<number>();
  const reasons = new Map<number, string>();
  const active = () => items.filter((x) => !excluded.has(x.i));
  const cvOf = () => {
    const a = active();
    const n = a.length;
    if (n < 2) return { cv: 0, n, mean: a[0]?.c ?? 0 };
    const mean = a.reduce((s, x) => s + x.c, 0) / n;
    if (mean <= 0) return { cv: 0, n, mean };
    const variance = a.reduce((s, x) => s + (x.c - mean) ** 2, 0) / (n - 1);
    return { cv: (Math.sqrt(variance) / mean) * 100, n, mean };
  };
  for (;;) {
    const { cv, n, mean } = cvOf();
    if (cv <= CV_THRESHOLD || n <= MIN_SOURCES) break;
    let far: (typeof items)[number] | null = null, dist = -1;
    for (const x of active()) { const d = Math.abs(x.c - mean); if (d > dist) { dist = d; far = x; } }
    if (!far) break;
    excluded.add(far.i);
    reasons.set(far.i, `Приведение к однородности: отклонение от средней ${pct1((dist / mean) * 100)} %, V до исключения ${pct1(cv)} %`);
  }
  excluded.forEach((i) => { src[i].excluded = true; src[i].excludeReason = reasons.get(i); });
  return src;
}

export function compute(positions: Position[]) {
  let nmck = 0, cvMax = 0;
  const rows = positions.map((p) => {
    const targetVat = posVat(p);
    const all = p.prices
      .map((x) => ({ raw: Number(x.unitPrice), comparable: toComparable(Number(x.unitPrice), priceVat(x), targetVat), excluded: !!x.excluded }))
      .filter((v) => Number.isFinite(v.raw) && v.raw > 0);
    const prices = all.filter((v) => !v.excluded);
    const excludedCount = all.length - prices.length;
    const n = prices.length;
    let avg = 0, std = 0, cv = 0;
    if (n > 0) {
      avg = prices.reduce((s, v) => s + v.comparable, 0) / n;
      if (n >= 2 && avg > 0) {
        const variance = prices.reduce((s, v) => s + (v.comparable - avg) ** 2, 0) / (n - 1);
        std = Math.sqrt(variance);
        cv = (std / avg) * 100;
      }
    }
    const sorted = prices.map((v) => v.comparable).sort((a, b) => a - b);
    const median = n ? (n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2) : 0;
    const qty = Number(p.quantity) || 0;
    const unitPriceRounded = floor2(avg);
    const sum = floor2(unitPriceRounded * qty); // НМЦК с учётом округления цены за ед.
    nmck += sum; cvMax = Math.max(cvMax, cv);
    return {
      avg, std, cv, sum, n, excludedCount, targetVat,
      min: n ? round2(sorted[0]) : 0, median: round2(median), max: n ? round2(sorted[n - 1]) : 0,
    };
  });
  return { rows, nmck: floor2(nmck), cvMax };
}

// Цена из найденного контракта ЕИС. Контракты до 2026 года — с НДС 20 %.
export function eisToPrice(it: EisItem): Price {
  const year = Number(String(it.date || "").match(/(\d{4})$/)?.[1]);
  return {
    kind: "eis",
    source: `${it.supplier || "Поставщик"} · контракт №${it.contractNumber}`,
    unitPrice: it.unitPrice,
    vatRate: year && year < 2026 ? 20 : DEFAULT_VAT,
    url: it.url,
    date: it.date || undefined,
    offerName: it.positionName || undefined,
    contractNumber: it.contractNumber,
    supplier: it.supplier || undefined,
  };
}

// КП без цены по позиции (зеркалит backend missingSources). В старых расчётах у цен нет
// отметки источника, «источник» — подпись модели, а не имя файла: там не считаем.
export function missingInKp(p: Position, sources: KpSource[] = []): string[] {
  if (!p.prices.some((x) => x.kind)) return [];
  const have = new Set(p.prices.filter((x) => x.kind === "kp").map((x) => x.source));
  return sources.map((s) => s.name).filter((n) => n && !have.has(n));
}
