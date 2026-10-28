import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Прод «только для заказчиков»: регистрация закрыта (вход — из кабинета площадки),
// приглашение в организацию работает; отказ входа поставщику объяснён.
const get = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { get: (url: string) => get(url), post: vi.fn() } }));

import LoginPage from "./LoginPage";

const renderAt = (url: string) => render(<MemoryRouter initialEntries={[url]}><LoginPage /></MemoryRouter>);

beforeEach(() => {
  get.mockReset();
  get.mockImplementation(async (url: string) => {
    if (url === "/auth/config") return { data: { registrationEnabled: false, orgTypes: ["customer"] } };
    if (url.startsWith("/auth/invite/")) return { data: { organizationName: "АО «Росхим»", email: "a@b.ru" } };
    return { data: {} };
  });
});

describe("LoginPage: только для заказчиков", () => {
  it("регистрация закрыта — вкладки нет, подсказка о входе с площадки", async () => {
    renderAt("/login");
    expect(await screen.findByText(/Входите из личного кабинета своей электронной площадки/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Регистрация" })).not.toBeInTheDocument();
  });

  it("по ссылке-приглашению форма регистрации доступна", async () => {
    renderAt("/login?invite=tok");
    expect(await screen.findByText(/АО «Росхим»/)).toBeInTheDocument();
  });

  it("отказ входа поставщику с площадки — понятное сообщение", async () => {
    renderAt("/login?sso_error=org_type");
    expect(await screen.findByText("Ассистент сейчас доступен только заказчикам.")).toBeInTheDocument();
  });

  it("регистрация открыта (dev) — вкладка есть", async () => {
    get.mockImplementation(async () => ({ data: { registrationEnabled: true, orgTypes: ["customer", "participant"] } }));
    renderAt("/login");
    expect(await screen.findByRole("button", { name: "Регистрация" })).toBeInTheDocument();
  });
});
