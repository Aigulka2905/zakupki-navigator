/* Полный отчёт Checko по организации: рендерит все разделы ответа API
   (реквизиты, ОКВЭД, капитал, руководство, учредители, контакты, регистрация,
   лицензии, филиалы, связи, банкротство, риск-индикаторы). Все секции
   опциональны — пустые скрываются. Используется и на экране, и при печати в PDF. */
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type Any = Record<string, any>;

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
function KV({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "" ) return null;
  return (
    <div className="flex gap-3 py-1 text-sm">
      <dt className="w-52 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{value}</dd>
    </div>
  );
}

export function CheckoReport({ data }: { data: Any | null }) {
  if (!data) return <p className="py-6 text-sm text-muted-foreground">Нет данных.</p>;
  const d = data;

  const name = txt(d["НаимПолн"]) || txt(d["НаимСокр"]) || txt(d["ФИО"]) || "—";
  const statusName = typeof d["Статус"] === "object" ? txt(d["Статус"]?.["Наим"]) : txt(d["Статус"]);
  const active = /действ/i.test(statusName);
  const ogrn = txt(d["ОГРН"]) || txt(d["ОГРНИП"]);
  const region = typeof d["Регион"] === "object" ? txt(d["Регион"]?.["Наим"]) : txt(d["Регион"]);
  const address = txt(d["ЮрАдрес"]?.["АдресРФ"]) || txt(d["ЮрАдрес"]?.["Адрес"]) || (typeof d["ЮрАдрес"] === "string" ? txt(d["ЮрАдрес"]) : "");
  const okved = d["ОКВЭД"] ? [txt(d["ОКВЭД"]["Код"]), txt(d["ОКВЭД"]["Наим"])].filter(Boolean).join(" — ") : "";
  const okvedDop = arr(d["ОКВЭДДоп"]);
  const cap = typeof d["УстКап"] === "object" ? money(d["УстКап"]?.["Сумма"]) : money(d["УстКап"]);
  const ruk = arr(d["Руковод"]);
  const lic = arr(d["Лиценз"]);
  const branches = arr(d["Подразд"]?.["Филиал"]);
  const repr = arr(d["Подразд"]?.["Представ"]);
  const related = arr(d["СвязУчред"]);
  const efrsb = arr(d["ЕФРСБ"]);
  const tm = arr(d["ТоварЗнак"]);
  const contacts = d["Контакты"] && typeof d["Контакты"] === "object" ? d["Контакты"] : null;

  // Учредители — разные категории
  const founders: { who: string; share: string }[] = [];
  const u = d["Учред"];
  if (u && typeof u === "object") {
    for (const [cat, list] of Object.entries(u)) {
      for (const f of arr(list)) {
        const who = txt(f["НаимСокр"]) || txt(f["НаимПолн"]) || txt(f["ФИО"]) || (cat === "РФ" ? "Российская Федерация" : "");
        const shareP = txt(f["Доля"]?.["Процент"] ?? f["Процент"]);
        const shareS = money(f["Доля"]?.["Сумма"] ?? f["Сумма"]);
        const share = [shareP ? `${shareP}%` : "", shareS].filter(Boolean).join(", ");
        if (who) founders.push({ who, share });
      }
    }
  }

  const RISKS: { key: string; label: string }[] = [
    { key: "НедобПост", label: "Недобросовестный поставщик (РНП)" },
    { key: "ДисквЛица", label: "Дисквалифицированные лица" },
    { key: "МассРуковод", label: "Массовый руководитель" },
    { key: "МассУчред", label: "Массовый учредитель" },
    { key: "НелегалФин", label: "Нелегальная фин. деятельность" },
    { key: "Санкции", label: "Санкции" },
    { key: "СанкцУчр", label: "Санкции (учредители)" },
  ].filter((r) => d[r.key] !== undefined && d[r.key] !== null);

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div>
        <div className="flex items-start gap-2 flex-wrap">
          <h2 className="text-lg font-semibold leading-tight">{name}</h2>
          {statusName && (
            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"}`}>
              {active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}{statusName}
            </span>
          )}
        </div>
        {txt(d["НаимСокр"]) && txt(d["НаимСокр"]) !== name && <p className="text-sm text-muted-foreground mt-0.5">{txt(d["НаимСокр"])}</p>}
      </div>

      {/* Реквизиты */}
      <Section title="Реквизиты">
        <dl>
          <KV label="ИНН" value={txt(d["ИНН"])} />
          <KV label="КПП" value={txt(d["КПП"])} />
          <KV label="ОГРН" value={ogrn} />
          <KV label="ОКПО" value={txt(d["ОКПО"])} />
          <KV label="Дата регистрации" value={date(d["ДатаРег"])} />
          <KV label="Дата присвоения ОГРН" value={date(d["ДатаОГРН"])} />
          <KV label="Дата ликвидации" value={date(d["ДатаЛикв"])} />
          <KV label="Регион" value={region} />
        </dl>
      </Section>

      {/* Адрес */}
      {(address || arr(d["ЮрАдрес"]?.["МассАдрес"]).length > 0) && (
        <Section title="Адрес">
          <p className="text-sm">{address || "—"}</p>
          {d["ЮрАдрес"]?.["Недост"] && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">⚠ Адрес признан недостоверным</p>}
          {arr(d["ЮрАдрес"]?.["МассАдрес"]).length > 0 && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">⚠ Массовый адрес — ещё {arr(d["ЮрАдрес"]["МассАдрес"]).length} организаций</p>
          )}
        </Section>
      )}

      {/* Деятельность */}
      {(okved || okvedDop.length > 0) && (
        <Section title="Виды деятельности">
          <dl>
            <KV label="Основной ОКВЭД" value={okved} />
            <KV label="Форма (ОКОПФ)" value={txt(d["ОКОПФ"]?.["Наим"])} />
            <KV label="Форма собственности" value={txt(d["ОКФС"]?.["Наим"])} />
          </dl>
          {okvedDop.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-muted-foreground">Дополнительные ОКВЭД ({okvedDop.length})</summary>
              <ul className="mt-1 space-y-0.5">
                {okvedDop.map((o, i) => <li key={i} className="text-xs text-muted-foreground">{[txt(o["Код"]), txt(o["Наим"])].filter(Boolean).join(" — ")}</li>)}
              </ul>
            </details>
          )}
        </Section>
      )}

      {/* Капитал */}
      {cap && <Section title="Уставный капитал"><p className="text-sm font-medium">{cap}</p></Section>}

      {/* Руководство */}
      {ruk.length > 0 && (
        <Section title="Руководство">
          {ruk.map((r, i) => (
            <div key={i} className="py-1 text-sm">
              <span className="font-medium">{txt(r["ФИО"])}</span>
              {txt(r["НаимДолжн"]) && <span className="text-muted-foreground"> — {txt(r["НаимДолжн"])}</span>}
              {txt(r["ИНН"]) && <span className="text-xs text-muted-foreground"> · ИНН {txt(r["ИНН"])}</span>}
              {r["ДисквЛицо"] && <span className="ml-1 rounded bg-red-500/10 px-1 text-[10px] text-red-600">дисквалификация</span>}
            </div>
          ))}
        </Section>
      )}

      {/* Учредители */}
      {founders.length > 0 && (
        <Section title="Учредители">
          {founders.map((f, i) => (
            <div key={i} className="py-1 text-sm"><span className="font-medium">{f.who}</span>{f.share && <span className="text-muted-foreground"> — {f.share}</span>}</div>
          ))}
        </Section>
      )}

      {/* Контакты */}
      {contacts && (
        <Section title="Контакты">
          <dl>
            <KV label="Телефон" value={arr(contacts["Тел"]).map(txt).filter(Boolean).join(", ")} />
            <KV label="E-mail" value={arr(contacts["Емэйл"]).map(txt).filter(Boolean).join(", ")} />
            <KV label="Веб-сайт" value={txt(contacts["ВебСайт"])} />
          </dl>
        </Section>
      )}

      {/* Численность / финансы */}
      {(txt(d["СЧР"]) || (d["Налоги"] && Object.keys(d["Налоги"]).length > 0)) && (
        <Section title="Численность и налоги">
          <dl>
            <KV label="Среднесписочная численность" value={txt(d["СЧР"])} />
            <KV label="Сумма уплаченных налогов" value={money(d["Налоги"]?.["СумУпл"])} />
            <KV label="Недоимка по налогам" value={money(d["Налоги"]?.["СведНедоим"]?.["Сумма"] ?? d["Налоги"]?.["Недоим"])} />
          </dl>
        </Section>
      )}

      {/* Регистрация в фондах */}
      {(d["РегПФР"] || d["РегФСС"] || d["ТекФНС"]) && (
        <Section title="Регистрация и учёт">
          <dl>
            <KV label="Налоговый орган" value={txt(d["ТекФНС"]?.["НаимОрг"])} />
            <KV label="ПФР (рег. номер)" value={txt(d["РегПФР"]?.["РегНомер"])} />
            <KV label="ФСС (рег. номер)" value={txt(d["РегФСС"]?.["РегНомер"])} />
          </dl>
        </Section>
      )}

      {/* Лицензии */}
      {lic.length > 0 && (
        <Section title={`Лицензии (${lic.length})`}>
          {lic.slice(0, 20).map((l, i) => (
            <div key={i} className="py-1 text-xs">
              <span className="font-medium">№ {txt(l["Номер"])}</span>
              {(txt(l["ДатаНач"]) || txt(l["ДатаОконч"])) && <span className="text-muted-foreground"> · {date(l["ДатаНач"])}–{date(l["ДатаОконч"])}</span>}
              {arr(l["ВидДеят"]).length > 0 && <div className="text-muted-foreground">{arr(l["ВидДеят"]).map((v: any) => txt(v?.["Наим"] ?? v)).filter(Boolean).join("; ").slice(0, 200)}</div>}
            </div>
          ))}
        </Section>
      )}

      {/* Филиалы */}
      {(branches.length > 0 || repr.length > 0) && (
        <Section title="Филиалы и представительства">
          {branches.slice(0, 30).map((b, i) => (
            <div key={`b${i}`} className="py-0.5 text-xs"><span className="font-medium">{txt(b["НаимПолн"]) || "Филиал"}</span>{txt(b["Адрес"]) && <span className="text-muted-foreground"> — {txt(b["Адрес"])}</span>}</div>
          ))}
          {repr.map((b, i) => (
            <div key={`r${i}`} className="py-0.5 text-xs"><span className="font-medium">Представительство</span>{(txt(b["Адрес"]) || txt(b["Страна"])) && <span className="text-muted-foreground"> — {txt(b["Адрес"]) || txt(b["Страна"])}</span>}</div>
          ))}
        </Section>
      )}

      {/* Связанные организации */}
      {related.length > 0 && (
        <Section title={`Связанные организации (${related.length})`}>
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">Показать список</summary>
            <ul className="mt-1 space-y-0.5">
              {related.slice(0, 50).map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground">{txt(r["НаимСокр"]) || txt(r["НаимПолн"])} {txt(r["ИНН"]) && `· ИНН ${txt(r["ИНН"])}`} {txt(r["Статус"]) && `· ${txt(r["Статус"])}`}</li>
              ))}
            </ul>
          </details>
        </Section>
      )}

      {/* Банкротство */}
      {efrsb.length > 0 && (
        <Section title="Банкротство (ЕФРСБ)">
          {efrsb.slice(0, 20).map((e, i) => (
            <div key={i} className="py-0.5 text-xs"><span className="font-medium">{txt(e["Тип"])}</span> · {date(e["Дата"])} {txt(e["Дело"]) && `· дело ${txt(e["Дело"])}`}</div>
          ))}
        </Section>
      )}

      {/* Товарные знаки */}
      {tm.length > 0 && <Section title="Товарные знаки"><p className="text-sm">{tm.length}</p></Section>}

      {/* Риск-индикаторы */}
      {RISKS.length > 0 && (
        <Section title="Риск-индикаторы">
          <div className="flex flex-wrap gap-2">
            {RISKS.map((r) => {
              const risk = !!d[r.key];
              return (
                <span key={r.key} className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${risk ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"}`}>
                  {risk ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}{r.label}: {risk ? "Да" : "Нет"}
                </span>
              );
            })}
          </div>
        </Section>
      )}

      {txt(d["ДатаВып"]) && <p className="border-t border-border pt-2 text-[11px] text-muted-foreground">Данные Checko на {date(d["ДатаВып"])}. Источник: checko.ru</p>}
    </div>
  );
}
