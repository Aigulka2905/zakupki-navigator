import { AlertTriangle, Layers } from "lucide-react";

// Сведения о том, как был проанализирован большой документ (по частям / частично).
// Бэкенд кладёт их в `coverage.notes`. Показываем явно: иначе пользователь думает,
// что проверен весь документ, хотя хвост мог остаться непроверенным.
export interface Coverage {
  notes?: string[];
  truncated?: boolean;
  spec?: { truncated?: boolean };
  bid?: { truncated?: boolean };
}

export function coverageIsPartial(c?: Coverage | null): boolean {
  if (!c) return false;
  return Boolean(c.truncated || c.spec?.truncated || c.bid?.truncated
    || c.notes?.some((n) => /не проверен|только часть/i.test(n)));
}

export function CoverageNotes({ coverage }: { coverage?: Coverage | null }) {
  const notes = coverage?.notes?.filter(Boolean) ?? [];
  if (!notes.length) return null;
  const partial = coverageIsPartial(coverage);
  const Icon = partial ? AlertTriangle : Layers;
  const cls = partial
    ? "border-amber-500/30 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
    : "border-border bg-muted/40 text-muted-foreground";
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${cls}`}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="space-y-0.5">
        {notes.map((n, i) => <p key={i}>{n}</p>)}
      </div>
    </div>
  );
}

// Для HTML/PDF-выгрузок отчётов.
export function coverageNotesHtml(coverage: Coverage | null | undefined, esc: (s: string) => string): string {
  const notes = coverage?.notes?.filter(Boolean) ?? [];
  if (!notes.length) return "";
  return `<div class="cov">${notes.map((n) => `<p>${esc(n)}</p>`).join("")}</div>`;
}
