import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Полоса «Вы вошли как …» на всех страницах, пока администратор под пользователем,
// и кнопка «Вернуться в админку».
const returnToAdmin = vi.fn(async () => {});
vi.mock("@/lib/api-client", () => ({ returnToAdmin: () => returnToAdmin() }));

import { ImpersonationBanner } from "./ImpersonationBanner";
import { impersonation } from "@/lib/auth";

beforeEach(() => { localStorage.clear(); returnToAdmin.mockClear(); });

describe("ImpersonationBanner", () => {
  it("обычная сессия — полосы нет", () => {
    const { container } = render(<ImpersonationBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("под пользователем — кто это и возврат в админку", () => {
    impersonation.start({ id: "u1", email: "a@b.ru", fullName: "Иванова Анна" });
    render(<ImpersonationBanner />);
    expect(screen.getByText(/Вы вошли как/)).toHaveTextContent("Иванова Анна (a@b.ru)");
    fireEvent.click(screen.getByRole("button", { name: "Вернуться в админку" }));
    expect(returnToAdmin).toHaveBeenCalled();
  });
});
