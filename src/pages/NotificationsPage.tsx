import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Bell,
  BriefcaseBusiness,
  Star,
  Clock,
  ShieldAlert,
  Info,
  CheckCheck,
  Check,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useNotifications, useMarkRead, useMarkAllRead } from "@/hooks/useNotifications";
import type { Notification, NotificationType } from "@/types/api";
import { Reveal } from "@/components/Reveal";

// ── Helpers ────────────────────────────────────────────────────

function hasDetailLink(link: string | null | undefined): link is string {
  return !!link && link.startsWith('/procurements/') && link.length > '/procurements/'.length;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} дн назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

const TYPE_META: Record<string, { icon: React.ElementType; label: string; cls: string; bg: string }> = {
  update:    { icon: BriefcaseBusiness, label: "Закупки",   cls: "text-indigo-400", bg: "bg-indigo-500/10" },
  deadline:  { icon: Clock,            label: "Дедлайн",   cls: "text-amber-400",  bg: "bg-amber-500/10"  },
  violation: { icon: ShieldAlert,      label: "Нарушение",  cls: "text-red-400",    bg: "bg-red-500/10"    },
  system:    { icon: Info,             label: "Система",    cls: "text-sky-400",    bg: "bg-sky-500/10"    },
};

function getMeta(n: Notification) {
  if (n.title?.includes("избранн") || n.title?.includes("избранного")) {
    return { icon: Star, label: "Избранный заказчик", cls: "text-yellow-400", bg: "bg-yellow-500/10" };
  }
  return TYPE_META[n.type] ?? TYPE_META.system;
}

// ── Card ───────────────────────────────────────────────────────
//
// The entire card body is the primary clickable action (navigate + mark read).
// The "Прочитать" button is a secondary action via z-10 layering over the
// stretched button — `e.stopPropagation()` prevents the primary from firing.

interface NotifCardProps {
  n: Notification;
  onRead: (id: string) => void;
  onNavigate: (n: Notification) => void;
}

function NotifCard({ n, onRead, onNavigate }: NotifCardProps) {
  const meta = getMeta(n);
  const Icon = meta.icon;

  const handlePrimary = useCallback(() => {
    onNavigate(n);
  }, [n, onNavigate]);

  const handleMarkRead = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    onRead(n.id);
  }, [n.id, onRead]);

  return (
    <article
      className={cn(
        "group relative flex gap-4 rounded-xl border border-border/50 bg-card p-4 transition-all",
        !n.isRead && "border-indigo-500/20 bg-indigo-500/[0.03] ring-1 ring-indigo-500/10",
        "hover:border-border hover:shadow-sm cursor-pointer",
      )}
      aria-label={`${n.isRead ? "" : "Непрочитанное: "}${n.title}`}
    >
      {/* ── Unread dot ──────────────────────────────────────── */}
      {!n.isRead && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-4 top-4 h-2 w-2 rounded-full bg-indigo-500"
        />
      )}

      {/* ── Stretched primary action — always present (marks read; navigates if link has ID) */}
      <button
        className={cn(
          "absolute inset-0 rounded-xl",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/50",
        )}
        onClick={handlePrimary}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handlePrimary();
          }
        }}
        aria-label={hasDetailLink(n.link) ? `Открыть закупку: ${n.title}` : `Отметить прочитанным: ${n.title}`}
        tabIndex={0}
      />

      {/* ── Icon ────────────────────────────────────────────── */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          meta.bg,
        )}
      >
        <Icon className={cn("h-5 w-5", meta.cls)} />
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="pointer-events-none min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <span className={cn("text-[11px] font-semibold uppercase tracking-wider", meta.cls)}>
              {meta.label}
            </span>
            <p className={cn(
              "mt-0.5 text-[14px] leading-snug",
              !n.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/80",
            )}>
              {n.title}
            </p>
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground/50">
            {timeAgo(n.createdAt)}
          </span>
        </div>

        <p className="mt-1.5 text-[13px] text-muted-foreground">{n.message}</p>

        {/* Hint row — visible only when card has a specific procurement link */}
        {hasDetailLink(n.link) && (
          <p className="mt-2 flex items-center gap-1 text-[12px] text-muted-foreground/40 transition-colors group-hover:text-indigo-400/70">
            <ExternalLink className="h-3 w-3" aria-hidden />
            Нажмите, чтобы открыть закупку
          </p>
        )}
      </div>

      {/* ── Mark-read (above stretched button) ──────────────── */}
      {!n.isRead && (
        <button
          onClick={handleMarkRead}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleMarkRead(e);
            }
          }}
          className={cn(
            "relative z-10 flex items-center gap-1 self-start",
            "shrink-0 whitespace-nowrap",
            "text-[12px] text-muted-foreground/50 hover:text-indigo-400 transition-colors",
          )}
          aria-label={`Отметить как прочитанное: ${n.title}`}
          tabIndex={0}
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Прочитано</span>
        </button>
      )}
    </article>
  );
}

// ── Empty state ────────────────────────────────────────────────

function Empty() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/50 py-16 text-center"
      role="status"
      aria-label="Нет уведомлений"
    >
      <Bell className="h-10 w-10 text-muted-foreground/20" aria-hidden />
      <p className="text-[14px] font-medium text-muted-foreground/50">Нет уведомлений</p>
    </div>
  );
}

// ── Tab filter ─────────────────────────────────────────────────

type Tab = "all" | "procurements" | "deadlines" | "system";

function filterByTab(items: Notification[], tab: Tab): Notification[] {
  if (tab === "all")          return items;
  if (tab === "procurements") return items.filter((n) => n.type === "update");
  if (tab === "deadlines")    return items.filter((n) => n.type === "deadline");
  return items.filter((n) => n.type === "system" || n.type === "violation");
}

// ── Page ───────────────────────────────────────────────────────

export default function NotificationsPage() {
  const navigate                       = useNavigate();
  const { data: notifications = [], isLoading } = useNotifications();
  const { mutate: markRead }           = useMarkRead();
  const { mutate: markAll, isPending: markingAll } = useMarkAllRead();
  const [tab, setTab]                  = useState<Tab>("all");

  const unread = notifications.filter((n) => !n.isRead).length;

  function tabCount(t: Tab) {
    const n = filterByTab(notifications, t).filter((n) => !n.isRead).length;
    return n > 0 ? n : null;
  }

  const handleNavigate = useCallback((n: Notification) => {
    if (!n.isRead) markRead(n.id);
    if (hasDetailLink(n.link)) navigate(n.link);
  }, [markRead, navigate]);

  return (
    <AppLayout title="Уведомления" subtitle="Все события по вашей работе">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-6">

        {/* Top bar */}
        <Reveal direction="up" delay={0}>
          <div className="flex items-center justify-between">
            <div>
              {unread > 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  <span className="font-semibold text-indigo-400">{unread}</span> непрочитанных
                </p>
              ) : (
                <p className="text-[13px] text-muted-foreground/60">Всё прочитано</p>
              )}
            </div>
            {unread > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAll()}
                disabled={markingAll}
                className="h-8 gap-1.5 text-[12px]"
                aria-label="Отметить все уведомления как прочитанные"
              >
                {markingAll
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  : <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                }
                Прочитать все
              </Button>
            )}
          </div>
        </Reveal>

        {/* Tabs */}
        <Reveal direction="up" delay={0.08}>
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="h-9 gap-1">
              {(
                [
                  { value: "all",          label: "Все" },
                  { value: "procurements", label: "Закупки" },
                  { value: "deadlines",    label: "Дедлайны" },
                  { value: "system",       label: "Система" },
                ] as { value: Tab; label: string }[]
              ).map(({ value, label }) => {
                const cnt = tabCount(value);
                return (
                  <TabsTrigger key={value} value={value} className="gap-1.5 text-[12px]">
                    {label}
                    {cnt !== null && (
                      <span
                        aria-label={`${cnt} непрочитанных`}
                        className="rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-400 leading-none"
                      >
                        {cnt}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {(["all", "procurements", "deadlines", "system"] as Tab[]).map((t) => {
              const tabItems = filterByTab(notifications, t);
              return (
                <TabsContent key={t} value={t} className="mt-4 space-y-3">
                  {isLoading ? (
                    <div
                      className="flex items-center justify-center py-12"
                      role="status"
                      aria-label="Загрузка уведомлений"
                    >
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" aria-hidden />
                    </div>
                  ) : tabItems.length === 0 ? (
                    <Empty />
                  ) : (
                    <div role="list" aria-label={`Уведомления: ${tab}`}>
                      {tabItems.map((n, i) => (
                        <Reveal key={n.id} direction="up" delay={0.05 + i * 0.04}>
                          <div role="listitem" className={i > 0 ? "mt-3" : undefined}>
                            <NotifCard
                              n={n}
                              onRead={markRead}
                              onNavigate={handleNavigate}
                            />
                          </div>
                        </Reveal>
                      ))}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </Reveal>
      </div>
    </AppLayout>
  );
}
