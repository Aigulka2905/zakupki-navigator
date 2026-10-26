import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Search, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import apiClient from "@/lib/api-client";
import { fmt, type EisItem } from "@/lib/nmck";

// Поиск цен в реестре контрактов ЕИС (сначала — свой накопленный реестр, иначе живой ЕИС
// через очередь, 10–30 с). Одна панель на двух местах: «добавить позицию» вверху расчёта и
// «найти в ЕИС» у позиции, которой нет в каком-то КП или с V > 33 %.
interface Props {
  label: string;               // имя области для экранного диктора и тестов
  initialQuery?: string;
  initialUnit?: string;
  addLabel: (n: number) => string;
  onAdd: (items: EisItem[], query: string, unit: string) => void;
  children?: ReactNode;        // заголовок и подсказка над полями
}

export function EisSearchPanel({ label, initialQuery = "", initialUnit = "", addLabel, onAdd, children }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [unit, setUnit] = useState(initialUnit);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<EisItem[] | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const poll = useRef<number | null>(null);
  useEffect(() => () => { if (poll.current) window.clearTimeout(poll.current); }, []);

  const search = async () => {
    const q = query.trim();
    if (q.length < 3) { setError("Введите наименование (от 3 символов)"); return; }
    setError(null); setLoading(true); setItems(null); setSel(new Set());
    if (poll.current) window.clearTimeout(poll.current);
    try {
      const { data } = await apiClient.post<{ searchId: string }>("/eis/search", { query: q, unit: unit.trim() || undefined });
      const tick = async () => {
        const { data: r } = await apiClient.get<{ status: string; items?: EisItem[]; error?: string }>(`/eis/search/${data.searchId}`);
        if (r.status === "processing") { poll.current = window.setTimeout(tick, 1500); return; }
        setLoading(false);
        if (r.status === "failed") { setError(r.error || "Поиск не удался"); return; }
        setItems(r.items ?? []);
      };
      tick();
    } catch (e: unknown) {
      setLoading(false);
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? "Не удалось запустить поиск");
    }
  };

  const add = () => {
    if (!items) return;
    const chosen = items.filter((_, i) => sel.has(i));
    if (!chosen.length) return;
    onAdd(chosen, query.trim(), unit.trim());
    setItems(null); setSel(new Set()); setQuery(initialQuery);
  };

  return (
    <div role="region" aria-label={label} className="rounded-lg border border-border p-3 no-print">
      {children}
      <div className="mt-2 flex flex-wrap gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="напр. стул офисный" className="max-w-sm flex-1" />
        <Input value={unit} onChange={(e) => setUnit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="ед. изм. (напр. шт)" className="w-40" title="Фильтр по единице измерения — оставит только сопоставимые цены" />
        <Button size="sm" onClick={search} disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}Найти
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
      {loading && <p className="mt-2 text-xs text-muted-foreground">Ищем в ЕИС (это может занять ~10–30 с)…</p>}
      {items && (items.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Контракты с ценами не найдены. Уточните запрос.</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {items.map((it, i) => (
            <label key={i} className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted/40">
              <input type="checkbox" className="mt-0.5" checked={sel.has(i)} onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(i); else n.delete(i); return n; })} />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{fmt(it.unitPrice)} ₽{it.unit ? `/${it.unit}` : ""}</span>
                {" — "}{it.supplier || "поставщик не указан"}{it.supplierInn ? ` (ИНН ${it.supplierInn})` : ""}
                <span className="block text-muted-foreground">{it.positionName} · контракт №{it.contractNumber}{it.date ? ` от ${it.date}` : ""}
                  <a href={it.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center text-primary" onClick={(e) => e.stopPropagation()}><ExternalLink className="h-3 w-3" /></a>
                </span>
              </span>
            </label>
          ))}
          <Button size="sm" variant="outline" className="mt-1" disabled={sel.size === 0} onClick={add}>
            <Plus className="mr-1 h-3.5 w-3.5" />{addLabel(sel.size)}
          </Button>
        </div>
      ))}
    </div>
  );
}
