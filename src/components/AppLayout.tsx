import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
}

export function AppLayout({ children, title, subtitle, headerRight }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { data: currentUser } = useCurrentUser();

  const isCustomer = currentUser?.organization?.orgType === "customer";

  const initials = currentUser?.fullName
    ? currentUser.fullName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : "ЗК";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* ── Header ──────────────────────────────────────────── */}
        <header
          className={cn(
            "sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 px-4 md:px-5",
            "border-b border-border/60 dark:border-white/[0.05]",
            "bg-background/75 backdrop-blur-xl",
            "transition-all duration-200",
          )}
        >
          {/* Mobile / Tablet hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground md:hidden"
            onClick={() => setCollapsed((v) => !v)}
            aria-label="Меню"
          >
            <Menu className="h-4 w-4" />
          </Button>

          {/* Page title */}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground/70">{subtitle}</p>
            )}
          </div>

          {/* Right controls */}
          <div className="flex shrink-0 items-center gap-1">
            {headerRight}

            <ThemeToggle />

            {!isCustomer && <NotificationBell />}

            {/* User avatar */}
            <div className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-bold text-white shadow-md shadow-indigo-500/30 ring-2 ring-background">
              {initials}
            </div>
          </div>
        </header>

        {/* ── Content ─────────────────────────────────────────── */}
        <main className="flex-1">{children}</main>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer className="shrink-0 border-t border-border/50 px-4 py-2.5 dark:border-white/[0.04] md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground/50">
            <span>
              ⚠ Информация справочная. Не является юридической консультацией.
            </span>
            <div className="flex items-center gap-3">
              <span>🇷🇺 Данные в РФ</span>
              <span className="hidden sm:inline">© 2026 ZakupkiAI</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
