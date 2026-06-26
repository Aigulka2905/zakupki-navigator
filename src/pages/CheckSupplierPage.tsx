import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search,
  ExternalLink,
  Building2,
  AlertTriangle,
  Scale,
  FileText,
  ShieldX,
  Gavel,
  Receipt,
  BookOpen,
  Users,
  Sparkles,
  Loader2,
  Printer,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { apiClient } from "@/lib/api-client";
import { CheckoReport } from "@/components/CheckoReport";

// Печать только отчёта Checko (для «Скачать PDF» → браузерное «Сохранить как PDF»).
const CHECKO_PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #checko-report, #checko-report * { visibility: visible !important; }
  #checko-report { position: absolute; left: 0; top: 0; width: 100%; padding: 16px; }
  .no-print { display: none !important; }
}`;

interface Registry {
  id: string;
  name: string;
  fullName: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  description: string;
  buildUrl: (inn: string) => string;
  note?: string;
  /** Проверка через наш бэкенд (Checko API) с показом результата в окне, а не переход на внешний сайт. */
  apiCheck?: boolean;
}

const REGISTRIES: Registry[] = [
  {
    id: "checko",
    name: "Checko",
    fullName: "Checko — комплексная проверка контрагентов",
    icon: Sparkles,
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-500/10",
    description: "Комплексная проверка: финансы, риски, связи, арбитраж, банкротство — в одном сервисе",
    buildUrl: () => `https://checko.ru/`,
    note: "Рекомендуем",
    apiCheck: true,
  },
  {
    id: "egrul",
    name: "ЕГРЮЛ / ЕГРИП",
    fullName: "Единый государственный реестр юридических лиц",
    icon: Building2,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    description: "Регистрационные данные, руководители, учредители, виды деятельности",
    buildUrl: (inn) => `https://egrul.nalog.ru/index.html?query=${inn}`,
  },
  {
    id: "rnp223",
    name: "РНП 223-ФЗ",
    fullName: "Реестр недобросовестных поставщиков (223-ФЗ)",
    icon: ShieldX,
    color: "text-orange-500",
    bg: "bg-orange-50 dark:bg-orange-500/10",
    description: "Недобросовестные поставщики в закупках по 223-ФЗ",
    buildUrl: (inn) => `https://zakupki.gov.ru/epz/dishonestsupplier/search/results.html?searchString=${inn}&morphology=on`,
  },
  {
    id: "bankrupt",
    name: "ЕФРСБ",
    fullName: "Единый федеральный реестр сведений о банкротстве",
    icon: AlertTriangle,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    description: "Сведения о банкротстве организаций и индивидуальных предпринимателей",
    buildUrl: (inn) => `https://bankrot.fedresurs.ru/bankrupts?searchString=${inn}`,
  },
  {
    id: "fssp",
    name: "ФССП",
    fullName: "Федеральная служба судебных приставов",
    icon: Gavel,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-500/10",
    description: "Исполнительные производства, задолженности перед судебными приставами",
    buildUrl: (inn) => `https://fssp.gov.ru/iss/ip/?predDataSEarch=0&nameOrg=${inn}`,
  },
  {
    id: "arbitr",
    name: "Арбитражные дела",
    fullName: "Картотека арбитражных дел (ВАС РФ)",
    icon: Scale,
    color: "text-indigo-500",
    bg: "bg-indigo-50 dark:bg-indigo-500/10",
    description: "Судебные дела в арбитражных судах: истец, ответчик, суммы исков",
    buildUrl: (inn) => `https://kad.arbitr.ru/?companies=${inn}`,
  },
  {
    id: "nalog_debt",
    name: "Налоговые долги",
    fullName: "ФНС — Сведения о задолженности",
    icon: Receipt,
    color: "text-rose-500",
    bg: "bg-rose-50 dark:bg-rose-500/10",
    description: "Публичные сведения о юридических лицах, имеющих задолженность по налогам",
    buildUrl: (inn) => `https://pb.nalog.ru/search.html#t=${Date.now()}&mode=search-all&queryAll=${inn}&page=1&pageSize=10`,
  },
  {
    id: "contracts",
    name: "Госконтракты",
    fullName: "Единая информационная система в сфере закупок",
    icon: FileText,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    description: "Все исполненные и текущие государственные контракты поставщика",
    buildUrl: (inn) => `https://zakupki.gov.ru/epz/contract/search/results.html?searchString=${inn}&morphology=on&supplierinn=${inn}`,
  },
  {
    id: "nostroy",
    name: "НОСТРОЙ (СРО)",
    fullName: "Национальное объединение строителей",
    icon: BookOpen,
    color: "text-cyan-600",
    bg: "bg-cyan-50 dark:bg-cyan-500/10",
    description: "Членство в саморегулируемых организациях в сфере строительства",
    buildUrl: (inn) => `https://reestr.nostroy.ru/?inn=${inn}`,
  },
  {
    id: "statreg",
    name: "Статистика (Росстат)",
    fullName: "Федеральная служба государственной статистики",
    icon: Users,
    color: "text-slate-500",
    bg: "bg-slate-50 dark:bg-slate-500/10",
    description: "Бухгалтерская отчётность, финансовые показатели за несколько лет",
    buildUrl: (inn) => `https://www.fedstat.ru/indicators/search?searchText=${inn}`,
  },
];

export default function CheckSupplierPage() {
  const [inn, setInn]           = useState("");
  const [searched, setSearched] = useState("");

  // Checko: проверка через наш бэкенд (ключ на сервере), результат в модалке.
  const [checkoOpen, setCheckoOpen]       = useState(false);
  const [checkoLoading, setCheckoLoading] = useState(false);
  const [checkoData, setCheckoData]       = useState<Record<string, unknown> | null>(null);
  const [checkoError, setCheckoError]     = useState<string | null>(null);

  const handleSearch = () => {
    const cleaned = inn.trim().replace(/\D/g, "");
    if (cleaned.length < 10) return;
    setSearched(cleaned);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const runChecko = async (targetInn: string) => {
    setCheckoOpen(true);
    setCheckoLoading(true);
    setCheckoError(null);
    setCheckoData(null);
    try {
      const { data } = await apiClient.get(`/checko/lookup`, { params: { inn: targetInn } });
      setCheckoData((data?.data ?? null) as Record<string, unknown> | null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setCheckoError(err.response?.data?.error ?? "Не удалось получить данные Checko");
    } finally {
      setCheckoLoading(false);
    }
  };

  const isValid = inn.trim().replace(/\D/g, "").length >= 10;

  return (
    <AppLayout
      title="Проверка контрагента"
      subtitle="Проверьте поставщика по государственным реестрам"
    >
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">

        {/* Search */}
        <Reveal direction="up" delay={0}>
          <Card className="p-6">
            <div className="text-sm font-semibold text-foreground mb-1">ИНН организации</div>
            <p className="text-xs text-muted-foreground mb-4">
              Введите ИНН (10 или 12 цифр) для формирования прямых ссылок на государственные реестры
            </p>
            <div className="flex gap-2">
              <Input
                value={inn}
                onChange={(e) => setInn(e.target.value.replace(/\D/g, "").slice(0, 12))}
                onKeyDown={handleKeyDown}
                placeholder="7700000000"
                maxLength={12}
                className="font-mono text-base max-w-xs"
              />
              <Button onClick={handleSearch} disabled={!isValid}>
                <Search className="mr-1.5 h-4 w-4" />
                Проверить
              </Button>
            </div>
            {searched && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-primary-soft px-4 py-2.5">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-primary">ИНН: {searched}</span>
                <span className="text-xs text-muted-foreground">— ссылки сформированы ниже</span>
              </div>
            )}
          </Card>
        </Reveal>

        {/* Registries */}
        <div>
          <Reveal direction="up" delay={0.07}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Государственные реестры
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {REGISTRIES.map((reg, i) => {
              const url = searched ? reg.buildUrl(searched) : null;
              return (
                <Reveal key={reg.id} delay={0.1 + i * 0.05} direction="up">
                  <Card
                    className={`p-4 transition-all ${searched ? "hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5" : "opacity-75"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${reg.bg}`}>
                        <reg.icon className={`h-5 w-5 ${reg.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{reg.name}</span>
                          {reg.note && (
                            <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                              {reg.note}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {reg.description}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      {!searched ? (
                        <Button size="sm" variant="outline" disabled className="text-xs">
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          Введите ИНН
                        </Button>
                      ) : reg.apiCheck ? (
                        <Button
                          size="sm"
                          onClick={() => runChecko(searched)}
                          className="text-xs"
                        >
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                          Проверить через Checko
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => url && window.open(url, "_blank")}
                          className="text-xs"
                        >
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          Открыть реестр
                        </Button>
                      )}
                    </div>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </div>

        {/* Info block */}
        <Reveal direction="up" delay={0.15}>
          <Card className="p-5 bg-muted/30 border-dashed">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Важно:</span> ссылки открываются на официальные государственные сайты.
                Некоторые реестры требуют дополнительного поиска на открывшейся странице.
                Для полноценной проверки рекомендуем использовать несколько источников.
              </div>
            </div>
          </Card>
        </Reveal>

      </div>

      {/* Checko result modal */}
      <Dialog open={checkoOpen} onOpenChange={setCheckoOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <style>{CHECKO_PRINT_CSS}</style>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                Checko — сведения об организации
              </span>
              {!checkoLoading && !checkoError && checkoData && (
                <Button size="sm" variant="outline" className="no-print text-xs" onClick={() => window.print()}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" /> Скачать PDF
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          {checkoLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Запрашиваем данные…
            </div>
          ) : checkoError ? (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{checkoError}</span>
            </div>
          ) : (
            <div id="checko-report">
              <CheckoReport data={checkoData} />
              <div className="mt-4 flex items-center justify-between gap-2 no-print">
                {(() => {
                  const ogrn = String((checkoData?.["ОГРН"] ?? checkoData?.["ОГРНИП"] ?? "")) || "";
                  return ogrn ? (
                    <Button size="sm" variant="outline" className="text-xs"
                      onClick={() => window.open(`https://checko.ru/company/${ogrn}`, "_blank")}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Открыть на checko.ru
                    </Button>
                  ) : <span />;
                })()}
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">Полный ответ (JSON)</summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted/50 p-2 text-[11px] leading-relaxed">
                    {JSON.stringify(checkoData, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
