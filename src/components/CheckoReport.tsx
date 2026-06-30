/* Полный отчёт Checko по организации.
   extractCheckoModel() извлекает все разделы в плоскую модель → ею рендерится и
   экран (CheckoReport), и PDF (printCheckoPdf открывает чистое окно печати, чтобы
   не зависеть от CSS модалки). Пустые разделы скрываются. */
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type Any = Record<string, any>;
type Block =
  | { title: string; kind: "kv"; rows: { label: string; value: string }[] }
  | { title: string; kind: "list"; items: string[] }
  | { title: string; kind: "text"; text: string };
interface CheckoModel {
  name: string;
  shortName: string;
  statusName: string;
  active: boolean;
  ogrn: string;
  blocks: Block[];
  risks: { label: string; risk: boolean }[];
  warnings: string[];
  asOf: string;
}

const txt = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v).trim();
  return "";
};
const date = (v: unknown): string => {
  const s = txt(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
};
const money = (v: unknown): string => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? `${n.toLocaleString("ru-RU")} ₽` : txt(v);
};
const arr = (v: unknown): Any[] => (Array.isArray(v) ? v : []);

export function extractCheckoModel(d: Any | null): CheckoModel | null {
  if (!d) return null;
  const name = txt(d["НаимПолн"]) || txt(d["НаимСокр"]) || txt(d["ФИО"]) || "—";
  const shortName = txt(d["НаимСокр"]);
  const statusName = typeof d["Статус"] === "object" ? txt(d["Статус"]?.["Наим"]) : txt(d["Статус"]);
  const active = /действ/i.test(statusName);
  const ogrn = txt(d["ОГРН"]) || txt(d["ОГРНИП"]);
  const region = typeof d["Регион"] === "object" ? txt(d["Регион"]?.["Наим"]) : txt(d["Регион"]);
  const address = txt(d["ЮрАдрес"]?.["АдресРФ"]) || txt(d["ЮрАдрес"]?.["Адрес"]) || (typeof d["ЮрАдрес"] === "string" ? txt(d["ЮрАдрес"]) : "");

  const blocks: Block[] = [];
  const warnings: string[] = [];

  const kv = (title: string, rows: { label: string; value: string }[]) => {
    const r = rows.filter((x) => x.value);
    if (r.length) blocks.push({ title, kind: "kv", rows: r });
  };
  const list = (title: string, items: string[]) => {
    const i = items.filter(Boolean);
    if (i.length) blocks.push({ title, kind: "list", items: i });
  };
  const text = (title: string, t: string) => { if (t) blocks.push({ title, kind: "text", text: t }); };

  // Реквизиты
  kv("Реквизиты", [
    { label: "ИНН", value: txt(d["ИНН"]) },
    { label: "КПП", value: txt(d["КПП"]) },
    { label: "ОГРН", value: ogrn },
    { label: "ОКПО", value: txt(d["ОКПО"]) },
    { label: "Дата регистрации", value: date(d["ДатаРег"]) },
    { label: "Дата присвоения ОГРН", value: date(d["ДатаОГРН"]) },
    { label: "Дата ликвидации", value: date(d["ДатаЛикв"]) },
    { label: "Регион", value: region },
  ]);

  // Адрес
  if (address) text("Адрес", address);
  if (d["ЮрАдрес"]?.["Недост"]) warnings.push("Юридический адрес признан недостоверным");
  const massAddr = arr(d["ЮрАдрес"]?.["МассАдрес"]).length;
  if (massAddr) warnings.push(`Массовый адрес — ещё ${massAddr} организаций по этому адресу`);

  // Деятельность
  const okved = d["ОКВЭД"] ? [txt(d["ОКВЭД"]["Код"]), txt(d["ОКВЭД"]["Наим"])].filter(Boolean).join(" — ") : "";
  kv("Виды деятельности", [
    { label: "Основной ОКВЭД", value: okved },
    { label: "Организационно-правовая форма", value: txt(d["ОКОПФ"]?.["Наим"]) },
    { label: "Форма собственности", value: txt(d["ОКФС"]?.["Наим"]) },
  ]);
  list("Дополнительные ОКВЭД", arr(d["ОКВЭДДоп"]).map((o) => [txt(o["Код"]), txt(o["Наим"])].filter(Boolean).join(" — ")));

  // Капитал
  const cap = typeof d["УстКап"] === "object" ? money(d["УстКап"]?.["Сумма"]) : money(d["УстКап"]);
  if (cap) text("Уставный капитал", cap);

  // Руководство
  list("Руководство", arr(d["Руковод"]).map((r) => {
    const base = [txt(r["ФИО"]), txt(r["НаимДолжн"])].filter(Boolean).join(" — ");
    const inn = txt(r["ИНН"]) ? ` · ИНН ${txt(r["ИНН"])}` : "";
    const disq = r["ДисквЛицо"] ? " · ⚠ дисквалификация" : "";
    return base + inn + disq;
  }));

  // Учредители
  const founders: string[] = [];
  const u = d["Учред"];
  if (u && typeof u === "object") {
    for (const [cat, lst] of Object.entries(u)) {
      for (const f of arr(lst)) {
        const who = txt(f["НаимСокр"]) || txt(f["НаимПолн"]) || txt(f["ФИО"]) || (cat === "РФ" ? "Российская Федерация" : "");
        const sp = txt(f["Доля"]?.["Процент"] ?? f["Процент"]);
        const ss = money(f["Доля"]?.["Сумма"] ?? f["Сумма"]);
        const share = [sp ? `${sp}%` : "", ss].filter(Boolean).join(", ");
        if (who) founders.push(who + (share ? ` — ${share}` : ""));
      }
    }
  }
  list("Учредители", founders);

  // Контакты
  const c = d["Контакты"];
  if (c && typeof c === "object") {
    kv("Контакты", [
      { label: "Телефон", value: arr(c["Тел"]).map(txt).filter(Boolean).join(", ") },
      { label: "E-mail", value: arr(c["Емэйл"]).map(txt).filter(Boolean).join(", ") },
      { label: "Веб-сайт", value: txt(c["ВебСайт"]) },
    ]);
  }

  // Численность и налоги
  kv("Численность и налоги", [
    { label: "Среднесписочная численность", value: txt(d["СЧР"]) },
    { label: "Сумма уплаченных налогов", value: money(d["Налоги"]?.["СумУпл"]) },
    { label: "Недоимка по налогам", value: money(d["Налоги"]?.["СведНедоим"]?.["Сумма"] ?? d["Налоги"]?.["Недоим"]) },
  ]);

  // Регистрация и учёт
  kv("Регистрация и учёт", [
    { label: "Налоговый орган", value: txt(d["ТекФНС"]?.["НаимОрг"]) },
    { label: "ПФР, рег. номер", value: txt(d["РегПФР"]?.["РегНомер"]) },
    { label: "ФСС, рег. номер", value: txt(d["РегФСС"]?.["РегНомер"]) },
  ]);

  // Лицензии
  list("Лицензии", arr(d["Лиценз"]).slice(0, 30).map((l) => {
    const head = `№ ${txt(l["Номер"])}`;
    const term = (txt(l["ДатаНач"]) || txt(l["ДатаОконч"])) ? ` · ${date(l["ДатаНач"])}–${date(l["ДатаОконч"])}` : "";
    const kinds = arr(l["ВидДеят"]).map((v) => txt(v?.["Наим"] ?? v)).filter(Boolean).join("; ");
    return head + term + (kinds ? ` · ${kinds}` : "");
  }));

  // Филиалы и представительства
  const branches = arr(d["Подразд"]?.["Филиал"]).slice(0, 40).map((b) =>
    `${txt(b["НаимПолн"]) || "Филиал"}${txt(b["Адрес"]) ? ` — ${txt(b["Адрес"])}` : ""}`);
  const repr = arr(d["Подразд"]?.["Представ"]).map((b) =>
    `Представительство${(txt(b["Адрес"]) || txt(b["Страна"])) ? ` — ${txt(b["Адрес"]) || txt(b["Страна"])}` : ""}`);
  list("Филиалы и представительства", [...branches, ...repr]);

  // Связанные организации
  list("Связанные организации", arr(d["СвязУчред"]).slice(0, 60).map((r) =>
    [txt(r["НаимСокр"]) || txt(r["НаимПолн"]), txt(r["ИНН"]) && `ИНН ${txt(r["ИНН"])}`, txt(r["Статус"])].filter(Boolean).join(" · ")));

  // Банкротство
  list("Банкротство (ЕФРСБ)", arr(d["ЕФРСБ"]).slice(0, 20).map((e) =>
    [txt(e["Тип"]), date(e["Дата"]), txt(e["Дело"]) && `дело ${txt(e["Дело"])}`].filter(Boolean).join(" · ")));

  // Арбитражные дела (Checko /legal-cases)
  const lc = d["АрбитражДела"];
  if (lc && typeof lc === "object") {
    kv("Арбитражные дела", [
      { label: "Всего дел", value: txt(lc["ЗапВсего"]) },
      { label: "Общая сумма исков", value: money(lc["ОбщСуммИск"]) },
    ]);
    const myInn = txt(d["ИНН"]);
    const cases = arr(lc["Записи"]).slice(0, 15).map((cse) => {
      const role = arr(cse["Ответ"]).some((x) => txt(x?.["ИНН"]) === myInn) ? "ответчик"
        : arr(cse["Ист"]).some((x) => txt(x?.["ИНН"]) === myInn) ? "истец" : "";
      const s = Number(cse["СуммИск"]);
      const sum = Number.isFinite(s) && s > 0 ? money(s) : "";
      return [txt(cse["Номер"]), date(cse["Дата"]), txt(cse["Суд"]), role, sum].filter(Boolean).join(" · ");
    });
    list("Последние арбитражные дела", cases);
  }

  // Товарные знаки
  const tm = arr(d["ТоварЗнак"]).length;
  if (tm) text("Товарные знаки", String(tm));

  // Риск-индикаторы
  const riskKeys: { key: string; label: string }[] = [
    { key: "НедобПост", label: "Недобросовестный поставщик (РНП)" },
    { key: "ДисквЛица", label: "Дисквалифицированные лица" },
    { key: "МассРуковод", label: "Массовый руководитель" },
    { key: "МассУчред", label: "Массовый учредитель" },
    { key: "НелегалФин", label: "Нелегальная фин. деятельность" },
    { key: "Санкции", label: "Санкции" },
    { key: "СанкцУчр", label: "Санкции (учредители)" },
  ];
  const risks = riskKeys.filter((r) => d[r.key] !== undefined && d[r.key] !== null).map((r) => ({ label: r.label, risk: !!d[r.key] }));

  return { name, shortName, statusName, active, ogrn, blocks, risks, warnings, asOf: date(d["ДатаВып"]) };
}

// ─────────────────────────── Экранный рендер ───────────────────────────
export function CheckoReport({ data }: { data: Any | null }) {
  const m = extractCheckoModel(data);
  if (!m) return <p className="py-6 text-sm text-muted-foreground">Нет данных.</p>;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-start gap-2 flex-wrap">
          <h2 className="text-lg font-semibold leading-tight">{m.name}</h2>
          {m.statusName && (
            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${m.active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"}`}>
              {m.active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}{m.statusName}
            </span>
          )}
        </div>
        {m.shortName && m.shortName !== m.name && <p className="text-sm text-muted-foreground mt-0.5">{m.shortName}</p>}
      </div>

      {m.warnings.length > 0 && (
        <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
          {m.warnings.map((w, i) => <div key={i} className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{w}</div>)}
        </div>
      )}

      {m.blocks.map((b, i) => (
        <div key={i} className="border-t border-border pt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{b.title}</p>
          {b.kind === "kv" && (
            <dl>
              {b.rows.map((r) => (
                <div key={r.label} className="flex gap-3 py-1 text-sm">
                  <dt className="w-52 shrink-0 text-muted-foreground">{r.label}</dt>
                  <dd className="min-w-0 flex-1 break-words">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {b.kind === "text" && <p className="text-sm">{b.text}</p>}
          {b.kind === "list" && (
            <ul className="space-y-0.5">
              {b.items.map((it, j) => <li key={j} className="text-sm text-foreground/90">{it}</li>)}
            </ul>
          )}
        </div>
      ))}

      {m.risks.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Риск-индикаторы</p>
          <div className="flex flex-wrap gap-2">
            {m.risks.map((r) => (
              <span key={r.label} className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${r.risk ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"}`}>
                {r.risk ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}{r.label}: {r.risk ? "Да" : "Нет"}
              </span>
            ))}
          </div>
        </div>
      )}

      {m.asOf && <p className="border-t border-border pt-2 text-[11px] text-muted-foreground">Данные Checko на {m.asOf}. Источник: checko.ru</p>}
    </div>
  );
}

// ───────────────── PDF (прямое скачивание файла через html2pdf) ─────────────────
const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Самодостаточный HTML отчёта со scoped-CSS и hex-цветами (без oklch Tailwind —
// иначе html2canvas падает). Возвращает innerHTML для контейнера .checko-pdf.
function modelToHtml(m: CheckoModel): string {
  const blocks = m.blocks.map((b) => {
    if (b.kind === "kv") {
      const rows = b.rows.map((r) => `<div class="kv"><span class="l">${esc(r.label)}</span><span class="v">${esc(r.value)}</span></div>`).join("");
      return `<section><h3>${esc(b.title)}</h3>${rows}</section>`;
    }
    if (b.kind === "text") return `<section><h3>${esc(b.title)}</h3><p>${esc(b.text)}</p></section>`;
    const items = b.items.map((i) => `<li>${esc(i)}</li>`).join("");
    return `<section><h3>${esc(b.title)}</h3><ul>${items}</ul></section>`;
  }).join("");

  const warns = m.warnings.length
    ? `<div class="warn">${m.warnings.map((w) => `<div>⚠ ${esc(w)}</div>`).join("")}</div>` : "";
  const risks = m.risks.length
    ? `<section><h3>Риск-индикаторы</h3><div class="risks">${m.risks.map((r) =>
        `<span class="risk ${r.risk ? "bad" : "ok"}">${esc(r.label)}: ${r.risk ? "Да" : "Нет"}</span>`).join("")}</div></section>` : "";

  const css = `
    .checko-pdf { font-family: Arial, "DejaVu Sans", sans-serif; color: #1a1a2e; font-size: 12px; line-height: 1.45; background: #fff; }
    .checko-pdf h1 { font-size: 16px; margin: 0 0 2px; }
    .checko-pdf .sub { color: #667; margin: 0 0 4px; }
    .checko-pdf .status { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
    .checko-pdf .status.ok { background: #d1fae5; color: #065f46; } .checko-pdf .status.bad { background: #fee2e2; color: #991b1b; }
    .checko-pdf section { margin-top: 12px; page-break-inside: avoid; }
    .checko-pdf h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #667; border-top: 1px solid #e3e6ee; padding-top: 6px; margin: 0 0 4px; }
    .checko-pdf .kv { display: flex; gap: 12px; padding: 2px 0; }
    .checko-pdf .kv .l { width: 220px; color: #667; flex-shrink: 0; } .checko-pdf .kv .v { flex: 1; }
    .checko-pdf ul { margin: 0; padding-left: 18px; } .checko-pdf li { margin: 1px 0; }
    .checko-pdf .warn { background: #fff7ed; color: #9a3412; border-radius: 6px; padding: 8px 10px; margin-top: 8px; }
    .checko-pdf .risks { display: flex; flex-wrap: wrap; gap: 6px; }
    .checko-pdf .risk { padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
    .checko-pdf .risk.ok { background: #d1fae5; color: #065f46; } .checko-pdf .risk.bad { background: #fee2e2; color: #991b1b; }
    .checko-pdf .foot { margin-top: 14px; color: #889; font-size: 10px; border-top: 1px solid #e3e6ee; padding-top: 6px; }
  `;
  return `<style>${css}</style>
    <h1>${esc(m.name)}</h1>
    ${m.shortName && m.shortName !== m.name ? `<p class="sub">${esc(m.shortName)}</p>` : ""}
    ${m.statusName ? `<span class="status ${m.active ? "ok" : "bad"}">${esc(m.statusName)}</span>` : ""}
    ${warns}${blocks}${risks}
    <div class="foot">Данные Checko${m.asOf ? ` на ${esc(m.asOf)}` : ""}. Источник: checko.ru · Сформировано в ZakupkiAI</div>`;
}

const safeFileName = (s: string) => s.replace(/["«»]/g, "").replace(/[^\wа-яёА-ЯЁ\d.-]+/g, "_").slice(0, 80) || "checko";

// Генерирует PDF на клиенте и СКАЧИВАЕТ его (без диалога печати).
export async function downloadCheckoPdf(data: Any | null) {
  const m = extractCheckoModel(data);
  if (!m) return;

  const container = document.createElement("div");
  container.className = "checko-pdf";
  // В пределах вьюпорта, но позади приложения (z-index:-1): far-offscreen элемент
  // html2canvas захватывает как пустую страницу.
  container.style.cssText = "position:fixed;left:0;top:0;width:760px;padding:24px;background:#ffffff;z-index:-1;";
  container.innerHTML = modelToHtml(m);
  document.body.appendChild(container);

  // даём браузеру разложить и отрисовать содержимое перед захватом
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));

  try {
    const html2pdf = (await import("html2pdf.js")).default;
    await html2pdf().set({
      margin: [10, 10, 12, 10],
      filename: `Checko_${safeFileName(m.shortName || m.name)}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: "#ffffff", useCORS: true, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    }).from(container).save();
  } finally {
    document.body.removeChild(container);
  }
}
