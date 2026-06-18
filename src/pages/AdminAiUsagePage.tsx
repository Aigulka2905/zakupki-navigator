import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { RefreshCw, Zap, DollarSign, BarChart2, AlertTriangle, CheckCircle2, ArrowRight, Star, RotateCcw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSetActiveModel, useResetActiveModel, useResetModelLimit, useSetFallbackModel, useResetFallbackModel, useAiPresetModels } from "@/hooks/useAdmin";
import type { AiPresetModel } from "@/hooks/useAdmin";

// ── Types ──────────────────────────────────────────────────────

interface ModelStat {
  model: string;
  provider: string;
  source: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costKopecks: number;
}

interface Totals {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costKopecks: number;
}

interface DayPoint {
  date: string;
  totalTokens: number;
  costKopecks: number;
  localTokens: number;
  yandexTokens: number;
}

interface ModelLimit {
  model: string;
  provider: string;
  primary: boolean;
  limitRequests: number;
  limitTokens: number;
  remainingRequests: number;
  remainingTokens: number;
  resetRequests: string;
  resetTokens: string;
}

interface YandexBilling {
  id: string;
  name: string;
  balanceAmount: string | null;
  currency: string;
}

interface ChainEntry {
  id: string;
  provider: "local" | "yandex";
  model: string;
  primary: boolean;
  exhausted: boolean;
  resetAt: number | null;
}

interface AiUsageStats {
  monthly: { models: ModelStat[]; totals: Totals };
  allTime: { models: ModelStat[]; totals: Totals };
  daily: DayPoint[];
  chain: ChainEntry[];
  modelLimits: ModelLimit[];
  providers: {
    yandex: { billing: YandexBilling | null };
  };
}

// ── API ────────────────────────────────────────────────────────

async function fetchAiUsage(): Promise<AiUsageStats> {
  const { data } = await apiClient.get<AiUsageStats>("/admin/ai-usage");
  return data;
}

// ── Helpers ────────────────────────────────────────────────────

function rub(kopecks: number) {
  return (kopecks / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function providerColor(p: string) {
  if (p === "yandex") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
}

function providerBadgeCls(provider: string) {
  if (provider === "yandex") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
}

function modelLabel(preset: AiPresetModel) {
  return `${preset.label} — ${preset.provider}${preset.note ? ` (${preset.note})` : ""}`;
}

// ── Provider chain status ──────────────────────────────────────

function ProviderChain({ chain, onRefetch }: { chain: ChainEntry[]; onRefetch: () => void }) {
  const { mutate: setModel,    isPending: settingModel }    = useSetActiveModel();
  const { mutate: resetModel }                               = useResetActiveModel();
  const { mutate: setFallback, isPending: settingFallback } = useSetFallbackModel();
  const { mutate: resetFallback }                            = useResetFallbackModel();
  const { mutate: resetLimit }                               = useResetModelLimit();
  const { data: presets = [] }                               = useAiPresetModels();

  if (!chain?.length) return null;

  const primaryEntry  = chain.find(e => e.primary);
  const fallbackEntry = chain.find(e => !e.primary && e.provider !== "yandex");

  function timeLeft(resetAt: number | null) {
    if (!resetAt) return null;
    const ms = resetAt - Date.now();
    if (ms <= 0) return null;
    const s = Math.ceil(ms / 1000);
    return s < 60 ? `${s}с` : `${Math.ceil(s / 60)}мин`;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Цепочка провайдеров</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              При исчерпании лимита автоматически переключается на следующий
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary model selector */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">1-я:</span>
              <Select
                value={primaryEntry?.model ?? ""}
                onValueChange={(m) => setModel(m, { onSuccess: onRefetch })}
                disabled={settingModel || presets.length === 0}
              >
                <SelectTrigger className="h-7 w-56 text-xs">
                  <SelectValue placeholder="Выбрать основную" />
                </SelectTrigger>
                <SelectContent>
                  {presets
                    .filter(p => p.model !== fallbackEntry?.model)
                    .map(p => (
                      <SelectItem key={p.model} value={p.model} className="text-xs">
                        {modelLabel(p)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => resetModel(undefined, { onSuccess: onRefetch })}
                title="Сбросить к значению из .env"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>

            {/* Fallback model selector */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">2-я:</span>
              <Select
                value={fallbackEntry?.model ?? ""}
                onValueChange={(m) => setFallback(m, { onSuccess: onRefetch })}
                disabled={settingFallback || presets.length === 0}
              >
                <SelectTrigger className="h-7 w-56 text-xs">
                  <SelectValue placeholder="Выбрать резервную" />
                </SelectTrigger>
                <SelectContent>
                  {presets
                    .filter(p => p.model !== primaryEntry?.model)
                    .map(p => (
                      <SelectItem key={p.model} value={p.model} className="text-xs">
                        {modelLabel(p)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => resetFallback(undefined, { onSuccess: onRefetch })}
                title="Сбросить к значению из .env"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          {chain.map((entry, i) => {
            const left = timeLeft(entry.resetAt);
            return (
              <div key={entry.id} className="flex items-center gap-2">
                <div className={`group flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium
                  ${entry.primary
                    ? "border-indigo-400/50 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                    : entry.exhausted
                    ? "border-amber-400/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-border bg-muted/30 text-muted-foreground"
                  }`}>
                  {entry.primary
                    ? <Star className="h-3 w-3 fill-current" />
                    : entry.exhausted
                    ? <AlertTriangle className="h-3 w-3" />
                    : <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  }
                  <span className="font-mono">{entry.model}</span>
                  <Badge variant="outline" className={`text-[10px] ml-1 ${providerBadgeCls(entry.provider)}`}>
                    {entry.provider}
                  </Badge>
                  {entry.primary && <span className="text-[10px] text-indigo-400 ml-0.5">активная</span>}
                  {entry.exhausted && left && (
                    <span className="text-[10px] text-amber-500">сброс: {left}</span>
                  )}
                  {entry.exhausted && (
                    <button
                      onClick={() => resetLimit(entry.model, { onSuccess: onRefetch })}
                      className="text-[10px] underline text-amber-600 dark:text-amber-400 hover:no-underline ml-0.5"
                      title="Принудительно сбросить лимит"
                    >
                      сбросить
                    </button>
                  )}
                </div>
                {i < chain.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function StatCard({ title, value, sub, icon: Icon, warn }: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; warn?: boolean;
}) {
  return (
    <Card className={warn ? "border-amber-400 dark:border-amber-600" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${warn ? "text-amber-500" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold ${warn ? "text-amber-600 dark:text-amber-400" : ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function DailyChart({ data }: { data: DayPoint[] }) {
  const fmt = (v: number) => fmtTokens(v);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Токены по дням (последние 30 дней)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }}
              tickFormatter={(d) => d.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} width={48} />
            <Tooltip
              formatter={(v: number, name: string) => [fmtTokens(v), name]}
              labelFormatter={(l) => `Дата: ${l}`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="localTokens"  name="Локальная" stackId="1"
              stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
            <Area type="monotone" dataKey="yandexTokens" name="Yandex"    stackId="1"
              stroke="#eab308" fill="#eab308" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function ModelsTable({ models, title }: { models: ModelStat[]; title: string }) {
  if (!models.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Модель</TableHead>
              <TableHead>Провайдер</TableHead>
              <TableHead className="text-right">Вход</TableHead>
              <TableHead className="text-right">Выход</TableHead>
              <TableHead className="text-right">Итого</TableHead>
              <TableHead className="text-right">Стоимость</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((m) => (
              <TableRow key={`${m.model}-${m.source}`}>
                <TableCell className="font-mono text-xs">{m.model}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${providerColor(m.provider)}`}>
                    {m.provider}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-xs">{fmtTokens(m.inputTokens)}</TableCell>
                <TableCell className="text-right text-xs">{fmtTokens(m.outputTokens)}</TableCell>
                <TableCell className="text-right text-xs font-medium">{fmtTokens(m.totalTokens)}</TableCell>
                <TableCell className="text-right text-xs">{rub(m.costKopecks)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ModelLimitsPanel({ limits, allTimeModels }: {
  limits: ModelLimit[];
  allTimeModels: ModelStat[];
}) {
  if (!limits.length) return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Лимиты моделей</CardTitle></CardHeader>
      <CardContent><p className="text-xs text-muted-foreground">API-ключи не настроены или провайдер недоступен</p></CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Лимиты моделей (текущая минута)</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Модель</TableHead>
              <TableHead>Провайдер</TableHead>
              <TableHead className="text-right">Всего (БД)</TableHead>
              <TableHead className="text-right">Использовано / лимит</TableHead>
              <TableHead className="text-right">Сброс</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {limits.map((m) => {
              const dbStat      = allTimeModels.find(s => s.model === m.model);
              const usedTokens  = dbStat?.totalTokens ?? 0;
              const spentTokens = m.limitTokens - m.remainingTokens;
              const pct         = m.limitTokens > 0 ? spentTokens / m.limitTokens : 0;
              return (
                <TableRow key={m.model}>
                  <TableCell className="font-mono text-xs">
                    {m.primary && <span className="text-indigo-400 mr-1">★</span>}
                    {m.model}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${providerColor(m.provider)}`}>
                      {m.provider}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium">{fmtTokens(usedTokens)}</TableCell>
                  <TableCell className="text-right text-xs">
                    <span className={pct > 0.8 ? "text-amber-500 font-medium" : ""}>
                      {fmtTokens(spentTokens)}
                    </span>
                    {" / "}{fmtTokens(m.limitTokens)}
                    {m.limitTokens > 0 && (
                      <span className="text-muted-foreground ml-1">({Math.round(pct * 100)}%)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {m.resetTokens || "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function YandexBillingPanel({ billing }: { billing: YandexBilling | null }) {
  if (!billing) return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Яндекс Облако — баланс</CardTitle></CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          YANDEX_OAUTH_TOKEN не настроен.{" "}
          <a
            href="https://oauth.yandex.ru/authorize?response_type=token&client_id=1a6990aa636648e9b2ef855fa7bec2fb"
            target="_blank" rel="noreferrer"
            className="underline text-primary"
          >
            Получить токен
          </a>{" "}и добавить в .env
        </p>
      </CardContent>
    </Card>
  );

  const balance = billing.balanceAmount ? parseFloat(billing.balanceAmount) : null;
  const low = balance !== null && balance < 100;

  return (
    <Card className={low ? "border-amber-400 dark:border-amber-600" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Яндекс Облако — баланс</CardTitle>
        {low
          ? <AlertTriangle className="h-4 w-4 text-amber-500" />
          : <CheckCircle2 className="h-4 w-4 text-green-500" />
        }
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold ${low ? "text-amber-600 dark:text-amber-400" : ""}`}>
          {balance !== null ? `${balance.toFixed(2)} ₽` : "—"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{billing.name}</p>
        {low && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            Баланс ниже порога. Пополните счёт в Яндекс Облаке.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main component ─────────────────────────────────────────────

export function AdminAiUsageTab() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-ai-usage"],
    queryFn: fetchAiUsage,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Загрузка статистики…</div>;
  }

  if (!data) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Нет данных</div>;
  }

  const { monthly, allTime, daily, providers, chain, modelLimits } = data;
  const hasYandexToken = !!providers.yandex.billing;
  const balance = providers.yandex.billing?.balanceAmount
    ? parseFloat(providers.yandex.billing.balanceAmount)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Расходы за текущий месяц и лимиты провайдеров</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Обновить
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Токены за месяц"
          value={fmtTokens(monthly.totals.totalTokens)}
          sub={`${fmtTokens(monthly.totals.inputTokens)} вх / ${fmtTokens(monthly.totals.outputTokens)} вых`}
          icon={Zap}
        />
        <StatCard
          title="Расходы за месяц"
          value={rub(monthly.totals.costKopecks)}
          sub="по тарифной таблице"
          icon={DollarSign}
        />
        <StatCard
          title="Токены за всё время"
          value={fmtTokens(allTime.totals.totalTokens)}
          sub={rub(allTime.totals.costKopecks)}
          icon={BarChart2}
        />
        <StatCard
          title="Баланс Яндекса"
          value={balance !== null ? `${balance.toFixed(2)} ₽` : "—"}
          sub={
            !hasYandexToken
              ? "YANDEX_OAUTH_TOKEN не задан"
              : balance === null
              ? "Баланс недоступен"
              : undefined
          }
          icon={balance !== null && balance < 100 ? AlertTriangle : DollarSign}
          warn={balance !== null && balance < 100}
        />
      </div>

      {/* Provider chain */}
      <ProviderChain chain={chain} onRefetch={refetch} />

      {/* Daily chart */}
      {daily.length > 0 && <DailyChart data={daily} />}

      {/* Provider panels */}
      <div className="grid md:grid-cols-2 gap-4">
        <ModelLimitsPanel limits={modelLimits} allTimeModels={allTime.models} />
        <YandexBillingPanel billing={providers.yandex.billing} />
      </div>

      {/* Monthly breakdown */}
      <ModelsTable models={monthly.models} title="Разбивка за месяц по моделям" />
    </div>
  );
}
