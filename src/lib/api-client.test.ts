import { describe, it, expect, vi, beforeEach } from "vitest";
import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";

// Прод «только для заказчиков»: API отвечает поставщику 403 ORG_TYPE_NOT_ALLOWED — сессия
// бесполезна, клиент выходит на страницу входа с объяснением (а не показывает пустые страницы).
// Вход администратора «под пользователем»: когда 5-минутный токен истёк, сессию нельзя молча
// продлить по cookie администратора (иначе на экране «пользователь», а данные — админа) —
// администратор возвращается в админку.
const clearTokens = vi.fn();
const setTokens = vi.fn();
const imp: { current: { id: string; email: string } | null } = { current: null };
const clearImpersonation = vi.fn(() => { imp.current = null; });
vi.mock("./auth", () => ({
  tokenStorage: { getAccessToken: () => "t", clearTokens: () => clearTokens(), setTokens: (t: string) => setTokens(t) },
  impersonation: { get: () => imp.current, clear: () => clearImpersonation() },
}));

import apiClient from "./api-client";

let calls = 0;
const reply = (status: number, data: unknown) => {
  calls = 0;
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    calls++;
    throw new AxiosError("fail", String(status), config, null, { status, statusText: "", headers: {}, config: { ...config, headers: new AxiosHeaders() }, data });
  };
};
const refresh = vi.spyOn(axios, "post");

beforeEach(() => {
  clearTokens.mockReset(); setTokens.mockReset(); clearImpersonation.mockClear(); refresh.mockReset();
  imp.current = null;
  Object.defineProperty(window, "location", { value: { href: "/nmck" }, writable: true });
});

describe("api-client: организация не допущена", () => {
  it("403 ORG_TYPE_NOT_ALLOWED — выход на страницу входа с объяснением", async () => {
    reply(403, { error: "Сервис сейчас доступен только заказчикам.", code: "ORG_TYPE_NOT_ALLOWED" });
    await expect(apiClient.get("/nmck")).rejects.toBeTruthy();
    expect(clearTokens).toHaveBeenCalled();
    expect(window.location.href).toBe("/login?sso_error=org_type");
  });

  it("другой 403 (например, нет прав) — сессия остаётся", async () => {
    reply(403, { error: "Недостаточно прав" });
    await expect(apiClient.get("/admin")).rejects.toBeTruthy();
    expect(clearTokens).not.toHaveBeenCalled();
    expect(window.location.href).toBe("/nmck");
  });
});

describe("api-client: администратор под пользователем", () => {
  it("401 (вход истёк) — сессия администратора возвращается явно, админка с объяснением; запрос не повторяется", async () => {
    imp.current = { id: "u1", email: "a@b.ru" };
    refresh.mockResolvedValue({ data: { accessToken: "admin-token" } });
    reply(401, { error: "Invalid or expired token" });
    await expect(apiClient.get("/history")).rejects.toBeTruthy();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(clearImpersonation).toHaveBeenCalled();
    expect(setTokens).toHaveBeenCalledWith("admin-token");
    expect(window.location.href).toBe("/admin?tab=users&imp_end=expired");
    expect(calls).toBe(1);
  });

  it("несколько 401 одновременно — одно обновление сессии администратора", async () => {
    imp.current = { id: "u1", email: "a@b.ru" };
    refresh.mockResolvedValue({ data: { accessToken: "admin-token" } });
    reply(401, {});
    await Promise.allSettled([apiClient.get("/history"), apiClient.get("/assistant/sessions")]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("403 ORG_TYPE_NOT_ALLOWED под пользователем — назад в админку, сессия администратора не теряется", async () => {
    imp.current = { id: "u1", email: "a@b.ru" };
    refresh.mockResolvedValue({ data: { accessToken: "admin-token" } });
    reply(403, { code: "ORG_TYPE_NOT_ALLOWED" });
    await expect(apiClient.get("/nmck")).rejects.toBeTruthy();
    expect(window.location.href).toBe("/admin?tab=users&imp_end=org_type");
    expect(clearTokens).not.toHaveBeenCalled();
  });

  it("сессия администратора тоже истекла — на страницу входа", async () => {
    imp.current = { id: "u1", email: "a@b.ru" };
    refresh.mockRejectedValue(new Error("401"));
    reply(401, {});
    await expect(apiClient.get("/history")).rejects.toBeTruthy();
    expect(clearTokens).toHaveBeenCalled();
    expect(window.location.href).toBe("/login");
  });
});
