import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";

// Прод «только для заказчиков»: API отвечает поставщику 403 ORG_TYPE_NOT_ALLOWED — сессия
// бесполезна, клиент выходит на страницу входа с объяснением (а не показывает пустые страницы).
const clearTokens = vi.fn();
vi.mock("./auth", () => ({ tokenStorage: { getAccessToken: () => "t", clearTokens: () => clearTokens(), setAccessToken: vi.fn() } }));

import apiClient from "./api-client";

const reply = (status: number, data: unknown) => {
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    throw new AxiosError("fail", String(status), config, null, { status, statusText: "", headers: {}, config: { ...config, headers: new AxiosHeaders() }, data });
  };
};

beforeEach(() => {
  clearTokens.mockReset();
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
