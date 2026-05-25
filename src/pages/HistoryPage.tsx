import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  FileSearch,
  Search,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronRight,
  FileText,
  Clock,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import apiClient from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────────

interface ChatSession {
  sessionId: string | null;
  procurementId: string | null;
  lastMessage: string;
  lastAt: string;
  count: number;
  procurementTitle: string | null;
  procurementNumber: string | null;
}

interface AnalysisItem {
  id: string;
  status: "processing" | "completed" | "failed";
  violations: Array<{ message: string }> | null;
  recommendations: string[] | null;
  originalFileName: string | null;
  createdAt: string;
}

type ActivityKind = "chat" | "analysis";

interface Activity {
  id: string;
  kind: ActivityKind;
  title: string;
  description: string;
  at: Date;
  href: string;
  meta?: string;
  status?: string;
  violationCount?: number;
}

// ── API ───────────────────────────────────────────────────────

async function fetchSessions(): Promise<ChatSession[]> {
  const { data } = await apiClient.get<ChatSession[]>("/assistant/sessions");
  return data;
}

async function fetchAnalyses(): Promise<AnalysisItem[]> {
  const { data } = await apiClient.get<AnalysisItem[]>("/analysis");
  return data;
}

// ── Helpers ───────────────────────────────────────────────────

function truncate(text: string, max = 80): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function fmtDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) return "Сегодня, " + date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Вчера, " + date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (diffDays < 7) return date.toLocaleDateString("ru-RU", { weekday: "long", hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

function buildActivities(sessions: ChatSession[], analyses: AnalysisItem[]): Activity[] {
  const result: Activity[] = [];

  for (const s of sessions) {
    const title = s.procurementTitle
      ? truncate(s.procurementTitle, 70)
      : s.lastMessage
      ? truncate(s.lastMessage, 70)
      : "Общий чат";

    const href = s.procurementId
      ? `/procurements/${s.procurementId}`
      : s.sessionId
      ? `/chat?session=${s.sessionId}`
      : "/chat";

    result.push({
      id: `chat-${s.procurementId ?? s.sessionId ?? "legacy"}`,
      kind: "chat",
      title,
      description: `${s.count} ${pluralMessages(s.count)}`,
      at: new Date(s.lastAt),
      href,
      meta: s.procurementNumber ?? undefined,
    });
  }

  for (const a of analyses) {
    const name = a.originalFileName ?? 'Документ';
    const vCount = (a.violations ?? []).length;
    const description =
      a.status === "processing"
        ? "Анализируется…"
        : a.status === "failed"
        ? "Ошибка анализа"
        : vCount > 0
        ? `${vCount} ${pluralViolations(vCount)}`
        : "Нарушений не обнаружено";

    result.push({
      id: `analysis-${a.id}`,
      kind: "analysis",
      title: name,
      description,
      at: new Date(a.createdAt),
      href: "/analysis",
      status: a.status,
      violationCount: vCount,
    });
  }

  return result.sort((a, b) => b.at.getTime() - a.at.getTime());
}

function pluralMessages(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "сообщение";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "сообщения";
  return "сообщений";
}

function pluralViolations(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "нарушение";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "нарушения";
  return "нарушений";
}

// ── Activity row ──────────────────────────────────────────────

const kindMeta: Record<ActivityKind, { icon: typeof MessageSquare; bg: string; color: string; label: string }> = {
  chat:     { icon: MessageSquare, bg: "bg-indigo-500/10",  color: "text-indigo-400",  label: "Чат" },
  analysis: { icon: FileSearch,    bg: "bg-amber-500/10",   color: "text-amber-400",   label: "Анализ" },
};

function ActivityRow({ item }: { item: Activity }) {
  const km = kindMeta[item.kind];
  const Icon = km.icon;

  const statusIcon =
    item.kind === "analysis" ? (
      item.status === "processing" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
      ) : item.status === "failed" ? (
        <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
      ) : (item.violationCount ?? 0) > 0 ? (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
      )
    ) : null;

  return (
    <Link to={item.href} className="group block">
      <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 px-4 py-3.5 transition-all hover:border-indigo-500/30 hover:bg-card/80">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${km.bg}`}>
          <Icon className={`h-4.5 w-4.5 ${km.color}`} style={{ width: 18, height: 18 }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[13px] font-medium text-foreground group-hover:text-indigo-400 transition-colors">
              {item.title}
            </span>
            {item.meta && (
              <Badge variant="outline" className="text-[10px] shrink-0">{item.meta}</Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground/70">
            {statusIcon}
            <span>{item.description}</span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[11px] text-muted-foreground/60">{fmtDate(item.at)}</div>
          <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${km.bg} ${km.color}`}>
            {km.label}
          </div>
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 group-hover:text-indigo-400 transition-colors" />
      </div>
    </Link>
  );
}

// ── Date group header ─────────────────────────────────────────

function groupByDay(activities: Activity[]): Array<{ label: string; items: Activity[] }> {
  const groups = new Map<string, Activity[]>();
  const now = new Date();

  for (const a of activities) {
    const d = a.at;
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    let label: string;
    if (diffDays === 0) label = "Сегодня";
    else if (diffDays === 1) label = "Вчера";
    else if (diffDays < 7) label = d.toLocaleDateString("ru-RU", { weekday: "long" });
    else label = d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(a);
  }

  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}

// ── Page ──────────────────────────────────────────────────────

const HistoryPage = () => {
  const [query, setQuery]   = useState("");
  const [filter, setFilter] = useState<string>("all");

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["chat-sessions"],
    queryFn: fetchSessions,
    staleTime: 30_000,
  });

  const { data: analyses = [], isLoading: analysesLoading } = useQuery({
    queryKey: ["analysis-history"],
    queryFn: fetchAnalyses,
    staleTime: 30_000,
  });

  const isLoading = sessionsLoading || analysesLoading;

  const all = buildActivities(sessions, analyses);

  const filtered = all.filter((a) => {
    const matchesFilter = filter === "all" || a.kind === filter;
    const matchesQuery  =
      !query ||
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.description.toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const groups = groupByDay(filtered);

  return (
    <AppLayout
      title="История"
      subtitle="Журнал чатов и анализа документов"
    >
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">

        {/* Filters */}
        <Reveal direction="up" delay={0}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                placeholder="Поиск по истории…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 text-[13px]"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="sm:w-48 text-[13px]">
                <SelectValue placeholder="Тип действия" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все действия</SelectItem>
                <SelectItem value="chat">Чаты</SelectItem>
                <SelectItem value="analysis">Анализ документов</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Reveal>

        {/* Stats chips */}
        {!isLoading && all.length > 0 && (
          <Reveal direction="up" delay={0.05}>
            <div className="flex flex-wrap gap-2">
              {[
                { kind: "all",      label: "Всего",   count: all.length,                                  bg: "bg-muted/60",         text: "text-muted-foreground" },
                { kind: "chat",     label: "Чатов",   count: all.filter(a => a.kind === "chat").length,   bg: "bg-indigo-500/10",    text: "text-indigo-400" },
                { kind: "analysis", label: "Анализов",count: all.filter(a => a.kind === "analysis").length, bg: "bg-amber-500/10", text: "text-amber-400" },
              ].map(({ kind, label, count, bg, text }) => (
                <button
                  key={kind}
                  onClick={() => setFilter(kind)}
                  className={`rounded-full px-3 py-1 text-[12px] font-medium transition-all ${bg} ${text} ${filter === kind ? "ring-1 ring-inset ring-current" : "opacity-70 hover:opacity-100"}`}
                >
                  {label}: {count}
                </button>
              ))}
            </div>
          </Reveal>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            <span className="text-[13px]">Загрузка истории…</span>
          </div>
        ) : filtered.length === 0 ? (
          <Reveal direction="scale">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/50 py-20 text-center">
              <Clock className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-[13px] font-medium text-muted-foreground">
                {query || filter !== "all" ? "Ничего не найдено" : "История пуста"}
              </p>
              {!query && filter === "all" && (
                <p className="text-[12px] text-muted-foreground/60">
                  Здесь появятся чаты и результаты анализа документов
                </p>
              )}
            </div>
          </Reveal>
        ) : (
          <div className="space-y-6">
            {groups.map(({ label, items }, gi) => (
              <Reveal key={label} direction="up" delay={0.04 + gi * 0.04}>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
                      {label}
                    </span>
                    <div className="h-px flex-1 bg-border/30" />
                    <span className="text-[11px] text-muted-foreground/40">{items.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <ActivityRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}

        {/* Empty state for analyses tab with hint */}
        {!isLoading && filter === "analysis" && all.filter(a => a.kind === "analysis").length > 0 && filtered.length > 0 && (
          <Reveal direction="up" delay={0.1}>
            <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-muted/20 px-4 py-3">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              <p className="text-[12px] text-muted-foreground/70">
                Нажмите на запись, чтобы перейти к результатам анализа
              </p>
            </div>
          </Reveal>
        )}

      </div>
    </AppLayout>
  );
};

export default HistoryPage;
