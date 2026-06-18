import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

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
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
