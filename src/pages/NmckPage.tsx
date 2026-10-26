import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Upload, FileText, Loader2, Printer, Calculator, Plus, Trash2,
  AlertTriangle, FileCheck2, XCircle, Sparkles, Clock, ExternalLink, Database,
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { EisSearchPanel } from "@/components/nmck/EisSearchPanel";
import {
  compute, homogenize, cvOfPrices, eisToPrice, missingInKp, posVat, fmt,
  CV_THRESHOLD, MIN_SOURCES, DEFAULT_VAT, VAT_OPTIONS,
  type Price, type Position, type KpSource, type EisItem,
} from "@/lib/nmck";

interface Calc {
  id: string; title: string; status: "processing" | "completed" | "failed";
  positions?: Position[]; nmck?: number | null; cvMax?: number | null;
  justification?: string | null; sources?: KpSource[]; createdAt: string;
}
interface HistoryItem { id: string; title: string; status: Calc["status"]; nmck: number | null; createdAt: string; }

const KIND_LABEL: Record<string, string> = { kp: "КП", eis: "ЕИС", manual: "вручную" };

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
  // Закон закупки — правовая основа в тексте обоснования (как в «Проверке документации»).
  const [law, setLaw] = useState<"223" | "44">("223");
  const pollRef = useRef<number | null>(null);

  // ЕИС: предупреждение после добавления позиции; позиция, у которой открыт поиск.
  const [eisWarn, setEisWarn] = useState<string | null>(null);
  const [eisFor, setEisFor] = useState<number | null>(null);

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
  // Текстовые поля из инпутов (prices/excluded меняются своими функциями).
  const setField = (i: number, k: Exclude<keyof Position, "prices">, v: string) => upd((p) => { p[i] = { ...p[i], [k]: v }; return p; });
  const setPrice = (i: number, j: number, k: Exclude<keyof Price, "excluded">, v: string) => upd((p) => { p[i].prices[j] = { ...p[i].prices[j], [k]: v }; return p; });
  const addPrice = (i: number) => upd((p) => { p[i].prices.push({ source: "", unitPrice: "", vatRate: DEFAULT_VAT }); return p; });
  const delPrice = (i: number, j: number) => upd((p) => { p[i].prices.splice(j, 1); return p; });
  const addPosition = () => upd((p) => [...p, { name: "", unit: "", quantity: "", vatRate: DEFAULT_VAT, prices: [{ source: "", unitPrice: "", vatRate: DEFAULT_VAT }] }]);
  const delPosition = (i: number) => { setEisFor(null); upd((p) => p.filter((_, j) => j !== i)); };
  const homogenizePos = (i: number) => upd((p) => { p[i].prices = homogenize(p[i].prices, posVat(p[i])); return p; });
  const resetExclusions = (i: number) => upd((p) => { p[i].prices = p[i].prices.map((x) => ({ ...x, excluded: false })); return p; });
  // Исключение вручную — с полем для причины (она идёт в отчёт); возврат снимает причину.
  const toggleExcluded = (i: number, j: number) => upd((p) => {
    const { excludeReason: _r, ...pr } = p[i].prices[j];
    p[i].prices[j] = pr.excluded ? { ...pr, excluded: false } : { ...pr, excluded: true, excludeReason: "" };
    return p;
  });
  const addEisToPosition = (i: number, items: EisItem[]) => {
    upd((p) => { p[i].prices.push(...items.map(eisToPrice)); return p; });
    setEisFor(null);
  };

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
      const { data } = await apiClient.post<Calc>(`/nmck/${calc.id}/justify`, { law });
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

  const addEisAsPosition = (chosen: EisItem[], query: string, unitFilter: string) => {
    const unit = unitFilter || chosen.find((c) => c.unit)?.unit || "";
    const qty = chosen.find((c) => c.quantity)?.quantity || 1;
    const prices: Price[] = chosen.map(eisToPrice);
    upd((p) => [...p, { name: query, unit, quantity: qty, vatRate: DEFAULT_VAT, prices }]);
    const { cv, n } = cvOfPrices(prices, DEFAULT_VAT);
    if (n >= 2 && cv > CV_THRESHOLD) {
      setEisWarn(`Подобранные цены неоднородны (V=${fmt(cv)}% > ${CV_THRESHOLD}%) — вероятно, контракты разного масштаба. Нажмите «Привести к однородности» у позиции ниже либо уточните запрос (конкретная модель/ед. изм.).`);
    } else setEisWarn(null);
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
            {error && <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
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

                {/* ЕИС: поиск цен в реестре контрактов — новая позиция */}
                <EisSearchPanel label="Подбор цен из ЕИС" addLabel={(n) => `Добавить выбранные (${n}) как позицию`} onAdd={addEisAsPosition}>
                  <p className="text-sm font-medium flex items-center gap-1.5"><Database className="h-4 w-4 text-primary" /> Подбор цен из ЕИС (реестр контрактов)</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Введите <b>конкретную</b> позицию (напр. «стул офисный», а не «мебель») и, по возможности, единицу измерения — система подберёт однородные цены за единицу из прошедших контрактов.</p>
                </EisSearchPanel>
                {eisWarn && (
                  <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-600 dark:text-amber-400 no-print">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{eisWarn}
                  </p>
                )}

                {/* Позиции */}
                <div className="space-y-3">
                  {positions.map((p, i) => {
                    const r = live.rows[i];
                    const missing = missingInKp(p, calc.sources ?? []);
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
                            <div key={j}>
                            <div className={`flex items-center gap-2 ${pr.excluded ? "opacity-55" : ""}`}>
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
                            <PriceSource pr={pr} />
                            {pr.excluded && (
                              <Input value={pr.excludeReason ?? ""} onChange={(e) => setPrice(i, j, "excludeReason", e.target.value)}
                                placeholder="Причина исключения (попадёт в отчёт)" className="mt-1 h-7 text-xs no-print" />
                            )}
                            </div>
                          ))}
                          <Button size="sm" variant="ghost" className="h-7 text-xs no-print" onClick={() => addPrice(i)}><Plus className="mr-1 h-3 w-3" />цена</Button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs border-t border-border pt-2">
                          <span>Средняя (с НДС {r.targetVat}%): <b>{fmt(r.avg)} ₽</b></span>
                          <span>мин.: {fmt(r.min)}</span>
                          <span>медиана: {fmt(r.median)}</span>
                          <span>σ: {fmt(r.std)}</span>
                          <span className={r.cv > CV_THRESHOLD ? "text-destructive font-medium" : ""}>Коэф. вариации: {fmt(r.cv)}% {r.cv > CV_THRESHOLD ? "⚠ >33%" : r.n >= 2 ? "✓" : ""}</span>
                          <span>Сумма: <b>{fmt(r.sum)} ₽</b></span>
                          <span className={r.n > 0 && r.n < MIN_SOURCES ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>источников: {r.n}{r.n > 0 && r.n < MIN_SOURCES ? ` (нужно ≥${MIN_SOURCES})` : ""}</span>
                          {r.excludedCount > 0 && <span className="text-muted-foreground">исключено: {r.excludedCount}</span>}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 no-print">
                          {missing.length > 0 && <span className="text-[11px] text-amber-600 dark:text-amber-400">нет в КП: {missing.join(", ")}</span>}
                          <Button size="sm" variant={missing.length > 0 || r.cv > CV_THRESHOLD ? "outline" : "ghost"} className="h-7 text-xs"
                            onClick={() => setEisFor(eisFor === i ? null : i)}>
                            <Database className="mr-1 h-3.5 w-3.5" />Найти в ЕИС
                          </Button>
                        </div>
                        {eisFor === i && (
                          <div className="mt-2">
                            <EisSearchPanel label={`Поиск в ЕИС для позиции «${p.name}»`} initialQuery={p.name} initialUnit={p.unit}
                              addLabel={(n) => `Добавить к позиции (${n})`} onAdd={(items) => addEisToPosition(i, items)}>
                              <p className="text-xs text-muted-foreground">Цены прошедших контрактов по этой позиции — выбранные добавятся ценами с типом «ЕИС» и ссылкой на контракт.</p>
                            </EisSearchPanel>
                          </div>
                        )}
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
                  <select
                    aria-label="Закон закупки"
                    value={law}
                    onChange={(e) => setLaw(e.target.value as "223" | "44")}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="223">По 223-ФЗ</option>
                    <option value="44">По 44-ФЗ</option>
                  </select>
                  <Button size="sm" onClick={justify} disabled={justifying}>{justifying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}Сформировать обоснование (ИИ)</Button>
                </div>

                {calc.justification && (
                  <div className="rounded-lg border border-border p-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Обоснование НМЦ</p>
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

// Откуда цена: тип, наименование в источнике, обоснование сопоставления (ИИ), ссылка ЕИС.
function PriceSource({ pr }: { pr: Price }) {
  const details = pr.kind || pr.offerName || pr.url || pr.vatExempt || pr.unverified || pr.vatMode === "сверху";
  if (!details && !pr.matchNote) return null;
  return (
    <div className="ml-1 mt-0.5 space-y-0.5 text-[11px] text-muted-foreground">
      {details && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
          {pr.kind && <span className="rounded bg-muted px-1.5 py-px text-[10px]">{KIND_LABEL[pr.kind] ?? pr.kind}</span>}
          {pr.offerName && <span>В {pr.kind === "eis" ? "контракте" : "КП"}: «{pr.offerName}»</span>}
          {pr.kind === "eis" && pr.date && <span>от {pr.date}</span>}
          {pr.url && /^https?:\/\//.test(pr.url) && (
            <a href={pr.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary">карточка контракта <ExternalLink className="h-3 w-3" /></a>
          )}
          {pr.vatMode === "сверху" && pr.sourcePrice != null && <span>в КП {fmt(Number(pr.sourcePrice))} ₽ + НДС {pr.vatRate}%</span>}
          {pr.vatExempt && <span>НДС не облагается — без пересчёта</span>}
          {pr.unverified && <span className="text-amber-600 dark:text-amber-400">цена не найдена в тексте КП — проверьте</span>}
        </div>
      )}
      {pr.matchNote && (
        <p className="flex gap-1 italic text-indigo-600 dark:text-indigo-300"><Sparkles className="mt-0.5 h-3 w-3 shrink-0" />{pr.matchNote}</p>
      )}
    </div>
  );
}
