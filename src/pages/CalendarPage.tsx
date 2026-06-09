import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarClock, Building2, ExternalLink, Clock, Trophy, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import apiClient from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { Procurement, PaginatedResponse } from "@/types/api";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/lib/utils";

// ── API ───────────────────────────────────────────────────────

async function fetchProcurements(onlyMine: boolean): Promise<Procurement[]> {
  // Участники видят только активные (нет смысла подавать заявки на завершённые)
  // Заказчики видят все свои закупки на всех этапах
  const params = new URLSearchParams({ limit: "200", sortBy: "applicationDeadline", sortDir: "asc" });
  if (!onlyMine) params.set("status", "active");
  if (onlyMine)  params.set("onlyMine", "true");
  const { data } = await apiClient.get<PaginatedResponse<Procurement>>(`/procurements?${params}`);
  return data.data;
}

// ── Helpers ───────────────────────────────────────────────────

function formatPrice(p: string | number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number(p));
}

// Понедельник первый (ISO week)
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
function isoDay(d: Date) {
  const day = getDay(d);
  return day === 0 ? 6 : day - 1;
}

// ── CalendarPage ──────────────────────────────────────────────

const CalendarPage = () => {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: currentUser } = useCurrentUser();
  const isCustomer = currentUser?.organization?.orgType === "customer";

  const { data: procurements = [], isError: procError } = useQuery({
    queryKey: ["calendar-procurements", isCustomer],
    queryFn: () => fetchProcurements(isCustomer),
    staleTime: 60_000,
    enabled: currentUser !== undefined,
  });
  useEffect(() => { if (procError) toast.error("Не удалось загрузить закупки"); }, [procError]);

  // Группируем по дате окончания приёма предложений
  const byDeadline = useMemo(() => {
    const map = new Map<string, Procurement[]>();
    for (const p of procurements) {
      const key = format(new Date(p.applicationDeadline), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [procurements]);

  // Группируем по дате подведения итогов (только если есть)
  const bySummingUp = useMemo(() => {
    const map = new Map<string, Procurement[]>();
    for (const p of procurements) {
      if (!p.summingUpDate) continue;
      const key = format(new Date(p.summingUpDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [procurements]);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start, end });
    const leadingBlanks = isoDay(start);
    return [...Array(leadingBlanks).fill(null), ...allDays];
  }, [currentMonth]);

  const selectedDeadlines = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return byDeadline.get(key) ?? [];
  }, [selectedDate, byDeadline]);

  const selectedSummingUp = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return bySummingUp.get(key) ?? [];
  }, [selectedDate, bySummingUp]);

  const monthCount = useMemo(() => {
    let n = 0;
    byDeadline.forEach((_, key) => {
      if (key.startsWith(format(currentMonth, "yyyy-MM"))) n++;
    });
    return n;
  }, [byDeadline, currentMonth]);

  return (
    <AppLayout
      title="Календарь дедлайнов"
      subtitle={isCustomer ? "Дедлайны ваших закупок" : "Даты окончания подачи заявок"}
    >
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* Календарь */}
          <Reveal direction="up" delay={0} className="lg:col-span-2">
            <Card className="overflow-hidden shadow-card">
              {/* Навигация по месяцам */}
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                  aria-label="Предыдущий месяц"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="text-center">
                  <h2 className="text-base font-semibold capitalize text-foreground">
                    {format(currentMonth, "LLLL yyyy", { locale: ru })}
                  </h2>
                  {monthCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {monthCount} дн. с дедлайнами
                    </p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                  aria-label="Следующий месяц"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Заголовки дней */}
              <div className="grid grid-cols-7 border-b border-border">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-xs font-medium text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Сетка дней */}
              <div className="grid grid-cols-7">
                {days.map((day, i) => {
                  if (!day) {
                    return <div key={`blank-${i}`} className="min-h-[72px] border-b border-r border-border/50" />;
                  }

                  const key = format(day, "yyyy-MM-dd");
                  const deadlineProcs = byDeadline.get(key) ?? [];
                  const summingProcs  = bySummingUp.get(key) ?? [];
                  const isSelected    = selectedDate ? isSameDay(day, selectedDate) : false;
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const today         = isToday(day);
                  const hasDeadlines  = deadlineProcs.length > 0;
                  const hasSummingUp  = summingProcs.length > 0;

                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedDate((prev) =>
                          prev && isSameDay(prev, day) ? null : day
                        );
                      }}
                      className={`relative min-h-[72px] border-b border-r border-border/50 p-2 text-left transition-colors
                        ${isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : "hover:bg-muted/40"}
                        ${!isCurrentMonth ? "opacity-30" : ""}
                      `}
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium
                          ${today ? "bg-primary text-primary-foreground" : "text-foreground"}`}
                      >
                        {format(day, "d")}
                      </span>

                      {/* Точки: синие = прием предложений, зелёные = подведение итогов,
                           серые = завершена/отменена */}
                      <div className="mt-1.5 flex flex-wrap gap-0.5">
                        {deadlineProcs.slice(0, 3).map((p) => (
                          <span
                            key={`d-${p.id}`}
                            title={p.title}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              p.status === "completed" || p.status === "cancelled"
                                ? "bg-muted-foreground/40"
                                : "bg-indigo-500",
                            )}
                          />
                        ))}
                        {summingProcs.slice(0, 2).map((p) => (
                          <span key={`s-${p.id}`} className="h-1.5 w-1.5 rounded-full bg-amber-400" title={`Итоги: ${p.title}`} />
                        ))}
                        {(deadlineProcs.length + summingProcs.length) > 5 && (
                          <span className="text-[9px] leading-none text-muted-foreground">
                            +{deadlineProcs.length + summingProcs.length - 5}
                          </span>
                        )}
                      </div>

                      {(hasDeadlines || hasSummingUp) && (
                        <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                          {deadlineProcs.length + summingProcs.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Легенда */}
              <div className="flex flex-wrap items-center gap-4 border-t border-border px-5 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" /> Окончание приёма предложений
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400" /> Подведение итогов
                </span>
              </div>
            </Card>
          </Reveal>

          {/* Детали выбранного дня */}
          <Reveal direction="up" delay={0.12}>
            <Card className="overflow-hidden shadow-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <CalendarClock className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {selectedDate
                    ? format(selectedDate, "d MMMM yyyy", { locale: ru })
                    : "Выберите дату"}
                </span>
              </div>

              <div className="max-h-[560px] overflow-y-auto">
                {!selectedDate ? (
                  <div className="px-4 py-10 text-center">
                    <CalendarClock className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Нажмите на дату с дедлайнами
                    </p>
                  </div>
                ) : (selectedDeadlines.length === 0 && selectedSummingUp.length === 0) ? (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Нет событий в этот день
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {/* Окончание приёма предложений */}
                    {selectedDeadlines.map((p) => (
                      <Link
                        key={`deadline-${p.id}`}
                        to={`/procurements/${p.id}`}
                        className="group block p-4 transition-colors hover:bg-muted/40"
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/15">
                            <Clock className="h-3 w-3 text-indigo-400" />
                          </div>
                          <span className="text-[11px] font-semibold text-indigo-400">Окончание приёма предложений</span>
                          <Badge variant="outline" className="ml-auto h-5 text-[10px] font-normal">
                            {p.etp?.name ?? "ЭТП"}
                          </Badge>
                        </div>

                        <p className="text-sm font-medium text-foreground break-words line-clamp-2 group-hover:text-primary">
                          {p.title}
                        </p>

                        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                          {!isCustomer && (
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3 w-3 shrink-0" />
                              {p.customer?.name ?? "—"}
                            </div>
                          )}
                          <div className="font-medium text-foreground">
                            {formatPrice(p.initialPrice)}
                          </div>
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          {p.documentationUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5 px-2 text-xs"
                              onClick={(e) => { e.preventDefault(); window.open(p.documentationUrl!, "_blank"); }}
                            >
                              Документация
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                          <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
                            Открыть <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </Link>
                    ))}

                    {/* Подведение итогов */}
                    {selectedSummingUp.map((p) => (
                      <Link
                        key={`summing-${p.id}`}
                        to={`/procurements/${p.id}`}
                        className="group block p-4 transition-colors hover:bg-muted/40"
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/15">
                            <Trophy className="h-3 w-3 text-amber-400" />
                          </div>
                          <span className="text-[11px] font-semibold text-amber-400">Подведение итогов</span>
                          <Badge variant="outline" className="ml-auto h-5 text-[10px] font-normal">
                            {p.etp?.name ?? "ЭТП"}
                          </Badge>
                        </div>

                        <p className="text-sm font-medium text-foreground break-words line-clamp-2 group-hover:text-primary">
                          {p.title}
                        </p>

                        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                          {!isCustomer && (
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3 w-3 shrink-0" />
                              {p.customer?.name ?? "—"}
                            </div>
                          )}
                          <div className="font-medium text-foreground">
                            {formatPrice(p.initialPrice)}
                          </div>
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          {p.documentationUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5 px-2 text-xs"
                              onClick={(e) => { e.preventDefault(); window.open(p.documentationUrl!, "_blank"); }}
                            >
                              Документация
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                          <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
                            Открыть <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </AppLayout>
  );
};

export default CalendarPage;
