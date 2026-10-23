export interface ModelPrice {
  model: string;
  input: string;
  output: string;
}

export interface UsageBilling {
  isFree: boolean;
  tokensBilled?: boolean;
  balanceKopecks: number;
}

// Токены входят в тариф: модель бесплатна или поштучное списание выключено
// (AI_BALANCE_BILLING=false) — тогда баланс тратится только на покупку тарифа.
export function tokensIncluded(u?: UsageBilling | null): boolean {
  return !u || u.isFree || u.tokensBilled !== true;
}

// «Баланс заканчивается» — только если токены действительно списываются с баланса.
export function balanceLow(u?: UsageBilling | null): boolean {
  return !!u && !tokensIncluded(u) && u.balanceKopecks < 5000;
}

const MODEL_PRICE_LABELS: Record<string, string> = {
  "yandexgpt/rc": "YandexGPT 5.1 Pro",
  "yandexgpt/latest": "YandexGPT 5 Pro",
  "yandexgpt-lite/latest": "YandexGPT Lite",
};

export function priceRows(prices: ModelPrice[] = [], current?: string) {
  return prices.map((p) => ({
    model: p.model,
    label: MODEL_PRICE_LABELS[p.model] ?? p.model,
    input: p.input,
    output: p.output,
    active: p.model === current,
  }));
}
