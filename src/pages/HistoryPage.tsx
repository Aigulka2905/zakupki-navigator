import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Clock,
  Calculator,
  Gavel,
  Package,
  Activity as ActivityIcon,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { UserChatsDialog } from "@/components/admin/UserChatsDialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAdminUsers, type ChatKey } from "@/hooks/useAdmin";
import { useHistory, type HistoryItem, type HistoryActor, type HistoryType } from "@/hooks/useHistory";
import { actionLabel, actionDetails, actionHref } from "@/lib/audit-actions";
import { sessionTitle } from "@/lib/chat-session";

// «История»: у пользователя — его чаты, анализы, расчёты, проверки и другие действия; у
// администратора — все действия в системе с тем, кто их сделал. Администратор, вошедший
// «под пользователем», видит историю этого пользователя (так решает сервер).

// ── Types ─────────────────────────────────────────────────────

type RowKind = "chat" | "analysis" | "nmck" | "bids" | "packages" | "other" | "admin";

interface Row {
  id: string;
  kind: RowKind;
  title: string;
  description: string;
  at: Date;
  href?: string | null;
  onOpen?: () => void;
  meta?: string;
  status?: string;
  violationCount?: number;
  /** undefined — история пользователя (кто сделал, не показываем); null — система. */
  actor?: HistoryActor | null;
  viaAdmin?: { fullName: string | null; email: string | null } | null;
}

const TYPE_OPTIONS: { value: HistoryType; label: string; adminOnly?: boolean }[] = [
  { value: "all",      label: "Все действия" },
  { value: "chat",     label: "Чаты" },
  { value: "analysis", label: "Анализ документов" },
  { value: "nmck",     label: "Расчёт НМЦ" },
  { value: "bids",     label: "Проверка и оценка заявок" },
  { value: "packages", label: "Пакеты документов" },
  { value: "other",    label: "Прочее" },
  { value: "admin",    label: "Администрирование", adminOnly: true },
];

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

function actionKind(action: string): RowKind {
  if (action.startsWith("nmck.")) return "nmck";
  if (action.startsWith("bid_check.") || action.startsWith("bid_evaluation.")) return "bids";
  if (action.startsWith("upload_batch.")) return "packages";
  if (action.startsWith("admin.")) return "admin";
  return "other";
}

const actorLine = (a: HistoryActor) => [a.fullName, a.organization, a.email].filter(Boolean).join(" · ");

// Строка истории. У администратора: кто сделал; чат открывается перепиской пользователя
// (ссылка /chat открыла бы чат самого администратора), чужие расчёты и проверки по ссылке
// не открываются.
function toRow(item: HistoryItem, all: boolean, openChat: (user: HistoryActor, key: ChatKey) => void): Row {
  const base = { id: item.id, at: new Date(item.at), ...(all && { actor: item.user ?? null }) };

  if (item.kind === "chat") {
    const c = item.chat;
    const title = c.procurementTitle
      ? truncate(c.procurementTitle, 70)
      : truncate(sessionTitle({ title: c.title, lastMessage: "" }), 70) || "Общий чат";
    const key = { sessionId: c.sessionId, procurementId: c.procurementId };
    return {
      ...base,
      kind: "chat",
      title,
      description: `${c.count} ${pluralMessages(c.count)}`,
      meta: c.procurementNumber ?? undefined,
      ...(all
        ? { onOpen: item.user ? () => openChat(item.user!, key) : undefined }
        : { href: c.procurementId ? `/procurements/${c.procurementId}` : c.sessionId ? `/chat?session=${c.sessionId}` : "/chat" }),
    };
  }

  if (item.kind === "analysis") {
    const a = item.analysis;
    const description =
      a.status === "processing" ? "Анализируется…"
      : a.status === "failed" ? "Ошибка анализа"
      : a.violations > 0 ? `${a.violations} ${pluralViolations(a.violations)}`
      : "Нарушений не обнаружено";
    return {
      ...base,
      kind: "analysis",
      title: a.fileName ?? "Документ",
      description,
      status: a.status,
      violationCount: a.violations,
      href: all ? null : `/doc-review?id=${a.id}`,
    };
  }

  return {
    ...base,
    kind: actionKind(item.action),
    title: actionLabel(item.action) + (item.entityTitle ? ` «${item.entityTitle}»` : ""),
    description: actionDetails(item.details) ?? "",
    href: all ? null : actionHref(item.action, item.entityId),
    viaAdmin: item.viaAdmin,
  };
}

// ── Activity row ──────────────────────────────────────────────

const kindMeta: Record<RowKind, { icon: typeof MessageSquare; bg: string; color: string; label: string }> = {
  chat:     { icon: MessageSquare, bg: "bg-indigo-500/10",  color: "text-indigo-400",  label: "Чат" },
  analysis: { icon: FileSearch,    bg: "bg-amber-500/10",   color: "text-amber-400",   label: "Анализ" },
  nmck:     { icon: Calculator,    bg: "bg-emerald-500/10", color: "text-emerald-400", label: "НМЦ" },
  bids:     { icon: Gavel,         bg: "bg-sky-500/10",     color: "text-sky-400",     label: "Заявки" },
  packages: { icon: Package,       bg: "bg-violet-500/10",  color: "text-violet-400",  label: "Пакет" },
  other:    { icon: ActivityIcon,  bg: "bg-slate-500/10",   color: "text-slate-400",   label: "Действие" },
  admin:    { icon: ShieldCheck,   bg: "bg-red-500/10",     color: "text-red-400",     label: "Админ" },
};

function RowShell({ row, children }: { row: Row; children: ReactNode }) {
  const cls = "group block w-full text-left";
  if (row.href) return <Link to={row.href} className={cls}>{children}</Link>;
  if (row.onOpen) return <button type="button" onClick={row.onOpen} className={cls}>{children}</button>;
  return <div className={cls}>{children}</div>;
}

function ActivityRow({ item }: { item: Row }) {
  const km = kindMeta[item.kind];
  const Icon = km.icon;
  const clickable = !!(item.href || item.onOpen);

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

  const via = item.viaAdmin;
  const viaName = via ? [via.fullName, via.email].filter(Boolean).join(", ") : "";

  return (
    <RowShell row={item}>
      <div className={`flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 px-4 py-3.5 transition-all ${clickable ? "hover:border-indigo-500/30 hover:bg-card/80" : ""}`}>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${km.bg}`}>
          <Icon className={`h-4.5 w-4.5 ${km.color}`} style={{ width: 18, height: 18 }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`truncate text-[13px] font-medium text-foreground transition-colors ${clickable ? "group-hover:text-indigo-400" : ""}`}>
              {item.title}
            </span>
            {item.meta && (
              <Badge variant="outline" className="text-[10px] shrink-0">{item.meta}</Badge>
            )}
          </div>
          {(item.description || statusIcon) && (
            <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground/70">
              {statusIcon}
              <span>{item.description}</span>
            </div>
          )}
          {item.actor !== undefined && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <UserIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{item.actor ? actorLine(item.actor) : "Система"}</span>
            </div>
          )}
          {via && (
            <div className="mt-1 inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-500 dark:text-red-400">
              <ShieldCheck className="h-3 w-3" />
              <span>Сделал администратор</span>
              {viaName && <span>({viaName})</span>}
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[11px] text-muted-foreground/60">{fmtDate(item.at)}</div>
          <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${km.bg} ${km.color}`}>
            {km.label}
          </div>
        </div>

        {clickable && (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 group-hover:text-indigo-400 transition-colors" />
        )}
      </div>
    </RowShell>
  );
}

// ── Date group header ─────────────────────────────────────────

function groupByDay(rows: Row[]): Array<{ label: string; items: Row[] }> {
  const groups = new Map<string, Row[]>();
  const now = new Date();

  for (const a of rows) {
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
  const [type, setType]     = useState<HistoryType>("all");
  const [userId, setUserId] = useState<string>("");
  const [chatOf, setChatOf] = useState<{ user: HistoryActor; key: ChatKey } | null>(null);

  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === "admin";
  const { data: users = [] } = useAdminUsers(isAdmin);

  const history = useHistory({ type, userId: isAdmin ? userId : null });
  const pages = history.data?.pages ?? [];
  const all = pages[0]?.scope === "all";
  const rows = pages.flatMap((p) => p.items).map((item) => toRow(item, all, (user, key) => setChatOf({ user, key })));

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => [r.title, r.description, r.actor && actorLine(r.actor)].filter(Boolean).join(" ").toLowerCase().includes(q))
    : rows;
  const groups = groupByDay(filtered);

  return (
    <AppLayout
      title="История"
      subtitle={all ? "Все действия в системе: кто, что и когда" : "Ваши чаты, проверки, расчёты и другие действия"}
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
            {isAdmin && (
              <Select value={userId || "all"} onValueChange={(v) => setUserId(v === "all" ? "" : v)}>
                <SelectTrigger className="sm:w-52 text-[13px]" aria-label="Пользователь">
                  <SelectValue placeholder="Все пользователи" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все пользователи</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={type} onValueChange={(v) => setType(v as HistoryType)}>
              <SelectTrigger className="sm:w-56 text-[13px]" aria-label="Тип действия">
                <SelectValue placeholder="Тип действия" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.filter((o) => !o.adminOnly || isAdmin).map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Reveal>

        {/* Content */}
        {history.isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            <span className="text-[13px]">Загрузка истории…</span>
          </div>
        ) : history.isError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/50 py-20 text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-[13px] font-medium text-muted-foreground">Не удалось загрузить историю</p>
            <Button size="sm" variant="outline" onClick={() => void history.refetch()}>Повторить</Button>
          </div>
        ) : filtered.length === 0 ? (
          <Reveal direction="scale">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/50 py-20 text-center">
              <Clock className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-[13px] font-medium text-muted-foreground">
                {q || type !== "all" || userId ? "Ничего не найдено" : "История пуста"}
              </p>
              {!q && type === "all" && !userId && (
                <p className="text-[12px] text-muted-foreground/60">
                  Здесь появятся чаты, анализ документов, расчёты НМЦ, проверки заявок и другие действия
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

        {history.hasNextPage && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>
              {history.isFetchingNextPage && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Показать ещё
            </Button>
          </div>
        )}
      </div>

      {chatOf && (
        <UserChatsDialog
          user={chatOf.user}
          initial={chatOf.key}
          open
          onOpenChange={(open) => { if (!open) setChatOf(null); }}
        />
      )}
    </AppLayout>
  );
};

export default HistoryPage;
