import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
      title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
      className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
        "text-muted-foreground hover:text-foreground hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "absolute transition-all duration-300",
          theme === "dark" ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-75",
        )}
      >
        <Sun className="h-4 w-4" />
      </span>
      <span
        className={cn(
          "absolute transition-all duration-300",
          theme === "light" ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75",
        )}
      >
        <Moon className="h-4 w-4" />
      </span>
    </button>
  );
}
