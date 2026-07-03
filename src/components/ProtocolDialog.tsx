/* Формирование официального «Протокола рассмотрения и оценки заявок» из готовой
   оценки заявок. Документ собирается ДЕТЕРМИНИРОВАННО из результатов (вердикты,
   оценки, несоответствия — их ИИ уже дал на этапе оценки) + шапочные поля от
   пользователя. PDF генерируется на сервере (weasyprint) — настоящий текст. */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FileText } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Finding = string | { text: string; ref?: string };
interface BidResult {
  participantName: string;
  fileNames?: string[];
  verdict: string;
  score: number | null;
  price?: string;
  deliveryTerm?: string;
  weaknesses?: Finding[];
}
interface EvalLike {
  title: string;
  createdAt: string;
  specFileName?: string;
  results?: BidResult[];
}

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const findingText = (f: Finding) => (typeof f === "string" ? f : [f?.text, f?.ref].filter(Boolean).join(" "));
const isRejected = (verdict: string) => /не соответ|ошибка|не готов/i.test(verdict || "");

interface Fields {
  customerName: string; customerInn: string; number: string; method: string;
  date: string; place: string; nmck: string; commission: string;
}

function buildProtocolHtml(ev: EvalLike, f: Fields): string {
  const results = [...(ev.results ?? [])].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const admitted = results.filter((r) => !isRejected(r.verdict));
  const rejected = results.filter((r) => isRejected(r.verdict));
  const winner = admitted[0];

  const submittedRows = results.map((r, i) =>
    `<tr><td>${i + 1}</td><td>${esc(r.participantName)}</td><td>${esc((r.fileNames ?? []).join(", "))}</td></tr>`).join("");

  const reviewRows = results.map((r, i) => {
    const rej = isRejected(r.verdict);
    const reason = rej
      ? (esc((r.weaknesses ?? []).map(findingText).filter(Boolean).slice(0, 6).join("; ")) || "Заявка не соответствует требованиям документации")
      : "Заявка соответствует требованиям документации закупки";
    return `<tr><td>${i + 1}</td><td>${esc(r.participantName)}</td><td><b>${rej ? "Отклонить" : "Допустить к оценке"}</b></td><td>${reason}</td></tr>`;
  }).join("");

  const scoreRows = admitted.map((r, i) =>
    `<tr><td>${i + 1}</td><td>${esc(r.participantName)}</td><td class="c">${r.score ?? "—"}</td><td>${esc(r.price || "—")}</td><td>${esc(r.deliveryTerm || "—")}</td></tr>`).join("");

  const decision = admitted.length === 0
    ? `<p>По результатам рассмотрения ни одна заявка не допущена к оценке. Закупка признаётся <b>несостоявшейся</b>.</p>`
    : `<p>1. Признать победителем закупки участника <b>${esc(winner.participantName)}</b> (оценка ${winner.score ?? "—"}/100) как лицо, заявка которого в наибольшей степени соответствует требованиям документации закупки.</p>
       <p>2. Присвоить порядковые номера (места) заявкам, признанным соответствующими требованиям:</p>
       <ul>${admitted.map((r, i) => `<li>${i + 1}-е место — ${esc(r.participantName)} (${r.score ?? "—"}/100)</li>`).join("")}</ul>`;

  const commissionLines = f.commission.split("\n").map((l) => l.trim()).filter(Boolean);
  const commissionBlock = commissionLines.length
    ? `<ul>${commissionLines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`
    : `<p>Состав комиссии определён в соответствии с положением о закупке заказчика.</p>`;

  const signRows = commissionLines.length
    ? commissionLines.map((l) => `<div class="sign"><span>${esc(l)}</span><span class="line">_______________</span></div>`).join("")
    : `<div class="sign"><span>Председатель комиссии</span><span class="line">_______________</span></div>
       <div class="sign"><span>Члены комиссии</span><span class="line">_______________</span></div>`;

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
    body{font-family:Arial,"DejaVu Sans",sans-serif;color:#1a1a2e;font-size:12px;line-height:1.5;margin:28px}
    h1{font-size:15px;text-align:center;margin:0 0 2px} .sub{text-align:center;color:#556;margin:0 0 14px;font-size:12px}
    h2{font-size:12px;margin:16px 0 6px;border-bottom:1px solid #dde;padding-bottom:3px}
    .kv{margin:2px 0} .kv b{display:inline-block;min-width:0}
    table{width:100%;border-collapse:collapse;margin:6px 0;font-size:11px} th,td{border:1px solid #ccd;padding:5px 7px;text-align:left;vertical-align:top}
    th{background:#f3f5fa;font-weight:600} td.c{text-align:center;font-weight:600}
    ul{margin:4px 0;padding-left:20px} li{margin:1px 0}
    .sign{display:flex;justify-content:space-between;margin-top:14px} .sign .line{color:#889}
    .foot{margin-top:20px;color:#889;font-size:10px}
  </style></head><body>
    <h1>ПРОТОКОЛ</h1>
    <p class="sub">рассмотрения и оценки заявок на участие в закупке</p>

    <div class="kv"><b>Заказчик:</b> ${esc(f.customerName)}${f.customerInn ? ` (ИНН ${esc(f.customerInn)})` : ""}</div>
    <div class="kv"><b>Предмет закупки:</b> ${esc(ev.title)}</div>
    ${f.number ? `<div class="kv"><b>Номер закупки/извещения:</b> ${esc(f.number)}</div>` : ""}
    ${f.method ? `<div class="kv"><b>Способ закупки:</b> ${esc(f.method)}</div>` : ""}
    ${f.nmck ? `<div class="kv"><b>НМЦК:</b> ${esc(f.nmck)}</div>` : ""}
    <div class="kv"><b>Дата и место рассмотрения:</b> ${esc(f.date)}${f.place ? `, ${esc(f.place)}` : ""}</div>

    <h2>1. Комиссия по осуществлению закупки</h2>
    ${commissionBlock}

    <h2>2. Заявки, поступившие на участие в закупке (${results.length})</h2>
    <table><thead><tr><th style="width:32px">№</th><th>Участник</th><th>Приложенные документы</th></tr></thead><tbody>${submittedRows || "<tr><td colspan=3>—</td></tr>"}</tbody></table>

    <h2>3. Результаты рассмотрения заявок</h2>
    <table><thead><tr><th style="width:32px">№</th><th>Участник</th><th style="width:120px">Решение</th><th>Основание</th></tr></thead><tbody>${reviewRows}</tbody></table>
    ${rejected.length ? `<p style="font-size:11px;color:#556">Отклонено заявок: ${rejected.length}.</p>` : ""}

    <h2>4. Результаты оценки и сопоставления заявок</h2>
    ${admitted.length
      ? `<table><thead><tr><th style="width:56px">Место</th><th>Участник</th><th style="width:80px">Оценка</th><th style="width:130px">Цена</th><th style="width:130px">Срок поставки</th></tr></thead><tbody>${scoreRows}</tbody></table>`
      : `<p>Нет заявок, допущенных к оценке.</p>`}

    <h2>5. Решение комиссии</h2>
    ${decision}

    <div style="margin-top:22px">${signRows}</div>
    <div class="kv" style="margin-top:10px"><b>Дата подписания:</b> ${esc(f.date)}</div>

    <div class="foot">Протокол сформирован в ZakupkiAI на основе автоматической оценки заявок и носит проектный/справочный характер;
    перед утверждением проверьте соответствие форме, установленной положением о закупке и законодательством (223-ФЗ/44-ФЗ).</div>
  </body></html>`;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtRu = (iso: string) => { const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}.${m[2]}.${m[1]}` : iso; };
const safeName = (s: string) => s.replace(/["«»]/g, "").replace(/[^\wа-яёА-ЯЁ\d.-]+/g, "_").slice(0, 60) || "protocol";

export function ProtocolDialog({ evaluation, open, onOpenChange }: {
  evaluation: EvalLike | null; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const { data: user } = useCurrentUser();
  const org = user?.organization;
  const [f, setF] = useState<Fields>({
    customerName: "", customerInn: "", number: "", method: "Запрос предложений",
    date: todayIso(), place: "", nmck: "", commission: "",
  });
  const [busy, setBusy] = useState(false);

  // Префилл заказчика из профиля организации (один раз, когда открыли).
  const [prefilled, setPrefilled] = useState(false);
  if (open && !prefilled && org) {
    setPrefilled(true);
    setF((p) => ({ ...p, customerName: p.customerName || org.name || "", customerInn: p.customerInn || org.inn || "" }));
  }
  if (!open && prefilled) setPrefilled(false);

  const download = async () => {
    if (!evaluation) return;
    setBusy(true);
    try {
      const html = buildProtocolHtml(evaluation, { ...f, date: fmtRu(f.date) });
      const res = await apiClient.post("/checko/pdf", { html }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url; a.download = `Протокол_${safeName(evaluation.title)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      onOpenChange(false);
    } catch { alert("Не удалось сформировать протокол."); }
    finally { setBusy(false); }
  };

  const field = (label: string, key: keyof Fields, placeholder = "") => (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input value={f[key]} onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} className="mt-1 h-9" />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Протокол оценки заявок
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Заполните реквизиты — протокол соберётся из результатов оценки (допуск, ранжирование, победитель) автоматически.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {field("Заказчик", "customerName")}
          {field("ИНН заказчика", "customerInn")}
          {field("Номер закупки / извещения", "number", "напр. 3854")}
          {field("Способ закупки", "method")}
          {field("НМЦК", "nmck", "напр. 1 200 000 ₽")}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Дата рассмотрения</label>
            <Input type="date" value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e.target.value }))} className="mt-1 h-9" />
          </div>
        </div>
        {field("Место рассмотрения", "place", "напр. г. Салават, ул. …")}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Комиссия (по одному в строке: ФИО — должность)</label>
          <textarea
            value={f.commission}
            onChange={(e) => setF((p) => ({ ...p, commission: e.target.value }))}
            rows={3}
            placeholder={"Иванов И.И. — председатель\nПетров П.П. — член комиссии"}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button size="sm" onClick={download} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
            Скачать протокол (PDF)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
