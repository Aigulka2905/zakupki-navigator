import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

// Инструкции для заказчика — по его меню и по реальным кнопкам: вход с площадки «Торги РФ»
// (без регистрации), проверка документации со сверкой с Положением о закупке, НМЦ с поиском
// в ЕИС у позиции. Раньше заказчику показывались регистрация, «Анализ документа» (такой
// страницы нет) и устаревшие шаги НМЦ.
let orgType = "customer";
vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ data: { id: "u1", role: "specialist", organization: { id: "o1", orgType } } }),
}));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import InstructionsPage from "./InstructionsPage";

// В jsdom у элементов нет scrollTo (страница прокручивает текст к началу при смене раздела).
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

const renderPage = () => render(<MemoryRouter><InstructionsPage /></MemoryRouter>);
const topicLabels = () => within(screen.getByRole("navigation", { name: "Разделы инструкции" }))
  .getAllByRole("button").map((b) => b.textContent?.replace(/NEW$/, "").trim());

describe("InstructionsPage: заказчик", () => {
  it("разделы — в порядке меню заказчика, без биллинга и «Анализа документа»", () => {
    orgType = "customer";
    renderPage();
    expect(topicLabels()).toEqual([
      "Начало работы", "Чат с ассистентом", "Мои закупки и сроки", "Проверка документации",
      "Положение о закупке", "Анализ заявок", "Обоснование НМЦ", "Цены в магазинах",
      "Проверка поставщиков", "Национальный режим", "Профиль организации", "История и настройки",
      "Безопасность", "Вопросы и ответы",
    ]);
  });

  it("вход — через кабинет «Торги РФ», регистрации нет", () => {
    orgType = "customer";
    renderPage();
    expect(screen.getByText("Вход через «Торги РФ»")).toBeInTheDocument();
    expect(screen.queryByText(/вкладку «Регистрация»/)).not.toBeInTheDocument();
  });

  it("поиск по инструкции находит «Найти в ЕИС» в обосновании НМЦ", () => {
    orgType = "customer";
    renderPage();
    fireEvent.change(screen.getByPlaceholderText("Поиск..."), { target: { value: "Найти в ЕИС" } });
    expect(topicLabels()).toContain("Обоснование НМЦ");
  });

  it("раздел о Положении — шаги загрузки", () => {
    orgType = "customer";
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Положение о закупке/ }));
    expect(screen.getAllByText(/Загрузить Положение/).length).toBeGreaterThan(0);
  });
});

describe("InstructionsPage: поставщик", () => {
  it("биллинг остаётся у поставщика", () => {
    orgType = "participant";
    renderPage();
    expect(topicLabels()).toContain("Биллинг и оплата");
    expect(topicLabels()).not.toContain("Положение о закупке");
  });
});
