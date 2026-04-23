import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  FileSearch,
  FileCheck2,
  Search,
  Download,
  Trash2,
  Calendar,
} from "lucide-react";

type Activity = {
  id: string;
  type: "chat" | "analysis" | "check";
  title: string;
  description: string;
  date: string;
  time: string;
  tag: string;
};

const activities: Activity[] = [
  {
    id: "1",
    type: "chat",
    title: "Сроки подачи заявки по 223-ФЗ",
    description: "Уточнение минимальных сроков для конкурса в электронной форме",
    date: "23.04.2026",
    time: "14:32",
    tag: "223-ФЗ",
  },
  {
    id: "2",
    type: "analysis",
    title: "Положение_о_закупке_Ромашка.pdf",
    description: "Найдено 3 замечания, 1 критическое нарушение",
    date: "23.04.2026",
    time: "11:18",
    tag: "Анализ",
  },
  {
    id: "3",
    type: "check",
    title: "Заявка №0373000123456",
    description: "Проверка комплектности документов — успешно",
    date: "22.04.2026",
    time: "16:45",
    tag: "ЭТП",
  },
  {
    id: "4",
    type: "chat",
    title: "Единственный поставщик: основания",
    description: "Сравнение норм 223-ФЗ и 44-ФЗ по закупкам у единственного поставщика",
    date: "22.04.2026",
    time: "10:02",
    tag: "Коммерция",
  },
  {
    id: "5",
    type: "analysis",
    title: "Техническое_задание_v3.docx",
    description: "Анализ ТЗ на соответствие требованиям заказчика",
    date: "21.04.2026",
    time: "17:21",
    tag: "Анализ",
  },
  {
    id: "6",
    type: "check",
    title: "Расчёт сроков по закупке №0373000987654",
    description: "Дедлайн подачи заявки: 02.05.2026",
    date: "20.04.2026",
    time: "09:14",
    tag: "Сроки",
  },
];

const typeMeta: Record<Activity["type"], { icon: typeof MessageSquare; label: string; bg: string; color: string }> = {
  chat: { icon: MessageSquare, label: "Чат", bg: "bg-primary-soft", color: "text-primary" },
  analysis: { icon: FileSearch, label: "Анализ", bg: "bg-warning-soft", color: "text-warning" },
  check: { icon: FileCheck2, label: "Проверка", bg: "bg-success-soft", color: "text-success" },
};

const HistoryPage = () => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const filtered = activities.filter((a) => {
    const matchesQuery = a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.description.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || a.type === filter;
    return matchesQuery && matchesFilter;
  });

  return (
    <AppLayout
      title="История запросов"
      subtitle="Журнал чатов, проверок и анализа документов"
      headerRight={
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Экспорт</span>
        </Button>
      }
    >
      <div className="space-y-6 p-4 md:p-6">

        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск по истории..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="sm:w-52">
                <SelectValue placeholder="Тип действия" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все действия</SelectItem>
                <SelectItem value="chat">Чаты</SelectItem>
                <SelectItem value="analysis">Анализ документов</SelectItem>
                <SelectItem value="check">Проверки</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2 sm:w-auto">
              <Calendar className="h-4 w-4" />
              За месяц
            </Button>
          </div>
        </Card>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-sm text-muted-foreground">Записи не найдены</p>
            </Card>
          ) : (
            filtered.map((a) => {
              const meta = typeMeta[a.type];
              const Icon = meta.icon;
              return (
                <Card key={a.id} className="p-4 transition-colors hover:bg-muted/30">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                      <Icon className={`h-5 w-5 ${meta.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-russian font-medium text-foreground">{a.title}</h3>
                        <Badge variant="outline" className="text-[11px]">{a.tag}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{a.date}</span>
                        <span>•</span>
                        <span>{a.time}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default HistoryPage;
