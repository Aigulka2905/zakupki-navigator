import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { AccessSettingsCard } from "./AccessSettingsCard";
import { useAccessSettings, useUpdateAccessSettings, type AccessSettings } from "@/hooks/useAdmin";

vi.mock("@/hooks/useAdmin", () => ({ useAccessSettings: vi.fn(), useUpdateAccessSettings: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mutate = vi.fn();
const BOTH: AccessSettings = {
  orgTypes: ["customer", "participant"], registrationEnabled: true, source: "admin",
  updatedAt: "2026-10-28T07:00:00Z", updatedBy: "admin@zakupkiai.ru", usersByOrgType: { customer: 7, participant: 3 },
};
const withData = (data: AccessSettings) =>
  vi.mocked(useAccessSettings).mockReturnValue({ data, isLoading: false, isError: false } as never);

beforeEach(() => {
  mutate.mockReset();
  vi.mocked(useUpdateAccessSettings).mockReturnValue({ mutate, isPending: false } as never);
});

describe("AccessSettingsCard", () => {
  it("значения из окружения — так и сказано; кто и когда менял — если из админки", () => {
    withData({ ...BOTH, orgTypes: ["customer"], registrationEnabled: false, source: "env", updatedAt: null, updatedBy: null });
    const { unmount } = render(<AccessSettingsCard />);
    expect(screen.getByText(/значения из окружения сервера/)).toBeInTheDocument();
    unmount();

    withData(BOTH);
    render(<AccessSettingsCard />);
    expect(screen.getByText(/Изменено .*admin@zakupkiai\.ru/)).toBeInTheDocument();
  });

  it("без изменений сохранить нечего; последний тип не снимается", () => {
    withData({ ...BOTH, orgTypes: ["customer"] });
    render(<AccessSettingsCard />);
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Заказчики/ })).toBeDisabled();
  });

  it("закрыть регистрацию — сохраняется без подтверждения", () => {
    withData(BOTH);
    render(<AccessSettingsCard />);
    fireEvent.click(screen.getByRole("switch", { name: /Самостоятельная регистрация/ }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(mutate).toHaveBeenCalledWith({ orgTypes: ["customer", "participant"], registrationEnabled: false }, expect.any(Object));
  });

  it("закрыть поставщиков с пользователями — сначала подтверждение с числом", () => {
    withData(BOTH);
    render(<AccessSettingsCard />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Поставщики/ }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(mutate).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/3 пользователей-поставщиков потеряют доступ сразу/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Закрыть доступ" }));
    expect(mutate).toHaveBeenCalledWith({ orgTypes: ["customer"], registrationEnabled: true }, expect.any(Object));
  });
});
