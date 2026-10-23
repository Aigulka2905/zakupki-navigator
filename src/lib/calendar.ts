import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";

// Видимая сетка месяца в календаре: с понедельника первой недели до конца последней.
// to — не включается (начало следующего дня), как в фильтре API deadlineTo.
export function monthGridRange(month: Date): { from: Date; to: Date } {
  const from = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const to = addDays(endOfWeek(endOfMonth(month), { weekStartsOn: 1 }), 1);
  to.setHours(0, 0, 0, 0);
  return { from, to };
}

// Все страницы выдачи (лимит страницы API — 200), не больше maxPages.
export async function collectPages<T>(
  fetchPage: (page: number) => Promise<{ data: T[]; total: number }>,
  maxPages = 10,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const { data, total } = await fetchPage(page);
    items.push(...data);
    if (data.length === 0 || items.length >= total) break;
  }
  return items;
}
