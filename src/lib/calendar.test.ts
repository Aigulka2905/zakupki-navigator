import { describe, it, expect } from "vitest";
import { monthGridRange, collectPages } from "./calendar";

// Календарь запрашивает закупки видимой сетки месяца (с понедельника первой недели до
// конца последней), а не 200 самых ранних «активных» — те оказывались в прошлом.
describe("monthGridRange", () => {
  it("октябрь 2026: с пн 28 сентября до пн 2 ноября (конец не включается)", () => {
    const { from, to } = monthGridRange(new Date(2026, 9, 15));
    expect([from.getFullYear(), from.getMonth(), from.getDate(), from.getDay()]).toEqual([2026, 8, 28, 1]);
    expect([to.getFullYear(), to.getMonth(), to.getDate(), to.getDay()]).toEqual([2026, 10, 2, 1]);
  });

  it("месяц, начинающийся в понедельник: с 1-го числа", () => {
    const { from } = monthGridRange(new Date(2026, 5, 10)); // июнь 2026 начинается в пн
    expect([from.getMonth(), from.getDate()]).toEqual([5, 1]);
  });
});

// В окне месяца бывает больше 200 закупок (лимит страницы API) — в октябре 2026 их 518:
// без догрузки конец месяца оставался пустым.
describe("collectPages", () => {
  const pages = (total: number, size: number) => async (page: number) => ({
    data: Array.from({ length: Math.max(0, Math.min(size, total - (page - 1) * size)) }, (_, i) => (page - 1) * size + i),
    total,
  });

  it("собирает все страницы до total", async () => {
    expect(await collectPages(pages(518, 200))).toHaveLength(518);
  });

  it("не больше maxPages страниц", async () => {
    expect(await collectPages(pages(5000, 200), 3)).toHaveLength(600);
  });

  it("пустой ответ — пустой список", async () => {
    expect(await collectPages(pages(0, 200))).toEqual([]);
  });
});
