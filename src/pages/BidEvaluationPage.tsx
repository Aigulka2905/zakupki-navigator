import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileText, Loader2, Printer, CheckCircle2, AlertTriangle,
  XCircle, ClipboardCheck, FileCheck2, Clock, Plus, Trash2, Users,
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { ProtocolDialog } from "@/components/ProtocolDialog";

type Finding = string | { text: string; ref?: string };
interface BidResult {
  participantName: string;
  fileNames?: string[];
  verdict: string;
  score: number | null;
  price?: string;
  deliveryTerm?: string;
  recommendation: string;
  strengths: Finding[];
  weaknesses: Finding[];
}
// Нормализует пункт к { text, ref } (поддержка старого строкового формата).
function asFinding(f: Finding): { text: string; ref: string } {
  if (typeof f === "string") return { text: f, ref: "" };
  return { text: f?.text ?? "", ref: f?.ref ?? "" };
}
interface Participant {
  name: string;
  files: File[];
}
interface Evaluation {
  id: string;
  title: string;
  status: "processing" | "completed" | "failed";
  bidCount: number;
  summary?: string | null;
  specFileName?: string;
  results?: BidResult[];
  createdAt: string;
}
interface HistoryItem {
  id: string; title: string; status: Evaluation["status"]; bidCount: number; createdAt: string;
}

function verdictStyle(verdict: string) {
  const v = (verdict || "").toLowerCase();
  if (/^соответ/.test(v))      return { cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", Icon: CheckCircle2 };
  if (/частич/.test(v))         return { cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", Icon: AlertTriangle };
  if (/не соответ/.test(v))     return { cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", Icon: XCircle };
  return { cls: "bg-muted text-muted-foreground", Icon: AlertTriangle };
}

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #bid-report, #bid-report * { visibility: visible !important; }
  #bid-report { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
  .no-print { display: none !important; }
}`;

export default function BidEvaluationPage() {
  const [title, setTitle] = useState("");
  const [specFiles, setSpecFiles] = useState<File[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([{ name: "", files: [] }]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addParticipant = () => setParticipants((p) => [...p, { name: "", files: [] }]);
  const removeParticipant = (i: number) => setParticipants((p) => p.length > 1 ? p.filter((_, j) => j !== i) : p);
  const setParticipantName = (i: number, name: string) =>
    setParticipants((p) => p.map((x, j) => (j === i ? { ...x, name } : x)));
  const setParticipantFiles = (i: number, files: File[]) =>
    setParticipants((p) => p.map((x, j) => (j === i ? { ...x, files } : x)));

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [current, setCurrent] = useState<Evaluation | null>(null);
  const [protocolOpen, setProtocolOpen] = useState(false);
  const pollRef = useRef<number | null>(null);

  const loadHistory = async () => {
    try {
      const { data } = await apiClient.get<HistoryItem[]>("/bid-evaluation");
      setHistory(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadHistory();
    return () => { if (pollRef.current) window.clearTimeout(pollRef.current); };
  }, []);

  const openEvaluation = async (id: string) => {
    if (pollRef.current) window.clearTimeout(pollRef.current);
    try {
      const { data } = await apiClient.get<Evaluation>(`/bid-evaluation/${id}`);
      setCurrent(data);
      if (data.status === "processing") {
        pollRef.current = window.setTimeout(() => openEvaluation(id), 1500);
      } else {
        loadHistory();
      }
    } catch {
      setError("Не удалось загрузить оценку");
    }
  };

  const submit = async () => {
    setError(null);
    if (specFiles.length === 0) { setError("Загрузите документацию закупки (ТЗ)"); return; }
    const filled = participants.filter((p) => p.files.length > 0);
    if (filled.length === 0) { setError("Добавьте хотя бы одного участника с документами"); return; }

    const form = new FormData();
    form.append("title", title);
    specFiles.forEach((f) => form.append("spec", f));
    // Имена участников выровнены по индексу с полями p_<i>.
    form.append("names", JSON.stringify(filled.map((p) => p.name.trim())));
    filled.forEach((p, i) => p.files.forEach((f) => form.append(`p_${i}`, f)));

    setUploading(true);
    try {
      const { data } = await apiClient.post<Evaluation>("/bid-evaluation", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setTitle(""); setSpecFiles([]); setParticipants([{ name: "", files: [] }]);
      openEvaluation(data.id);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? "Не удалось запустить оценку");
    } finally {
      setUploading(false);
    }
  };

  const fmtDate = (s: string) => new Date(s).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });

  return (
    <AppLayout title="Оценка заявок участников" subtitle="ИИ сверяет заявки с документацией закупки (ТЗ) и даёт рекомендации">
      <style>{PRINT_CSS}</style>
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">

        {/* ── Форма загрузки ── */}
        <Card className="p-6 no-print">
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium">Название закупки</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="напр. Поставка офисной бумаги А4" className="mt-1 max-w-md" />
            </div>

            {/* Документация закупки (ТЗ) */}
            <div>
              <label className="text-sm font-medium">Документация закупки (ТЗ, можно несколько)</label>
              <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm hover:border-primary/40">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate text-muted-foreground">{specFiles.length ? `Выбрано файлов: ${specFiles.length}` : "Выберите файлы (PDF, DOCX, XLSX, TXT)"}</span>
                <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" className="hidden"
                  onChange={(e) => setSpecFiles(Array.from(e.target.files ?? []))} />
              </label>
              {specFiles.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {specFiles.map((f, i) => <Badge key={i} variant="secondary" className="text-[11px] font-normal">{f.name}</Badge>)}
                </div>
              )}
            </div>

            {/* Участники и их комплекты документов */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-1.5"><Users className="h-4 w-4" /> Участники и их документы</label>
                <Button size="sm" variant="outline" onClick={addParticipant}><Plus className="mr-1 h-3.5 w-3.5" />Добавить участника</Button>
              </div>
              <div className="mt-2 space-y-3">
                {participants.map((p, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                      <Input value={p.name} onChange={(e) => setParticipantName(i, e.target.value)}
                        placeholder={`Участник ${i + 1} — название организации`} className="max-w-sm" />
                      {participants.length > 1 && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeParticipant(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm hover:border-primary/40">
                      <Upload className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate text-muted-foreground">{p.files.length ? `Документов: ${p.files.length}` : "Прикрепить документы участника (несколько)"}</span>
                      <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" className="hidden"
                        onChange={(e) => setParticipantFiles(i, Array.from(e.target.files ?? []))} />
                    </label>
                    {p.files.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {p.files.map((f, j) => <Badge key={j} variant="outline" className="text-[11px] font-normal">{f.name}</Badge>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <div>
              <Button onClick={submit} disabled={uploading}>
                {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-1.5 h-4 w-4" />}
                Проанализировать заявки
              </Button>
              <p className="mt-1.5 text-xs text-muted-foreground">Каждый участник оценивается по всему своему комплекту документов. Если имя не указано — берётся из имени файла. Поддержка: PDF, DOCX, XLSX, TXT.</p>
            </div>
          </div>
        </Card>

        {/* ── История ── */}
        {history.length > 0 && (
          <Card className="p-4 no-print">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">История оценок</p>
            <div className="divide-y divide-border">
              {history.map((h) => (
                <button key={h.id} onClick={() => openEvaluation(h.id)}
                  className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:bg-muted/40 rounded px-2">
                  <span className="truncate">{h.title}</span>
                  <span className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                    {h.bidCount} заявок · {fmtDate(h.createdAt)}
                    {h.status === "processing" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                    {h.status === "completed" && <FileCheck2 className="h-3.5 w-3.5 text-emerald-500" />}
                    {h.status === "failed" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* ── Результат ── */}
        {current && (
          <Card className="p-6">
            {current.status === "processing" && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Анализируем заявки ({current.bidCount})…
              </div>
            )}
            {current.status === "failed" && (
              <div className="flex items-center gap-2 py-6 text-sm text-destructive">
                <XCircle className="h-4 w-4" /> Не удалось выполнить оценку. Попробуйте ещё раз.
              </div>
            )}

            {current.status === "completed" && (
              <div id="bid-report" className="space-y-5">
                {/* Шапка отчёта */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{current.title}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" /> {fmtDate(current.createdAt)}
                      {current.specFileName && <> · ТЗ: {current.specFileName}</>}
                    </p>
                  </div>
                  <div className="flex gap-2 no-print">
                    <Button size="sm" onClick={() => setProtocolOpen(true)}>
                      <FileText className="mr-1.5 h-3.5 w-3.5" /> Сформировать протокол
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.print()}>
                      <Printer className="mr-1.5 h-3.5 w-3.5" /> Сохранить в PDF
                    </Button>
                  </div>
                </div>

                {current.summary && (
                  <div className="rounded-lg bg-primary-soft px-4 py-3 text-sm">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Общий вывод по закупке</p>
                    {current.summary}
                  </div>
                )}

                {/* Сводная таблица */}
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 w-8">#</th>
                        <th className="px-3 py-2">Участник</th>
                        <th className="px-3 py-2">Вердикт</th>
                        <th className="px-3 py-2 text-center">Соответствие</th>
                        <th className="px-3 py-2">Цена</th>
                        <th className="px-3 py-2">Срок</th>
                        <th className="px-3 py-2">Рекомендация</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(current.results ?? []).map((r, i) => {
                        const v = verdictStyle(r.verdict);
                        return (
                          <tr key={i} className="align-top">
                            <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-2.5 font-medium">{r.participantName}</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${v.cls}`}>
                                <v.Icon className="h-3 w-3" /> {r.verdict}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center font-semibold">{r.score ?? "—"}{r.score != null && <span className="text-xs text-muted-foreground">/100</span>}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{r.price || "—"}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{r.deliveryTerm || "—"}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{r.recommendation || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Детали по участникам */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {(current.results ?? []).map((r, i) => (
                    <div key={i} className="rounded-lg border border-border p-3">
                      <p className="font-medium text-sm">{r.participantName}</p>
                      {r.fileNames && r.fileNames.length > 0 && (
                        <p className="mb-2 text-[11px] text-muted-foreground">Документы: {r.fileNames.join(", ")}</p>
                      )}
                      {r.strengths?.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">Соответствует / сильные стороны</p>
                          <ul className="space-y-0.5">
                            {r.strengths.map((s, j) => { const f = asFinding(s); return (
                              <li key={j} className="text-xs text-muted-foreground flex gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" /><span>{f.text}{f.ref && <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] font-medium text-foreground/70">{f.ref}</span>}</span></li>
                            ); })}
                          </ul>
                        </div>
                      )}
                      {r.weaknesses?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-0.5">Несоответствия / риски</p>
                          <ul className="space-y-0.5">
                            {r.weaknesses.map((s, j) => { const f = asFinding(s); return (
                              <li key={j} className="text-xs text-muted-foreground flex gap-1.5"><XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" /><span>{f.text}{f.ref && <span className="ml-1 rounded bg-red-500/10 px-1 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">{f.ref}</span>}</span></li>
                            ); })}
                          </ul>
                        </div>
                      )}
                      {!r.strengths?.length && !r.weaknesses?.length && (
                        <p className="text-xs text-muted-foreground">Детали недоступны.</p>
                      )}
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
                  ⚠ Оценка сформирована ИИ и носит рекомендательный характер. Окончательное решение принимает заказчик.
                </p>
              </div>
            )}
          </Card>
        )}
      </div>

      <ProtocolDialog evaluation={current} open={protocolOpen} onOpenChange={setProtocolOpen} />
    </AppLayout>
  );
}
