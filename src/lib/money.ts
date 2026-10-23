// Цена закупки для списков. null — цены нет: площадка не прислала НМЦ, и сервер отдаёт
// "0.00" (непустая строка — раньше рисовалось «0 ₽»).
export function priceLabel(price: string | number | null | undefined, { compact = true } = {}): string | null {
  const n = Number(price);
  if (price == null || price === "" || !Number.isFinite(n) || n <= 0) return null;
  if (compact && n >= 1_000_000)
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 1, notation: "compact" }).format(n);
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
}
