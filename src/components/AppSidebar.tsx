import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Settings,
  History,
  Briefcase,
  Calendar,
  Building2,
  CreditCard,
  BookMarked,
  LogOut,
  UserSearch,
  ChevronLeft,
  ChevronRight,
  Bell,
  BellRing,
  ShieldCheck,
  Flag,
  ClipboardCheck,
  Calculator,
  FileCheck2,
  ShieldAlert,
  Gavel,
} from "lucide-react";
import { useUnreadCount } from "@/hooks/useNotifications";
import { tokenStorage } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

// ── Secondary nav ─────────────────────────────────────────────
// Заказчики пользуются сервисом бесплатно — вкладка «Биллинг» им не нужна.

function getSecondaryItems(isCustomer: boolean): NavItem[] {
  return [
    { title: "Инструкции",     url: "/instructions", icon: BookMarked },
    ...(isCustomer ? [] : [{ title: "Биллинг", url: "/billing", icon: CreditCard }]),
    { title: "История",        url: "/history",       icon: History },
    { title: "Настройки",      url: "/settings",      icon: Settings },
  ];
}

// ── NavItem component ─────────────────────────────────────────

function SideNavItem({
  item,
  collapsed,
  active,
  badge,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      to={item.url}
      title={collapsed ? item.title : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 select-none",
        collapsed && "justify-center px-2",
        active
          ? "text-indigo-400 dark:text-indigo-400"
          : "text-sidebar-foreground hover:text-foreground",
      )}
    >
      {/* Glass active background */}
      {active && (
        <span className="absolute inset-0 rounded-lg bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/20" />
      )}

      {/* Hover background */}
      {!active && (
        <span className="absolute inset-0 rounded-lg opacity-0 bg-muted/50 transition-opacity duration-150 group-hover:opacity-100 dark:bg-white/[0.04]" />
      )}

      {/* Left indicator bar */}
      {active && (
        <span className="absolute left-0 top-1/2 h-[22px] w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-500 shadow-[0_0_8px_hsl(239_84%_67%/0.8)]" />
      )}

      {/* Icon — with collapsed badge dot */}
      <div className="relative z-10 shrink-0">
        <item.icon
          className={cn(
            "h-[18px] w-[18px] transition-colors duration-150",
            active
              ? "text-indigo-400"
              : "text-muted-foreground group-hover:text-foreground",
          )}
        />
        {/* Show dot in collapsed mode */}
        {collapsed && badge != null && badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-indigo-500 text-[8px] font-bold text-white leading-none">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </div>

      {!collapsed && (
        <span className="relative z-10 flex-1 truncate leading-none">{item.title}</span>
      )}

      {/* Badge in expanded mode */}
      {!collapsed && badge != null && badge > 0 && (
        <span className="relative z-10 rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-400 leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

// ── Section label ─────────────────────────────────────────────

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-1 mx-auto h-px w-8 bg-sidebar-border" />;
  return (
    <div className="mb-1.5 mt-1 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
      {label}
    </div>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────

export interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const navigate  = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const isCustomer = currentUser?.organization?.orgType === "customer";
  const isAdmin = currentUser?.role === "admin";
  const { data: unreadCount = 0 } = useUnreadCount();

  // Role-based main nav
  const mainItems: NavItem[] = isCustomer
    ? [
        { title: "Главная",              url: "/",                       icon: LayoutDashboard },
        { title: "Чат с ассистентом",    url: "/chat",                   icon: MessageSquare },
        { title: "Мои закупки",          url: "/procurements?mine=true", icon: Briefcase },
        { title: "Все закупки",          url: "/procurements",           icon: Briefcase },
        { title: "Проверка документации", url: "/doc-review",            icon: Gavel },
        { title: "Оценка заявок",        url: "/bid-evaluation",         icon: ClipboardCheck },
        { title: "Обоснование НМЦ",      url: "/nmck",                   icon: Calculator },
        { title: "Календарь дедлайнов", url: "/calendar",               icon: Calendar },
        { title: "Проверка контрагента", url: "/check-supplier",         icon: UserSearch },
        { title: "Массовая проверка",   url: "/batch-check",            icon: ShieldAlert },
        { title: "Национальный режим",  url: "/national-regime",        icon: Flag },
        { title: "Профиль организации", url: "/organization",           icon: Building2 },
      ]
    : [
        { title: "Главная",              url: "/",               icon: LayoutDashboard },
        { title: "Чат с ассистентом",    url: "/chat",           icon: MessageSquare },
        { title: "Все закупки",          url: "/procurements",   icon: Briefcase },
        { title: "Подписки",             url: "/subscriptions",  icon: BellRing },
        { title: "Проверка заявки",      url: "/bid-check",      icon: FileCheck2 },
        { title: "Оценка заявок",        url: "/bid-evaluation", icon: ClipboardCheck },
        { title: "Обоснование НМЦ",      url: "/nmck",           icon: Calculator },
        { title: "Уведомления",          url: "/notifications",  icon: Bell },
        { title: "Календарь дедлайнов", url: "/calendar",       icon: Calendar },
        { title: "Профиль организации", url: "/organization",    icon: Building2 },
      ];

  const handleLogout = () => {
    tokenStorage.clearTokens();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  const isNavActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    const [path, qs] = url.split("?");
    if (!location.pathname.startsWith(path)) return false;
    if (!qs) return !location.search.includes("mine=true");
    return location.search.includes("mine=true");
  };

  const initials = currentUser?.fullName
    ? currentUser.fullName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : "ЗК";

  return (
    <aside
      style={{ width: collapsed ? 68 : 260 }}
      className={cn(
        "sticky top-0 relative flex h-screen shrink-0 flex-col overflow-hidden",
        "border-r border-sidebar-border bg-sidebar",
        "transition-[width] duration-300 ease-in-out",
        // Dark glass tint
        "dark:bg-[#0B0D18] dark:border-white/[0.05]",
      )}
    >
      {/* ── Logo header ───────────────────────────────────────── */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border px-4",
          "dark:border-white/[0.05]",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {/* Logo mark — always visible */}
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg shadow-indigo-500/20 ring-1 ring-black/5">
            <img src="/logo-icon.png" alt="Закупки AI" className="h-11 w-11 object-contain" />
            {/* Glow dot */}
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-sidebar bg-emerald-400" />
          </div>

          {/* Brand text — hides when collapsed */}
          <div
            className={cn(
              "overflow-hidden whitespace-nowrap transition-all duration-300",
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
            )}
          >
            <div className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-sm font-bold leading-tight text-transparent">
              Закупки AI
            </div>
            <div className="text-[10px] leading-tight text-muted-foreground/60">
              223-ФЗ Ассистент
            </div>
          </div>
        </div>

        {/* Collapse toggle (only shown when expanded) */}
        {!collapsed && (
          <button
            onClick={onToggle}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition hover:bg-muted/50 hover:text-foreground"
            aria-label="Свернуть меню"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── Navigation scroll area ────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        <div className="px-2 space-y-0.5">
          <SectionLabel label="Основное" collapsed={collapsed} />

          {mainItems.map((item) => (
            <SideNavItem
              key={item.url}
              item={item}
              collapsed={collapsed}
              active={isNavActive(item.url)}
              badge={item.url === "/notifications" && !isCustomer ? unreadCount : undefined}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="my-3 mx-4 h-px bg-sidebar-border dark:bg-white/[0.04]" />

        <div className="px-2 space-y-0.5">
          <SectionLabel label="Сервис" collapsed={collapsed} />

          {getSecondaryItems(isCustomer).map((item) => (
            <SideNavItem
              key={item.url}
              item={item}
              collapsed={collapsed}
              active={isNavActive(item.url)}
            />
          ))}

          {isAdmin && (
            <SideNavItem
              item={{ title: "Администрирование", url: "/admin", icon: ShieldCheck }}
              collapsed={collapsed}
              active={isNavActive("/admin")}
            />
          )}
        </div>
      </div>

      {/* ── Footer: user + logout ─────────────────────────────── */}
      <div
        className={cn(
          "shrink-0 border-t border-sidebar-border px-2 py-3",
          "dark:border-white/[0.05]",
        )}
      >
        {/* User card */}
        <div
          className={cn(
            "mb-2 flex items-center gap-2.5 rounded-lg px-2 py-2",
            "bg-muted/40 ring-1 ring-inset ring-border/50 dark:bg-white/[0.02] dark:ring-white/[0.05]",
            collapsed && "justify-center px-0 bg-transparent ring-0",
          )}
        >
          {/* Avatar */}
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[10px] font-bold text-white shadow-md shadow-indigo-500/30">
            {initials}
          </div>

          {/* Info — hidden when collapsed */}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold leading-tight text-foreground">
                {currentUser?.fullName ?? "Пользователь"}
              </div>
              <div className="truncate text-[10px] leading-tight text-muted-foreground/70">
                {currentUser?.organization?.name ?? "Организация"}
              </div>
            </div>
          )}

          {/* Status dot */}
          {!collapsed && (
            <div className="relative shrink-0">
              <span className="block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-40" />
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={collapsed ? "Выйти" : undefined}
          className={cn(
            "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium",
            "text-muted-foreground/60 transition-all duration-150",
            "hover:bg-destructive/10 hover:text-destructive",
            collapsed && "justify-center px-2",
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Выйти</span>}
        </button>

        {/* Expand button — only when collapsed */}
        {collapsed && (
          <button
            onClick={onToggle}
            className="mt-1 flex w-full items-center justify-center rounded-lg py-1.5 text-muted-foreground/40 transition hover:bg-muted/30 hover:text-muted-foreground"
            aria-label="Развернуть меню"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </aside>
  );
}
