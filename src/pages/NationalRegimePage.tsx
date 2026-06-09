import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ShieldAlert, ShieldCheck, ShieldOff, AlertTriangle, BookOpen, Loader2, Info, ChevronRight, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import apiClient from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/Reveal";

// ── Types ─────────────────────────────────────────────────────

interface DecreeMeta {
  number: string;
  date: string;
  fullTitle: string;
  description: string;
  regimeType: string;
  laws: string[];
  note: string;
}

interface MatchItem {
  okpd: string;
  name: string;
  regime: "ban" | "restriction" | "condition" | "none";
  decrees: string[];
  decreesDetail: DecreeMeta[];
  summary: string;
  exceptions?: string;
  practicalNote?: string;
}

interface LookupResult {
  okpd: string;
  found: boolean;
  topRegime: "ban" | "restriction" | "condition" | "none";
  matches: MatchItem[];
  aiExplanation: string | null;
  meta: { version: string; lastUpdated: string };
}

interface Suggestion {
  okpd: string;
  name: string;
  regime: string;
}

// ── API ───────────────────────────────────────────────────────

async function fetchLookup(okpd: string): Promise<LookupResult> {
  const { data } = await apiClient.get<LookupResult>(`/national-regime/${encodeURIComponent(okpd)}`);
  return data;
}

async function fetchSuggest(q: string): Promise<Suggestion[]> {
  if (!q || q.length < 2) return [];
  const { data } = await apiClient.get<Suggestion[]>(`/national-regime/suggest?q=${encodeURIComponent(q)}`);
  return data;
}

// ── Helpers ───────────────────────────────────────────────────

const REGIME_CONFIG = {
  ban: {
    label: "Запрет",
    icon: ShieldOff,
    cls: "bg-red-500/10 text-red-400 ring-red-500/20",
    cardCls: "border-red-500/20 dark:border-red-500/15",
    headerCls: "bg-red-500/5",
    dot: "bg-red-500",
    description: "Иностранный товар запрещён при наличии отечественных аналогов",
  },
  restriction: {
    label: "Ограничение",
    icon: ShieldAlert,
    cls: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    cardCls: "border-amber-500/20 dark:border-amber-500/15",
    headerCls: "bg-amber-500/5",
    dot: "bg-amber-400",
    description: "Правило «второй/третий лишний» — иностранный товар может быть отклонён",
  },
  condition: {
    label: "Условия допуска",
    icon: ShieldCheck,
    cls: "bg-indigo-500/10 text-indigo-400 ring-indigo-500/20",
    cardCls: "border-indigo-500/20 dark:border-indigo-500/15",
    headerCls: "bg-indigo-500/5",
    dot: "bg-indigo-400",
    description: "Ценовая преференция 15% для отечественных товаров (ПП-925, 223-ФЗ)",
  },
  none: {
    label: "Без ограничений",
    icon: ShieldCheck,
    cls: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    cardCls: "border-emerald-500/20 dark:border-emerald-500/15",
    headerCls: "bg-emerald-500/5",
    dot: "bg-emerald-400",
    description: "Данный код не попадает в известные перечни ограничений",
  },
};

function RegimeBadge({ regime }: { regime: keyof typeof REGIME_CONFIG }) {
  const cfg = REGIME_CONFIG[regime];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", cfg.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// Применяет inline-разметку: **bold**, `code`, ссылки
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="rounded bg-muted/60 px-1 font-mono text-[11px] text-indigo-300">{part.slice(1, -1)}</code>;
    // Убираем оставшиеся одиночные * и <br>
    return <span key={i}>{part.replace(/<br\s*\/?>/gi, "\n").replace(/\*/g, "")}</span>;
  });
}

// Полноценный Markdown-рендерер: таблицы, заголовки, списки, разделители
function AiExplanation({ text }: { text: string }) {
  // Разбиваем на блоки: таблица — последовательность строк с |
  const blocks: React.ReactNode[] = [];
  const rawLines = text.replace(/<br\s*\/?>/gi, "\n").split("\n");

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Пустая строка
    if (!trimmed) { blocks.push(<div key={i} className="h-2" />); i++; continue; }

    // Горизонтальный разделитель --- или ***
    if (/^[-*]{3,}$/.test(trimmed)) {
      blocks.push(<hr key={i} className="my-3 border-border/30" />); i++; continue;
    }

    // Заголовки ## или цифра+точка в начале строки (1. Заголовок)
    const h2Match = trimmed.match(/^#{1,3}\s+(.+)/);
    if (h2Match) {
      blocks.push(
        <p key={i} className="mt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 first:mt-0">
          {h2Match[1].replace(/\*\*/g, "")}
        </p>
      );
      i++; continue;
    }

    // Строка вида "2. ЧТО НУЖНО..." — нумерованный заголовок-секция
    const sectionMatch = trimmed.match(/^(\d+)\.\s+\*{0,2}([А-ЯA-Z][^*]{3,})\*{0,2}$/);
    if (sectionMatch) {
      blocks.push(
        <p key={i} className="mt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 first:mt-0">
          {sectionMatch[1]}. {sectionMatch[2]}
        </p>
      );
      i++; continue;
    }

    // Таблица: собираем все строки с |
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith("|")) {
        tableLines.push(rawLines[i].trim());
        i++;
      }
      // Убираем строку-разделитель |---|---|
      const dataRows = tableLines.filter(r => !/^\|[-:\s|]+\|$/.test(r));
      const [headerRow, ...bodyRows] = dataRows;
      const parseCells = (row: string) =>
        row.split("|").map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

      blocks.push(
        <div key={i} className="my-3 overflow-x-auto rounded-lg border border-border/40">
          <table className="w-full text-[12px]">
            {headerRow && (
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  {parseCells(headerRow).map((cell, ci) => (
                    <th key={ci} className="px-3 py-2 text-left font-semibold text-foreground/80">
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/20 last:border-0 odd:bg-muted/10">
                  {parseCells(row).map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 align-top text-foreground/75 whitespace-pre-wrap">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Маркированный список: - или •
    if (/^[-•]\s/.test(trimmed)) {
      blocks.push(
        <div key={i} className="flex gap-2 text-[13px] leading-relaxed text-foreground/80">
          <span className="mt-1 shrink-0 text-indigo-400">•</span>
          <span>{renderInline(trimmed.replace(/^[-•]\s/, ""))}</span>
        </div>
      );
      i++; continue;
    }

    // Нумерованный список: "1. ..." (не заголовок-секция)
    const liMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (liMatch) {
      blocks.push(
        <div key={i} className="flex gap-2 text-[13px] leading-relaxed text-foreground/80">
          <span className="mt-0 shrink-0 font-mono text-[11px] text-indigo-400">{liMatch[1]}.</span>
          <span>{renderInline(liMatch[2])}</span>
        </div>
      );
      i++; continue;
    }

    // Обычный параграф
    blocks.push(
      <p key={i} className="text-[13px] leading-relaxed text-foreground/80">
        {renderInline(trimmed)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{blocks}</div>;
}

// ── Page ──────────────────────────────────────────────────────

const OKPD_RE = /^[\d]{1,2}(\.[\d]{1,2}){0,3}(\.[\d]{1,3})?$/;

const EXAMPLE_CODES = [
  { code: "26.20", label: "Компьютеры" },
  { code: "31", label: "Мебель" },
  { code: "62.01", label: "ПО" },
  { code: "29.10", label: "Авто" },
  { code: "21.20", label: "Лекарства" },
  { code: "27.40", label: "Освещение" },
];

const NationalRegimePage = () => {
  const [input, setInput] = useState("");
  const [searchCode, setSearchCode] = useState<string | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Подсказки
  const { data: suggestions = [] } = useQuery({
    queryKey: ["nr-suggest", input],
    queryFn: () => fetchSuggest(input),
    enabled: input.length >= 2 && showSuggest,
    staleTime: 60_000,
  });

  // Основной поиск
  const { data: result, isLoading, isError, isFetching } = useQuery({
    queryKey: ["nr-lookup", searchCode],
    queryFn: () => fetchLookup(searchCode!),
    enabled: !!searchCode,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
  });

  if (isError) toast.error("Не удалось получить данные. Проверьте код ОКПД2.");

  function handleSearch() {
    const code = input.trim().replace(/\.+$/, "");
    if (!code) return;
    if (!OKPD_RE.test(code)) {
      toast.error("Некорректный код ОКПД2. Пример: 26.20 или 26.20.11");
      return;
    }
    setShowSuggest(false);
    setSearchCode(code);
  }

  function selectSuggestion(s: Suggestion) {
    setInput(s.okpd);
    setShowSuggest(false);
    setSearchCode(s.okpd);
  }

  const topCfg = result ? REGIME_CONFIG[result.topRegime] : null;

  return (
    <AppLayout
      title="Национальный режим"
      subtitle="Проверка ограничений на поставку товаров по ОКПД2"
    >
      <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">

        {/* ── Поиск ──────────────────────────────────────────── */}
        <Reveal direction="up" delay={0}>
          <Card className="overflow-visible p-5 shadow-card">
            <p className="mb-4 text-[13px] text-muted-foreground">
              Введите код ОКПД2 (классификатор продукции по видам экономической деятельности) —
              система определит действующие ограничения национального режима по 44-ФЗ и 223-ФЗ.
            </p>

            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Например: 26.20 или 31.01.11"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setShowSuggest(true);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  onFocus={() => setShowSuggest(true)}
                  onBlur={() => setTimeout(() => setShowSuggest(false), 180)}
                  className="h-10 w-full rounded-lg border border-border/50 bg-card/60 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground/35 transition focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/15"
                />

                {/* Выпадающие подсказки */}
                {showSuggest && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border/60 bg-popover shadow-xl">
                    {suggestions.map((s) => (
                      <button
                        key={s.okpd}
                        type="button"
                        onMouseDown={() => selectSuggestion(s)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
                      >
                        <code className="shrink-0 font-mono text-xs text-indigo-400">{s.okpd}</code>
                        <span className="flex-1 truncate text-[13px]">{s.name}</span>
                        <RegimeBadge regime={s.regime as keyof typeof REGIME_CONFIG} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleSearch}
                disabled={isLoading || isFetching}
                className="flex h-10 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
              >
                {(isLoading || isFetching) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Проверить
              </button>
            </div>

            {/* Примеры */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-[11px] text-muted-foreground/50">Примеры:</span>
              {EXAMPLE_CODES.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => { setInput(code); setSearchCode(code); setShowSuggest(false); }}
                  className="rounded-full border border-border/40 bg-muted/30 px-2.5 py-0.5 text-[11px] text-muted-foreground/70 transition hover:border-indigo-500/30 hover:text-indigo-400"
                >
                  {code} — {label}
                </button>
              ))}
            </div>
          </Card>
        </Reveal>

        {/* ── Результат ──────────────────────────────────────── */}
        {(isLoading || isFetching) && (
          <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
            Анализируем ограничения и готовим объяснение ИИ…
          </div>
        )}

        {result && !isFetching && topCfg && (
          <Reveal direction="up" delay={0}>
            <div className="space-y-4">

              {/* Заголовок результата */}
              <div className={cn("rounded-xl border p-5", topCfg.cardCls)}>
                <div className={cn("mb-4 flex flex-wrap items-start gap-3 rounded-lg p-3 -mx-1", topCfg.headerCls)}>
                  <topCfg.icon className="mt-0.5 h-5 w-5 shrink-0 text-current opacity-70" />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        ОКПД2 {result.okpd}
                      </span>
                      <RegimeBadge regime={result.topRegime} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{topCfg.description}</p>
                  </div>
                </div>

                {/* Карточки по каждому постановлению */}
                {result.found ? (
                  <div className="space-y-3">
                    {result.matches.map((match, idx) => (
                      <div key={idx} className="rounded-lg border border-border/40 bg-card/50 p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <code className="font-mono text-[11px] text-muted-foreground/60">ОКПД2 {match.okpd}</code>
                          <span className="text-[13px] font-medium text-foreground">{match.name}</span>
                          <RegimeBadge regime={match.regime} />
                        </div>

                        <p className="mb-3 text-[13px] text-foreground/80">{match.summary}</p>

                        {/* Постановления */}
                        <div className="mb-3 flex flex-wrap gap-2">
                          {match.decreesDetail.map((d) => (
                            <div key={d.number} className="rounded-md border border-border/40 bg-muted/30 px-2.5 py-1.5 text-[11px]">
                              <div className="font-semibold text-foreground/80">{d.fullTitle}</div>
                              <div className="text-muted-foreground/60">{d.description}</div>
                              {d.laws && (
                                <div className="mt-0.5 flex gap-1">
                                  {d.laws.map((l) => (
                                    <span key={l} className="rounded bg-indigo-500/10 px-1.5 text-[10px] font-medium text-indigo-400">{l}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {match.exceptions && (
                          <div className="mb-2 flex items-start gap-2 text-[12px] text-emerald-400">
                            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span><b>Исключения:</b> {match.exceptions}</span>
                          </div>
                        )}

                        {match.practicalNote && (
                          <div className="flex items-start gap-2 text-[12px] text-amber-400">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span><b>Практика:</b> {match.practicalNote}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/20 p-4">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                    <div className="text-[13px] text-muted-foreground">
                      Код ОКПД2 <b className="text-foreground">{result.okpd}</b> не найден в базе ограничений национального режима.
                      Это может означать, что товар не входит в ни один из известных запретительных перечней.
                      По 223-ФЗ всё равно может действовать ценовая преференция 15% (ПП-925).
                    </div>
                  </div>
                )}
              </div>

              {/* ИИ-объяснение */}
              <Card className="overflow-hidden shadow-card">
                <div className="flex items-center gap-2 border-b border-border/50 bg-indigo-500/5 px-4 py-3">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  <span className="text-sm font-semibold text-foreground">Рекомендации ИИ для заказчика</span>
                  <span className="ml-auto rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-400">
                    AI
                  </span>
                </div>
                <div className="p-5">
                  {result.aiExplanation ? (
                    <AiExplanation text={result.aiExplanation} />
                  ) : (
                    <div className="flex items-start gap-3 text-[13px] text-muted-foreground">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                      <span>
                        ИИ-рекомендации временно недоступны (лимит запросов). Структурированная информация об ограничениях отображена выше.
                        Попробуйте повторить поиск через несколько минут.
                      </span>
                    </div>
                  )}
                </div>
                <div className="border-t border-border/30 px-5 py-2.5 text-[11px] text-muted-foreground/40">
                  ИИ-объяснение носит справочный характер. Для принятия юридически значимых решений обращайтесь к актуальным текстам НПА.
                </div>
              </Card>
            </div>
          </Reveal>
        )}

        {/* ── Справочная информация ──────────────────────────── */}
        {!searchCode && (
          <Reveal direction="up" delay={0.08}>
            <Card className="p-5 shadow-card">
              <div className="mb-4 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground/50" />
                <span className="text-sm font-semibold text-foreground">Основные постановления</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { decree: "ПП-616", date: "30.04.2020", regime: "ban" as const, title: "Запрет промышленных товаров", desc: "Металл, машины, оборудование, мебель, текстиль, транспорт" },
                  { decree: "ПП-878", date: "10.07.2019", regime: "restriction" as const, title: "Радиоэлектронная продукция", desc: "Компьютеры, телеком, электроника, оптика («второй лишний»)" },
                  { decree: "ПП-1236", date: "16.11.2015", regime: "ban" as const, title: "Запрет иностранного ПО", desc: "Программное обеспечение, облачные сервисы, СУБД" },
                  { decree: "ПП-102", date: "05.02.2015", regime: "restriction" as const, title: "Медицинские изделия и лекарства", desc: "Правило «третий лишний» (44-ФЗ)" },
                  { decree: "ПП-925", date: "16.09.2016", regime: "condition" as const, title: "Условия допуска (223-ФЗ)", desc: "Ценовая преференция 15% для российских товаров" },
                  { decree: "ПП-649", date: "17.07.2015", regime: "restriction" as const, title: "Транспортные средства", desc: "Автомобили, автобусы, спецтехника («второй лишний»)" },
                ].map(({ decree, date, regime, title, desc }) => (
                  <button
                    key={decree}
                    type="button"
                    onClick={() => { setInput(decree); }}
                    className="group flex items-start gap-3 rounded-lg border border-border/40 bg-card/40 p-3 text-left transition hover:border-indigo-500/30 hover:bg-indigo-500/5"
                  >
                    <RegimeBadge regime={regime} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold text-foreground">{title}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground/40">{date}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/60">{desc}</p>
                    </div>
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/20 transition group-hover:text-indigo-400" />
                  </button>
                ))}
              </div>
            </Card>
          </Reveal>
        )}

      </div>
    </AppLayout>
  );
};

export default NationalRegimePage;
