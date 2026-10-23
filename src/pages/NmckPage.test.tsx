import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

// Обоснование НМЦ всегда ссылалось на 44-ФЗ, даже для закупок по 223-ФЗ. Теперь закон
// выбирается перед формированием и уходит на сервер (по умолчанию — 223-ФЗ).
const calc = {
  id: "c1", title: "Бумага офисная", status: "completed", createdAt: "2026-10-20T09:00:00.000Z",
  positions: [{ name: "Бумага А4", unit: "пачка", quantity: 10, prices: [
    { source: "КП 1", unitPrice: 300 }, { source: "КП 2", unitPrice: 310 }, { source: "КП 3", unitPrice: 320 },
  ] }],
  nmck: 3100, cvMax: 3.2, justification: null, sources: [{ name: "КП 1" }, { name: "КП 2" }, { name: "КП 3" }],
};
const get = vi.fn();
const post = vi.fn();
const put = vi.fn();

vi.mock("@/lib/api-client", () => ({ default: {
  get: (url: string) => get(url),
  post: (url: string, body: unknown) => post(url, body),
  put: (url: string, body: unknown) => put(url, body),
} }));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import NmckPage from "./NmckPage";

beforeEach(() => {
  get.mockReset(); post.mockReset(); put.mockReset();
  get.mockImplementation(async (url: string) => (url === "/nmck"
    ? { data: [{ id: "c1", title: calc.title, status: "completed", nmck: 3100, createdAt: calc.createdAt }] }
    : { data: calc }));
  put.mockResolvedValue({ data: calc });
  post.mockResolvedValue({ data: { ...calc, justification: "Текст обоснования" } });
});

async function openCalc() {
  render(<MemoryRouter><NmckPage /></MemoryRouter>);
  fireEvent.click(await screen.findByText(calc.title));
  return screen.findByRole("button", { name: /Сформировать обоснование/ });
}

describe("NmckPage: закон для обоснования", () => {
  it("по умолчанию — 223-ФЗ", async () => {
    fireEvent.click(await openCalc());
    await waitFor(() => expect(post).toHaveBeenCalledWith("/nmck/c1/justify", { law: "223" }));
  });

  it("выбран 44-ФЗ — уходит 44", async () => {
    const button = await openCalc();
    fireEvent.change(screen.getByLabelText("Закон закупки"), { target: { value: "44" } });
    fireEvent.click(button);
    await waitFor(() => expect(post).toHaveBeenCalledWith("/nmck/c1/justify", { law: "44" }));
  });
});
