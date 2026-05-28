import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, BriefcaseBusiness, Star, Clock, ShieldAlert, Info, CheckCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications, useUnreadCount, useMarkRead, useMarkAllRead } from "@/hooks/useNotifications";
import type { Notification } from "@/types/api";

// ── Helpers ────────────────────────────────────────────────────

// Returns true only when the link points to a specific procurement (has a UUID/id segment)
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
  return `${d} дн назад`;
}

const TYPE_META: Record<string, { icon: React.ElementType; cls: string }> = {
  update:    { icon: BriefcaseBusiness, cls: "text-indigo-400 bg-indigo-500/10" },
  deadline:  { icon: Clock,            cls: "text-amber-400  bg-amber-500/10"  },
  violation: { icon: ShieldAlert,      cls: "text-red-400    bg-red-500/10"    },
  system:    { icon: Info,             cls: "text-sky-400    bg-sky-500/10"    },
};

function getTypeMeta(type: string) {
  if (type.includes("favorite") || type.includes("избранн")) {
    return { icon: Star, cls: "text-yellow-400 bg-yellow-500/10" };
  }
  return TYPE_META[type] ?? TYPE_META.system;
}

// ── Single notification row ────────────────────────────────────
//
// Accessibility pattern: stretched <button> covers the entire row as the
// primary action. Content is pointer-events-none so clicks pass through to
// it. The mark-read button has relative z-10 to sit above the stretched
// button and receive its own clicks independently.

interface NotifRowProps {
  n: Notification;
  onRead: (id: string) => void;
  onNavigate: (n: Notification) => void;
}

function NotifRow({ n, onRead, onNavigate }: NotifRowProps) {
  const meta = getTypeMeta(n.type);
  const Icon = meta.icon;

  const handlePrimary = useCallback(() => {
    onNavigate(n);
  }, [n, onNavigate]);

  const handleMarkRead = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    onRead(n.id);
  }, [n.id, onRead]);

  return (
    <div
      className={cn(
        "group relative flex gap-3 px-4 py-3 transition-colors",
        "hover:bg-muted/60",
        !n.isRead && "bg-indigo-500/[0.04]",
        "cursor-pointer",
      )}
    >
      {/* ── Stretched primary action — always present (marks read; navigates if link has ID) */}
      <button
        className={cn(
          "absolute inset-0 rounded-none",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/50",
        )}
        onClick={handlePrimary}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handlePrimary();
          }
        }}
        aria-label={hasDetailLink(n.link) ? `Открыть: ${n.title}` : `Отметить прочитанным: ${n.title}`}
        tabIndex={0}
      />

      {/* ── Unread dot ───────────────────────────────────────── */}
      {!n.isRead && (
        <span className="pointer-events-none absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-indigo-500" />
      )}

      {/* ── Type icon ────────────────────────────────────────── */}
      <div className={cn(
        "pointer-events-none mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        meta.cls,
      )}>
        <Icon className="h-4 w-4" />
      </div>

      {/* ── Text content ─────────────────────────────────────── */}
      <div className="pointer-events-none min-w-0 flex-1">
        <p className={cn(
          "text-[13px] leading-snug",
          !n.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/80",
        )}>
          {n.title}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{n.message}</p>
        <p className="mt-1 text-[11px] text-muted-foreground/50">{timeAgo(n.createdAt)}</p>
      </div>

      {/* ── Mark-read button (above the stretched button) ────── */}
      {!n.isRead && (
        <button
          onClick={handleMarkRead}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleMarkRead(e);
            }
          }}
          title="Отметить прочитанным"
          aria-label="Отметить прочитанным"
          className={cn(
            "relative z-10 mt-1 shrink-0 self-start",
            "opacity-0 transition-opacity group-hover:opacity-100",
            "text-muted-foreground/50 hover:text-indigo-400",
          )}
          tabIndex={0}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Bell button with popover ───────────────────────────────────

export function NotificationBell() {
  const [open, setOpen]               = useState(false);
  const navigate                       = useNavigate();
  const { data: notifications = [] }  = useNotifications();
  const { data: unread = 0 }          = useUnreadCount();
  const { mutate: markRead }          = useMarkRead();
  const { mutate: markAll }           = useMarkAllRead();

  const recent = notifications.slice(0, 15);

  // Called when user clicks a notification row inside the popover
  const handleNotifNavigate = useCallback((n: Notification) => {
    if (!n.isRead) markRead(n.id);
    setOpen(false);
    if (hasDetailLink(n.link)) navigate(n.link);
  }, [markRead, navigate]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={`Уведомления${unread > 0 ? `, ${unread} непрочитанных` : ""}`}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white leading-none"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] p-0 shadow-xl ring-1 ring-border/60 dark:bg-[#0f1117]"
        aria-label="Панель уведомлений"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">Уведомления</span>
            {unread > 0 && (
              <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-400">
                {unread} новых
              </span>
            )}
          </div>
          {unread > 0 && (
            <button
              onClick={() => markAll()}
              className="flex items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-indigo-400 transition-colors"
              aria-label="Отметить все уведомления как прочитанные"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Прочитать все
            </button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="max-h-[420px]">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/20" aria-hidden />
              <p className="text-[13px] text-muted-foreground/50">Нет уведомлений</p>
            </div>
          ) : (
            <div
              className="divide-y divide-border/40"
              role="list"
              aria-label="Последние уведомления"
            >
              {recent.map((n) => (
                <div key={n.id} role="listitem">
                  <NotifRow
                    n={n}
                    onRead={markRead}
                    onNavigate={handleNotifNavigate}
                  />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {recent.length > 0 && (
          <div className="border-t border-border/60 px-4 py-2.5">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-[12px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Смотреть все уведомления
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
