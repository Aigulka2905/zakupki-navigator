import { useMemo, useState } from "react";
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
} from "lucide-react";
import apiClient from "@/lib/api-client";
import type { Procurement, PaginatedResponse, FavoriteOrg } from "@/types/api";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/Reveal";

type SortOption = "createdAt_desc" | "applicationDeadline_asc" | "initialPrice_desc" | "relevanceScore_desc";

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
): Promise<PaginatedResponse<Procurement>> {
  const [sortBy, sortDir] = sort.split("_") as [string, string];
  const params = new URLSearchParams({ page: "1", limit: "50", sortBy, sortDir });
  if (search)        params.set("search", search);
  if (status !== "all") params.set("status", status);
  if (customerInn)   params.set("customerInn", customerInn);
  if (onlyFavorites) params.set("onlyFavorites", "true");
  if (onlyMine)      params.set("onlyMine", "true");
  const { data } = await apiClient.get<PaginatedResponse<Procurement>>(`/procurements?${params}`);
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

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active:    { label: "Активна",   cls: "bg-indigo-500/10 text-indigo-400 ring-indigo-500/20" },
  draft:     { label: "Черновик",  cls: "bg-muted/60 text-muted-foreground ring-border/40" },
  completed: { label: "Завершена", cls: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" },
  cancelled: { label: "Отменена",  cls: "bg-red-500/10 text-red-400 ring-red-500/20" },
};

function getStatusDisplay(p: Procurement) {
  if (p.statusLabel === "Идет прием предложений") {
    return { label: "Идет прием предложений", cls: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" };
  }
  const base = STATUS_META[p.status] ?? STATUS_META.draft;
  return { label: p.statusLabel ?? base.label, cls: base.cls };
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

// ── Page ──────────────────────────────────────────────────────

const ProcurementsPage = () => {
  const [searchParams] = useSearchParams();
  const onlyMine = searchParams.get("mine") === "true";

  const [query, setQuery]             = useState("");
  const [innQuery, setInnQuery]       = useState("");
  const [etpFilter, setEtpFilter]     = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort]               = useState<SortOption>("createdAt_desc");
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const { data: response, isLoading, isError } = useQuery({
    queryKey: ["procurements", query, statusFilter, sort, innQuery, onlyFavorites, onlyMine],
    queryFn:  () => fetchProcurements(query, statusFilter, sort, innQuery, onlyFavorites, onlyMine),
    staleTime: 30_000,
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

  const stats = useMemo(() => ({
    total:     response?.total ?? 0,
    active:    procurements.filter((p) => p.status === "active").length,
    draft:     procurements.filter((p) => p.status === "draft").length,
    completed: procurements.filter((p) => p.status === "completed").length,
  }), [procurements, response]);

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
            label="черновиков"
            value={isLoading ? 0 : stats.draft}
            active={statusFilter === "draft"}
            onClick={() => setStatusFilter(statusFilter === "draft" ? "all" : "draft")}
          />
          <StatChip
            label="завершённых"
            value={isLoading ? 0 : stats.completed}
            active={statusFilter === "completed"}
            onClick={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")}
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
                      : "Закупки появятся после синхронизации с РФТорги"
                    : "Попробуйте изменить фильтры"}
                </p>
              </div>
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
                              onClick={(e) => { e.preventDefault(); window.open(p.documentationUrl!, "_blank"); }}
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

          {/* Footer: count */}
          {filtered.length > 0 && (
            <div className="border-t border-border/30 px-5 py-2.5 text-[11px] text-muted-foreground/40">
              Показано {filtered.length} из {stats.total} закупок
            </div>
          )}
        </div>
        </Reveal>

      </div>
    </AppLayout>
  );
};

export default ProcurementsPage;
