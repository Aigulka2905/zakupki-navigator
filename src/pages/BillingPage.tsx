import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { openExternal } from "@/lib/url";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CreditCard,
  Zap,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Wallet,
  BarChart3,
  ExternalLink,
  MessageSquare,
  FileSearch,
  Crown,
  RefreshCw,
  Sparkles,
  Users,
  Infinity,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import apiClient from "@/lib/api-client";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────

interface PlanInfo {
  key: string;
  name: string;
  chatRequestsUsed: number;
  chatRequestsLimit: number | null;
  analysesUsed: number;
  analysesLimit: number | null;
}

interface UsageData {
  currentModel: string;
  isFree: boolean;
  pricePerKToken: string;
  monthlyTokens: number;
  allTimeTokens: number;
  monthlyCostRubles: string;
  balanceRubles: string;
  balanceKopecks: number;
  plan: PlanInfo;
}

interface Payment {
  id: string;
  amountKopecks: number;
  amountRubles: string;
  status: "pending" | "succeeded" | "failed" | "cancelled";
  provider: string;
  description: string | null;
  createdAt: string;
  confirmUrl: string | null;
}

// ── API ───────────────────────────────────────────────────────

async function fetchUsage(): Promise<UsageData> {
  const { data } = await apiClient.get<UsageData>("/billing/usage");
  return data;
}

async function fetchPayments(): Promise<Payment[]> {
  const { data } = await apiClient.get<Payment[]>("/billing/payments");
  return data;
}

async function createTopup(amount: number): Promise<{ confirmUrl: string }> {
  const { data } = await apiClient.post<{ confirmUrl: string }>("/billing/topup", { amount });
  return data;
}

async function subscribePlan(plan: string): Promise<{ plan: string }> {
  const { data } = await apiClient.post<{ plan: string }>("/billing/subscribe", { plan });
  return data;
}

async function syncPayment(id: string): Promise<{ status: string; alreadyProcessed?: boolean }> {
  const { data } = await apiClient.post(`/billing/sync-payment/${id}`);
  return data;
}

// ── Plan config ───────────────────────────────────────────────

interface PlanMeta {
  label: string;
  priceRub: number;
  priceLabel: string;
  color: string;
  ringColor: string;
  bgColor: string;
  badgeColor: string;
  chatRequests: number | null;
  analyses: number | null;
  users: number | null;
  features: string[];
  popular?: boolean;
}

const PLAN_META: Record<string, PlanMeta> = {
  free: {
    label: "Free",
    priceRub: 0,
    priceLabel: "Бесплатно",
    color: "text-muted-foreground",
    ringColor: "ring-border",
    bgColor: "bg-muted/20",
    badgeColor: "bg-muted text-muted-foreground",
    chatRequests: 30,
    analyses: 1,
    users: 1,
    features: ["30 AI-запросов в месяц", "1 анализ документа", "AI-ассистент ZakupkiAI", "1 пользователь"],
  },
  pro: {
    label: "Pro",
    priceRub: 990,
    priceLabel: "990 ₽/мес",
    color: "text-indigo-400",
    ringColor: "ring-indigo-500/40",
    bgColor: "bg-indigo-500/5",
    badgeColor: "bg-indigo-500/20 text-indigo-400",
    chatRequests: 500,
    analyses: 20,
    users: 1,
    popular: true,
    features: ["500 AI-запросов в месяц", "20 анализов документов", "AI-ассистент (YandexGPT)", "1 пользователь", "Приоритетная поддержка"],
  },
  business: {
    label: "Business",
    priceRub: 2990,
    priceLabel: "2 990 ₽/мес",
    color: "text-violet-400",
    ringColor: "ring-violet-500/40",
    bgColor: "bg-violet-500/5",
    badgeColor: "bg-violet-500/20 text-violet-400",
    chatRequests: 2000,
    analyses: 100,
    users: 3,
    features: ["2 000 AI-запросов в месяц", "100 анализов документов", "AI-ассистент (YandexGPT)", "До 3 пользователей", "Выгрузка отчётов"],
  },
  enterprise: {
    label: "Enterprise",
    priceRub: 9990,
    priceLabel: "от 9 990 ₽/мес",
    color: "text-amber-400",
    ringColor: "ring-amber-500/40",
    bgColor: "bg-amber-500/5",
    badgeColor: "bg-amber-500/20 text-amber-400",
    chatRequests: null,
    analyses: null,
    users: null,
    features: ["Безлимитные AI-запросы", "Безлимитные анализы", "YandexGPT Pro приоритет", "Безлимит пользователей", "Выделенная поддержка", "SLA 99.9%"],
  },
};

const PLAN_ORDER = ["free", "pro", "business", "enterprise"];

// ── Helpers ───────────────────────────────────────────────────

const MODEL_LABELS: Record<string, string> = {
  "yandexgpt/latest":       "YandexGPT Pro",
  "yandexgpt-lite/latest":  "YandexGPT Lite",
};
// Базовый AI-ассистент (тарифы Free/Pro/Business) показывается нейтрально, без
// раскрытия конкретной модели. Платный YandexGPT — по названию (см. карту выше).
const DEFAULT_MODEL_LABEL = "AI-ассистент ZakupkiAI";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} М`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} К`;
  return String(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatLimit(n: number | null): string {
  return n === null ? "∞" : n.toLocaleString("ru-RU");
}

// ── LimitBar ──────────────────────────────────────────────────

function LimitBar({ used, limit, label, icon }: {
  used: number; limit: number | null; label: string; icon: React.ReactNode;
}) {
  const isUnlimited = limit === null;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / limit!) * 100));
  const isWarning = !isUnlimited && pct >= 80;
  const isDanger  = !isUnlimited && pct >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className={cn("font-medium tabular-nums", isDanger ? "text-destructive" : isWarning ? "text-amber-500" : "")}>
          {isUnlimited ? <span className="text-emerald-500">∞ безлимит</span> : <>{used} / {limit}</>}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", isDanger ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-indigo-500")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────

function StatusBadge({ status }: { status: Payment["status"] }) {
  const map = {
    succeeded: { label: "Оплачено",  className: "bg-emerald-500/10 text-emerald-500" },
    pending:   { label: "Ожидание",  className: "bg-amber-500/10 text-amber-500" },
    failed:    { label: "Ошибка",    className: "bg-red-500/10 text-red-500" },
    cancelled: { label: "Отменён",   className: "bg-muted text-muted-foreground" },
  } as const;
  const { label, className } = map[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", className)}>
      {label}
    </span>
  );
}

// ── TopupModal ────────────────────────────────────────────────

const PRESET_AMOUNTS = [500, 1000, 2000, 5000];

function TopupModal({ open, onClose, onConfirm, isPending }: {
  open: boolean; onClose: () => void;
  onConfirm: (amount: number) => void; isPending: boolean;
}) {
  const [amount, setAmount] = useState<string>("1000");
  const parsed = parseInt(amount, 10);
  const valid = !isNaN(parsed) && parsed >= 100 && parsed <= 100000;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-indigo-400" />
            Пополнить баланс
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-4 gap-2">
            {PRESET_AMOUNTS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  amount === String(v)
                    ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-400"
                    : "border-border hover:border-indigo-500/30 hover:bg-muted/50",
                )}
              >
                {v.toLocaleString("ru-RU")} ₽
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-amount">Другая сумма (₽)</Label>
            <Input
              id="custom-amount" type="number" min={100} max={100000}
              value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500"
            />
            {!valid && amount !== "" && (
              <p className="text-xs text-destructive">Сумма от 100 до 100 000 ₽</p>
            )}
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p>Оплата через ЮKassa — банковская карта, СБП, Яндекс Пэй и др.</p>
            <p>После подтверждения баланс пополняется автоматически.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>Отмена</Button>
            <Button className="flex-1" disabled={!valid || isPending} onClick={() => onConfirm(parsed)}>
              {isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Создание...</>
                : `Оплатить ${valid ? parsed.toLocaleString("ru-RU") : "..."} ₽`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── SubscribeModal ────────────────────────────────────────────

function SubscribeModal({ planKey, balanceKopecks, onClose, onConfirm, isPending }: {
  planKey: string; balanceKopecks: number;
  onClose: () => void; onConfirm: () => void; isPending: boolean;
}) {
  const plan = PLAN_META[planKey];
  if (!plan) return null;

  const priceKopecks = plan.priceRub * 100;
  const hasEnough = balanceKopecks >= priceKopecks;
  const balanceRub = (balanceKopecks / 100).toFixed(2);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className={cn("h-5 w-5", plan.color)} />
            Подключить тариф {plan.label}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Plan summary */}
          <div className={cn("rounded-xl border p-4 space-y-2", plan.bgColor, `ring-1 ${plan.ringColor}`)}>
            <div className="flex items-center justify-between">
              <span className={cn("text-lg font-bold", plan.color)}>{plan.label}</span>
              <span className="text-sm font-semibold text-foreground">{plan.priceLabel}</span>
            </div>
            <ul className="space-y-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Balance check */}
          <div className={cn(
            "rounded-lg border p-3 text-sm",
            hasEnough ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5",
          )}>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Баланс</span>
              <span className={cn("font-semibold", hasEnough ? "text-foreground" : "text-red-400")}>
                {balanceRub} ₽
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-muted-foreground">Спишется</span>
              <span className="font-semibold text-foreground">−{plan.priceRub.toLocaleString("ru-RU")} ₽</span>
            </div>
            {!hasEnough && (
              <p className="mt-2 text-xs text-red-400">
                Недостаточно средств. Пополните баланс на {((priceKopecks - balanceKopecks) / 100).toFixed(2)} ₽.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>Отмена</Button>
            <Button className="flex-1" disabled={!hasEnough || isPending} onClick={onConfirm}>
              {isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Подключение...</>
                : "Подключить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── PlanCard ──────────────────────────────────────────────────

function PlanCard({ planKey, currentPlanKey, balanceKopecks, onSelect }: {
  planKey: string; currentPlanKey: string; balanceKopecks: number;
  onSelect: (pk: string) => void;
}) {
  const plan = PLAN_META[planKey];
  const isCurrent = planKey === currentPlanKey;
  const currentIdx = PLAN_ORDER.indexOf(currentPlanKey);
  const thisIdx = PLAN_ORDER.indexOf(planKey);
  const isUpgrade = thisIdx > currentIdx;
  const isDowngrade = thisIdx < currentIdx;

  return (
    <div className={cn(
      "relative flex flex-col rounded-xl border p-5 transition-all",
      isCurrent
        ? `${plan.bgColor} ring-2 ${plan.ringColor}`
        : "border-border/50 bg-card/40 hover:border-border",
    )}>
      {plan.popular && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-indigo-500 px-3 py-0.5 text-[11px] font-semibold text-white shadow">
            Популярный
          </span>
        </div>
      )}

      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className={cn("rounded-full px-3 py-0.5 text-[11px] font-semibold shadow", plan.badgeColor)}>
            Текущий
          </span>
        </div>
      )}

      <div className="mb-4">
        <div className={cn("text-[15px] font-bold", plan.color)}>{plan.label}</div>
        <div className="mt-0.5 text-[22px] font-bold text-foreground">{plan.priceLabel}</div>
      </div>

      {/* Limits */}
      <div className="mb-4 space-y-2 text-[13px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" />AI-запросы</span>
          <span className="font-semibold">{formatLimit(plan.chatRequests)}/мес</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground flex items-center gap-1.5"><FileSearch className="h-3.5 w-3.5" />Анализы</span>
          <span className="font-semibold">{formatLimit(plan.analyses)}/мес</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Пользователи</span>
          <span className="font-semibold">{plan.users === null ? <Infinity className="h-4 w-4 inline" /> : plan.users}</span>
        </div>
      </div>

      {/* Features */}
      <ul className="mb-5 flex-1 space-y-1.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[12px] text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            {f}
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <div className={cn("rounded-lg py-2 text-center text-[13px] font-medium", plan.badgeColor)}>
          Активен
        </div>
      ) : (
        <Button
          size="sm"
          variant={isUpgrade ? "default" : "outline"}
          className="w-full text-[13px]"
          onClick={() => onSelect(planKey)}
        >
          {isUpgrade ? (
            <><Sparkles className="mr-1.5 h-3.5 w-3.5" />Перейти на {plan.label}</>
          ) : isDowngrade ? (
            `Перейти на ${plan.label}`
          ) : (
            `Выбрать ${plan.label}`
          )}
        </Button>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

const BillingPage = () => {
  const qc = useQueryClient();
  const [topupOpen, setTopupOpen]     = useState(false);
  const [subscribeTo, setSubscribeTo] = useState<string | null>(null);
  const [syncingId, setSyncingId]     = useState<string | null>(null);

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ["billing-usage"],
    queryFn: fetchUsage,
    staleTime: 60_000,
  } as Parameters<typeof useQuery>[0]);

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["billing-payments"],
    queryFn: fetchPayments,
    staleTime: 30_000,
  } as Parameters<typeof useQuery>[0]);

  // Авто-зачисление при возврате с оплаты. ЮKassa после успешной оплаты
  // перенаправляет на /billing?status=success. Раньше баланс обновлялся только
  // после ручного «Обновить» (или прихода вебхука, который может отстать/не
  // дойти в dev). Теперь при возврате сразу тянем статус платежа из API ЮKassa
  // (тот же идемпотентный syncPayment) и зачисляем баланс. Короткий поллинг —
  // на случай, если у ЮKassa расчёт занял пару секунд.
  const [searchParams, setSearchParams] = useSearchParams();
  const autoSyncStarted = useRef(false);
  useEffect(() => {
    if (searchParams.get("status") !== "success" || autoSyncStarted.current) return;
    autoSyncStarted.current = true;

    // Убираем ?status из URL, чтобы обновление страницы не запускало заново.
    const next = new URLSearchParams(searchParams);
    next.delete("status");
    setSearchParams(next, { replace: true });

    const loading = toast.loading("Подтверждаем оплату…");
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      let credited = false;
      let stillPending = false;
      try {
        const list = await fetchPayments(); // свежий список, не из кэша
        for (const p of list.filter((x) => x.status === "pending")) {
          try {
            const r = await syncPayment(p.id);
            if (r.status === "succeeded") credited = true;
            else if (r.status === "pending" || r.status === "processing") stillPending = true;
          } catch { stillPending = true; }
        }
      } catch { stillPending = true; }

      if (credited) {
        qc.invalidateQueries({ queryKey: ["billing-usage"] });
        qc.invalidateQueries({ queryKey: ["billing-payments"] });
        toast.success("Платёж прошёл — баланс пополнен", { id: loading });
        return;
      }
      if (stillPending && attempts < 5) {
        setTimeout(poll, 2500); // до ~12,5 c
        return;
      }
      // Не подтвердилось за окно поллинга — не пугаем ошибкой, обновляем историю.
      qc.invalidateQueries({ queryKey: ["billing-payments"] });
      toast.dismiss(loading);
    };
    poll();
  }, [searchParams, setSearchParams, qc]);

  const { mutate: doTopup, isLoading: topupPending } = useMutation({
    mutationFn: createTopup,
    onSuccess: (data) => {
      setTopupOpen(false);
      if (data.confirmUrl) {
        openExternal(data.confirmUrl);
        toast.success("Перенаправляем на страницу оплаты...");
      } else {
        toast.error("Не удалось создать платёж. Проверьте настройки ЮKassa.");
      }
      qc.invalidateQueries({ queryKey: ["billing-payments"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Ошибка создания платежа");
    },
  } as Parameters<typeof useMutation>[0]);

  const { mutate: doSubscribe, isLoading: subscribePending } = useMutation({
    mutationFn: subscribePlan,
    onSuccess: (data) => {
      setSubscribeTo(null);
      toast.success(`Тариф ${PLAN_META[data.plan]?.label ?? data.plan} успешно подключён`);
      qc.invalidateQueries({ queryKey: ["billing-usage"] });
      qc.invalidateQueries({ queryKey: ["billing-payments"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Не удалось подключить тариф");
    },
  } as Parameters<typeof useMutation>[0]);

  const handleSyncPayment = async (id: string) => {
    setSyncingId(id);
    try {
      const result = await syncPayment(id);
      if (result.status === "succeeded") {
        toast.success("Платёж подтверждён, баланс пополнен");
        qc.invalidateQueries({ queryKey: ["billing-usage"] });
        qc.invalidateQueries({ queryKey: ["billing-payments"] });
      } else if (result.status === "cancelled") {
        toast.info("Платёж отменён");
        qc.invalidateQueries({ queryKey: ["billing-payments"] });
      } else {
        toast.info(`Статус платежа: ${result.status}. Попробуйте позже.`);
      }
    } catch {
      toast.error("Не удалось проверить статус платежа");
    } finally {
      setSyncingId(null);
    }
  };

  const currentPlanKey = usage?.plan?.key ?? "free";
  const balanceLow = (usage?.balanceKopecks ?? 0) < 5000 && !usage?.isFree;

  return (
    <AppLayout title="Биллинг и оплата" subtitle="Тарифные планы, баланс и история платежей">
      <div className="mx-auto max-w-5xl space-y-6 px-4 pb-10 md:px-6">

        {/* ── Stats row ─────────────────────────────────────── */}
        <Reveal direction="up" delay={0}>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Balance */}
          <Card className="p-5 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Баланс</p>
                {usageLoading ? (
                  <div className="mt-1 h-7 w-24 animate-pulse rounded bg-muted" />
                ) : (
                  <p className={cn("mt-1 text-2xl font-bold", balanceLow ? "text-destructive" : "text-foreground")}>
                    {usage?.balanceRubles} ₽
                  </p>
                )}
                {balanceLow && <p className="mt-0.5 text-xs text-destructive">Баланс заканчивается</p>}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
                <Wallet className="h-5 w-5 text-indigo-400" />
              </div>
            </div>
            <Button size="sm" className="mt-4 w-full" onClick={() => setTopupOpen(true)}>
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
              Пополнить баланс
            </Button>
          </Card>

          {/* Monthly tokens */}
          <Card className="p-5 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Токены за месяц</p>
                {usageLoading ? (
                  <div className="mt-1 h-7 w-20 animate-pulse rounded bg-muted" />
                ) : (
                  <p className="mt-1 text-2xl font-bold">{formatTokens(usage?.monthlyTokens ?? 0)}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {usage?.isFree ? "Входит в тариф" : `≈ ${usage?.monthlyCostRubles} ₽`}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                <BarChart3 className="h-5 w-5 text-violet-400" />
              </div>
            </div>
          </Card>

          {/* Model */}
          <Card className="p-5 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI-ассистент</p>
                <p className="mt-1 text-sm font-semibold leading-tight">
                  {MODEL_LABELS[usage?.currentModel ?? ""] ?? DEFAULT_MODEL_LABEL}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {usage?.isFree ? "Входит в тариф" : `${usage?.pricePerKToken} ₽ / 1К токенов`}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Zap className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
          </Card>
        </div>
        </Reveal>

        {/* ── Limits ────────────────────────────────────────── */}
        {usage?.plan && (
          <Reveal direction="up" delay={0.06}>
          <Card className="p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Crown className={cn("h-4 w-4", PLAN_META[currentPlanKey]?.color)} />
                <span className={cn("text-sm font-bold", PLAN_META[currentPlanKey]?.color)}>
                  {PLAN_META[currentPlanKey]?.label}
                </span>
                <span className="text-xs text-muted-foreground">— текущий тариф</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {PLAN_META[currentPlanKey]?.priceLabel}
              </span>
            </div>
            <p className="mb-3 text-xs font-medium text-muted-foreground">Использование в этом месяце</p>
            <div className="space-y-3">
              <LimitBar
                used={usage.plan.chatRequestsUsed}
                limit={usage.plan.chatRequestsLimit}
                label="AI-запросов"
                icon={<MessageSquare className="h-3.5 w-3.5" />}
              />
              <LimitBar
                used={usage.plan.analysesUsed}
                limit={usage.plan.analysesLimit}
                label="Анализов документов"
                icon={<FileSearch className="h-3.5 w-3.5" />}
              />
            </div>
          </Card>
          </Reveal>
        )}

        {/* ── Plan cards ────────────────────────────────────── */}
        <Reveal direction="up" delay={0.1}>
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            Тарифные планы
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLAN_ORDER.map((pk) => (
              <PlanCard
                key={pk}
                planKey={pk}
                currentPlanKey={currentPlanKey}
                balanceKopecks={usage?.balanceKopecks ?? 0}
                onSelect={(key) => {
                  if (key === "free") {
                    doSubscribe("free");
                  } else {
                    setSubscribeTo(key);
                  }
                }}
              />
            ))}
          </div>
          {currentPlanKey !== "enterprise" && (
            <p className="mt-3 text-center text-[12px] text-muted-foreground/60">
              Оплата за тариф списывается с баланса. Пополните баланс перед переходом на платный тариф.
            </p>
          )}
        </div>
        </Reveal>

        {/* ── Usage stats ───────────────────────────────────── */}
        <Reveal direction="up" delay={0.14}>
        <Card className="p-5 shadow-card">
          <h3 className="flex items-center gap-2 text-sm font-semibold mb-4">
            <TrendingUp className="h-4 w-4 text-indigo-400" />
            Статистика использования
          </h3>
          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Всего токенов</p>
              <p className="mt-0.5 text-lg font-semibold">{formatTokens(usage?.allTimeTokens ?? 0)}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">За текущий месяц</p>
              <p className="mt-0.5 text-lg font-semibold">{formatTokens(usage?.monthlyTokens ?? 0)}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Стоимость месяца</p>
              <p className="mt-0.5 text-lg font-semibold">
                {usage?.isFree ? "Входит в тариф" : `${usage?.monthlyCostRubles} ₽`}
              </p>
            </div>
          </div>

          {/* Pricing table */}
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Стоимость за 1 000 токенов</p>
            <div className="space-y-2">
              {[
                { model: "YandexGPT Lite",        input: "0.25 ₽", output: "0.30 ₽", blended: "~0.26 ₽", active: usage?.currentModel === "yandexgpt-lite/latest" },
                { model: "YandexGPT Pro",          input: "1.50 ₽", output: "1.80 ₽", blended: "~1.55 ₽", active: usage?.currentModel === "yandexgpt/latest" },
              ].map((row) => (
                <div key={row.model} className={cn("rounded-md px-3 py-2 text-sm", row.active ? "bg-indigo-500/8 ring-1 ring-inset ring-indigo-500/20" : "bg-muted/30")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.model}</span>
                      {row.active && <Badge variant="outline" className="h-4 px-1.5 text-[10px]">Активна</Badge>}
                    </div>
                    <span className={cn("font-semibold", row.active ? "text-indigo-400" : "text-muted-foreground")}>{row.blended}</span>
                  </div>
                  {row.active && row.input !== "—" && (
                    <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                      <span>входящие: <span className="font-medium text-foreground">{row.input}</span></span>
                      <span>исходящие: <span className="font-medium text-foreground">{row.output}</span></span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
        </Reveal>

        {/* ── Payment history ───────────────────────────────── */}
        <Reveal direction="up" delay={0.18}>
        <Card className="shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-indigo-400" />
              История платежей
            </h3>
          </div>

          {paymentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <CreditCard className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Платежей пока нет</p>
              <Button size="sm" variant="outline" onClick={() => setTopupOpen(true)}>Пополнить баланс</Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="shrink-0">
                    {p.status === "succeeded" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                    {p.status === "pending"   && <AlertCircle  className="h-5 w-5 text-amber-500" />}
                    {(p.status === "failed" || p.status === "cancelled") && <XCircle className="h-5 w-5 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.description ?? "Пополнение баланса"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">+{p.amountRubles} ₽</p>
                    <p className="text-xs capitalize text-muted-foreground">{p.provider}</p>
                  </div>
                  {/* Pending: retry via YooKassa or sync */}
                  {p.status === "pending" && (
                    <div className="flex shrink-0 gap-1.5">
                      {p.confirmUrl && (
                        <a href={p.confirmUrl} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            <ExternalLink className="mr-1 h-3 w-3" />
                            Оплатить
                          </Button>
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={syncingId === p.id}
                        onClick={() => handleSyncPayment(p.id)}
                        title="Проверить статус платежа в ЮKassa"
                      >
                        {syncingId === p.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <RefreshCw className="h-3 w-3" />}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
        </Reveal>

        {/* ── Note ──────────────────────────────────────────── */}
        <Reveal direction="up" delay={0.22}>
        <div className="rounded-xl border border-border/40 bg-muted/20 px-5 py-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Способы оплаты</p>
          <p>Банковская карта (Visa, MasterCard, МИР), СБП, Яндекс Пэй, ЮMoney — через платёжный шлюз ЮKassa.</p>
          <p className="mt-1 text-xs">Все транзакции защищены 3D Secure. Данные карты не хранятся на наших серверах.</p>
        </div>
        </Reveal>
      </div>

      <TopupModal
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        onConfirm={(amount) => doTopup(amount)}
        isPending={topupPending as boolean}
      />

      {subscribeTo && (
        <SubscribeModal
          planKey={subscribeTo}
          balanceKopecks={usage?.balanceKopecks ?? 0}
          onClose={() => setSubscribeTo(null)}
          onConfirm={() => doSubscribe(subscribeTo)}
          isPending={subscribePending as boolean}
        />
      )}
    </AppLayout>
  );
};

export default BillingPage;
