import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { JobProgress } from "@/types/api";

// Карточка фоновой обработки пакета: этап, «часть j из M» / «участник k из K»,
// полоса прогресса. Страницу можно закрыть — обработка идёт на сервере.
export function JobProgressCard({ title, progress }: { title: string; progress?: JobProgress | null }) {
  const pct = progress?.total ? Math.min(100, Math.round(((progress.current ?? 0) / progress.total) * 100)) : null;
  return (
    <Card className="p-6" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="h-4 w-4 animate-spin text-primary" /> {title}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{progress?.label ?? "Подготовка…"}</p>
      {pct != null && <Progress value={pct} className="mt-3 h-2" aria-label={`Готово ${pct}%`} />}
      <p className="mt-3 text-xs text-muted-foreground">
        Страницу можно закрыть: результат появится в «Истории», а в колокольчике придёт уведомление.
      </p>
    </Card>
  );
}
