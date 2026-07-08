import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload, Loader2, ShieldAlert, AlertTriangle, CheckCircle2, Printer, Gavel, Quote, Wrench, Scale,
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { openExternal } from "@/lib/url";

interface Citation { kind?: string; title?: string; law?: string; article?: string; docNumber?: string; authority?: string; url?: string; quote?: string; }
interface Risk { title: string; severity: string; place: string; why: string; fix: string; topic?: string; confidence?: string; citations?: Citation[]; }
interface ReviewResult { overallRisk: string; summary: string; risks: Risk[]; mode?: string; }

const MODE_LAWS: Record<string, string> = {
  "223": "223-ФЗ · ГК РФ · ФЗ-135",
  "44": "44-ФЗ · ГК РФ · ФЗ-135",
  commercial: "ГК РФ · ФЗ-135",
};

function citeLabel(c: Citation): string {
  if (c.law && c.article) return `${c.law} ${c.article}`;
  if (c.docNumber) return `${c.authority ?? "ФАС"} № ${c.docNumber}`;
  return c.title ?? "источник";
}

function sev(s: string) {
  const v = (s || "").toLowerCase();
  if (/высок/.test(v)) return { label: "высокий", cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", dot: "text-red-500" };
  if (/средн/.test(v)) return { label: "средний", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", dot: "text-amber-500" };
  if (/низк/.test(v))  return { label: "низкий", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", dot: "text-emerald-500" };
  return { label: s || "—", cls: "bg-muted text-muted-foreground", dot: "text-muted-foreground" };
}
function overallStyle(s: string) {
  const v = (s || "").toLowerCase();
  if (/высок/.test(v)) return { cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", Icon: ShieldAlert };
  if (/средн/.test(v)) return { cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", Icon: AlertTriangle };
  if (/низк/.test(v))  return { cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", Icon: CheckCircle2 };
  return { cls: "bg-muted text-muted-foreground", Icon: AlertTriangle };
}

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function buildHtml(r: ReviewResult): string {
  const rows = r.risks.map((x, i) => {
    const cites = (x.citations ?? []).map((c) => `${esc(citeLabel(c))}${c.url ? ` (${esc(c.url)})` : ""}`).join("; ");
    return `<tr><td>${i + 1}</td><td><b>${esc(x.title)}</b><div class="s">${esc(x.severity)}</div></td>
     <td>${x.place ? `<div class="q">«${esc(x.place)}»</div>` : ""}<div>${esc(x.why)}</div>${x.fix ? `<div class="f"><b>Исправить:</b> ${esc(x.fix)}</div>` : ""}${cites ? `<div class="c"><b>Основание:</b> ${cites}</div>` : ""}</td></tr>`;
  }).join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
    body{font-family:Arial,"DejaVu Sans",sans-serif;font-size:11px;color:#1a1a2e;margin:24px}
    h1{font-size:15px;margin:0 0 4px} .badge{display:inline-block;padding:2px 8px;border-radius:6px;font-weight:600;background:#fee2e2;color:#991b1b}
    table{width:100%;border-collapse:collapse;margin-top:8px} th,td{border:1px solid #ccd;padding:6px 8px;text-align:left;vertical-align:top}
    th{background:#f3f5fa} .s{color:#667;font-size:10px} .q{color:#556;font-style:italic;margin-bottom:3px} .f{color:#155e3b;margin-top:3px}
    .c{color:#3b3a6b;margin-top:3px;font-size:10px} .foot{margin-top:12px;color:#889;font-size:10px}</style></head><body>
    <h1>Проверка документации на риски обжалования (ФАС)</h1>
    <div>Общий риск: <span class="badge">${esc(r.overallRisk)}</span></div>
    ${r.summary ? `<p>${esc(r.summary)}</p>` : ""}
    <table><thead><tr><th style="width:28px">№</th><th style="width:34%">Риск</th><th>Обоснование, нормы и как исправить</th></tr></thead><tbody>${rows || "<tr><td colspan=3>Риски не выявлены</td></tr>"}</tbody></table>
    <div class="foot">Сформировано в ZakupkiAI. Основания приведены со ссылками на нормы; итоговое решение принимает заказчик. Спорные моменты согласуйте с юристом.</div>
  </body></html>`;
}

type Mode = "223" | "44" | "commercial";
const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "223", label: "По 223-ФЗ", hint: "223-ФЗ + ГК РФ + ФЗ-135 «О защите конкуренции»" },
  { value: "44", label: "По 44-ФЗ", hint: "44-ФЗ + ГК РФ + ФЗ-135 «О защите конкуренции»" },
  { value: "commercial", label: "Коммерческая", hint: "ГК РФ + ФЗ-135 (без 44/223-ФЗ)" },
];

export default function DocReviewPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>("223");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);

  const submit = async () => {
    setError(null);
    if (files.length === 0) { setError("Загрузите файлы документации закупки"); return; }
    const form = new FormData();
    files.forEach((f) => form.append("docs", f));
    form.append("mode", mode);
    setLoading(true); setResult(null);
    try {
      const { data } = await apiClient.post<ReviewResult>("/doc-review", form, {
        headers: { "Content-Type": "multipart/form-data" }, timeout: 120000,
      });
      setResult(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? "Не удалось выполнить проверку");
    } finally { setLoading(false); }
  };

  const downloadPdf = async () => {
    if (!result) return;
    try {
      const res = await apiClient.post("/checko/pdf", { html: buildHtml(result) }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url; a.download = "Проверка_документации.pdf";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { alert("Не удалось сформировать PDF."); }
  };

  const ov = result ? overallStyle(result.overallRisk) : null;

  return (
    <AppLayout title="Проверка документации" subtitle="Проверьте проект закупки на риски обжалования в ФАС до публикации">
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">

        <Card className="p-6">
          <label className="text-sm font-medium">Способ закупки</label>
          <p className="mt-0.5 text-xs text-muted-foreground">Определяет, по каким законам проверять — 223-ФЗ анализируется без норм 44-ФЗ.</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={`rounded-lg border p-2.5 text-left transition-colors ${
                  mode === m.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="text-sm font-medium">{m.label}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{m.hint}</div>
              </button>
            ))}
          </div>

          <label className="mt-5 block text-sm font-medium">Документация закупки (проект)</label>
          <p className="mt-0.5 text-xs text-muted-foreground">Извещение, ТЗ, проект договора. Можно несколько файлов.</p>
          <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm hover:border-primary/40">
            <Upload className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate text-muted-foreground">{files.length ? `Файлов: ${files.length}` : "Выберите файлы (PDF, DOCX, XLSX, TXT)"}</span>
            <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </label>
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">{files.map((f, i) => <Badge key={i} variant="secondary" className="text-[11px] font-normal">{f.name}</Badge>)}</div>
          )}
          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          <div className="mt-3">
            <Button onClick={submit} disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Gavel className="mr-1.5 h-4 w-4" />}
              Проверить документацию
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">Проверка займёт до ~20 секунд. Поддержка: PDF, DOCX, XLSX, TXT.</p>
          </div>
        </Card>

        {loading && (
          <Card className="p-6">
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Анализируем документацию на риски ФАС…
            </div>
          </Card>
        )}

        {result && !loading && ov && (
          <Card className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold ${ov.cls}`}>
                  <ov.Icon className="h-4 w-4" /> Общий риск: {result.overallRisk}
                </span>
                <span className="text-xs text-muted-foreground">выявлено рисков: {result.risks.length}</span>
                {result.mode && MODE_LAWS[result.mode] && (
                  <span className="text-[11px] text-muted-foreground">· проверено по: {MODE_LAWS[result.mode]}</span>
                )}
              </div>
              <Button size="sm" variant="outline" className="text-xs" onClick={downloadPdf}>
                <Printer className="mr-1.5 h-3.5 w-3.5" /> Скачать PDF
              </Button>
            </div>

            {result.summary && <p className="rounded-lg bg-primary-soft px-4 py-3 text-sm">{result.summary}</p>}

            {result.risks.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Явных рисков обжалования не выявлено. Всё равно проверьте документацию по внутреннему регламенту.
              </div>
            ) : (
              <div className="space-y-3">
                {result.risks.map((r, i) => {
                  const s = sev(r.severity);
                  return (
                    <div key={i} className="rounded-lg border border-border p-3">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className={`h-4 w-4 shrink-0 mt-0.5 ${s.dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{r.title}</p>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${s.cls}`}>{s.label}</span>
                          </div>
                          {r.place && (
                            <p className="mt-1 flex gap-1.5 text-xs text-muted-foreground italic"><Quote className="h-3 w-3 shrink-0 mt-0.5" />«{r.place}»</p>
                          )}
                          {r.why && <p className="mt-1 text-xs text-muted-foreground">{r.why}</p>}
                          {r.fix && (
                            <p className="mt-1.5 flex gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"><Wrench className="h-3 w-3 shrink-0 mt-0.5" /><span><b>Как исправить:</b> {r.fix}</span></p>
                          )}
                          {r.citations && r.citations.length > 0 ? (
                            <div className="mt-2 rounded-md bg-indigo-500/5 border border-indigo-500/15 px-2.5 py-2">
                              <p className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
                                <Scale className="h-3 w-3" /> Основание
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {r.citations.map((c, ci) => {
                                  const label = citeLabel(c);
                                  return c.url ? (
                                    <button key={ci} onClick={() => openExternal(c.url!)} title={c.quote ?? c.title ?? ""}
                                      className="inline-flex items-center gap-1 rounded border border-indigo-500/30 bg-background px-1.5 py-0.5 text-[11px] text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10">
                                      {label}
                                    </button>
                                  ) : (
                                    <span key={ci} title={c.quote ?? ""} className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">{label}</span>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <p className="mt-2 text-[11px] text-muted-foreground/70 italic">Без подтверждённого прецедента в базе — проверьте норму самостоятельно.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
              ⚖ К находкам приведены основания со ссылками на нормы — проверьте их по первоисточнику. Итоговое решение о публикации принимает заказчик; спорные моменты согласуйте с юристом.
            </p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
