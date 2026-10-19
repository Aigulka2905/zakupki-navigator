import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Заказчик: в карточке задачи пакета обещано «в колокольчике придёт уведомление».
vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ data: { fullName: "Иван Иванов", role: "specialist", organization: { orgType: "customer" } } }),
}));
vi.mock("@/hooks/useNotifications", () => ({
  useUnreadCount: () => ({ data: 7 }),
  useNotifications: () => ({ data: [] }),
  useMarkRead: () => ({ mutate: vi.fn() }),
  useMarkAllRead: () => ({ mutate: vi.fn() }),
}));
vi.mock("./ThemeToggle", () => ({ ThemeToggle: () => null }));

import { AppSidebar } from "./AppSidebar";
import { AppLayout } from "./AppLayout";

describe("уведомления у заказчика", () => {
  it("в меню есть «Уведомления» со ссылкой на /notifications и счётчиком непрочитанных", () => {
    render(<MemoryRouter><AppSidebar collapsed={false} onToggle={() => {}} /></MemoryRouter>);
    const link = screen.getByRole("link", { name: /Уведомления/ });
    expect(link).toHaveAttribute("href", "/notifications");
    expect(link).toHaveTextContent("7");
  });

  it("в шапке есть колокольчик", () => {
    render(<MemoryRouter><AppLayout title="Проверка"><p>x</p></AppLayout></MemoryRouter>);
    expect(screen.getByRole("button", { name: /Уведомления, 7 непрочитанных/ })).toBeInTheDocument();
  });
});
