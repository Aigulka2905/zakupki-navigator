import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileText, Loader2, ShieldCheck, CheckCircle2, AlertTriangle,
  XCircle, HelpCircle, ClipboardList, FileWarning, Lightbulb, Printer, Scale,
  CalendarClock, FileCheck2,
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { openExternal } from "@/lib/url";

interface Citation { kind?: string; title?: string; law?: string; article?: string; docNumber?: string; authority?: string; url?: string; quote?: string; }
interface ChecklistItem { requirement: string; status: string; detail: string; ref: string; citations?: Citation[]; confidence?: string; specMatch?: "verified" | "weak" | "unverified"; }
interface CheckResult {
  verdict: string;
  score: number | null;
  summary: string;
  checklist: ChecklistItem[];
  missingDocuments: string[];
  recommendations: string[];
  mode?: string;
  unverifiedCount?: number;
  ruleChecks?: RuleChecks;
}
interface RuleChecks {
  missingDocuments: { id: string; label: string; presentInBid: boolean }[];
  deadlines: { id: string; label: string; snippet: string }[];
  forms: { referenced: string[]; missingInBid: string[] };
}

type Mode = "223" | "44" | "commercial";
const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "223", label: "По 223-ФЗ", hint: "223-ФЗ + ГК РФ + ФЗ-135" },
  { value: "44", label: "По 44-ФЗ", hint: "44-ФЗ + ГК РФ + ФЗ-135" },
  { value: "commercial", label: "Коммерческая", hint: "ГК РФ + ФЗ-135" },
];
const MODE_LAWS: Record<string, string> = { "223": "223-ФЗ · ГК РФ · ФЗ-135", "44": "44-ФЗ · ГК РФ · ФЗ-135", commercial: "ГК РФ · ФЗ-135" };
function citeLabel(c: Citation): string {
  if (c.law && c.article) return `${c.law} ${c.article}`;
  if (c.docNumber) return `${c.authority ?? "ФАС"} № ${c.docNumber}`;
  return c.title ?? "источник";
}

function verdictStyle(v: string) {
  const s = (v || "").toLowerCase();
  if (/готова к подаче/.test(s)) return { cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", Icon: CheckCircle2 };
  if (/не готова/.test(s))       return { cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", Icon: XCircle };
  return { cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", Icon: AlertTriangle };
}
function statusStyle(s: string) {
  const v = (s || "").toLowerCase();
  if (/выполн/.test(v))  return { Icon: CheckCircle2, cls: "text-emerald-500" };
  if (/частич/.test(v))  return { Icon: AlertTriangle, cls: "text-amber-500" };
  if (/не вып/.test(v))  return { Icon: XCircle, cls: "text-red-500" };
  return { Icon: HelpCircle, cls: "text-muted-foreground" };
}

const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildReportHtml(r: CheckResult): string {
  const rows = r.checklist.map((c) =>
    `<tr><td class="st">${esc(c.status)}</td><td>${esc(c.requirement)}${c.ref ? ` <span class="ref">${esc(c.ref)}</span>` : ""}${c.specMatch === "unverified" ? ` <span class="warn">не найдено в ТЗ</span>` : ""}${c.detail ? `<div class="d">${esc(c.detail)}</div>` : ""}</td></tr>`).join("");
  const md = r.missingDocuments.length ? `<h3>Недостающие документы</h3><ul>${r.missingDocuments.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  const rec = r.recommendations.length ? `<h3>Рекомендации</h3><ul>${r.recommendations.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  const rc = r.ruleChecks;
  const ruleParts: string[] = [];
  if (rc?.missingDocuments.length) ruleParts.push(`<p><b>ТЗ требует, но в заявке не найдено:</b></p><ul>${rc.missingDocuments.map((d) => `<li>${esc(d.label)}</li>`).join("")}</ul>`);
  if (rc?.forms.missingInBid.length) ruleParts.push(`<p><b>Формы/приложения из ТЗ, не найденные в заявке:</b> ${rc.forms.missingInBid.map(esc).join(", ")}</p>`);
  if (rc?.deadlines.length) ruleParts.push(`<p><b>Ключевые сроки из ТЗ:</b></p><ul>${rc.deadlines.map((d) => `<li>${esc(d.label)}: ${esc(d.snippet)}</li>`).join("")}</ul>`);
  const rules = ruleParts.length ? `<h3>Автопроверка по правилам (без ИИ)</h3>${ruleParts.join("")}` : "";
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
    body{font-family:Arial,"DejaVu Sans",sans-serif;color:#1a1a2e;font-size:12px;line-height:1.45;margin:24px}
    h1{font-size:16px;margin:0 0 4px} h3{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#667;border-top:1px solid #e3e6ee;padding-top:8px;margin:14px 0 6px}
    .badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;background:#fef3c7;color:#92400e}
    .sum{margin:8px 0}
    table{width:100%;border-collapse:collapse} td{border-top:1px solid #eef;padding:6px 8px;vertical-align:top;font-size:11px}
    .st{white-space:nowrap;font-weight:600;width:110px} .ref{color:#667;font-size:10px} .d{color:#556;margin-top:2px}
    .warn{color:#92400e;background:#fef3c7;border-radius:4px;padding:0 4px;font-size:10px;font-weight:600}
    ul{margin:4px 0;padding-left:18px} li{margin:1px 0}
    .foot{margin-top:14px;color:#889;font-size:10px;border-top:1px solid #e3e6ee;padding-top:6px}
  </style></head><body>
    <h1>Проверка заявки перед подачей</h1>
    <div><span class="badge">${esc(r.verdict)}</span>${r.score != null ? ` &nbsp; Готовность: <b>${r.score}/100</b>` : ""}</div>
    ${r.summary ? `<p class="sum">${esc(r.summary)}</p>` : ""}
    <h3>Чек-лист требований</h3>
    <table>${rows || "<tr><td>—</td></tr>"}</table>
    ${rules}${md}${rec}
    <div class="foot">Сформировано в ZakupkiAI · носит рекомендательный характер</div>
  </body></html>`;
}

export default function BidCheckPage() {
  const [specFiles, setSpecFiles] = useState<File[]>([]);
  const [bidFiles, setBidFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>("223");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);

  const submit = async () => {
    setError(null);
    if (specFiles.length === 0) { setError("Загрузите документацию закупки (ТЗ)"); return; }
    if (bidFiles.length === 0) { setError("Загрузите файлы вашей заявки"); return; }
    const form = new FormData();
    specFiles.forEach((f) => form.append("spec", f));
    bidFiles.forEach((f) => form.append("bid", f));
    form.append("mode", mode);
    setLoading(true);
    setResult(null);
    try {
      const { data } = await apiClient.post<CheckResult>("/bid-check", form, {
        headers: { "Content-Type": "multipart/form-data" }, timeout: 120000,
      });
      setResult(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? "Не удалось выполнить проверку");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    if (!result) return;
    try {
      const res = await apiClient.post("/checko/pdf", { html: buildReportHtml(result) }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url; a.download = "Проверка_заявки.pdf";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { alert("Не удалось сформировать PDF."); }
  };

  const v = result ? verdictStyle(result.verdict) : null;

  return (
    <AppLayout title="Проверка заявки" subtitle="Проверьте свою заявку на соответствие ТЗ до подачи">
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">

        {/* Форма */}
        <Card className="p-6">
          <label className="text-sm font-medium">Способ закупки</label>
          <p className="mt-0.5 text-xs text-muted-foreground">По какому закону проводится закупка — для ссылок на нормы.</p>
          <div className="mt-2 mb-4 grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button key={m.value} type="button" onClick={() => setMode(m.value)}
                className={`rounded-lg border p-2.5 text-left transition-colors ${
                  mode === m.value ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/40"
                }`}>
                <div className="text-sm font-medium">{m.label}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{m.hint}</div>
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Документация закупки (ТЗ)</label>
              <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm hover:border-primary/40">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate text-muted-foreground">{specFiles.length ? `Файлов: ${specFiles.length}` : "Выберите файлы (PDF, DOCX, XLSX, TXT)"}</span>
                <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" className="hidden"
                  onChange={(e) => setSpecFiles(Array.from(e.target.files ?? []))} />
              </label>
            </div>
            <div>
              <label className="text-sm font-medium">Ваша заявка (черновик)</label>
              <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm hover:border-primary/40">
                <Upload className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate text-muted-foreground">{bidFiles.length ? `Файлов: ${bidFiles.length}` : "Выберите файлы заявки"}</span>
                <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" className="hidden"
                  onChange={(e) => setBidFiles(Array.from(e.target.files ?? []))} />
              </label>
            </div>
          </div>

          {(specFiles.length > 0 || bidFiles.length > 0) && (
            <div className="mt-2 space-y-1">
              {specFiles.length > 0 && <div className="flex flex-wrap gap-1.5"><span className="text-[11px] text-muted-foreground self-center">ТЗ:</span>{specFiles.map((f, i) => <Badge key={i} variant="secondary" className="text-[11px] font-normal">{f.name}</Badge>)}</div>}
              {bidFiles.length > 0 && <div className="flex flex-wrap gap-1.5"><span className="text-[11px] text-muted-foreground self-center">Заявка:</span>{bidFiles.map((f, i) => <Badge key={i} variant="outline" className="text-[11px] font-normal">{f.name}</Badge>)}</div>}
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <div className="mt-4">
            <Button onClick={submit} disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}
              Проверить заявку
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">Проверка займёт несколько секунд. Поддержка: PDF, DOCX, XLSX, TXT.</p>
          </div>
        </Card>

        {/* Загрузка */}
        {loading && (
          <Card className="p-6">
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Сверяем заявку с требованиями ТЗ…
            </div>
          </Card>
        )}

        {/* Результат */}
        {result && !loading && v && (
          <Card className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold ${v.cls}`}>
                  <v.Icon className="h-4 w-4" /> {result.verdict}
                </span>
                {result.score != null && (
                  <span className="text-sm text-muted-foreground">Готовность: <b className="text-foreground">{result.score}/100</b></span>
                )}
              </div>
              <Button size="sm" variant="outline" className="text-xs" onClick={downloadPdf}>
                <Printer className="mr-1.5 h-3.5 w-3.5" /> Скачать PDF
              </Button>
            </div>

            {result.summary && <p className="rounded-lg bg-primary-soft px-4 py-3 text-sm">{result.summary}</p>}

            {/* Чек-лист */}
            {result.checklist.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ClipboardList className="h-3.5 w-3.5" /> Чек-лист требований
                </p>
                {(result.unverifiedCount ?? 0) > 0 && (
                  <p className="mb-2 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>Пункты, помеченные «не найдено в ТЗ» ({result.unverifiedCount}), не удалось сопоставить с текстом документации — возможно, ИИ ошибся с требованием или ссылкой. Проверьте их по оригиналу ТЗ, прежде чем править заявку.</span>
                  </p>
                )}
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {result.checklist.map((c, i) => {
                    const st = statusStyle(c.status);
                    return (
                      <li key={i} className="flex gap-2.5 px-3 py-2.5 text-sm">
                        <st.Icon className={`h-4 w-4 shrink-0 mt-0.5 ${st.cls}`} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {c.requirement}
                            {c.ref && <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] font-medium text-foreground/70">{c.ref}</span>}
                            {c.specMatch === "unverified" && (
                              <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" title="Требование или ссылка не найдены в тексте ТЗ — проверьте вручную">
                                <AlertTriangle className="h-2.5 w-2.5" /> не найдено в ТЗ
                              </span>
                            )}
                          </p>
                          {c.detail && <p className="text-xs text-muted-foreground mt-0.5">{c.detail}</p>}
                          {c.citations && c.citations.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span className="flex items-center gap-1 text-[10px] font-medium text-indigo-700 dark:text-indigo-300"><Scale className="h-3 w-3" /> Основание:</span>
                              {c.citations.map((ci, k) => ci.url ? (
                                <button key={k} onClick={() => openExternal(ci.url!)} title={ci.quote ?? ci.title ?? ""}
                                  className="rounded border border-indigo-500/30 bg-background px-1.5 py-0.5 text-[10px] text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10">{citeLabel(ci)}</button>
                              ) : (
                                <span key={k} title={ci.quote ?? ""} className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">{citeLabel(ci)}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Недостающие документы */}
            {result.missingDocuments.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                  <FileWarning className="h-3.5 w-3.5" /> Недостающие документы
                </p>
                <ul className="space-y-0.5">
                  {result.missingDocuments.map((d, i) => (
                    <li key={i} className="flex gap-1.5 text-sm text-muted-foreground"><XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Рекомендации */}
            {result.recommendations.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Lightbulb className="h-3.5 w-3.5" /> Рекомендации
                </p>
                <ul className="space-y-0.5">
                  {result.recommendations.map((d, i) => (
                    <li key={i} className="flex gap-1.5 text-sm text-muted-foreground"><Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Автопроверка по правилам (детерминированная, без ИИ) */}
            {result.ruleChecks && (
              (result.ruleChecks.missingDocuments.length > 0 ||
               result.ruleChecks.deadlines.length > 0 ||
               result.ruleChecks.forms.missingInBid.length > 0) && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/70">
                    <ShieldCheck className="h-3.5 w-3.5" /> Автопроверка по правилам
                    <span className="font-normal normal-case text-[10px] text-muted-foreground">(без ИИ, по формальным признакам)</span>
                  </p>
                  <div className="space-y-2.5">
                    {result.ruleChecks.missingDocuments.length > 0 && (
                      <div>
                        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                          <FileWarning className="h-3 w-3" /> ТЗ требует, но в заявке не найдено:
                        </p>
                        <ul className="space-y-0.5">
                          {result.ruleChecks.missingDocuments.map((d) => (
                            <li key={d.id} className="flex gap-1.5 text-sm text-muted-foreground"><XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />{d.label}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {result.ruleChecks.forms.missingInBid.length > 0 && (
                      <div>
                        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          <FileCheck2 className="h-3 w-3" /> Формы/приложения из ТЗ, не найденные в заявке:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.ruleChecks.forms.missingInBid.map((f, i) => (
                            <span key={i} className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">{f}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {result.ruleChecks.deadlines.length > 0 && (
                      <div>
                        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-foreground/70">
                          <CalendarClock className="h-3 w-3" /> Ключевые сроки из ТЗ:
                        </p>
                        <ul className="space-y-0.5">
                          {result.ruleChecks.deadlines.map((d) => (
                            <li key={d.id} className="flex gap-1.5 text-sm text-muted-foreground">
                              <span className="text-foreground/70">{d.label}:</span>
                              <span className="font-medium tabular-nums">{d.snippet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">Эти проверки формальные и не заменяют чтение ТЗ — сверьте с оригиналом.</p>
                </div>
              )
            )}

            <p className="border-t border-border pt-2 text-[11px] text-muted-foreground">
              ⚠ Проверка сформирована ИИ и носит рекомендательный характер. Итоговую корректность заявки подтверждайте по документации закупки.
            </p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
