import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileCheck2,
  CalendarClock,
  FileSearch,
  Plus,
  Upload,
  RefreshCw,
  TrendingUp,
  Clock,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";

const stats = [
  {
    label: "Активные закупки",
    value: "12",
    delta: "+2 за неделю",
    icon: TrendingUp,
    accent: "text-primary",
    bg: "bg-primary-soft",
  },
  {
    label: "Дедлайны на неделе",
    value: "3",
    delta: "Ближайший — 28.04",
    icon: Clock,
    accent: "text-warning-foreground",
    bg: "bg-warning-soft",
  },
  {
    label: "Проверено документов",
    value: "48",
    delta: "За последние 30 дней",
    icon: FileCheck2,
    accent: "text-secondary",
    bg: "bg-secondary-soft",
  },
  {
    label: "Найдено замечаний",
    value: "7",
    delta: "Требуют внимания",
    icon: AlertTriangle,
    accent: "text-destructive",
    bg: "bg-destructive/10",
  },
];

const procurements = [
  {
    id: "№0373000123456",
    title: "Поставка серверного оборудования",
    etp: "Сбербанк-АСТ",
    deadline: "15.05.2026",
    status: "Подача заявок",
    statusTone: "bg-primary-soft text-primary",
  },
  {
    id: "№0373000123457",
    title: "Услуги технической поддержки ПО",
    etp: "РТС-тендер",
    deadline: "28.04.2026",
    status: "Срочно",
    statusTone: "bg-warning-soft text-warning-foreground",
  },
  {
    id: "№0373000123458",
    title: "Закупка канцелярских товаров",
    etp: "ЕЭТП",
    deadline: "03.06.2026",
    status: "Анализ",
    statusTone: "bg-secondary-soft text-secondary",
  },
  {
    id: "№0373000123459",
    title: "Единственный_поставщик: лицензии Microsoft",
    etp: "Внутренняя ЭТП",
    deadline: "10.05.2026",
    status: "Черновик",
    statusTone: "bg-muted text-muted-foreground",
  },
];

const activity = [
  { time: "10:42", text: "Сформирован чек-лист по закупке №0373000123456", tone: "success" },
  { time: "09:18", text: "Загружено положение о закупке ООО «Ромашка»", tone: "primary" },
  { time: "Вчера", text: "Обновлена редакция 223-ФЗ от 01.01.2026", tone: "secondary" },
  { time: "Вчера", text: "Найдено 3 несоответствия в заявке №0373000123451", tone: "warning" },
];

const Dashboard = () => {
  return (
    <AppLayout
      title="Главная"
      subtitle="Обзор активных закупок и состояния системы"
      headerRight={
        <Button asChild size="sm" className="hidden md:inline-flex">
          <Link to="/chat">
            <Plus className="mr-1.5 h-4 w-4" />
            Новая закупка
          </Link>
        </Button>
      }
    >
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        {/* Status banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-card">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-success">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              База актуальна
            </span>
            <span className="text-muted-foreground">Последнее обновление: 22.04.2026, 06:00</span>
            <span className="text-muted-foreground">🔒 Обработка данных: РФ</span>
          </div>
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Обновить базу
          </Button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="p-5 shadow-card transition hover:shadow-elevated">
              <div className="flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.bg}`}>
                  <s.icon className={`h-5 w-5 ${s.accent}`} />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-4">
                <div className="text-3xl font-semibold text-foreground tracking-tight">{s.value}</div>
                <div className="mt-1 text-sm font-medium text-foreground break-russian">{s.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.delta}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Быстрые действия
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { icon: Plus, title: "Новая закупка", desc: "Создать карточку закупки и подключить документы", to: "/chat" },
              { icon: Upload, title: "Проверить заявку", desc: "Загрузите PDF — ассистент проверит по 223-ФЗ", to: "/analysis" },
              { icon: FileSearch, title: "Сравнить нормы", desc: "Сопоставление редакций и судебной практики", to: "/knowledge" },
            ].map((a) => (
              <Link
                key={a.title}
                to={a.to}
                className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-card transition hover:border-primary/40 hover:shadow-elevated"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition group-hover:bg-primary-hover">
                  <a.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{a.title}</div>
                  <div className="text-sm text-muted-foreground break-russian">{a.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Two-column: procurements + activity */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 overflow-hidden shadow-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="font-semibold text-foreground">Активные закупки</h3>
                <p className="text-xs text-muted-foreground">Сортировка по ближайшему дедлайну</p>
              </div>
              <Button variant="ghost" size="sm" className="text-primary">
                Все закупки
                <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="divide-y divide-border">
              {procurements.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{p.id}</span>
                      <Badge variant="outline" className="h-5 text-[10px] font-normal">
                        {p.etp}
                      </Badge>
                    </div>
                    <div className="mt-0.5 truncate text-sm font-medium text-foreground break-russian">
                      {p.title}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {p.deadline}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${p.statusTone}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="shadow-card">
            <div className="border-b border-border px-5 py-4">
              <h3 className="font-semibold text-foreground">Последние события</h3>
              <p className="text-xs text-muted-foreground">Хронология за сегодня</p>
            </div>
            <div className="space-y-4 p-5">
              {activity.map((a, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        a.tone === "success" ? "bg-success" :
                        a.tone === "primary" ? "bg-primary" :
                        a.tone === "warning" ? "bg-warning" : "bg-secondary"
                      }`}
                    />
                    {i < activity.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className="-mt-0.5 pb-1">
                    <div className="text-xs text-muted-foreground">{a.time}</div>
                    <div className="text-sm text-foreground break-russian">{a.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
