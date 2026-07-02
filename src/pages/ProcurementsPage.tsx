import { useEffect, useMemo, useState } from "react";
import { openExternal } from "@/lib/url";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  Plus,
  CalendarClock,
  Building2,
  ExternalLink,
  Filter,
  Loader2,
  ArrowUpDown,
  Star,
  Hash,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { Procurement, PaginatedResponse, FavoriteOrg } from "@/types/api";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/Reveal";

type SortOption = "createdAt_desc" | "applicationDeadline_asc" | "initialPrice_desc" | "relevanceScore_desc";

const PAGE_SIZE = 20;

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "createdAt_desc",          label: "Новые первыми" },
  { value: "applicationDeadline_asc", label: "Ближайший дедлайн" },
  { value: "relevanceScore_desc",     label: "По релевантности" },
  { value: "initialPrice_desc",       label: "По убыванию цены" },
];

// ── API ───────────────────────────────────────────────────────

async function fetchProcurements(
  search: string,
  status: string,
  sort: SortOption,
  customerInn: string,
  onlyFavorites: boolean,
  onlyMine: boolean,
  procedureType: string,
  page: number,
): Promise<PaginatedResponse<Procurement>> {
  const [sortBy, sortDir] = sort.split("_") as [string, string];
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sortBy, sortDir });
  if (search)           params.set("search", search);
  if (status !== "all") params.set("status", status);
  if (customerInn)      params.set("customerInn", customerInn);
  if (onlyFavorites)    params.set("onlyFavorites", "true");
  if (onlyMine)         params.set("onlyMine", "true");
  if (procedureType && procedureType !== "all") params.set("procedureType", procedureType);
  const { data } = await apiClient.get<PaginatedResponse<Procurement>>(`/procurements?${params}`);
  return data;
}

async function syncForMe(): Promise<{ imported: number; updated: number }> {
  const { data } = await apiClient.post("/procurements/sync-for-me");
  return data;
}

async function fetchFavorites(): Promise<FavoriteOrg[]> {
  const { data } = await apiClient.get<FavoriteOrg[]>("/customers/favorites");
  return data;
}
async function addFavorite(id: string) { await apiClient.post(`/customers/favorites/${id}`); }
async function removeFavorite(id: string) { await apiClient.delete(`/customers/favorites/${id}`); }

// ── Helpers ───────────────────────────────────────────────────

function fmtPrice(price: string | number) {
  const n = Number(price);
  if (n >= 1_000_000)
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 1, notation: "compact" }).format(n);
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
}

function daysLeft(deadline: string) {
  return Math.floor((new Date(deadline).getTime() - Date.now()) / 86_400_000);
}

function deadlineLabel(days: number): string {
  if (days < 0)  return "Истёк";
  if (days === 0) return "Сегодня";
  if (days === 1) return "Завтра";
  return `${days}д`;
}


function urgencyBadgeCls(days: number) {
  if (days < 0)   return "bg-muted/40 text-muted-foreground/50";
  if (days <= 7)  return "bg-red-500/10 text-red-400";
  if (days <= 14) return "bg-amber-500/10 text-amber-400";
  return "bg-muted/40 text-muted-foreground/60";
}

// Цвета по statusLabel (русский текст из РФТорги/АФТорги) — приоритет над status
const LABEL_CLS: Record<string, string> = {
  "Идет прием предложений": "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  "Идёт прием заявок":      "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  "Опубликована":           "bg-indigo-500/10 text-indigo-400 ring-indigo-500/20",
  "Активна":                "bg-indigo-500/10 text-indigo-400 ring-indigo-500/20",
  "Подведение итогов":      "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  "На рассмотрении":        "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  "Окончен прием заявок":   "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  "Торги завершены":        "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  "Завершена":              "bg-muted/60 text-muted-foreground/70 ring-border/40",
  "Отменена":               "bg-red-500/10 text-red-400 ring-red-500/20",
  "Торги отменены":         "bg-red-500/10 text-red-400 ring-red-500/20",
  "Отклонена":              "bg-red-500/10 text-red-400 ring-red-500/20",
  "Черновик":               "bg-muted/60 text-muted-foreground ring-border/40",
};

const STATUS_FALLBACK: Record<string, { label: string; cls: string }> = {
  active:    { label: "Активна",   cls: "bg-indigo-500/10 text-indigo-400 ring-indigo-500/20" },
  draft:     { label: "Черновик",  cls: "bg-muted/60 text-muted-foreground ring-border/40" },
  completed: { label: "Завершена", cls: "bg-muted/60 text-muted-foreground/70 ring-border/40" },
  cancelled: { label: "Отменена",  cls: "bg-red-500/10 text-red-400 ring-red-500/20" },
};

function getStatusDisplay(p: Procurement) {
  const label = p.statusLabel ?? STATUS_FALLBACK[p.status]?.label ?? "Черновик";
  const cls   = LABEL_CLS[label] ?? STATUS_FALLBACK[p.status]?.cls ?? LABEL_CLS["Черновик"];
  return { label, cls };
}

// ── Favorite button ───────────────────────────────────────────

function FavoriteButton({ customerId, isFavorite, customerName }: {
  customerId: string;
  isFavorite: boolean;
  customerName: string;
}) {
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: () => isFavorite ? removeFavorite(customerId) : addFavorite(customerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favorites"] });
      qc.invalidateQueries({ queryKey: ["procurements"] });
      toast.success(
        isFavorite
          ? `«${customerName}» удалён из избранных`
          : `«${customerName}» добавлен в избранные`,
      );
    },
    onError: () => toast.error("Не удалось обновить список избранных"),
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle.mutate(); }}
          disabled={toggle.isPending}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded transition-all duration-150",
            isFavorite
              ? "text-amber-400 hover:bg-amber-400/10"
              : "text-muted-foreground/30 hover:text-amber-400 hover:bg-amber-400/10",
          )}
        >
          <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-amber-400")} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {isFavorite ? "Убрать из избранных" : "Добавить заказчика в избранные"}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Stat chip ─────────────────────────────────────────────────

function StatChip({ label, value, active, onClick }: {
  label: string; value: number; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all duration-150",
        active
          ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-400"
          : "border-border/40 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      <span className="tabular-nums font-bold text-foreground/90">{value}</span>
      <span>{label}</span>
    </button>
  );
}

// ── Pagination helpers ────────────────────────────────────────

function pageRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

// ── Page ──────────────────────────────────────────────────────

const ProcurementsPage = () => {
  const [searchParams] = useSearchParams();
  const onlyMine = searchParams.get("mine") === "true";
  const qc = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const isCustomer = currentUser?.organization?.orgType === "customer";

  const [query, setQuery]             = useState("");
  const [innQuery, setInnQuery]       = useState("");
  const [etpFilter, setEtpFilter]     = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [procedureTypeFilter, setProcedureTypeFilter] = useState("all");
  const [sort, setSort]               = useState<SortOption>("createdAt_desc");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [page, setPage]               = useState(1);

  useEffect(() => { setPage(1); }, [query, statusFilter, sort, innQuery, onlyFavorites, procedureTypeFilter]);

  const syncMutation = useMutation({
    mutationFn: syncForMe,
    onSuccess: (result) => {
      const msg = result.imported > 0 || result.updated > 0
        ? `Найдено: ${result.imported} новых, ${result.updated} обновлено`
        : "Закупок вашей организации на РФТорги не найдено";
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["procurements"] });
    },
    onError: () => toast.error("Не удалось выполнить поиск. Попробуйте позже."),
  });

  const { data: response, isLoading, isError } = useQuery({
    queryKey: ["procurements", query, statusFilter, sort, innQuery, onlyFavorites, onlyMine, procedureTypeFilter, page],
    queryFn:  () => fetchProcurements(query, statusFilter, sort, innQuery, onlyFavorites, onlyMine, procedureTypeFilter, page),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["favorites"],
    queryFn:  fetchFavorites,
    staleTime: 60_000,
  });

  if (isError) toast.error("Не удалось загрузить список закупок");

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);
  const procurements = response?.data ?? [];

  const filtered = useMemo(() => {
    if (etpFilter === "all") return procurements;
    return procurements.filter((p) => p.etp?.name === etpFilter);
  }, [procurements, etpFilter]);

  const etpOptions = useMemo(() => {
    const names = new Set(procurements.map((p) => p.etp?.name).filter(Boolean));
    return [...names] as string[];
  }, [procurements]);

  const STATIC_PROCEDURE_TYPES = [
    "Запрос котировок",
    "Запрос предложений",
    "Открытый конкурс",
    "Закрытый конкурс",
    "Аукцион",
    "Электронный аукцион",
    "Закупка у единственного поставщика",
    "Упрощённая закупка",
    "Малая закупка",
    "Коммерческая закупка",
    "Конкурентный отбор",
  ];

  const procedureTypeOptions = useMemo(() => {
    const dynamic = procurements.map((p) => p.procedureType).filter(Boolean) as string[];
    const merged = new Set([...STATIC_PROCEDURE_TYPES, ...dynamic]);
    return [...merged];
  }, [procurements]);

  const stats = useMemo(() => {
    const total = response?.total ?? 0;
    const counts = response?.counts;
    return {
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      active:    counts?.active    ?? 0,
      completed: counts?.completed ?? 0,
      cancelled: counts?.cancelled ?? 0,
    };
  }, [response]);

  return (
    <AppLayout
      title={onlyMine ? "Мои закупки" : "Все закупки"}
      subtitle={onlyMine ? "Закупки вашей организации" : "Реестр закупок с дедлайнами и статусами"}
      headerRight={
        <Button size="sm" className="h-8 gap-1.5 bg-indigo-500 text-white hover:bg-indigo-400" disabled>
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Новая</span>
        </Button>
      }
    >
      <div className="space-y-4 p-4 md:p-6">

        {/* ── STAT CHIPS ──────────────────────────────────────── */}
        <Reveal direction="up" delay={0}>
        <div className="flex flex-wrap items-center gap-2">
          <StatChip
            label="всего"
            value={isLoading ? 0 : stats.total}
            active={statusFilter === "all" && !onlyFavorites}
            onClick={() => { setStatusFilter("all"); setOnlyFavorites(false); }}
          />
          <StatChip
            label="активных"
            value={isLoading ? 0 : stats.active}
            active={statusFilter === "active"}
            onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
          />
          <StatChip
            label="завершённых"
            value={isLoading ? 0 : stats.completed}
            active={statusFilter === "completed"}
            onClick={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")}
          />
          <StatChip
            label="отменённых"
            value={isLoading ? 0 : stats.cancelled}
            active={statusFilter === "cancelled"}
            onClick={() => setStatusFilter(statusFilter === "cancelled" ? "all" : "cancelled")}
          />

          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/40" />}
        </div>
        </Reveal>

        {/* ── FILTER BAR ──────────────────────────────────────── */}
        <Reveal direction="up" delay={0.07}>
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative min-w-0 flex-1 basis-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <input
              type="text"
              placeholder="Поиск по названию, номеру или заказчику..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-border/50 bg-card/60 pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/35 backdrop-blur-sm transition focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/15"
            />
          </div>

          {/* INN */}
          <div className="relative w-36 shrink-0">
            <Hash className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <input
              type="text"
              placeholder="ИНН"
              value={innQuery}
              onChange={(e) => setInnQuery(e.target.value.replace(/\D/g, ""))}
              maxLength={12}
              className="h-9 w-full rounded-lg border border-border/50 bg-card/60 pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/35 backdrop-blur-sm transition focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/15"
            />
          </div>

          {/* ETP */}
          <Select value={etpFilter} onValueChange={setEtpFilter}>
            <SelectTrigger className="h-9 w-36 border-border/50 bg-card/60 text-[13px] backdrop-blur-sm">
              <SelectValue placeholder="ЭТП" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все ЭТП</SelectItem>
              {etpOptions.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Способ проведения */}
          <Select value={procedureTypeFilter} onValueChange={setProcedureTypeFilter}>
            <SelectTrigger className="h-9 w-44 border-border/50 bg-card/60 text-[13px] backdrop-blur-sm">
              <Filter className="mr-1.5 h-3 w-3 text-muted-foreground/50" />
              <SelectValue placeholder="Способ проведения" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все способы</SelectItem>
              {procedureTypeOptions.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="h-9 w-44 border-border/50 bg-card/60 text-[13px] backdrop-blur-sm">
              <ArrowUpDown className="mr-1.5 h-3 w-3 text-muted-foreground/50" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Favorites toggle */}
          <button
            type="button"
            onClick={() => setOnlyFavorites((v) => !v)}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-all duration-150",
              onlyFavorites
                ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                : "border-border/50 bg-card/60 text-muted-foreground/60 hover:border-amber-500/30 hover:text-amber-400",
            )}
          >
            <Star className={cn("h-3.5 w-3.5 shrink-0", onlyFavorites && "fill-amber-400")} />
            <span className="hidden sm:inline">Избранные</span>
            {favorites.length > 0 && (
              <span className={cn(
                "rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums",
                onlyFavorites ? "bg-amber-400/20 text-amber-300" : "bg-muted/60 text-muted-foreground",
              )}>
                {favorites.length}
              </span>
            )}
          </button>
        </div>
        </Reveal>

        {/* ── PROCUREMENT LIST ─────────────────────────────────── */}
        <Reveal direction="up" delay={0.13}>
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm dark:bg-[#0E1120]/60">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
            </div>

          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/30">
                <Filter className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground/60">Закупки не найдены</p>
                <p className="mt-0.5 text-xs text-muted-foreground/40">
                  {procurements.length === 0
                    ? onlyFavorites
                      ? "Нет закупок от избранных заказчиков"
                      : onlyMine && isCustomer
                      ? "Закупки вашей организации ещё не загружены"
                      : "Закупки появятся после синхронизации с РФТорги"
                    : "Попробуйте изменить фильтры"}
                </p>
              </div>
              {onlyMine && isCustomer && procurements.length === 0 && (
                <button
                  type="button"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className={cn(
                    "mt-1 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                    "bg-indigo-500/15 text-indigo-400 ring-1 ring-inset ring-indigo-500/25",
                    "hover:bg-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  <RefreshCw className={cn("h-4 w-4", syncMutation.isPending && "animate-spin")} />
                  {syncMutation.isPending ? "Ищем закупки на РФТорги…" : "Найти мои закупки на РФТорги"}
                </button>
              )}
            </div>

          ) : (
            <div className="divide-y divide-border/30">
              {filtered.map((p) => {
                const days = daysLeft(p.applicationDeadline);
                const meta = getStatusDisplay(p);
                const isFav = p.isFavoriteCustomer ?? (p.customer ? favoriteIds.has(p.customer.id) : false);

                return (
                  <div key={p.id} className="group relative">
                    <Link
                      to={`/procurements/${p.id}`}
                      className="flex flex-col gap-2 py-3.5 pl-4 pr-4 transition-colors hover:bg-muted/30 dark:hover:bg-white/[0.025]"
                    >
                      {/* Row 1: status + number */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(
                          "rounded-full px-2 py-px text-[10px] font-semibold ring-1 ring-inset",
                          meta.cls,
                        )}>
                          {meta.label}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground/40">
                          {p.number}
                        </span>
                      </div>

                      {/* Row 2: title */}
                      <p className="text-[13px] font-medium leading-snug text-foreground/85 group-hover:text-foreground break-russian">
                        {p.title}
                      </p>

                      {/* Row 3: meta left + deadline right */}
                      <div className="flex flex-wrap items-center justify-between gap-y-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground/50">
                          {p.customer && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 shrink-0" />
                              <span className="max-w-[200px] truncate">{p.customer.name}</span>
                              {p.customer.inn && (
                                <span className="text-muted-foreground/30">
                                  ИНН {p.customer.inn}
                                </span>
                              )}
                              <FavoriteButton
                                customerId={p.customer.id}
                                isFavorite={isFav}
                                customerName={p.customer.name}
                              />
                            </span>
                          )}
                          {p.etp && (
                            <>
                              <span className="text-muted-foreground/25">·</span>
                              <span>{p.etp.name}</span>
                            </>
                          )}
                          <span className="text-muted-foreground/25">·</span>
                          <span className="font-semibold text-foreground/65 tabular-nums">
                            {fmtPrice(p.initialPrice)}
                          </span>
                        </div>

                        {/* Deadline + external link */}
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <CalendarClock className="h-3 w-3 text-muted-foreground/40" />
                            <span className="text-foreground/60">
                              {new Date(p.applicationDeadline).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                            </span>
                          </div>
                          <span className={cn("rounded px-1.5 py-px text-[10px] font-bold tabular-nums", urgencyBadgeCls(days))}>
                            {deadlineLabel(days)}
                          </span>
                          {p.documentationUrl && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); openExternal(p.documentationUrl!); }}
                              className="text-muted-foreground/25 transition-colors hover:text-indigo-400"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer: pagination */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-border/30 px-4 py-2.5">
              <span className="text-[11px] text-muted-foreground/40 tabular-nums">
                {stats.total > 0
                  ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, stats.total)} из ${stats.total}`
                  : "0 закупок"
                }
              </span>

              {stats.totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded border border-border/40 bg-card/60 text-muted-foreground/60 transition hover:border-border hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>

                  {pageRange(page, stats.totalPages).map((p, i) =>
                    p === "…" ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-[12px] text-muted-foreground/30">…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p as number)}
                        className={cn(
                          "flex h-7 min-w-[28px] items-center justify-center rounded border px-1.5 text-[12px] font-medium transition",
                          p === page
                            ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-400"
                            : "border-border/40 bg-card/60 text-muted-foreground/60 hover:border-border hover:text-foreground",
                        )}
                      >
                        {p}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    disabled={page === stats.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded border border-border/40 bg-card/60 text-muted-foreground/60 transition hover:border-border hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        </Reveal>

      </div>
    </AppLayout>
  );
};

export default ProcurementsPage;
