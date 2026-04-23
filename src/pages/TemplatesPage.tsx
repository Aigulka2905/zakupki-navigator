import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  FileText,
  Download,
  Eye,
  Plus,
  Star,
} from "lucide-react";

type Template = {
  id: string;
  title: string;
  category: string;
  description: string;
  format: "DOCX" | "PDF" | "XLSX";
  downloads: number;
  updated: string;
  popular?: boolean;
};

const categories = [
  { id: "all", label: "Все" },
  { id: "polozhenie", label: "Положения" },
  { id: "zayavka", label: "Заявки" },
  { id: "dogovor", label: "Договоры" },
  { id: "protokol", label: "Протоколы" },
  { id: "pretenziya", label: "Претензии" },
];

const templates: Template[] = [
  {
    id: "1",
    title: "Положение о закупке (типовое для МСП)",
    category: "polozhenie",
    description: "Базовый шаблон положения о закупке для субъектов малого и среднего предпринимательства",
    format: "DOCX",
    downloads: 1284,
    updated: "01.04.2026",
    popular: true,
  },
  {
    id: "2",
    title: "Заявка на участие в конкурсе (электронная форма)",
    category: "zayavka",
    description: "Шаблон заявки для подачи через ЭТП по 223-ФЗ",
    format: "DOCX",
    downloads: 942,
    updated: "15.03.2026",
    popular: true,
  },
  {
    id: "3",
    title: "Договор поставки товара",
    category: "dogovor",
    description: "Типовая форма договора поставки с условиями оплаты и приёмки",
    format: "DOCX",
    downloads: 778,
    updated: "20.02.2026",
  },
  {
    id: "4",
    title: "Протокол рассмотрения заявок",
    category: "protokol",
    description: "Шаблон протокола работы закупочной комиссии",
    format: "DOCX",
    downloads: 521,
    updated: "10.04.2026",
  },
  {
    id: "5",
    title: "Претензия по нарушению сроков поставки",
    category: "pretenziya",
    description: "Образец претензии поставщику с расчётом неустойки",
    format: "DOCX",
    downloads: 345,
    updated: "05.03.2026",
  },
  {
    id: "6",
    title: "Расчёт начальной (максимальной) цены договора",
    category: "zayavka",
    description: "Excel-таблица для обоснования НМЦД методом сопоставимых рыночных цен",
    format: "XLSX",
    downloads: 612,
    updated: "28.03.2026",
  },
  {
    id: "7",
    title: "Договор оказания услуг (рамочный)",
    category: "dogovor",
    description: "Рамочный договор с возможностью заключения отдельных заказов",
    format: "DOCX",
    downloads: 489,
    updated: "12.03.2026",
  },
  {
    id: "8",
    title: "Положение о закупке для крупных компаний",
    category: "polozhenie",
    description: "Расширенный шаблон с детальной регламентацией процедур",
    format: "DOCX",
    downloads: 367,
    updated: "01.04.2026",
  },
];

const formatColors: Record<Template["format"], string> = {
  DOCX: "bg-primary-soft text-primary",
  PDF: "bg-destructive/10 text-destructive",
  XLSX: "bg-success-soft text-success",
};

const TemplatesPage = () => {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const filtered = templates.filter((t) => {
    const matchesQuery =
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.description.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = activeCategory === "all" || t.category === activeCategory;
    return matchesQuery && matchesCategory;
  });

  return (
    <AppLayout
      title="Шаблоны документов"
      subtitle="Готовые формы для закупочной деятельности по 223-ФЗ"
      headerRight={
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Загрузить</span>
        </Button>
      }
    >
      <div className="space-y-6 p-4 md:p-6">

        {/* Поиск */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск шаблонов..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Категории */}
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Button
              key={c.id}
              variant={activeCategory === c.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(c.id)}
            >
              {c.label}
            </Button>
          ))}
        </div>

        {/* Сетка шаблонов */}
        {filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Шаблоны не найдены</p>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <Card key={t.id} className="flex flex-col p-5 transition-shadow hover:shadow-md">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {t.popular && (
                      <Badge variant="outline" className="gap-1 text-[11px]">
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        Популярный
                      </Badge>
                    )}
                    <Badge className={`text-[11px] ${formatColors[t.format]}`}>
                      {t.format}
                    </Badge>
                  </div>
                </div>
                <h3 className="break-russian font-medium leading-snug text-foreground">
                  {t.title}
                </h3>
                <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{t.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Скачиваний: {t.downloads.toLocaleString("ru-RU")}</span>
                  <span>Обновлён: {t.updated}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Просмотр
                  </Button>
                  <Button size="sm" className="flex-1 gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    Скачать
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TemplatesPage;
