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
  Search,
  Plus,
  CalendarClock,
  Building2,
  ExternalLink,
  Filter,
} from "lucide-react";

type Status = "active" | "preparation" | "submitted" | "completed";

type Procurement = {
  id: string;
  number: string;
  title: string;
  customer: string;
  etp: string;
  price: string;
  deadline: string;
  daysLeft: number;
  status: Status;
};

const statusMeta: Record<Status, { label: string; class: string }> = {
  active: { label: "Активна", class: "bg-primary-soft text-primary" },
  preparation: { label: "Подготовка", class: "bg-warning-soft text-warning" },
  submitted: { label: "Заявка подана", class: "bg-success-soft text-success" },
  completed: { label: "Завершена", class: "bg-muted text-muted-foreground" },
};

const procurements: Procurement[] = [
  {
    id: "1",
    number: "№0373000123456",
    title: "Поставка серверного оборудования",
    customer: "ПАО «Энергосбыт»",
    etp: "Сбербанк-АСТ",
    price: "12 450 000 ₽",
    deadline: "15.05.2026",
    daysLeft: 22,
    status: "active",
  },
  {
    id: "2",
    number: "№0373000987654",
    title: "Услуги клининга административных зданий",
    customer: "ГК «Росатом»",
    etp: "РТС-тендер",
    price: "3 800 000 ₽",
    deadline: "02.05.2026",
    daysLeft: 9,
    status: "preparation",
  },
  {
    id: "3",
    number: "№0373000555111",
    title: "Разработка системы документооборота",
    customer: "ОАО «РЖД»",
    etp: "ЕЭТП",
    price: "8 200 000 ₽",
    deadline: "28.04.2026",
    daysLeft: 5,
    status: "preparation",
  },
  {
    id: "4",
    number: "№0373000222333",
    title: "Поставка канцелярских товаров",
    customer: "ФГУП «Почта России»",
    etp: "Сбербанк-АСТ",
    price: "1 250 000 ₽",
    deadline: "20.04.2026",
    daysLeft: -3,
    status: "submitted",
  },
  {
    id: "5",
    number: "№0373000444555",
    title: "Техническое обслуживание кондиционеров",
    customer: "ПАО «Газпром»",
    etp: "Росэлторг",
    price: "2 100 000 ₽",
    deadline: "10.06.2026",
    daysLeft: 48,
    status: "active",
  },
  {
    id: "6",
    number: "№0373000666777",
    title: "Закупка медицинских расходных материалов",
    customer: "ФГБУ «НМИЦ»",
    etp: "Сбербанк-АСТ",
    price: "5 600 000 ₽",
    deadline: "01.04.2026",
    daysLeft: -22,
    status: "completed",
  },
];

const ProcurementsPage = () => {
  const [query, setQuery] = useState("");
  const [etpFilter, setEtpFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = procurements.filter((p) => {
    const matchesQuery =
      p.title.toLowerCase().includes(query.toLowerCase()) ||
      p.number.includes(query) ||
      p.customer.toLowerCase().includes(query.toLowerCase());
    const matchesEtp = etpFilter === "all" || p.etp === etpFilter;
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesQuery && matchesEtp && matchesStatus;
  });

  const getDeadlineColor = (days: number) => {
    if (days < 0) return "text-muted-foreground";
    if (days <= 7) return "text-destructive";
    if (days <= 14) return "text-warning";
    return "text-foreground";
  };

  const getDeadlineLabel = (days: number) => {
    if (days < 0) return "Завершена";
    if (days === 0) return "Сегодня";
    if (days === 1) return "Завтра";
    return `Осталось ${days} дн.`;
  };

  return (
    <AppLayout
      title="Активные закупки"
      subtitle="Реестр закупок с дедлайнами и статусами"
      headerRight={
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Новая закупка</span>
        </Button>
      }
    >
      <div className="space-y-6 p-4 md:p-6">

        {/* Сводка */}
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Всего закупок", value: procurements.length, accent: "text-foreground" },
            { label: "Активные", value: procurements.filter((p) => p.status === "active").length, accent: "text-primary" },
            { label: "В подготовке", value: procurements.filter((p) => p.status === "preparation").length, accent: "text-warning" },
            { label: "Поданы", value: procurements.filter((p) => p.status === "submitted").length, accent: "text-success" },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {s.label}
              </div>
              <div className={`mt-1 text-2xl font-semibold ${s.accent}`}>{s.value}</div>
            </Card>
          ))}
        </div>

        {/* Фильтры */}
        <Card className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск по номеру, названию или заказчику..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={etpFilter} onValueChange={setEtpFilter}>
              <SelectTrigger className="lg:w-48">
                <SelectValue placeholder="ЭТП" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все ЭТП</SelectItem>
                <SelectItem value="Сбербанк-АСТ">Сбербанк-АСТ</SelectItem>
                <SelectItem value="РТС-тендер">РТС-тендер</SelectItem>
                <SelectItem value="ЕЭТП">ЕЭТП</SelectItem>
                <SelectItem value="Росэлторг">Росэлторг</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="lg:w-48">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="active">Активные</SelectItem>
                <SelectItem value="preparation">Подготовка</SelectItem>
                <SelectItem value="submitted">Заявка подана</SelectItem>
                <SelectItem value="completed">Завершённые</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Список */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <Card className="p-12 text-center">
              <Filter className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Закупки не найдены</p>
            </Card>
          ) : (
            filtered.map((p) => (
              <Card key={p.id} className="p-4 transition-colors hover:bg-muted/30">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{p.number}</span>
                      <Badge className={statusMeta[p.status].class}>
                        {statusMeta[p.status].label}
                      </Badge>
                    </div>
                    <h3 className="mt-1.5 break-russian font-medium text-foreground">
                      {p.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" />
                        {p.customer}
                      </span>
                      <span>ЭТП: {p.etp}</span>
                      <span className="font-medium text-foreground">{p.price}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 lg:flex-col lg:items-end lg:gap-1">
                    <div className="flex items-center gap-1.5">
                      <CalendarClock className={`h-4 w-4 ${getDeadlineColor(p.daysLeft)}`} />
                      <span className={`text-sm font-medium ${getDeadlineColor(p.daysLeft)}`}>
                        {p.deadline}
                      </span>
                    </div>
                    <span className={`text-xs ${getDeadlineColor(p.daysLeft)}`}>
                      {getDeadlineLabel(p.daysLeft)}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 lg:shrink-0">
                    Открыть
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default ProcurementsPage;
