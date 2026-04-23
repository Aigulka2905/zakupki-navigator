import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Paperclip,
  FileCheck2,
  Scale,
  CalendarClock,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

type Message = {
  role: "ai" | "user";
  text: string;
  source?: string;
  attachments?: string[];
};

const messages: Message[] = [
  {
    role: "ai",
    text: "Здравствуйте! Я помогу с закупкой №0373000123456. Загрузите документацию или задайте вопрос — проверю на соответствие 223-ФЗ и подскажу сроки.",
  },
  {
    role: "user",
    text: "Какой минимальный срок подачи заявок по конкурентной закупке у субъектов МСП?",
  },
  {
    role: "ai",
    text:
      "Для конкурентной закупки с участием субъектов МСП минимальный срок подачи заявок — 7 рабочих дней с момента размещения извещения в ЕИС. Если НМЦК превышает 30 млн рублей, срок увеличивается до 15 рабочих дней.",
    source: "ст. 3 223-ФЗ (ред. от 01.01.2026), ч. 3",
  },
  {
    role: "user",
    text: "Проверь, пожалуйста, проект положения о закупке",
    attachments: ["Положение_о_закупке_v3.pdf"],
  },
  {
    role: "ai",
    text:
      "Проанализировал документ (24 страницы). Найдено 3 замечания: некорректная ссылка на редакцию закона в п. 4.2, отсутствует порядок обжалования в ст. 7, и срок заключения договора превышает установленный лимит. Сформировать чек-лист?",
    source: "Анализ по 223-ФЗ и Положению ЦБ РФ № 6356-У",
  },
];

const ChatPage = () => {
  const [mode, setMode] = useState<"223" | "comm">("223");

  return (
    <AppLayout
      title="Ассистент по закупкам"
      subtitle="Онлайн · Готов отвечать на ваши вопросы"
      headerRight={
        <div className="hidden items-center gap-1 rounded-lg border border-border bg-muted p-1 sm:flex">
          <button
            onClick={() => setMode("223")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              mode === "223"
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            223-ФЗ
          </button>
          <button
            onClick={() => setMode("comm")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              mode === "comm"
                ? "bg-card text-secondary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Коммерция
          </button>
        </div>
      }
    >
      <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-4xl flex-col">
        {/* Context bar */}
        <div className="border-b border-border bg-card px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="font-medium text-muted-foreground">Закупка:</span>
              <span className="font-mono font-medium text-foreground">№0373000123456</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-medium text-muted-foreground">ЭТП:</span>
              <span className="text-foreground">Сбербанк-АСТ</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-medium text-muted-foreground">Дедлайн:</span>
              <span className="font-medium text-warning-foreground">15.05.2026</span>
            </span>
            <Badge variant="outline" className="ml-auto h-5 gap-1 text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Контекст активен
            </Badge>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-6 md:px-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  m.role === "ai"
                    ? "bg-primary-soft text-primary"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {m.role === "ai" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className={`max-w-[78%] ${m.role === "user" ? "text-right" : ""}`}>
                <div
                  className={`inline-block rounded-2xl px-4 py-2.5 text-sm break-russian ${
                    m.role === "ai"
                      ? "rounded-tl-sm bg-card text-foreground shadow-card border border-border"
                      : "rounded-tr-sm bg-primary text-primary-foreground"
                  }`}
                >
                  {m.text}
                  {m.attachments && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.attachments.map((f) => (
                        <span
                          key={f}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary-foreground/15 px-2 py-1 text-xs"
                        >
                          <Paperclip className="h-3 w-3" />
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {m.source && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-success" />
                    <span>Источник: {m.source}</span>
                    <ExternalLink className="h-3 w-3" />
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading state preview */}
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground shadow-card">
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
              Анализирую документ...
            </div>
          </div>
        </div>

        {/* Quick actions + Input */}
        <div className="border-t border-border bg-card px-4 py-3 md:px-6">
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {[
              { icon: FileCheck2, label: "Проверить документ" },
              { icon: Scale, label: "Сравнить нормы" },
              { icon: CalendarClock, label: "Рассчитать сроки" },
            ].map((q) => (
              <button
                key={q.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
              >
                <q.icon className="h-3.5 w-3.5" />
                {q.label}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground" aria-label="Прикрепить файл">
              <Paperclip className="h-4 w-4" />
            </Button>
            <textarea
              rows={1}
              placeholder="Введите вопрос или загрузите документ..."
              className="min-h-[36px] flex-1 resize-none bg-transparent px-1 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <Button size="icon" className="h-9 w-9 shrink-0 bg-primary hover:bg-primary-hover" aria-label="Отправить">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ChatPage;
