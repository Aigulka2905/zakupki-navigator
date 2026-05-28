import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileCheck2,
  CalendarClock,
  RefreshCw,
  TrendingUp,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  Sparkles,
  AlarmClock,
  Bot,
  Send,
  BarChart2,
  BookOpen,
} from "lucide-react";
import apiClient from "@/lib/api-client";
import type { DashboardStats, Procurement } from "@/types/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/Reveal";

// ── API ───────────────────────────────────────────────────────

async function fetchStats(): Promise<DashboardStats> {
  const { data } = await apiClient.get<DashboardStats>("/dashboard/stats");
  return data;
}
async function fetchRecent(): Promise<Procurement[]> {
  const { data } = await apiClient.get<Procurement[]>("/dashboard/recent");
  return data;
}
async function fetchRecommendations(): Promise<Procurement[]> {
  const { data } = await apiClient.get<Procurement[]>("/dashboard/recommendations");
  return data;
}
async function fetchDeadlines(): Promise<Procurement[]> {
  const { data } = await apiClient.get<Procurement[]>("/dashboard/deadlines");
  return data;
}

// ── Helpers ───────────────────────────────────────────────────

function fmt(price: string | number) {
  const n = Number(price);
  if (n >= 1_000_000)
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 1, notation: "compact" }).format(n);
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", opts ?? { day: "2-digit", month: "short" });
}

function daysUntil(iso: string) {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active:    { label: "Активна",   cls: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" },
  draft:     { label: "Черновик",  cls: "bg-muted text-muted-foreground ring-border/60" },
  completed: { label: "Завершена", cls: "bg-muted text-muted-foreground ring-border/60" },
  cancelled: { label: "Отменена",  cls: "bg-red-500/10 text-red-400 ring-red-500/20" },
};

// ── Stat card ─────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  icon: React.ElementType;
  iconCls: string;
  bgCls: string;
  to: string;
  loading?: boolean;
}

function StatCard({ label, value, delta, icon: Icon, iconCls, bgCls, to, loading }: StatCardProps) {
  return (
    <Link to={to} className="group">
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/60 p-5 shadow-card backdrop-blur-sm transition-all duration-200 hover:border-indigo-500/30 hover:shadow-elevated dark:bg-[#0E1120]/60">
        {/* Hover glow */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-indigo-500/5 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="flex items-start justify-between">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", bgCls)}>
            <Icon className={cn("h-[18px] w-[18px]", iconCls)} />
          </div>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/30" />}
        </div>

        <div className="mt-3.5">
          <div className="text-[32px] font-bold leading-none tracking-tight text-foreground tabular-nums">
            {loading
              ? <span className="inline-block h-8 w-16 animate-pulse rounded-md bg-muted/60" />
              : value}
          </div>
          <div className="mt-1.5 text-[13px] font-medium text-foreground/80 leading-tight">{label}</div>
          {delta && <div className="mt-0.5 truncate text-[11px] text-muted-foreground/55">{delta}</div>}
        </div>

        <ArrowUpRight className="absolute bottom-4 right-4 h-3.5 w-3.5 text-muted-foreground/15 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-indigo-400/50" />
      </div>
    </Link>
  );
}

// ── Deadline item ─────────────────────────────────────────────

function DeadlineItem({ p, isLast }: { p: Procurement; isLast: boolean }) {
  const days = daysUntil(p.applicationDeadline);
  const urgent = days <= 3;
  const soon   = days <= 7;

  return (
    <Link
      to={`/procurements/${p.id}`}
      className="group flex gap-3 transition-colors"
    >
      {/* Timeline spine */}
      <div className="flex flex-col items-center pt-1">
        <div className={cn(
          "h-2 w-2 shrink-0 rounded-full ring-2 ring-background",
          urgent ? "bg-red-500 ring-red-500/20"
          : soon  ? "bg-amber-400 ring-amber-400/20"
          : "bg-border ring-muted/30",
        )} />
        {!isLast && <div className="mt-1.5 flex-1 w-px bg-border/50 mb-1" />}
      </div>

      {/* Content */}
      <div className={cn("min-w-0 flex-1", !isLast && "pb-4")}>
        <p className="truncate text-[13px] font-medium text-foreground/85 group-hover:text-foreground break-russian leading-tight">
          {p.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground/55">
          {p.customer?.name && <span className="truncate max-w-[140px]">{p.customer.name}</span>}
          {p.initialPrice && <><span>·</span><span>{fmt(p.initialPrice)}</span></>}
        </div>
      </div>

      {/* Days badge */}
      <div className={cn(
        "shrink-0 self-start rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
        urgent ? "bg-red-500/10 text-red-400"
        : soon  ? "bg-amber-500/10 text-amber-400"
        : "bg-muted/60 text-muted-foreground",
      )}>
        {days < 0 ? "Истёк" : days === 0 ? "Сегодня" : `${days}д`}
      </div>
    </Link>
  );
}

// ── Recommendation item ───────────────────────────────────────

function RecItem({ p }: { p: Procurement }) {
  const score = p.relevanceScore ?? 0;

  return (
    <Link
      to={`/procurements/${p.id}`}
      className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40 dark:hover:bg-white/[0.03]"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 cursor-help flex-col items-center justify-center rounded-xl text-[13px] font-bold text-white ring-1 ring-inset ring-white/10",
              score >= 70 ? "bg-emerald-500/80"
              : score >= 40 ? "bg-amber-500/80"
              : "bg-muted-foreground/30",
            )}
            onClick={(e) => e.preventDefault()}
          >
            {score}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs max-w-[180px]">
          Релевантность {score}% —{" "}
          {score >= 70 ? "высокое соответствие"
          : score >= 40 ? "частичное соответствие"
          : "слабая связь"}
        </TooltipContent>
      </Tooltip>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground/85 group-hover:text-foreground break-russian leading-tight">
          {p.title}
        </p>

        {/* Relevance bar */}
        <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-muted/50">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              score >= 70 ? "bg-emerald-500"
              : score >= 40 ? "bg-amber-400"
              : "bg-muted-foreground/40",
            )}
            style={{ width: `${score}%` }}
          />
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground/55">
          <span>{fmt(p.initialPrice)}</span>
          {p.etp?.name && <><span>·</span><span>{p.etp.name}</span></>}
          <span>·</span>
          <span className={cn(
            "font-medium",
            score >= 70 ? "text-emerald-400/80" : score >= 40 ? "text-amber-400/80" : "text-muted-foreground/55",
          )}>
            {fmtDate(p.applicationDeadline, { day: "2-digit", month: "short" })}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Dashboard ─────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const [chatQuery, setChatQuery] = useState("");
  const { data: currentUser } = useCurrentUser();
  const isCustomer = currentUser?.organization?.orgType === "customer";

  const firstName = currentUser?.fullName?.split(" ")[0] ?? "Пользователь";
  const today = new Date().toLocaleDateString("ru-RU", {
    weekday: "long", day: "numeric", month: "long",
  });

  // ── Queries ──────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading, refetch: refetchStats, isError: statsError } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchStats,
    staleTime: 60_000,
  });
  useEffect(() => { if (statsError) toast.error("Не удалось загрузить статистику"); }, [statsError]);

  const { data: recent, isLoading: recentLoading, isError: recentError } = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: fetchRecent,
    staleTime: 60_000,
  });
  useEffect(() => { if (recentError) toast.error("Не удалось загрузить список закупок"); }, [recentError]);

  const { data: recommendations = [] } = useQuery({
    queryKey: ["dashboard-recommendations"],
    queryFn: fetchRecommendations,
    staleTime: 120_000,
  });

  const { data: deadlines = [] } = useQuery({
    queryKey: ["dashboard-deadlines"],
    queryFn: fetchDeadlines,
    staleTime: 60_000,
  });

  // ── Stat cards ───────────────────────────────────────────────
  const statCards: StatCardProps[] = isCustomer
    ? [
        { label: "Мои закупки",       value: stats?.totalProcurements ?? "—",   delta: "Размещено вашей организацией",          icon: TrendingUp,  iconCls: "text-indigo-400",  bgCls: "bg-indigo-500/10",  to: "/procurements",          loading: statsLoading },
        { label: "Активных сейчас",   value: stats?.activeProcurements ?? "—",  delta: "Принимаются заявки",                    icon: Clock,       iconCls: "text-amber-400",   bgCls: "bg-amber-500/10",   to: "/procurements?status=active", loading: statsLoading },
        { label: "Дедлайны на неделе",value: stats?.deadlinesThisWeek ?? "—",   delta: stats?.nextDeadline ? `Ближ. — ${fmtDate(stats.nextDeadline, { day: "2-digit", month: "2-digit" })}` : "Нет срочных", icon: AlertTriangle, iconCls: "text-red-400", bgCls: "bg-red-500/10", to: "/calendar", loading: statsLoading },
        { label: "AI-анализов",       value: stats?.completedAnalyses ?? "—",   delta: "Документов проверено",                  icon: FileCheck2,  iconCls: "text-emerald-400", bgCls: "bg-emerald-500/10", to: "/analysis",              loading: statsLoading },
      ]
    : [
        { label: "Активные закупки",  value: stats?.activeProcurements ?? "—",  delta: `${stats?.totalProcurements ?? 0} всего в реестре`, icon: TrendingUp, iconCls: "text-indigo-400", bgCls: "bg-indigo-500/10", to: "/procurements?status=active", loading: statsLoading },
        { label: "Дедлайны на неделе",value: stats?.deadlinesThisWeek ?? "—",   delta: stats?.nextDeadline ? `Ближ. — ${fmtDate(stats.nextDeadline, { day: "2-digit", month: "2-digit" })}` : "Нет срочных", icon: Clock, iconCls: "text-amber-400", bgCls: "bg-amber-500/10", to: "/calendar", loading: statsLoading },
        { label: "Всего в реестре",   value: stats?.totalProcurements ?? "—",   delta: "Закупок в базе системы",                icon: BarChart2,   iconCls: "text-violet-400",  bgCls: "bg-violet-500/10",  to: "/procurements",          loading: statsLoading },
        { label: "База знаний",       value: "→",                                delta: "Законы, шаблоны, практика",             icon: BookOpen,    iconCls: "text-sky-400",     bgCls: "bg-sky-500/10",     to: "/knowledge",             loading: false },
      ];

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(chatQuery.trim() ? `/chat?q=${encodeURIComponent(chatQuery.trim())}` : "/chat");
  };

  return (
    <AppLayout
      title="Главная"
      subtitle={isCustomer ? "Мои закупки и дедлайны" : "Обзор закупок и рекомендации"}
      headerRight={
        <Button
          variant="ghost"
          size="sm"
          className="hidden h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground sm:flex"
          onClick={() => refetchStats()}
        >
          <RefreshCw className="h-3 w-3" />
          Обновить
        </Button>
      }
    >
      <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">

        {/* ── HERO ────────────────────────────────────────────── */}
        <Reveal direction="up" delay={0}>
        <div className="relative overflow-hidden rounded-2xl p-px">
          {/* Gradient border */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/35 via-violet-500/15 to-transparent" />

          <div className="relative rounded-[calc(1rem-1px)] bg-card/70 px-5 py-5 backdrop-blur-sm dark:bg-[#0E1120]/80">
            {/* Decorative glow */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 rounded-full bg-indigo-500/[0.07] blur-3xl" />
            <div className="pointer-events-none absolute right-0 top-0 h-full w-2/5 bg-gradient-to-l from-indigo-500/[0.03] to-transparent" />

            <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
              {/* Greeting */}
              <div className="flex-1 min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_hsl(142_65%_42%/0.8)]" />
                  <span className="text-[11px] capitalize text-muted-foreground/55">{today}</span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Добро пожаловать, {firstName}!
                </h2>
                <p className="mt-1 text-[13px] text-muted-foreground/65 leading-relaxed max-w-sm">
                  {isCustomer
                    ? "Управляйте своими закупками и контролируйте дедлайны."
                    : "Ваш AI-ассистент по 223-ФЗ и коммерческим тендерам готов к работе."}
                </p>
              </div>

              {/* Quick AI input */}
              <form onSubmit={handleChatSubmit} className="w-full md:max-w-[340px] shrink-0">
                <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-background/50 px-3.5 py-2.5 ring-1 ring-inset ring-border/40 transition-all focus-within:border-indigo-500/40 focus-within:ring-indigo-500/15 dark:bg-background/40 dark:ring-white/[0.04]">
                  <Bot className="h-4 w-4 shrink-0 text-indigo-400" />
                  <input
                    type="text"
                    placeholder="Спросите ассистента..."
                    value={chatQuery}
                    onChange={(e) => setChatQuery(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
                  />
                  <button
                    type="submit"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-md shadow-indigo-500/25 transition hover:bg-indigo-400 active:scale-95"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Quick chips */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {[
                    { label: "Найти закупку",       to: "/procurements" },
                    { label: "База знаний",          to: "/knowledge" },
                  ].map((a) => (
                    <Link
                      key={a.to}
                      to={a.to}
                      className="rounded-full border border-border/40 bg-muted/20 px-2.5 py-1 text-[11px] text-muted-foreground/70 transition hover:border-indigo-500/30 hover:bg-indigo-500/5 hover:text-indigo-400"
                    >
                      {a.label}
                    </Link>
                  ))}
                </div>
              </form>
            </div>
          </div>
        </div>
        </Reveal>

        {/* ── STATS ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((card, i) => (
            <Reveal key={card.label} delay={i * 0.07} direction="up">
              <StatCard {...card} />
            </Reveal>
          ))}
        </div>

        {/* ── DEADLINES + RECOMMENDATIONS ─────────────────────── */}
        <Reveal delay={0.1} direction="up">
        <div className={cn("grid gap-4", !isCustomer && "lg:grid-cols-5")}>

          {/* Deadlines */}
          <div className={cn(
            "rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm dark:bg-[#0E1120]/60",
            !isCustomer ? "lg:col-span-2" : "",
          )}>
            <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
              <div>
                <h3 className="text-[13px] font-semibold text-foreground">Ближайшие дедлайны</h3>
                <p className="text-[11px] text-muted-foreground/50">
                  {isCustomer ? "По вашим закупкам" : "Активные закупки"}
                </p>
              </div>
              <AlarmClock className="h-4 w-4 text-amber-400/70" />
            </div>

            <div className="px-5 py-3">
              {deadlines.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-muted-foreground/40">
                  Нет ближайших дедлайнов
                </div>
              ) : (
                deadlines.map((p, i) => (
                  <DeadlineItem key={p.id} p={p} isLast={i === deadlines.length - 1} />
                ))
              )}
            </div>
          </div>

          {/* Recommendations — participants only */}
          {!isCustomer && (
            <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm dark:bg-[#0E1120]/60 lg:col-span-3">
              <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
                <div>
                  <h3 className="text-[13px] font-semibold text-foreground">Топ рекомендаций</h3>
                  <p className="text-[11px] text-muted-foreground/50">AI-скоринг по профилю организации</p>
                </div>
                <Sparkles className="h-4 w-4 text-indigo-400/70" />
              </div>

              <div className="max-h-[360px] overflow-y-auto py-1.5">
                {recommendations.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10">
                      <Sparkles className="h-5 w-5 text-indigo-400/60" />
                    </div>
                    <div>
                      <p className="text-[13px] text-muted-foreground/50">Закупки загружаются...</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/35">
                        Заполните{" "}
                        <Link to="/organization" className="text-indigo-400/70 underline underline-offset-2 hover:text-indigo-400">
                          профиль организации
                        </Link>{" "}
                        для персональных рекомендаций
                      </p>
                    </div>
                  </div>
                ) : (
                  recommendations.map((p) => <RecItem key={p.id} p={p} />)
                )}
              </div>
            </div>
          )}
        </div>
        </Reveal>

        {/* ── RECENT PROCUREMENTS ─────────────────────────────── */}
        <Reveal delay={0.15} direction="up">
        <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm dark:bg-[#0E1120]/60">
          <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
            <div>
              <h3 className="text-[13px] font-semibold text-foreground">
                {isCustomer ? "Мои закупки" : "Активные закупки"}
              </h3>
              <p className="text-[11px] text-muted-foreground/50">Сортировка по дате добавления</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-[11px] text-muted-foreground hover:text-indigo-400"
              asChild
            >
              <Link to="/procurements">
                Все <ArrowUpRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>

          {recentLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
            </div>
          ) : !recent?.length ? (
            <div className="py-12 text-center text-[13px] text-muted-foreground/40">
              Закупки появятся после синхронизации с РФТорги
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {recent.map((p) => {
                const meta = STATUS_META[p.status] ?? STATUS_META.draft;
                return (
                  <Link
                    key={p.id}
                    to={`/procurements/${p.id}`}
                    className="group flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30 dark:hover:bg-white/[0.02]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] text-muted-foreground/40">{p.number}</span>
                        {p.etp && (
                          <span className="rounded border border-border/40 bg-muted/30 px-1.5 py-px text-[10px] text-muted-foreground/60">
                            {p.etp.name}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[13px] font-medium text-foreground/80 group-hover:text-foreground break-russian">
                        {p.title}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3 text-[11px]">
                      <span className="text-muted-foreground/50 tabular-nums">{fmt(p.initialPrice)}</span>
                      <div className="flex items-center gap-1 text-muted-foreground/45">
                        <CalendarClock className="h-3 w-3" />
                        <span>{fmtDate(p.applicationDeadline)}</span>
                      </div>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset", meta.cls)}>
                        {meta.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        </Reveal>

      </div>
    </AppLayout>
  );
};

export default Dashboard;
