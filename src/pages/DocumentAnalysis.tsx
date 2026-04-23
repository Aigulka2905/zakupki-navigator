import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Search,
  Download,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  FileText,
  Sparkles,
} from "lucide-react";

const comments = [
  {
    tone: "warning",
    icon: AlertTriangle,
    title: "Срок подачи заявок",
    body:
      "Указан срок 5 рабочих дней. Минимум по ч. 3 ст. 3 223-ФЗ для конкурентной закупки с участием МСП — 7 рабочих дней.",
    source: "ч. 3 ст. 3 223-ФЗ (ред. от 01.01.2026)",
    page: "стр. 4",
  },
  {
    tone: "destructive",
    icon: AlertTriangle,
    title: "Отсутствует порядок обжалования",
    body:
      "В разделе 7 не описан порядок подачи и рассмотрения жалоб. Это обязательное требование к положению о закупке.",
    source: "п. 9 ч. 9 ст. 4 223-ФЗ",
    page: "стр. 12",
  },
  {
    tone: "success",
    icon: CheckCircle2,
    title: "Корректное описание предмета закупки",
    body: "Предмет закупки описан в соответствии с требованиями. Указаны характеристики, объём и место поставки.",
    source: "ст. 3 223-ФЗ",
    page: "стр. 2",
  },
  {
    tone: "primary",
    icon: Info,
    title: "Рекомендация: единственный_поставщик",
    body:
      "Рассмотрите возможность включения дополнительных оснований для закупки у единственного_поставщика согласно последним разъяснениям ФАС.",
    source: "Письмо ФАС от 28.02.2026 №ИА/12345/26",
    page: "стр. 8",
  },
];

const toneStyles: Record<string, { bg: string; border: string; icon: string; badge: string; label: string }> = {
  warning: {
    bg: "bg-warning-soft",
    border: "border-l-warning",
    icon: "text-warning-foreground",
    badge: "bg-warning text-warning-foreground",
    label: "Замечание",
  },
  destructive: {
    bg: "bg-destructive/5",
    border: "border-l-destructive",
    icon: "text-destructive",
    badge: "bg-destructive text-destructive-foreground",
    label: "Критично",
  },
  success: {
    bg: "bg-success-soft",
    border: "border-l-success",
    icon: "text-success",
    badge: "bg-success text-success-foreground",
    label: "Корректно",
  },
  primary: {
    bg: "bg-primary-soft",
    border: "border-l-primary",
    icon: "text-primary",
    badge: "bg-primary text-primary-foreground",
    label: "Рекомендация",
  },
};

const DocumentAnalysis = () => {
  return (
    <AppLayout
      title="Анализ документа"
      subtitle="Положение_о_закупке_v3.pdf · 24 страницы"
      headerRight={
        <div className="hidden gap-1.5 md:flex">
          <Button variant="outline" size="sm">
            <ClipboardList className="mr-1.5 h-4 w-4" />
            Чек-лист
          </Button>
          <Button size="sm" className="bg-secondary hover:bg-secondary-hover">
            <Download className="mr-1.5 h-4 w-4" />
            Экспорт в PDF
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-[1600px] p-4 md:p-6">
        {/* Summary banner */}
        <Card className="mb-4 border-l-4 border-l-primary p-4 shadow-card">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-foreground">Анализ завершён</h2>
                <Badge variant="outline" className="text-[11px]">
                  Загружено: 22.04.2026
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground break-russian">
                Документ проверен по 223-ФЗ. Найдено <strong className="text-foreground">4 замечания</strong>: 1 критичное, 1 средней важности, 2 рекомендации.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-center">
                <div className="text-base font-semibold text-destructive">1</div>
                <div className="text-muted-foreground">Критично</div>
              </div>
              <div className="rounded-md bg-warning-soft px-2.5 py-1.5 text-center">
                <div className="text-base font-semibold text-warning-foreground">1</div>
                <div className="text-muted-foreground">Замечание</div>
              </div>
              <div className="rounded-md bg-success-soft px-2.5 py-1.5 text-center">
                <div className="text-base font-semibold text-success">18</div>
                <div className="text-muted-foreground">Корректно</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Split view */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* PDF preview */}
          <Card className="overflow-hidden shadow-card lg:col-span-3">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground break-russian">Положение_о_закупке_v3.pdf</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Уменьшить">
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2 text-xs text-muted-foreground">100%</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Увеличить">
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <span className="mx-2 h-4 w-px bg-border" />
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Назад">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-1 text-xs text-muted-foreground">4 / 24</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Вперёд">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Mock PDF page */}
            <div className="bg-muted/30 p-6">
              <div className="mx-auto aspect-[1/1.3] max-w-md rounded-md bg-card p-8 shadow-md">
                <div className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Положение о закупке
                </div>
                <div className="mt-1 text-center text-[10px] text-muted-foreground">
                  ООО «Ромашка» · Утверждено 01.04.2026
                </div>

                <div className="mt-6 space-y-3">
                  <div>
                    <div className="text-[11px] font-semibold text-foreground">3. Сроки проведения закупки</div>
                    <div className="mt-1 space-y-1">
                      <div className="h-1.5 w-full rounded bg-muted" />
                      <div className="h-1.5 w-[92%] rounded bg-muted" />
                      {/* Highlighted line */}
                      <div className="relative h-1.5 w-[78%] rounded bg-warning/40">
                        <span className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full whitespace-nowrap rounded bg-warning px-1.5 py-0.5 text-[9px] font-medium text-warning-foreground">
                          ⚠️ Срок: 7 дней
                        </span>
                      </div>
                      <div className="h-1.5 w-[88%] rounded bg-muted" />
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-foreground">4. Требования к участникам</div>
                    <div className="mt-1 space-y-1">
                      {[100, 95, 90, 97, 85].map((w, i) => (
                        <div key={i} className="h-1.5 rounded bg-muted" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-foreground">5. Описание предмета закупки</div>
                    <div className="mt-1 space-y-1">
                      {[100, 88, 94].map((w, i) => (
                        <div key={i} className="h-1.5 rounded bg-success/30" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-center text-[9px] text-muted-foreground">— 4 —</div>
              </div>
            </div>
          </Card>

          {/* Analysis panel */}
          <Card className="overflow-hidden shadow-card lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Замечания ассистента</span>
              </div>
              <Badge variant="outline" className="text-[11px]">
                {comments.length} комментариев
              </Badge>
            </div>

            <div className="max-h-[600px] space-y-3 overflow-y-auto p-4">
              {comments.map((c, i) => {
                const t = toneStyles[c.tone];
                return (
                  <div
                    key={i}
                    className={`rounded-lg border-l-4 ${t.border} ${t.bg} p-3.5`}
                  >
                    <div className="flex items-start gap-2.5">
                      <c.icon className={`mt-0.5 h-4 w-4 shrink-0 ${t.icon}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${t.badge}`}>
                            {t.label}
                          </span>
                          <span className="text-[11px] text-muted-foreground">{c.page}</span>
                        </div>
                        <h4 className="mt-1.5 text-sm font-semibold text-foreground break-russian">
                          {c.title}
                        </h4>
                        <p className="mt-1 text-xs text-foreground/80 break-russian">{c.body}</p>
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          <span className="break-russian">Источник: {c.source}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="border-t border-border bg-card p-3">
              <div className="grid grid-cols-1 gap-2">
                <Button size="sm" className="justify-start bg-primary hover:bg-primary-hover">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Сформировать чек-лист
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" className="justify-start">
                    <Search className="mr-1.5 h-3.5 w-3.5" />
                    Найти кейсы
                  </Button>
                  <Button size="sm" variant="outline" className="justify-start">
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Экспортировать
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default DocumentAnalysis;
