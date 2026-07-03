import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2, ShieldAlert, CheckCircle2, AlertTriangle, XCircle, Printer, Users,
} from "lucide-react";
import apiClient from "@/lib/api-client";

interface Flags {
  rnp: boolean; disqualified: boolean; sanctions: boolean;
  massHead: boolean; massFounder: boolean; illegalFin: boolean; efrsb: number;
}
interface Row {
  inn: string; found: boolean; error?: string;
  name?: string; ogrn?: string; status?: string; active?: boolean;
  flags?: Flags; level?: "red" | "amber" | "green";
}

const LEVEL = {
  red:   { label: "Риск",     cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", Icon: ShieldAlert },
  amber: { label: "Внимание", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", Icon: AlertTriangle },
  green: { label: "Чисто",    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", Icon: CheckCircle2 },
};

// Красным — стоп-факторы, жёлтым — сигналы.
function flagChips(f: Flags): { text: string; bad: boolean }[] {
  const out: { text: string; bad: boolean }[] = [];
  if (f.rnp) out.push({ text: "РНП", bad: true });
  if (f.disqualified) out.push({ text: "Дисквалификация", bad: true });
  if (f.sanctions) out.push({ text: "Санкции", bad: true });
  if (f.massHead) out.push({ text: "Массовый руководитель", bad: false });
  if (f.massFounder) out.push({ text: "Массовый учредитель", bad: false });
  if (f.illegalFin) out.push({ text: "Нелегал. фин.", bad: false });
  if (f.efrsb > 0) out.push({ text: `ЕФРСБ: ${f.efrsb}`, bad: false });
  return out;
}

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildBatchHtml(rows: Row[]): string {
  const body = rows.map((r) => {
    const lvl = r.found && r.level ? LEVEL[r.level].label : (r.found ? "—" : "не найдено");
    const flags = r.found && r.flags ? flagChips(r.flags).map((c) => c.text).join(", ") : (r.error || "");
    return `<tr><td>${esc(r.inn)}</td><td>${esc(r.found ? r.name : "—")}</td><td>${esc(r.found ? r.status : "—")}</td><td><b>${esc(lvl)}</b></td><td>${esc(flags) || "—"}</td></tr>`;
  }).join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
    body{font-family:Arial,"DejaVu Sans",sans-serif;font-size:11px;color:#1a1a2e;margin:24px}
    h1{font-size:15px;margin:0 0 8px} table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #ccd;padding:5px 7px;text-align:left;vertical-align:top} th{background:#f3f5fa}
    .foot{margin-top:12px;color:#889;font-size:10px}</style></head><body>
    <h1>Массовая проверка участников</h1>
    <table><thead><tr><th>ИНН</th><th>Наименование</th><th>Статус</th><th>Оценка</th><th>Факторы</th></tr></thead><tbody>${body}</tbody></table>
    <div class="foot">Сформировано в ZakupkiAI на основе данных Checko. Носит справочный характер — проверяйте ключевые сведения по первоисточникам.</div>
  </body></html>`;
}

export default function BatchCheckPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);

  const parseInns = (s: string) => [...new Set((s.match(/\d{10,12}/g) ?? []))];

  const run = async () => {
    setError(null);
    const inns = parseInns(text);
    if (inns.length === 0) { setError("Введите ИНН участников (10 или 12 цифр), по одному в строке или через запятую"); return; }
    setLoading(true);
    setRows(null);
    try {
      const { data } = await apiClient.post<{ results: Row[] }>("/checko/batch", { inns });
      setRows(data.results);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? "Не удалось выполнить проверку");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    if (!rows) return;
    try {
      const res = await apiClient.post("/checko/pdf", { html: buildBatchHtml(rows) }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url; a.download = "Проверка_участников.pdf";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { alert("Не удалось сформировать PDF."); }
  };

  const counts = rows ? {
    red: rows.filter((r) => r.level === "red").length,
    amber: rows.filter((r) => r.level === "amber").length,
    green: rows.filter((r) => r.level === "green").length,
    notFound: rows.filter((r) => !r.found).length,
  } : null;

  return (
    <AppLayout title="Массовая проверка участников" subtitle="Проверьте всех участников по списку ИНН: РНП, банкротство, дисквалификация, санкции">
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">

        <Card className="p-6">
          <label className="text-sm font-medium">ИНН участников</label>
          <p className="mt-0.5 text-xs text-muted-foreground">По одному в строке или через запятую/пробел. До 20 за раз.</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={"7707083893\n0266033773\n..."}
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
          />
          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          <div className="mt-3">
            <Button onClick={run} disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Users className="mr-1.5 h-4 w-4" />}
              Проверить всех
            </Button>
          </div>
        </Card>

        {rows && counts && (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Риск: {counts.red}</span>
                <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Внимание: {counts.amber}</span>
                <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">Чисто: {counts.green}</span>
                {counts.notFound > 0 && <span className="text-xs text-muted-foreground">не найдено: {counts.notFound}</span>}
              </div>
              <Button size="sm" variant="outline" className="text-xs" onClick={downloadPdf}>
                <Printer className="mr-1.5 h-3.5 w-3.5" /> Скачать PDF
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">ИНН</th>
                    <th className="px-3 py-2">Наименование</th>
                    <th className="px-3 py-2">Статус</th>
                    <th className="px-3 py-2">Оценка</th>
                    <th className="px-3 py-2">Факторы риска</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r, i) => {
                    if (!r.found) {
                      return (
                        <tr key={i} className="align-top text-muted-foreground">
                          <td className="px-3 py-2.5 font-mono">{r.inn}</td>
                          <td className="px-3 py-2.5" colSpan={4}>{r.error || "Не найдено"}</td>
                        </tr>
                      );
                    }
                    const lvl = LEVEL[r.level ?? "green"];
                    const chips = r.flags ? flagChips(r.flags) : [];
                    return (
                      <tr key={i} className="align-top">
                        <td className="px-3 py-2.5 font-mono">{r.inn}</td>
                        <td className="px-3 py-2.5">
                          <span className="font-medium">{r.name}</span>
                          {r.ogrn && (
                            <button className="ml-1.5 text-[11px] text-primary hover:underline" onClick={() => window.open(`https://checko.ru/company/${r.ogrn}`, "_blank", "noopener,noreferrer")}>подробно</button>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={r.active ? "" : "text-red-600 dark:text-red-400 font-medium"}>{r.status}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${lvl.cls}`}>
                            <lvl.Icon className="h-3 w-3" /> {lvl.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {chips.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : (
                            <div className="flex flex-wrap gap-1">
                              {chips.map((c, j) => (
                                <span key={j} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${c.bad ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>{c.text}</span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
              ⚠ Данные Checko носят справочный характер. «ЕФРСБ» — наличие сведений в реестре банкротств (проверьте, актуальны ли);
              красные факторы (РНП, дисквалификация, санкции, недействующий статус) — стоп-сигналы, требуют отдельной проверки перед заключением контракта.
            </p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
