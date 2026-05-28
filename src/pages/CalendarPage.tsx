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
import { ChevronLeft, ChevronRight, CalendarClock, Building2, ExternalLink } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import apiClient from "@/lib/api-client";
import type { Procurement, PaginatedResponse } from "@/types/api";
import { Reveal } from "@/components/Reveal";

// ── API ───────────────────────────────────────────────────────

async function fetchAllActive(): Promise<Procurement[]> {
  const { data } = await apiClient.get<PaginatedResponse<Procurement>>(
    "/procurements?status=active&limit=200&sortBy=applicationDeadline&sortDir=asc"
  );
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

function scoreColor(score: number): string {
  if (score >= 70) return "bg-success";
  if (score >= 40) return "bg-warning";
  return "bg-muted-foreground/40";
}

// Понедельник первый (ISO week)
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
function isoDay(d: Date) {
  const day = getDay(d); // 0=Sun
  return day === 0 ? 6 : day - 1; // 0=Mon … 6=Sun
}

// ── CalendarPage ──────────────────────────────────────────────

const CalendarPage = () => {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: procurements = [], isError: procError } = useQuery({
    queryKey: ["calendar-procurements"],
    queryFn: fetchAllActive,
    staleTime: 60_000,
  });
  useEffect(() => { if (procError) toast.error("Не удалось загрузить закупки"); }, [procError]);

  // Группируем закупки по дате дедлайна (ключ — ISO-строка даты)
  const byDate = useMemo(() => {
    const map = new Map<string, Procurement[]>();
    for (const p of procurements) {
      const key = format(new Date(p.applicationDeadline), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [procurements]);

  // Дни текущего месяца + выравнивание по пн
  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start, end });

    const leadingBlanks = isoDay(start);
    return [...Array(leadingBlanks).fill(null), ...allDays];
  }, [currentMonth]);

  const selectedProcurements = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return byDate.get(key) ?? [];
  }, [selectedDate, byDate]);

  // Закупки в видимом месяце
  const monthCount = useMemo(() => {
    let n = 0;
    byDate.forEach((_, key) => {
      if (key.startsWith(format(currentMonth, "yyyy-MM"))) n++;
    });
    return n;
  }, [byDate, currentMonth]);

  return (
    <AppLayout
      title="Календарь дедлайнов"
      subtitle="Даты окончания подачи заявок"
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
                  const dayProcs = byDate.get(key) ?? [];
                  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const today = isToday(day);
                  const hasDeadlines = dayProcs.length > 0;

                  // Максимальный скор среди закупок дня
                  const maxScore = hasDeadlines
                    ? Math.max(...dayProcs.map((p) => p.relevanceScore))
                    : 0;

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
                      {/* Номер дня */}
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium
                          ${today ? "bg-primary text-primary-foreground" : "text-foreground"}`}
                      >
                        {format(day, "d")}
                      </span>

                      {/* Точки закупок */}
                      {hasDeadlines && (
                        <div className="mt-1.5 flex flex-wrap gap-0.5">
                          {dayProcs.slice(0, 3).map((p) => (
                            <span
                              key={p.id}
                              className={`h-1.5 w-1.5 rounded-full ${scoreColor(p.relevanceScore)}`}
                              title={p.title}
                            />
                          ))}
                          {dayProcs.length > 3 && (
                            <span className="text-[9px] leading-none text-muted-foreground">
                              +{dayProcs.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Мини-бейдж количества */}
                      {hasDeadlines && (
                        <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                          {dayProcs.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Легенда */}
              <div className="flex flex-wrap items-center gap-4 border-t border-border px-5 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-success" /> Высокая релевантность (≥70)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-warning" /> Средняя (40–70)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> Низкая (&lt;40)
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
                ) : selectedProcurements.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Нет закупок с дедлайном в этот день
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {selectedProcurements.map((p) => (
                      <div key={p.id} className="p-4 hover:bg-muted/30">
                        {/* Скор */}
                        <div className="mb-2 flex items-center gap-2">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${
                              p.relevanceScore >= 70
                                ? "bg-success"
                                : p.relevanceScore >= 40
                                ? "bg-warning"
                                : "bg-muted-foreground/50"
                            }`}
                          >
                            {p.relevanceScore}
                          </div>
                          <Badge
                            variant="outline"
                            className="h-5 text-[10px] font-normal"
                          >
                            {p.etp?.name ?? "ЭТП"}
                          </Badge>
                        </div>

                        <p className="text-sm font-medium text-foreground break-russian line-clamp-2">
                          {p.title}
                        </p>

                        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3 w-3 shrink-0" />
                            {p.customer?.name ?? "—"}
                          </div>
                          <div className="font-medium text-foreground">
                            {formatPrice(p.initialPrice)}
                          </div>
                        </div>

                        {p.documentationUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-7 gap-1.5 px-2 text-xs"
                            onClick={() => window.open(p.documentationUrl!, "_blank")}
                          >
                            Документация
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
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
