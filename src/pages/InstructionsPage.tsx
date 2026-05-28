import { useState, useRef, useEffect } from "react";
import {
  Search,
  PlayCircle,
  MessageSquare,
  Briefcase,
  BookOpen,
  FileSearch,
  CreditCard,
  Building2,
  HelpCircle,
  ChevronRight,
  Lightbulb,
  AlertTriangle,
  Info,
  CheckCircle2,
  Zap,
  Upload,
  Filter,
  Eye,
  Send,
  Lock,
  RefreshCw,
  Star,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

// ── Types ─────────────────────────────────────────────────────

interface Topic {
  id: string;
  icon: React.ElementType;
  label: string;
  badge?: string;
  sections: Section[];
}

interface Section {
  title: string;
  content: React.ReactNode;
}

// ── Callout components ────────────────────────────────────────

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary-soft/60 p-4 text-sm">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="text-foreground/80">{children}</span>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft/70 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
      <span className="text-foreground/80">{children}</span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-muted/50 p-4 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}

function Success({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-success/30 bg-success/5 p-4 text-sm">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <span className="text-foreground/80">{children}</span>
    </div>
  );
}

// ── Numbered step ─────────────────────────────────────────────

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {n}
        </div>
        <div className="mt-1 w-px flex-1 bg-border" />
      </div>
      <div className="pb-6 pt-0.5 min-w-0 flex-1">
        <p className="mb-1.5 text-sm font-semibold text-foreground">{title}</p>
        <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <div className="mt-3">{children}</div>;
}

// ── Key shortcut ──────────────────────────────────────────────

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">
      {children}
    </kbd>
  );
}

// ── Feature grid ──────────────────────────────────────────────

function FeatureGrid({ items }: { items: { icon: React.ElementType; title: string; desc: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.title} className="flex gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
            <item.icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Topic content ─────────────────────────────────────────────

const TOPICS: Topic[] = [
  {
    id: "start",
    icon: PlayCircle,
    label: "Начало работы",
    badge: "С этого начните",
    sections: [
      {
        title: "Регистрация и вход",
        content: (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Ассистент 223-ФЗ — система для автоматизации участия в государственных закупках.
              Перед началом работы зарегистрируйте аккаунт организации.
            </p>
            <Steps>
              <Step n={1} title="Перейдите на страницу регистрации">
                На экране входа нажмите вкладку <strong>«Регистрация»</strong>.
              </Step>
              <Step n={2} title="Заполните данные аккаунта">
                Введите email, придумайте логин (латиница, цифры, _ или -) и надёжный пароль (минимум 8 символов, цифра и спецсимвол !@#$...).
              </Step>
              <Step n={3} title="Укажите данные организации">
                Введите полное наименование, ИНН и КПП. Эти данные используются для анализа релевантности закупок.
              </Step>
              <Step n={4} title="Подтвердите email">
                Письмо с кнопкой подтверждения придёт на указанный адрес. Проверьте папку «Спам».
              </Step>
            </Steps>
            <Tip>
              Сразу после регистрации заполните профиль организации — это значительно повышает точность AI-рекомендаций по закупкам.
            </Tip>
          </div>
        ),
      },
      {
        title: "Обзор интерфейса",
        content: (
          <div className="space-y-4">
            <FeatureGrid items={[
              { icon: MessageSquare, title: "Чат с ИИ", desc: "Задавайте вопросы по 223-ФЗ, анализируйте документы" },
              { icon: Briefcase, title: "Закупки", desc: "Мониторинг тендеров с AI-оценкой релевантности" },
              { icon: BookOpen, title: "База знаний", desc: "Хранение нормативных актов и шаблонов" },
              { icon: FileSearch, title: "Анализ документов", desc: "Автоматическая проверка на нарушения" },
              { icon: CreditCard, title: "Биллинг", desc: "Управление балансом и статистика токенов" },
              { icon: Building2, title: "Организация", desc: "Настройка профиля для точных рекомендаций" },
            ]} />
            <Note>
              Боковая панель сворачивается — нажмите на стрелку слева, чтобы освободить больше места для работы.
            </Note>
          </div>
        ),
      },
      {
        title: "Восстановление пароля",
        content: (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Если вы забыли пароль:</p>
            <Steps>
              <Step n={1} title='Нажмите "Забыли пароль?" на странице входа'>
                Ссылка находится под полем ввода пароля.
              </Step>
              <Step n={2} title="Введите email от аккаунта">
                Ссылка на сброс придёт в течение 1–2 минут.
              </Step>
              <Step n={3} title="Перейдите по ссылке из письма">
                Ссылка действительна <strong>1 час</strong>. После установки нового пароля все активные сессии завершаются.
              </Step>
            </Steps>
          </div>
        ),
      },
    ],
  },

  {
    id: "chat",
    icon: MessageSquare,
    label: "Чат с ИИ-ассистентом",
    sections: [
      {
        title: "Как работает ассистент",
        content: (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ИИ-ассистент специализируется на законодательстве о госзакупках (223-ФЗ, 44-ФЗ) и умеет работать в трёх режимах:
            </p>
            <FeatureGrid items={[
              { icon: MessageSquare, title: "Общий режим", desc: "Вопросы по 223-ФЗ, 44-ФЗ, расчёт сроков, сравнение норм" },
              { icon: Briefcase, title: "Режим закупки", desc: "Анализ конкретной закупки с данными из ЭТП" },
              { icon: BookOpen, title: "Режим документа", desc: "Ответы строго по содержимому загруженного документа" },
            ]} />
            <Tip>
              Для точных ответов задавайте конкретные вопросы: «Каков минимальный срок публикации извещения по 223-ФЗ для товаров?» лучше, чем «расскажи про сроки».
            </Tip>
          </div>
        ),
      },
      {
        title: "Анализ документа из базы знаний",
        content: (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Вы можете попросить ассистента ответить на вопросы по конкретному документу из базы знаний:
            </p>
            <Steps>
              <Step n={1} title="Откройте Базу знаний">
                Перейдите в раздел <strong>«База знаний»</strong> через боковое меню.
              </Step>
              <Step n={2} title="Найдите нужный документ">
                Используйте поиск или фильтры по типу документа.
              </Step>
              <Step n={3} title='Нажмите "Спросить ИИ"'>
                Кнопка есть как в карточке документа, так и в панели просмотра.
              </Step>
              <Step n={4} title="Задавайте вопросы по документу">
                ИИ будет отвечать <strong>строго на основе текста этого документа</strong> — без смешения с другими данными.
              </Step>
            </Steps>
            <Success>
              Это особенно полезно для анализа технических заданий, проверки закупочной документации и изучения судебной практики.
            </Success>
          </div>
        ),
      },
      {
        title: "Примеры эффективных запросов",
        content: (
          <div className="space-y-3">
            <div className="space-y-2">
              {[
                { tag: "Сроки", q: "Какой минимальный срок подачи заявок для конкурса с НМЦК более 10 млн руб. по 223-ФЗ?" },
                { tag: "Проверка", q: "Есть ли в этом документе нарушения требований к обеспечению заявки?" },
                { tag: "Анализ", q: "Какие требования к участникам установлены в данной закупочной документации?" },
                { tag: "Расчёт", q: "Рассчитай сроки проведения запроса котировок по 223-ФЗ от даты публикации 15 мая" },
                { tag: "Сравнение", q: "Чем отличаются требования к обеспечению контракта в 44-ФЗ и 223-ФЗ?" },
              ].map((item) => (
                <div key={item.tag} className="flex gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <Badge variant="outline" className="mt-0.5 h-5 shrink-0 text-[10px]">{item.tag}</Badge>
                  <p className="text-sm text-foreground/80">«{item.q}»</p>
                </div>
              ))}
            </div>
            <Tip>
              Нажмите <Key>Enter</Key> для отправки, <Key>Shift</Key>+<Key>Enter</Key> — для переноса строки в вопросе.
            </Tip>
          </div>
        ),
      },
      {
        title: "История диалогов",
        content: (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>В левой панели чата сохраняются все предыдущие диалоги.</p>
            <ul className="space-y-2 list-none">
              {[
                "Общий чат — вопросы по законодательству без привязки к закупке",
                "Диалоги по закупкам — появляются при открытии чата из карточки закупки",
                "Диалоги по документам — не сохраняются в историю (каждый раз свежий контекст)",
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ),
      },
    ],
  },

  {
    id: "procurements",
    icon: Briefcase,
    label: "Активные закупки",
    sections: [
      {
        title: "Работа со списком закупок",
        content: (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Раздел «Активные закупки» показывает тендеры, добавленные в систему, с оценкой релевантности для вашей организации.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Filter, label: "Фильтры", desc: "По статусу, площадке, цене, дедлайну" },
                { icon: Star, label: "AI-оценка", desc: "Релевантность 0–100% для вашей организации" },
                { icon: Zap, label: "Анализ рисков", desc: "Проверка на нарушения 223-ФЗ" },
              ].map((f) => (
                <div key={f.label} className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                  <f.icon className="mx-auto mb-2 h-5 w-5 text-primary" />
                  <p className="text-xs font-semibold">{f.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
            <Tip>
              AI-оценка релевантности рассчитывается на основе профиля вашей организации. Чем подробнее заполнен раздел «Виды деятельности», тем точнее оценка.
            </Tip>
          </div>
        ),
      },
      {
        title: "Карточка закупки",
        content: (
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>В карточке закупки доступны:</p>
            <ul className="space-y-2">
              {[
                "Полные данные закупки с РФТорги (цена, сроки, обеспечение, требования)",
                "Список документов закупки — ИИ может загрузить и проанализировать PDF прямо во время чата",
                "Кнопка «Проконсультироваться» — открывает чат в контексте этой закупки",
                "Оценка релевантности с объяснением от ИИ",
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ),
      },
    ],
  },

  {
    id: "knowledge",
    icon: BookOpen,
    label: "База знаний",
    sections: [
      {
        title: "Типы документов",
        content: (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { type: "Нормативный акт", desc: "223-ФЗ, 44-ФЗ, постановления Правительства" },
                { type: "Положение / Регламент", desc: "Внутренние положения о закупках" },
                { type: "Шаблон", desc: "Типовые договоры, ТЗ, спецификации" },
                { type: "Судебная практика", desc: "Решения ФАС, арбитражных судов" },
                { type: "Регламент ЭТП", desc: "Правила работы на торговых площадках" },
              ].map((t) => (
                <div key={t.type} className="rounded-lg border border-border px-3 py-2.5">
                  <p className="text-sm font-medium">{t.type}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        title: "Загрузка документов",
        content: (
          <div className="space-y-4">
            <Steps>
              <Step n={1} title='Нажмите "Добавить документ"'>
                Кнопка находится в правом верхнем углу страницы «База знаний».
              </Step>
              <Step n={2} title="Выберите файл">
                Поддерживаются форматы <strong>PDF, DOCX, DOC, TXT</strong>. Максимальный размер — 50 МБ. Можно перетащить файл в область загрузки.
              </Step>
              <Step n={3} title="Заполните метаданные">
                Укажите название, выберите тип документа, добавьте теги для удобного поиска.
              </Step>
              <Step n={4} title="Нажмите «Загрузить»">
                Документ появится в списке и будет доступен для просмотра и анализа.
              </Step>
            </Steps>
            <Warning>
              Документы с таблицами и сложным форматированием (вертикальные черты, колонки) могут извлекаться частично. Для таких файлов лучше использовать PDF-формат.
            </Warning>
          </div>
        ),
      },
      {
        title: "Просмотр и поиск",
        content: (
          <div className="space-y-4 text-sm">
            <div className="space-y-3">
              {[
                { icon: Search, title: "Поиск по названию", desc: "Введите ключевое слово в строку поиска" },
                { icon: Filter, title: "Фильтр по типу", desc: "Кликните на карточку-счётчик в верхней части страницы" },
                { icon: Eye, title: "Просмотр документа", desc: "Нажмите на документ или иконку глаза — откроется панель просмотра (PDF отображается прямо в браузере)" },
                { icon: MessageSquare, title: "Задать вопрос по документу", desc: "Кнопка «Спросить ИИ» в карточке или панели просмотра" },
              ].map((item) => (
                <div key={item.title} className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted-foreground text-xs">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
    ],
  },

  {
    id: "analysis",
    icon: FileSearch,
    label: "Анализ документов",
    sections: [
      {
        title: "Как работает анализ",
        content: (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Раздел «Анализ документа» позволяет загрузить любой файл закупочной документации
              и получить автоматическую проверку на соответствие 223-ФЗ и 44-ФЗ.
            </p>
            <Steps>
              <Step n={1} title="Загрузите документ">
                Перетащите файл в зону загрузки или нажмите кнопку выбора. Форматы: PDF, DOCX, TXT.
              </Step>
              <Step n={2} title="Дождитесь обработки">
                Анализ выполняется в фоне (обычно 30–90 секунд в зависимости от размера файла).
              </Step>
              <Step n={3} title="Изучите результат">
                Система выведет список найденных нарушений с ссылками на статьи законов и рекомендациями по устранению.
              </Step>
            </Steps>
            <Tip>
              Загружайте финальные версии документов — черновики без дат и подписей могут давать ложные предупреждения.
            </Tip>
          </div>
        ),
      },
      {
        title: "Что проверяется",
        content: (
          <div className="space-y-3">
            <div className="space-y-2 text-sm">
              {[
                "Сроки публикации извещения и документации",
                "Требования к обеспечению заявки и контракта",
                "Критерии оценки заявок (222-ФЗ, ч. 6 ст. 3)",
                "Преимущества для субъектов МСП",
                "Порядок подачи и отзыва заявок",
                "Требования к участникам (РНП, лицензии)",
                "Условия расторжения и изменения контракта",
              ].map((item) => (
                <div key={item} className="flex gap-2 rounded-lg bg-muted/30 px-3 py-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
            <Note>
              Анализ носит информационный характер. Результаты рекомендуется проверять с юристом перед подачей жалобы в ФАС.
            </Note>
          </div>
        ),
      },
    ],
  },

  {
    id: "billing",
    icon: CreditCard,
    label: "Биллинг и оплата",
    sections: [
      {
        title: "Модели оплаты",
        content: (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Модель ИИ</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Стоимость</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { model: "Groq · Llama 3.3 70B", price: "Бесплатно", status: "Тест", statusClass: "bg-success/10 text-success" },
                    { model: "YandexGPT Lite", price: "0.20 ₽ / 1К токенов", status: "Платно", statusClass: "bg-primary-soft text-primary" },
                    { model: "YandexGPT Pro", price: "1.00 ₽ / 1К токенов", status: "Платно", statusClass: "bg-primary-soft text-primary" },
                  ].map((row) => (
                    <tr key={row.model} className="bg-background">
                      <td className="px-4 py-3 font-medium">{row.model}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.price}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.statusClass}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Note>
              Токены считаются суммарно по всем пользователям организации. Баланс общий для всей организации.
            </Note>
          </div>
        ),
      },
      {
        title: "Пополнение баланса",
        content: (
          <div className="space-y-4 text-sm">
            <Steps>
              <Step n={1} title="Откройте раздел «Биллинг и оплата»">
                Ссылка в нижней части бокового меню.
              </Step>
              <Step n={2} title='Нажмите "Пополнить"'>
                Выберите сумму из пресетов (500 / 1000 / 2000 / 5000 ₽) или введите произвольную (от 100 ₽).
              </Step>
              <Step n={3} title="Оплатите через ЮKassa">
                Система перенаправит на страницу оплаты. Доступны: банковская карта, СБП, Яндекс Пэй, ЮMoney.
              </Step>
              <Step n={4} title="Баланс пополняется мгновенно">
                После подтверждения оплаты средства зачисляются на счёт организации.
              </Step>
            </Steps>
            <Tip>
              В разделе «История платежей» вы найдёте все транзакции. Незавершённые платежи можно оплатить повторно, нажав кнопку «Оплатить» рядом с ними.
            </Tip>
          </div>
        ),
      },
    ],
  },

  {
    id: "organization",
    icon: Building2,
    label: "Профиль организации",
    sections: [
      {
        title: "Зачем заполнять профиль",
        content: (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Профиль организации используется ИИ для персонализации рекомендаций и оценки релевантности закупок.
            </p>
            <div className="space-y-2">
              {[
                { pct: "90%", desc: "точнее AI-оценка релевантности закупок при заполненных видах деятельности" },
                { pct: "Быстрее", desc: "ответы ассистента, когда он знает специализацию вашей организации" },
                { pct: "Точнее", desc: "анализ документов — ИИ учитывает специфику вашей отрасли" },
              ].map((item) => (
                <div key={item.pct} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-2.5">
                  <span className="text-base font-bold text-primary">{item.pct}</span>
                  <span className="text-muted-foreground">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        title: "Что заполнить в первую очередь",
        content: (
          <div className="space-y-3 text-sm">
            <div className="space-y-2">
              {[
                { priority: "Обязательно", field: "Виды деятельности", desc: "Ключевые слова через запятую: «строительство, ремонт дорог, асфальтирование»" },
                { priority: "Важно", field: "Описание организации", desc: "2–3 предложения о специализации, опыте, основных направлениях" },
                { priority: "Желательно", field: "ОГРН, адрес, контакты", desc: "Для корректной идентификации в документах" },
                { priority: "Опционально", field: "Банковские реквизиты", desc: "Для автоматической подстановки в шаблоны договоров" },
              ].map((item) => (
                <div key={item.field} className="flex gap-3 rounded-lg border border-border px-4 py-3">
                  <span className={`mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-wide ${
                    item.priority === "Обязательно" ? "text-destructive" :
                    item.priority === "Важно" ? "text-warning-foreground" :
                    item.priority === "Желательно" ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {item.priority}
                  </span>
                  <div>
                    <p className="font-medium">{item.field}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
    ],
  },

  {
    id: "security",
    icon: Lock,
    label: "Безопасность",
    sections: [
      {
        title: "Хранение данных",
        content: (
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              {[
                "Все данные хранятся на серверах в Российской Федерации",
                "Пароли хранятся в зашифрованном виде (bcrypt), исходный пароль нигде не сохраняется",
                "Файлы документов хранятся изолированно от других организаций",
                "Передача данных — только по HTTPS",
              ].map((item, i) => (
                <div key={i} className="flex gap-2">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        title: "Токены доступа",
        content: (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Система использует два типа токенов для безопасного доступа:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: "Access Token", ttl: "15 минут", desc: "Короткоживущий токен для API-запросов. Обновляется автоматически." },
                { title: "Refresh Token", ttl: "7 дней", desc: "Долгоживущий токен для обновления доступа. Хранится в базе данных." },
              ].map((t) => (
                <div key={t.title} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium">{t.title}</p>
                    <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 font-mono">{t.ttl}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
              ))}
            </div>
            <Note>
              При смене пароля все активные сессии завершаются — вам потребуется войти заново на всех устройствах.
            </Note>
          </div>
        ),
      },
    ],
  },

  {
    id: "faq",
    icon: HelpCircle,
    label: "FAQ",
    sections: [
      {
        title: "Частые вопросы",
        content: (
          <div className="space-y-3">
            {[
              {
                q: "ИИ отвечает медленно или не отвечает",
                a: "Модель Groq может быть временно недоступна из-за ограничений сети. Подождите 1–2 минуты и повторите запрос. Если проблема сохраняется — обратитесь к администратору для переключения на другую модель.",
              },
              {
                q: "ИИ отвечает не по документу, а про 'Тестовую организацию'",
                a: "Убедитесь, что вы перешли в чат кнопкой «Спросить ИИ» из карточки конкретного документа, а не открыли общий чат. При корректном переходе в заголовке страницы будет указано «Консультация по документу».",
              },
              {
                q: "Документ загружен, но текст не извлекается",
                a: "Документы с таблицами, вертикальными линиями и нестандартным форматированием могут плохо распознаваться. Попробуйте сохранить документ в PDF-формате или скопировать текст вручную в .txt файл.",
              },
              {
                q: "Как добавить нового пользователя в организацию?",
                a: "На текущем этапе каждый пользователь регистрируется самостоятельно. При регистрации с одним ИНН/КПП организации создаётся общий аккаунт. Многопользовательское управление в разработке.",
              },
              {
                q: "Потеряна ссылка на подтверждение email",
                a: "Войдите в систему, после чего в уведомлениях появится кнопка «Отправить письмо повторно». Ссылка действительна 24 часа.",
              },
              {
                q: "Как переключить модель ИИ?",
                a: "Переключение модели выполняется в файле .env на сервере (параметр AI_MODEL). Изменение требует перезапуска бэкенда. Стоимость токенов изменится автоматически согласно тарифу выбранной модели.",
              },
              {
                q: "Как узнать, сколько токенов потрачено?",
                a: "Откройте раздел «Биллинг и оплата» — там показана статистика за текущий месяц и за всё время. Статистика обновляется в реальном времени после каждого ответа ИИ.",
              },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-border overflow-hidden">
                <div className="flex gap-3 bg-muted/30 px-4 py-3">
                  <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm font-medium">{item.q}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm text-muted-foreground">{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        title: "Горячие клавиши",
        content: (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Действие</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Комбинация</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {[
                  { action: "Отправить сообщение в чат", keys: ["Enter"] },
                  { action: "Перенос строки в чате", keys: ["Shift", "Enter"] },
                  { action: "Закрыть модальное окно", keys: ["Esc"] },
                ].map((row) => (
                  <tr key={row.action}>
                    <td className="px-4 py-3 text-muted-foreground">{row.action}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {row.keys.map((k, i) => (
                          <span key={k} className="flex items-center gap-1">
                            <Key>{k}</Key>
                            {i < row.keys.length - 1 && <span className="text-muted-foreground text-xs">+</span>}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      },
      {
        title: "Нужна помощь?",
        content: (
          <div className="space-y-3">
            <Success>
              Если вы не нашли ответ — опишите проблему в чате с ИИ-ассистентом. По вопросам работы системы (не законодательства) помогут наши технические специалисты.
            </Success>
            <div className="flex gap-3">
              <Link to="/chat" className="flex-1">
                <div className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm font-medium text-primary hover:bg-primary-soft/80 transition-colors">
                  <MessageSquare className="h-4 w-4" />
                  Открыть чат с ИИ
                </div>
              </Link>
              <Link to="/settings" className="flex-1">
                <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm font-medium hover:bg-muted/60 transition-colors">
                  <RefreshCw className="h-4 w-4" />
                  Настройки
                </div>
              </Link>
            </div>
          </div>
        ),
      },
    ],
  },
];

// ── Main Page ─────────────────────────────────────────────────

const InstructionsPage = () => {
  const [activeId, setActiveId] = useState("start");
  const [search, setSearch] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  const filteredTopics = search.trim()
    ? TOPICS.filter(
        (t) =>
          t.label.toLowerCase().includes(search.toLowerCase()) ||
          t.sections.some((s) =>
            s.title.toLowerCase().includes(search.toLowerCase())
          )
      )
    : TOPICS;

  const activeTopic = TOPICS.find((t) => t.id === activeId) ?? TOPICS[0];

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeId]);

  return (
    <AppLayout
      title="Инструкции"
      subtitle="Руководство по работе с системой"
    >
      <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl gap-0 overflow-hidden rounded-xl border border-border shadow-card px-4 md:px-6">

        {/* ── Left sidebar ─────────────────────────────────── */}
        <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-muted/20">
          {/* Search */}
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск..."
                className="h-8 pl-8 text-sm bg-background"
              />
            </div>
          </div>

          {/* Topics */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {filteredTopics.length === 0 && (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">Ничего не найдено</p>
            )}
            {filteredTopics.map((topic) => {
              const isActive = topic.id === activeId;
              return (
                <button
                  key={topic.id}
                  onClick={() => { setActiveId(topic.id); setSearch(""); }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                    isActive
                      ? "bg-primary-soft text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <topic.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="flex-1 truncate text-sm">{topic.label}</span>
                  {topic.badge && (
                    <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
                      NEW
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Version */}
          <div className="border-t border-border p-3">
            <p className="text-[10px] text-muted-foreground text-center">Ассистент 223-ФЗ · v1.0</p>
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────── */}
        <div ref={contentRef} className="flex-1 overflow-y-auto bg-background">
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft">
                <activeTopic.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">{activeTopic.label}</h2>
                <p className="text-xs text-muted-foreground">
                  {activeTopic.sections.length} {activeTopic.sections.length === 1 ? "раздел" : "раздела"}
                </p>
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="px-6 py-6 space-y-8">
            {activeTopic.sections.map((section, i) => (
              <section key={i}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                </div>
                <div className="ml-9">{section.content}</div>
                {i < activeTopic.sections.length - 1 && (
                  <div className="mt-8 border-t border-border/60" />
                )}
              </section>
            ))}

            {/* Navigation between topics */}
            <div className="border-t border-border pt-6 flex justify-between gap-3">
              {(() => {
                const idx = TOPICS.findIndex((t) => t.id === activeId);
                const prev = TOPICS[idx - 1];
                const next = TOPICS[idx + 1];
                return (
                  <>
                    {prev ? (
                      <button
                        onClick={() => setActiveId(prev.id)}
                        className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
                      >
                        <ChevronRight className="h-4 w-4 rotate-180" />
                        <span className="hidden sm:inline">{prev.label}</span>
                        <span className="sm:hidden">Назад</span>
                      </button>
                    ) : <div />}
                    {next && (
                      <button
                        onClick={() => setActiveId(next.id)}
                        className="flex items-center gap-2 rounded-lg border border-border bg-primary-soft px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        <span className="hidden sm:inline">{next.label}</span>
                        <span className="sm:hidden">Далее</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default InstructionsPage;
