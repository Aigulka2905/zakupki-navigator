import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
}

export function AppLayout({ children, title, subtitle, headerRight }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur md:px-6">
            <SidebarTrigger className="text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold text-foreground md:text-lg">
                {title}
              </h1>
              {subtitle && (
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {headerRight}
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" aria-label="Помощь">
                <HelpCircle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" aria-label="Уведомления">
                <Bell className="h-4 w-4" />
              </Button>
              <div className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                АИ
              </div>
            </div>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-border bg-card px-4 py-3 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 break-russian">
                <span className="text-warning">⚠️</span>
                Информация справочная. Не является юридической консультацией.
              </div>
              <div className="flex items-center gap-3">
                <span>🇷🇺 Данные обрабатываются в РФ</span>
                <span className="hidden sm:inline">© 2026 Ассистент 223-ФЗ</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
