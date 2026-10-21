import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

// «Настройки» показывали зашитые «Иванов Иван Иванович» и ООО «Ромашка» вместо
// данных учётной записи. Профиль и организация — из /auth/me.
const user = {
  id: "u1",
  email: "aigulka2905@mail.ru",
  fullName: "Муфтахова Айгуль Айратовна",
  role: "specialist",
  organizationId: "o1",
  organization: { id: "o1", name: "ООО «Содериз»", inn: "1655123456", kpp: "165501001", orgType: "participant" },
};
let current: { data: typeof user | undefined; isLoading: boolean } = { data: user, isLoading: false };

vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => current }));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/TwoFactorCard", () => ({ TwoFactorCard: () => null }));
vi.mock("@/components/Reveal", () => ({ Reveal: ({ children }: { children: ReactNode }) => <>{children}</> }));

import SettingsPage from "./SettingsPage";

const renderPage = () => render(<MemoryRouter><SettingsPage /></MemoryRouter>);

describe("SettingsPage", () => {
  it("показывает ФИО и почту пользователя, реквизиты его организации", () => {
    current = { data: user, isLoading: false };
    renderPage();
    expect(screen.getByText("Муфтахова Айгуль Айратовна")).toBeInTheDocument();
    expect(screen.getByText("aigulka2905@mail.ru")).toBeInTheDocument();
    expect(screen.getByText("ООО «Содериз»")).toBeInTheDocument();
    expect(screen.getByText("1655123456")).toBeInTheDocument();
    expect(screen.getByText("165501001")).toBeInTheDocument();
    expect(screen.getByText("Участник")).toBeInTheDocument();
    expect(screen.queryByText(/Иванов|Ромашка|7701234567/)).not.toBeInTheDocument();
  });

  it("реквизиты меняются в «Профиле организации», пароль — через восстановление по почте", () => {
    current = { data: user, isLoading: false };
    renderPage();
    expect(screen.getByRole("link", { name: /Изменить в «Профиле организации»/ })).toHaveAttribute("href", "/organization");
    expect(screen.getByRole("link", { name: /Сменить пароль/ })).toHaveAttribute("href", "/forgot-password");
  });

  it("нет кнопки «Сохранить изменения», которая ничего не сохраняла", () => {
    current = { data: user, isLoading: false };
    renderPage();
    expect(screen.queryByRole("button", { name: /Сохранить изменения/ })).not.toBeInTheDocument();
  });

  it("пока данные загружаются, заглушек нет", () => {
    current = { data: undefined, isLoading: true };
    renderPage();
    expect(screen.queryByText(/Иванов|Ромашка/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Загрузка…").length).toBeGreaterThan(0);
  });
});
