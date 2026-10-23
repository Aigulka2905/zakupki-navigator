import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

// Некорректный ИНН в списке молча пропадал из проверки — пользователь думал, что
// проверены все участники.
const post = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { post: (url: string, body: unknown) => post(url, body) } }));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import BatchCheckPage from "./BatchCheckPage";

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({ data: { results: [{ inn: "7707083893", found: true, name: "ПАО Сбербанк", status: "Действует", level: "green", flags: [] }] } });
});

function runWith(text: string) {
  render(<MemoryRouter><BatchCheckPage /></MemoryRouter>);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /Проверить всех/ }));
}

describe("BatchCheckPage: некорректные ИНН", () => {
  it("проверяются корректные, пропущенные показаны с причиной", async () => {
    runWith("7707083893\n12345\n7707083894");
    await waitFor(() => expect(post).toHaveBeenCalledWith("/checko/batch", { inns: ["7707083893"] }));
    expect(await screen.findByText(/Не проверены/)).toBeInTheDocument();
    expect(screen.getByText(/12345: 5 цифр/)).toBeInTheDocument();
    expect(screen.getByText(/7707083894: неверная контрольная цифра/)).toBeInTheDocument();
  });

  it("ни одного корректного — запрос не уходит, причины видны", async () => {
    runWith("12345");
    expect(await screen.findByText(/12345: 5 цифр/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
