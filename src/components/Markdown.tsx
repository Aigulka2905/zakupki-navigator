import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Скриншоты шагов инструкций ЭТП приходят от ассистента корневым путём
// «/api/etp-guide/media/…». Браузер резолвит его против origin СТРАНИЦЫ, а API
// может жить на другом origin (VITE_API_URL) — тогда картинка уходит мимо бэкенда
// и ломается, хотя все XHR работают. Приводим такие пути к той же базе, что
// использует api-client, иначе поведение расходится между dev и prod.
const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

function resolveApiSrc(src?: string): string | undefined {
  if (!src?.startsWith("/api/")) return src;
  return API_BASE + src.slice("/api".length);
}

/**
 * Безопасный рендер markdown от ИИ (таблицы, жирный, списки, код).
 * react-markdown НЕ рендерит сырой HTML (rehype-raw не подключаем) → нет XSS
 * из вывода модели. remark-gfm добавляет таблицы/strikethrough/таск-листы.
 */
export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none break-words",
        // компактные отступы под чат-пузырь
        "prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:font-semibold",
        "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5",
        // Таблицы: авто-ширина + мин-ширина ячеек, чтобы колонки не схлопывались
        // (широкие таблицы скроллятся по горизонтали, а не давятся в пузырь).
        "prose-table:my-2 prose-table:w-auto",
        "prose-th:px-2.5 prose-th:py-1.5 prose-th:align-top prose-th:min-w-[110px]",
        "prose-td:px-2.5 prose-td:py-1.5 prose-td:align-top prose-td:min-w-[110px]",
        "prose-pre:my-2 prose-pre:text-[13px] prose-code:text-[13px]",
        "prose-a:text-indigo-500 hover:prose-a:text-indigo-400",
        // Скриншоты шагов инструкций ЭТП: рамка отделяет кадр интерфейса от
        // текста ответа, иначе светлый скриншот сливается с пузырём.
        "prose-img:my-2 prose-img:rounded-lg prose-img:border prose-img:border-border",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Широкие таблицы скроллим, чтобы не ломать вёрстку пузыря
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto">
              <table {...props} />
            </div>
          ),
          // Внешние ссылки — в новой вкладке и безопасно
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          // Скриншот шага: в пузыре он мелкий, детали интерфейса не разобрать —
          // клик открывает кадр в полный размер. loading=lazy: в длинном ответе
          // с инструкцией кадров может быть с десяток.
          img: ({ node, src, alt, ...props }) => {
            const resolved = resolveApiSrc(typeof src === "string" ? src : undefined);
            return (
              <a href={resolved} target="_blank" rel="noopener noreferrer">
                <img {...props} src={resolved} alt={alt ?? ""} loading="lazy" />
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
