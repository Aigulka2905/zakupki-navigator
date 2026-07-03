import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload, Loader2, ShieldAlert, AlertTriangle, CheckCircle2, Printer, Gavel, Quote, Wrench,
} from "lucide-react";
import apiClient from "@/lib/api-client";

interface Risk { title: string; severity: string; place: string; why: string; fix: string; }
interface ReviewResult { overallRisk: string; summary: string; risks: Risk[]; }

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
  const rows = r.risks.map((x, i) =>
    `<tr><td>${i + 1}</td><td><b>${esc(x.title)}</b><div class="s">${esc(x.severity)}</div></td>
     <td>${x.place ? `<div class="q">«${esc(x.place)}»</div>` : ""}<div>${esc(x.why)}</div>${x.fix ? `<div class="f"><b>Исправить:</b> ${esc(x.fix)}</div>` : ""}</td></tr>`).join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
    body{font-family:Arial,"DejaVu Sans",sans-serif;font-size:11px;color:#1a1a2e;margin:24px}
    h1{font-size:15px;margin:0 0 4px} .badge{display:inline-block;padding:2px 8px;border-radius:6px;font-weight:600;background:#fee2e2;color:#991b1b}
    table{width:100%;border-collapse:collapse;margin-top:8px} th,td{border:1px solid #ccd;padding:6px 8px;text-align:left;vertical-align:top}
    th{background:#f3f5fa} .s{color:#667;font-size:10px} .q{color:#556;font-style:italic;margin-bottom:3px} .f{color:#155e3b;margin-top:3px}
    .foot{margin-top:12px;color:#889;font-size:10px}</style></head><body>
    <h1>Проверка документации на риски обжалования (ФАС)</h1>
    <div>Общий риск: <span class="badge">${esc(r.overallRisk)}</span></div>
    ${r.summary ? `<p>${esc(r.summary)}</p>` : ""}
    <table><thead><tr><th style="width:28px">№</th><th style="width:34%">Риск</th><th>Обоснование и как исправить</th></tr></thead><tbody>${rows || "<tr><td colspan=3>Риски не выявлены</td></tr>"}</tbody></table>
    <div class="foot">Сформировано в ZakupkiAI. Носит рекомендательный/проектный характер — перед публикацией согласуйте с юристом.</div>
  </body></html>`;
}

export default function DocReviewPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);

  const submit = async () => {
    setError(null);
    if (files.length === 0) { setError("Загрузите файлы документации закупки"); return; }
    const form = new FormData();
    files.forEach((f) => form.append("docs", f));
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
          <label className="text-sm font-medium">Документация закупки (проект)</label>
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
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
              ⚠ Проверка сформирована ИИ и носит рекомендательный характер. Итоговое решение о публикации принимает заказчик; спорные моменты согласуйте с юристом.
            </p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
