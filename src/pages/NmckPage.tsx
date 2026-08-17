import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Upload, FileText, Loader2, Printer, Calculator, Plus, Trash2,
  AlertTriangle, FileCheck2, XCircle, Sparkles, Clock, Search, ExternalLink, Database,
} from "lucide-react";
import apiClient from "@/lib/api-client";

interface Price { source: string; unitPrice: number | string; vatRate?: number | string; }
interface Position { name: string; unit: string; quantity: number | string; vatRate?: number | string; prices: Price[]; }
interface Calc {
  id: string; title: string; status: "processing" | "completed" | "failed";
  positions?: Position[]; nmck?: number | null; cvMax?: number | null;
  justification?: string | null; sources?: { name: string }[]; createdAt: string;
}
interface HistoryItem { id: string; title: string; status: Calc["status"]; nmck: number | null; createdAt: string; }
interface EisItem {
  contractNumber: string; customer: string; supplier: string; supplierInn: string;
  positionName: string; unit: string; quantity: number | null; unitPrice: number;
  contractPrice: number | null; date: string; url: string;
}

const CV_THRESHOLD = 33;
const MIN_SOURCES = 3;
const DEFAULT_VAT = 20;
const VAT_OPTIONS = [20, 10, 0];
const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) : "—");
const floor2 = (x: number) => Math.floor(x * 100 + 1e-6) / 100;
const toComparable = (raw: number, vr: number | null, target: number) =>
  vr != null && Number.isFinite(vr) && vr !== target ? (raw / (1 + vr / 100)) * (1 + target / 100) : raw;
const priceVat = (x: Price): number | null => (x.vatRate === "" || x.vatRate == null ? null : Number(x.vatRate));
const posVat = (p: Position) => (Number.isFinite(Number(p.vatRate)) ? Number(p.vatRate) : DEFAULT_VAT);

// Коэф. вариации по набору сопоставимых цен (для предупреждений при подборе из ЕИС).
function cvOfPrices(prices: Price[], targetVat: number) {
  const vals = prices
    .filter((x) => !x.excluded)
    .map((x) => ({ raw: Number(x.unitPrice), c: toComparable(Number(x.unitPrice), priceVat(x), targetVat) }))
    .filter((v) => Number.isFinite(v.raw) && v.raw > 0);
  const n = vals.length;
  if (n < 2) return { cv: 0, n };
  const mean = vals.reduce((s, v) => s + v.c, 0) / n;
  if (mean <= 0) return { cv: 0, n };
  const variance = vals.reduce((s, v) => s + (v.c - mean) ** 2, 0) / (n - 1);
  return { cv: (Math.sqrt(variance) / mean) * 100, n };
}

// Приведение к однородности (зеркалит backend homogenizePrices): пошагово помечает
// excluded самую отклоняющуюся цену, пока V ≤ 33% и активных источников ≥ MIN_SOURCES.
function homogenize(prices: Price[], targetVat: number): Price[] {
  const src = prices.map((p) => ({ ...p, excluded: false }));
  const items = src
    .map((p, i) => ({ i, raw: Number(p.unitPrice), c: toComparable(Number(p.unitPrice), priceVat(p), targetVat) }))
    .filter((x) => Number.isFinite(x.raw) && x.raw > 0);
  const excluded = new Set<number>();
  const active = () => items.filter((x) => !excluded.has(x.i));
  const cvOf = () => {
    const a = active();
    const n = a.length;
    if (n < 2) return { cv: 0, n, mean: a[0]?.c ?? 0 };
    const mean = a.reduce((s, x) => s + x.c, 0) / n;
    if (mean <= 0) return { cv: 0, n, mean };
    const variance = a.reduce((s, x) => s + (x.c - mean) ** 2, 0) / (n - 1);
    return { cv: (Math.sqrt(variance) / mean) * 100, n, mean };
  };
  for (;;) {
    const { cv, n, mean } = cvOf();
    if (cv <= CV_THRESHOLD || n <= MIN_SOURCES) break;
    let far: (typeof items)[number] | null = null, dist = -1;
    for (const x of active()) { const d = Math.abs(x.c - mean); if (d > dist) { dist = d; far = x; } }
    if (!far) break;
    excluded.add(far.i);
  }
  excluded.forEach((i) => { src[i].excluded = true; });
  return src;
}

// Локальный расчёт для живого превью (сервер — источник истины при сохранении).
// Зеркалит backend/src/utils/nmck.js: приведение к базе НДС позиции, СКО σ (n−1),
// округление денежных итогов ВНИЗ до сотых (форма Приказа №567). Исключённые
// (excluded) цены в расчёте не участвуют.
function compute(positions: Position[]) {
  let nmck = 0, cvMax = 0;
  const rows = positions.map((p) => {
    const targetVat = posVat(p);
    const all = p.prices
      .map((x) => ({ raw: Number(x.unitPrice), comparable: toComparable(Number(x.unitPrice), priceVat(x), targetVat), excluded: !!x.excluded }))
      .filter((v) => Number.isFinite(v.raw) && v.raw > 0);
    const prices = all.filter((v) => !v.excluded);
    const excludedCount = all.length - prices.length;
    const n = prices.length;
    let avg = 0, std = 0, cv = 0;
    if (n > 0) {
      avg = prices.reduce((s, v) => s + v.comparable, 0) / n;
      if (n >= 2 && avg > 0) {
        const variance = prices.reduce((s, v) => s + (v.comparable - avg) ** 2, 0) / (n - 1);
        std = Math.sqrt(variance);
        cv = (std / avg) * 100;
      }
    }
    const qty = Number(p.quantity) || 0;
    const unitPriceRounded = floor2(avg);
    const sum = floor2(unitPriceRounded * qty); // НМЦК с учётом округления цены за ед.
    nmck += sum; cvMax = Math.max(cvMax, cv);
    return { avg, std, cv, sum, n, excludedCount, targetVat };
  });
  return { rows, nmck: floor2(nmck), cvMax };
}

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #nmck-report, #nmck-report * { visibility: visible !important; }
  #nmck-report { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
}`;

export default function NmckPage() {
  const [title, setTitle] = useState("");
  const [specFiles, setSpecFiles] = useState<File[]>([]);
  const [kpFiles, setKpFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [calc, setCalc] = useState<Calc | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [saving, setSaving] = useState(false);
  const [justifying, setJustifying] = useState(false);
  const pollRef = useRef<number | null>(null);

  // ЕИС-поиск цен
  const [eisQuery, setEisQuery] = useState("");
  const [eisUnit, setEisUnit] = useState("");
  const [eisLoading, setEisLoading] = useState(false);
  const [eisItems, setEisItems] = useState<EisItem[] | null>(null);
  const [eisSel, setEisSel] = useState<Set<number>>(new Set());
  const [eisError, setEisError] = useState<string | null>(null);
  const eisPoll = useRef<number | null>(null);

  const loadHistory = async () => {
    try { const { data } = await apiClient.get<HistoryItem[]>("/nmck"); setHistory(data); } catch { /* ignore */ }
  };
  useEffect(() => { loadHistory(); return () => { if (pollRef.current) window.clearTimeout(pollRef.current); }; }, []);

  const open = async (id: string) => {
    if (pollRef.current) window.clearTimeout(pollRef.current);
    try {
      const { data } = await apiClient.get<Calc>(`/nmck/${id}`);
      setCalc(data);
      setPositions(Array.isArray(data.positions) ? data.positions : []);
      if (data.status === "processing") pollRef.current = window.setTimeout(() => open(id), 1500);
      else loadHistory();
    } catch { setError("Не удалось загрузить расчёт"); }
  };

  const submit = async () => {
    setError(null);
    if (kpFiles.length === 0) { setError("Загрузите хотя бы одно коммерческое предложение"); return; }
    const form = new FormData();
    form.append("title", title);
    specFiles.forEach((f) => form.append("spec", f));
    kpFiles.forEach((f) => form.append("kp", f));
    setUploading(true);
    try {
      const { data } = await apiClient.post<Calc>("/nmck", form, { headers: { "Content-Type": "multipart/form-data" } });
      setTitle(""); setSpecFiles([]); setKpFiles([]);
      open(data.id);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? "Не удалось запустить расчёт");
    } finally { setUploading(false); }
  };

  // редактирование позиций
  const upd = (fn: (p: Position[]) => Position[]) => setPositions((prev) => fn(prev.map((x) => ({ ...x, prices: [...x.prices] }))));
  const setField = (i: number, k: keyof Position, v: string) => upd((p) => { (p[i] as Record<string, unknown>)[k] = v; return p; });
  const setPrice = (i: number, j: number, k: keyof Price, v: string) => upd((p) => { (p[i].prices[j] as Record<string, unknown>)[k] = v; return p; });
  const addPrice = (i: number) => upd((p) => { p[i].prices.push({ source: "", unitPrice: "", vatRate: DEFAULT_VAT }); return p; });
  const delPrice = (i: number, j: number) => upd((p) => { p[i].prices.splice(j, 1); return p; });
  const addPosition = () => upd((p) => [...p, { name: "", unit: "", quantity: "", vatRate: DEFAULT_VAT, prices: [{ source: "", unitPrice: "", vatRate: DEFAULT_VAT }] }]);
  const delPosition = (i: number) => upd((p) => p.filter((_, j) => j !== i));
  const homogenizePos = (i: number) => upd((p) => { p[i].prices = homogenize(p[i].prices, posVat(p[i])); return p; });
  const resetExclusions = (i: number) => upd((p) => { p[i].prices = p[i].prices.map((x) => ({ ...x, excluded: false })); return p; });
  const toggleExcluded = (i: number, j: number) => upd((p) => { p[i].prices[j].excluded = !p[i].prices[j].excluded; return p; });

  const save = async () => {
    if (!calc) return;
    setSaving(true); setError(null);
    try {
      const { data } = await apiClient.put<Calc>(`/nmck/${calc.id}`, { title: calc.title, positions });
      setCalc(data); setPositions(Array.isArray(data.positions) ? data.positions : positions);
      loadHistory();
    } catch { setError("Не удалось сохранить"); } finally { setSaving(false); }
  };

  const justify = async () => {
    if (!calc) return;
    setJustifying(true); setError(null);
    try {
      await apiClient.put(`/nmck/${calc.id}`, { title: calc.title, positions }); // сначала сохраняем правки
      const { data } = await apiClient.post<Calc>(`/nmck/${calc.id}/justify`, {});
      setCalc(data); setPositions(Array.isArray(data.positions) ? data.positions : positions);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? "Не удалось сформировать обоснование");
    } finally { setJustifying(false); }
  };

  const [xlsxLoading, setXlsxLoading] = useState(false);
  const downloadXlsx = async () => {
    if (!calc) return;
    setXlsxLoading(true); setError(null);
    try {
      await apiClient.put(`/nmck/${calc.id}`, { title: calc.title, positions }); // сохраняем правки перед выгрузкой
      const res = await apiClient.get(`/nmck/${calc.id}/xlsx`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(calc.title || "nmck").replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim().slice(0, 60) || "nmck"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Не удалось сформировать .xlsx");
    } finally { setXlsxLoading(false); }
  };

  const createEmpty = async () => {
    setError(null);
    const form = new FormData();
    form.append("title", title || "Обоснование НМЦ");
    try {
      const { data } = await apiClient.post<Calc>("/nmck", form, { headers: { "Content-Type": "multipart/form-data" } });
      setTitle("");
      open(data.id);
    } catch { setError("Не удалось создать расчёт"); }
  };

  const eisSearch = async () => {
    const q = eisQuery.trim();
    if (q.length < 3) { setEisError("Введите наименование (от 3 символов)"); return; }
    setEisError(null); setEisLoading(true); setEisItems(null); setEisSel(new Set());
    if (eisPoll.current) window.clearTimeout(eisPoll.current);
    try {
      const { data } = await apiClient.post<{ searchId: string }>("/eis/search", { query: q, unit: eisUnit.trim() || undefined });
      const poll = async () => {
        const { data: r } = await apiClient.get<{ status: string; items?: EisItem[]; error?: string }>(`/eis/search/${data.searchId}`);
        if (r.status === "processing") { eisPoll.current = window.setTimeout(poll, 1500); return; }
        setEisLoading(false);
        if (r.status === "failed") { setEisError(r.error || "Поиск не удался"); return; }
        setEisItems(r.items ?? []);
      };
      poll();
    } catch (e: unknown) {
      setEisLoading(false);
      const err = e as { response?: { data?: { error?: string } } };
      setEisError(err.response?.data?.error ?? "Не удалось запустить поиск");
    }
  };

  const addEisAsPosition = () => {
    if (!eisItems) return;
    const chosen = eisItems.filter((_, i) => eisSel.has(i));
    if (chosen.length === 0) return;
    const unit = eisUnit.trim() || chosen.find((c) => c.unit)?.unit || "";
    const qty = chosen.find((c) => c.quantity)?.quantity || 1;
    const prices: Price[] = chosen.map((c) => ({
      source: `${c.supplier || "Поставщик"} · контракт №${c.contractNumber}`,
      unitPrice: c.unitPrice,
      vatRate: DEFAULT_VAT,
    }));
    upd((p) => [...p, { name: eisQuery.trim(), unit, quantity: qty, vatRate: DEFAULT_VAT, prices }]);
    const { cv, n } = cvOfPrices(prices, DEFAULT_VAT);
    if (n >= 2 && cv > CV_THRESHOLD) {
      setError(`Подобранные цены неоднородны (V=${fmt(cv)}% > ${CV_THRESHOLD}%) — вероятно, контракты разного масштаба. Нажмите «Привести к однородности» у позиции либо уточните запрос (напр. конкретная модель/ед. изм.).`);
    } else setError(null);
    setEisItems(null); setEisSel(new Set()); setEisQuery("");
  };

  const fmtDate = (s: string) => new Date(s).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  const live = compute(positions);
  const fewSources = live.rows.some((r) => r.n > 0 && r.n < MIN_SOURCES);

  return (
    <AppLayout title="Обоснование НМЦ" subtitle="Расчёт начальной (максимальной) цены методом анализа рынка (Приказ №567)">
      <style>{PRINT_CSS}</style>
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">

        {/* Форма загрузки */}
        <Card className="p-6 no-print">
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium">Название закупки</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="напр. Поставка цветного металла" className="mt-1 max-w-md" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Спецификация (опционально)</label>
                <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm hover:border-primary/40">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate text-muted-foreground">{specFiles.length ? `Файлов: ${specFiles.length}` : "Позиции и количество (PDF, DOCX, XLSX)"}</span>
                  <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" className="hidden" onChange={(e) => setSpecFiles(Array.from(e.target.files ?? []))} />
                </label>
              </div>
              <div>
                <label className="text-sm font-medium">Коммерческие предложения (≥3)</label>
                <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm hover:border-primary/40">
                  <Upload className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate text-muted-foreground">{kpFiles.length ? `Файлов: ${kpFiles.length}` : "Загрузите КП поставщиков"}</span>
                  <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" className="hidden" onChange={(e) => setKpFiles(Array.from(e.target.files ?? []))} />
                </label>
              </div>
            </div>
            {error && <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
            <div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={submit} disabled={uploading}>
                  {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Calculator className="mr-1.5 h-4 w-4" />}
                  Извлечь цены и рассчитать
                </Button>
                <Button variant="outline" onClick={createEmpty} disabled={uploading}>
                  <Database className="mr-1.5 h-4 w-4" />Создать и искать цены в ЕИС
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">ИИ извлечёт цены из КП, либо создайте пустой расчёт и подберите цены из реестра контрактов ЕИС. По Приказу №567 нужно ≥{MIN_SOURCES} источников; коэф. вариации ≤{CV_THRESHOLD}%.</p>
            </div>
          </div>
        </Card>

        {/* История */}
        {history.length > 0 && (
          <Card className="p-4 no-print">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">История расчётов</p>
            <div className="divide-y divide-border">
              {history.map((h) => (
                <button key={h.id} onClick={() => open(h.id)} className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:bg-muted/40 rounded px-2">
                  <span className="truncate">{h.title}</span>
                  <span className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                    {h.nmck != null && `${fmt(h.nmck)} ₽`} · {fmtDate(h.createdAt)}
                    {h.status === "processing" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                    {h.status === "completed" && <FileCheck2 className="h-3.5 w-3.5 text-emerald-500" />}
                    {h.status === "failed" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Расчёт */}
        {calc && (
          <Card className="p-6">
            {calc.status === "processing" && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> ИИ извлекает цены из коммерческих предложений…</div>
            )}
            {calc.status === "failed" && (
              <div className="flex items-center gap-2 py-6 text-sm text-destructive"><XCircle className="h-4 w-4" /> Не удалось обработать. Попробуйте ещё раз.</div>
            )}
            {calc.status === "completed" && (
              <div id="nmck-report" className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{calc.title}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> {fmtDate(calc.createdAt)} · метод сопоставимых рыночных цен</p>
                  </div>
                  <div className="flex gap-2 no-print">
                    <Button size="sm" variant="outline" onClick={downloadXlsx} disabled={xlsxLoading}>
                      {xlsxLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Database className="mr-1.5 h-3.5 w-3.5" />} Скачать .xlsx (форма №567)
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="mr-1.5 h-3.5 w-3.5" /> Скачать PDF</Button>
                  </div>
                </div>

                {/* ЕИС: поиск цен в реестре контрактов */}
                <div className="rounded-lg border border-border p-3 no-print">
                  <p className="text-sm font-medium flex items-center gap-1.5"><Database className="h-4 w-4 text-primary" /> Подбор цен из ЕИС (реестр контрактов)</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Введите <b>конкретную</b> позицию (напр. «стул офисный», а не «мебель») и, по возможности, единицу измерения — система подберёт однородные цены за единицу из прошедших контрактов.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Input value={eisQuery} onChange={(e) => setEisQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && eisSearch()} placeholder="напр. стул офисный" className="max-w-sm flex-1" />
                    <Input value={eisUnit} onChange={(e) => setEisUnit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && eisSearch()} placeholder="ед. изм. (напр. шт)" className="w-40" title="Фильтр по единице измерения — оставит только сопоставимые цены" />
                    <Button size="sm" onClick={eisSearch} disabled={eisLoading}>
                      {eisLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}Найти
                    </Button>
                  </div>
                  {eisError && <p className="mt-1.5 text-xs text-destructive">{eisError}</p>}
                  {eisLoading && <p className="mt-2 text-xs text-muted-foreground">Ищем в ЕИС (это может занять ~10–30 с)…</p>}
                  {eisItems && (
                    eisItems.length === 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">Контракты с ценами не найдены. Уточните запрос.</p>
                    ) : (
                      <div className="mt-2 space-y-1.5">
                        {eisItems.map((it, i) => (
                          <label key={i} className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted/40">
                            <input type="checkbox" className="mt-0.5" checked={eisSel.has(i)} onChange={(e) => setEisSel((s) => { const n = new Set(s); e.target.checked ? n.add(i) : n.delete(i); return n; })} />
                            <span className="min-w-0 flex-1">
                              <span className="font-medium">{fmt(it.unitPrice)} ₽{it.unit ? `/${it.unit}` : ""}</span>
                              {" — "}{it.supplier || "поставщик не указан"}{it.supplierInn ? ` (ИНН ${it.supplierInn})` : ""}
                              <span className="block text-muted-foreground">{it.positionName} · контракт №{it.contractNumber}{it.date ? ` от ${it.date}` : ""}
                                <a href={it.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center text-primary" onClick={(e) => e.stopPropagation()}><ExternalLink className="h-3 w-3" /></a>
                              </span>
                            </span>
                          </label>
                        ))}
                        <Button size="sm" variant="outline" className="mt-1" disabled={eisSel.size === 0} onClick={addEisAsPosition}>
                          <Plus className="mr-1 h-3.5 w-3.5" />Добавить выбранные ({eisSel.size}) как позицию
                        </Button>
                      </div>
                    )
                  )}
                </div>

                {/* Позиции */}
                <div className="space-y-3">
                  {positions.map((p, i) => {
                    const r = live.rows[i];
                    return (
                      <div key={i} className="rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Input value={p.name} onChange={(e) => setField(i, "name", e.target.value)} placeholder="Наименование позиции" className="min-w-[220px] flex-1" />
                          <Input value={p.unit} onChange={(e) => setField(i, "unit", e.target.value)} placeholder="ед." className="w-20" />
                          <Input value={String(p.quantity)} onChange={(e) => setField(i, "quantity", e.target.value)} placeholder="кол-во" type="number" className="w-24" />
                          <select
                            value={String(p.vatRate ?? DEFAULT_VAT)}
                            onChange={(e) => setField(i, "vatRate", e.target.value)}
                            title="Ставка НДС итоговой цены"
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                            {VAT_OPTIONS.map((v) => <option key={v} value={v}>НДС {v}%</option>)}
                          </select>
                          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive no-print" onClick={() => delPosition(i)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {p.prices.map((pr, j) => (
                            <div key={j} className={`flex items-center gap-2 ${pr.excluded ? "opacity-55" : ""}`}>
                              <Input value={pr.source} onChange={(e) => setPrice(i, j, "source", e.target.value)} placeholder="Источник (КП)" className={`h-8 flex-1 text-sm ${pr.excluded ? "line-through" : ""}`} />
                              <Input value={String(pr.unitPrice)} onChange={(e) => setPrice(i, j, "unitPrice", e.target.value)} placeholder="цена за ед." type="number" className={`h-8 w-32 text-sm ${pr.excluded ? "line-through" : ""}`} />
                              <select
                                value={String(pr.vatRate ?? DEFAULT_VAT)}
                                onChange={(e) => setPrice(i, j, "vatRate", e.target.value)}
                                title="НДС, включённый в цену источника"
                                className="h-8 rounded-md border border-input bg-background px-1.5 text-xs no-print">
                                {VAT_OPTIONS.map((v) => <option key={v} value={v}>НДС {v}%</option>)}
                              </select>
                              <Button size="sm" variant="ghost" className={`h-7 shrink-0 px-1.5 text-[11px] no-print ${pr.excluded ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
                                title={pr.excluded ? "Вернуть в расчёт" : "Исключить как аномальную цену"} onClick={() => toggleExcluded(i, j)}>
                                {pr.excluded ? "вернуть" : "искл."}
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive no-print" onClick={() => delPrice(i, j)}><XCircle className="h-3.5 w-3.5" /></Button>
                            </div>
                          ))}
                          <Button size="sm" variant="ghost" className="h-7 text-xs no-print" onClick={() => addPrice(i)}><Plus className="mr-1 h-3 w-3" />цена</Button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs border-t border-border pt-2">
                          <span>Средняя (с НДС {r.targetVat}%): <b>{fmt(r.avg)} ₽</b></span>
                          <span>σ: {fmt(r.std)}</span>
                          <span className={r.cv > CV_THRESHOLD ? "text-destructive font-medium" : ""}>Коэф. вариации: {fmt(r.cv)}% {r.cv > CV_THRESHOLD ? "⚠ >33%" : r.n >= 2 ? "✓" : ""}</span>
                          <span>Сумма: <b>{fmt(r.sum)} ₽</b></span>
                          <span className={r.n > 0 && r.n < MIN_SOURCES ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>источников: {r.n}{r.n > 0 && r.n < MIN_SOURCES ? ` (нужно ≥${MIN_SOURCES})` : ""}</span>
                          {r.excludedCount > 0 && <span className="text-muted-foreground">исключено: {r.excludedCount}</span>}
                        </div>
                        {(r.cv > CV_THRESHOLD || r.excludedCount > 0) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 no-print">
                            {r.cv > CV_THRESHOLD && r.n > MIN_SOURCES && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => homogenizePos(i)}>
                                <FileCheck2 className="mr-1 h-3.5 w-3.5" />Привести к однородности (V≤{CV_THRESHOLD}%)
                              </Button>
                            )}
                            {r.excludedCount > 0 && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => resetExclusions(i)}>Вернуть все исключённые</Button>
                            )}
                            {r.cv > CV_THRESHOLD && r.n <= MIN_SOURCES && (
                              <span className="text-[11px] text-amber-600 dark:text-amber-400">Нельзя привести к V≤{CV_THRESHOLD}% без падения ниже {MIN_SOURCES} источников — добавьте сопоставимые цены.</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <Button size="sm" variant="outline" className="no-print" onClick={addPosition}><Plus className="mr-1 h-3.5 w-3.5" />Добавить позицию</Button>
                </div>

                {/* Итог */}
                <div className="rounded-lg bg-primary-soft px-4 py-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">НМЦК (итого):</span>
                    <span className="text-xl font-bold">{fmt(live.nmck)} ₽</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Макс. коэффициент вариации: {fmt(live.cvMax)}% {live.cvMax > CV_THRESHOLD ? "— превышает 33%, цены неоднородны" : "— в пределах нормы"}.</p>
                  {fewSources && <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">По части позиций менее {MIN_SOURCES} источников — добавьте КП для соответствия Приказу №567.</p>}
                </div>

                <div className="flex flex-wrap gap-2 no-print">
                  <Button size="sm" variant="outline" onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Calculator className="mr-1.5 h-3.5 w-3.5" />}Пересчитать и сохранить</Button>
                  <Button size="sm" onClick={justify} disabled={justifying}>{justifying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}Сформировать обоснование (ИИ)</Button>
                </div>

                {calc.justification && (
                  <div className="rounded-lg border border-border p-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Обоснование НМЦК</p>
                    <p className="whitespace-pre-line text-sm leading-relaxed">{calc.justification}</p>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground border-t border-border pt-2">⚠ Расчёт носит справочный характер. Проверьте источники цен и итоговую НМЦК перед публикацией закупки.</p>
              </div>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
