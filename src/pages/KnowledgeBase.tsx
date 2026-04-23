import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText, Plus, Calendar, Bookmark, Filter } from "lucide-react";

const filters = [
  "#223ФЗ",
  "#Коммерция",
  "#ЭТП",
  "#Шаблоны",
  "#Судебная_практика",
  "#МСП",
  "#Разъяснения_ФАС",
];

const documents = [
  {
    title: "Положение о закупке ООО «Ромашка»",
    type: "Внутренний документ",
    date: "01.04.2026",
    status: "Актуально на 01.04.2026",
    statusTone: "bg-success-soft text-success",
    tags: ["#223ФЗ", "#Шаблоны"],
    excerpt:
      "Утверждённое положение, определяющее порядок подготовки и проведения закупок, требования к участникам и порядок заключения договоров.",
  },
  {
    title: "Постановление АС МО от 12.03.2026 №А40-12345/2025",
    type: "Судебная практика",
    date: "12.03.2026",
    status: "Прецедент",
    statusTone: "bg-primary-soft text-primary",
    tags: ["#Судебная_практика", "#223ФЗ"],
    excerpt:
      "Суд признал необоснованным отклонение заявки участника по формальным основаниям при наличии исправимых недостатков.",
  },
  {
    title: "Регламент работы на ЭТП Сбербанк-АСТ (ред. 03.2026)",
    type: "Регламент площадки",
    date: "20.03.2026",
    status: "Актуально",
    statusTone: "bg-success-soft text-success",
    tags: ["#ЭТП"],
    excerpt:
      "Порядок аккредитации, подачи заявок, проведения процедур и взаимодействия с заказчиком на электронной торговой площадке.",
  },
  {
    title: "Письмо ФАС России от 28.02.2026 №ИА/12345/26",
    type: "Разъяснение",
    date: "28.02.2026",
    status: "Требует проверки",
    statusTone: "bg-warning-soft text-warning-foreground",
    tags: ["#Разъяснения_ФАС", "#223ФЗ"],
    excerpt:
      "Разъяснения о применении норм 223-ФЗ при закупках у единственного_поставщика в случаях аварийных ситуаций.",
  },
  {
    title: "Шаблон договора поставки (ред. 01.2026)",
    type: "Шаблон",
    date: "15.01.2026",
    status: "Актуально",
    statusTone: "bg-success-soft text-success",
    tags: ["#Шаблоны", "#Коммерция"],
    excerpt:
      "Универсальный шаблон договора поставки с условиями о качестве товара, сроках поставки, ответственности сторон.",
  },
];

const KnowledgeBase = () => {
  const [active, setActive] = useState<string[]>(["#223ФЗ"]);

  const toggle = (f: string) =>
    setActive((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));

  return (
    <AppLayout
      title="База знаний"
      subtitle="Нормативные акты, шаблоны и судебная практика"
      headerRight={
        <Button size="sm" variant="outline" className="hidden md:inline-flex">
          <Plus className="mr-1.5 h-4 w-4" />
          Добавить документ
        </Button>
      }
    >
      <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по базе знаний..."
            className="h-12 rounded-xl border-border bg-card pl-10 pr-32 text-base shadow-card"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Фильтры
            </Button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => {
            const isActive = active.includes(f);
            return (
              <button
                key={f}
                onClick={() => toggle(f)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition break-russian ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary-soft"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { l: "Всего документов", v: "1 247" },
            { l: "Нормативные акты", v: "324" },
            { l: "Судебная практика", v: "586" },
            { l: "Шаблоны", v: "89" },
          ].map((s) => (
            <Card key={s.l} className="px-4 py-3 shadow-card">
              <div className="text-xs text-muted-foreground break-russian">{s.l}</div>
              <div className="mt-0.5 text-xl font-semibold text-foreground">{s.v}</div>
            </Card>
          ))}
        </div>

        {/* Document list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Найдено: <span className="text-muted-foreground font-normal">{documents.length} документов</span>
            </h2>
            <select className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option>Сначала новые</option>
              <option>По релевантности</option>
              <option>Сначала старые</option>
            </select>
          </div>

          {documents.map((d) => (
            <Card key={d.title} className="p-5 shadow-card transition hover:shadow-elevated hover:border-primary/30">
              <div className="flex flex-col gap-3 md:flex-row md:items-start">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <FileText className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {d.type}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {d.date}
                    </span>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${d.statusTone}`}>
                      ✅ {d.status}
                    </span>
                  </div>

                  <h3 className="mt-1.5 text-base font-semibold text-foreground break-russian">
                    {d.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground break-russian">{d.excerpt}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {d.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground break-russian"
                      >
                        {t}
                      </span>
                    ))}
                    <div className="ml-auto flex gap-1.5">
                      <Button size="sm" variant="ghost" className="h-8 text-muted-foreground">
                        <Bookmark className="mr-1 h-3.5 w-3.5" />
                        Сохранить
                      </Button>
                      <Button size="sm" className="h-8 bg-secondary text-secondary-foreground hover:bg-secondary-hover">
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        В контекст
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default KnowledgeBase;
