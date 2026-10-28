import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SsoProvidersCard } from "./SsoProvidersCard";
import {
  useCreateSsoProvider, useDeleteSsoProvider, useSsoProviders, useUpdateSsoProvider, type SsoProvider,
} from "@/hooks/useAdmin";

vi.mock("@/hooks/useAdmin", () => ({
  useSsoProviders: vi.fn(), useCreateSsoProvider: vi.fn(), useUpdateSsoProvider: vi.fn(), useDeleteSsoProvider: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const createMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();
const mutation = (mutate: unknown) => ({ mutate, isPending: false }) as never;

const RF: SsoProvider = {
  code: "rftorgi", name: "Торги РФ", baseUrl: "https://lk.rftorgi.ru", clientId: "zakupki-ai",
  hasClientSecret: true, enabled: true,
  callbackUrl: "https://ai.soderiz.ru/api/auth/sso/rftorgi/callback",
  startUrl: "https://ai.soderiz.ru/api/auth/sso/rftorgi/start?profile_id=<id профиля>",
  usersCount: 12, lastLoginAt: "2026-10-27T09:15:00Z", createdAt: "2026-10-21T00:00:00Z", updatedAt: "2026-10-21T00:00:00Z",
};
const AF: SsoProvider = {
  ...RF, code: "aftorgi", name: "АФ-Торги", baseUrl: "https://lk.af-torgi.ru", hasClientSecret: false, enabled: false,
  callbackUrl: "https://ai.soderiz.ru/api/auth/sso/aftorgi/callback",
  startUrl: "https://ai.soderiz.ru/api/auth/sso/aftorgi/start?profile_id=<id профиля>",
  usersCount: 0, lastLoginAt: null,
};

const withProviders = (data: SsoProvider[]) =>
  vi.mocked(useSsoProviders).mockReturnValue({ data, isLoading: false, isError: false } as never);

beforeEach(() => {
  createMutate.mockReset();
  updateMutate.mockReset();
  deleteMutate.mockReset();
  vi.mocked(useCreateSsoProvider).mockReturnValue(mutation(createMutate));
  vi.mocked(useUpdateSsoProvider).mockReturnValue(mutation(updateMutate));
  vi.mocked(useDeleteSsoProvider).mockReturnValue(mutation(deleteMutate));
});

describe("SsoProvidersCard", () => {
  it("список: статус, сколько входило, адреса для площадки", () => {
    withProviders([RF, AF]);
    render(<SsoProvidersCard />);

    expect(screen.getByText("Вход включён")).toBeInTheDocument();
    expect(screen.getByText("Не настроена: нет секрета")).toBeInTheDocument();
    expect(screen.getByText(/входили: 12, последний вход/)).toBeInTheDocument();
    expect(screen.getByText(/ещё никто не входил/)).toBeInTheDocument();
    expect(screen.getByText(RF.callbackUrl)).toBeInTheDocument();
    expect(screen.getByText(AF.startUrl)).toBeInTheDocument();
  });

  it("без секрета включить нельзя; переключатель включённой выключает вход", () => {
    withProviders([RF, AF]);
    render(<SsoProvidersCard />);

    expect(screen.getByRole("switch", { name: "Вход с «АФ-Торги»" })).toBeDisabled();
    fireEvent.click(screen.getByRole("switch", { name: "Вход с «Торги РФ»" }));
    expect(updateMutate).toHaveBeenCalledWith({ code: "rftorgi", enabled: false }, expect.any(Object));
  });

  it("через площадку входили — удалить нельзя; не входили — удаление после подтверждения", () => {
    withProviders([RF, AF]);
    render(<SsoProvidersCard />);

    expect(screen.getByRole("button", { name: "Удалить «Торги РФ»" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Удалить «АФ-Торги»" }));
    expect(deleteMutate).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Удалить" }));
    expect(deleteMutate).toHaveBeenCalledWith("aftorgi", expect.any(Object));
  });

  it("новая площадка: неверный код не сохраняется, верный уходит вместе с секретом", () => {
    withProviders([]);
    render(<SsoProvidersCard />);
    expect(screen.getByText(/Площадок пока нет/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Добавить площадку/ }));
    fireEvent.change(screen.getByLabelText("Код"), { target: { value: "1af" } });
    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "АФ-Торги" } });
    fireEvent.change(screen.getByLabelText("Адрес площадки"), { target: { value: "https://lk.af-torgi.ru" } });
    expect(screen.getByText(/Латиница в нижнем регистре/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Код"), { target: { value: "AFtorgi" } });
    fireEvent.change(screen.getByLabelText("Секрет клиента"), { target: { value: "s3cret" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(createMutate).toHaveBeenCalledWith(
      { code: "aftorgi", name: "АФ-Торги", baseUrl: "https://lk.af-torgi.ru", clientId: "zakupki-ai", clientSecret: "s3cret", enabled: false },
      expect.any(Object),
    );
  });

  it("правка: код заблокирован, пустой секрет не отправляется", () => {
    withProviders([RF]);
    render(<SsoProvidersCard />);

    fireEvent.click(screen.getByRole("button", { name: "Изменить «Торги РФ»" }));
    expect(screen.getByLabelText("Код")).toBeDisabled();
    expect(screen.getByLabelText("Секрет клиента")).toHaveValue("");
    expect(screen.getByPlaceholderText(/Задан — оставьте пустым/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Торги РФ (прод)" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    const [body] = updateMutate.mock.calls[0];
    expect(body).toEqual({ code: "rftorgi", name: "Торги РФ (прод)", baseUrl: RF.baseUrl, clientId: "zakupki-ai", enabled: true });
    expect(body).not.toHaveProperty("clientSecret");
  });
});
