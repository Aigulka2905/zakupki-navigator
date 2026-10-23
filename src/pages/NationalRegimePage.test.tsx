import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// «Национальный режим» ссылался на ПП-616/878/925, утратившие силу с 01.01.2025. Теперь —
// ПП-1875: запрет (прил. 1), ограничение (прил. 2), преимущество 15% для остальных товаров,
// минимальная доля по 223-ФЗ (прил. 3).
const get = vi.fn();
vi.mock("@/lib/api-client", () => ({ default: { get: (url: string) => get(url) } }));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/Reveal", () => ({ Reveal: ({ children }: { children: ReactNode }) => <>{children}</> }));

import NationalRegimePage from "./NationalRegimePage";

const META = { version: "2026.09", lastUpdated: "2026-09-30", edition: "ред. от 30.09.2026 № 1264", sourceUrl: "http://government.ru/docs/all/157130/" };

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter><NationalRegimePage /></MemoryRouter></QueryClientProvider>);
}

async function search(code: string) {
  renderPage();
  fireEvent.change(screen.getByPlaceholderText(/Например/), { target: { value: code } });
  fireEvent.keyDown(screen.getByPlaceholderText(/Например/), { key: "Enter" });
}

// Без фигурных скобок vitest принял бы возвращённый мок за функцию очистки и вызвал его.
beforeEach(() => { get.mockReset(); });

describe("NationalRegimePage", () => {
  it("справка — по ПП-1875, без отменённых постановлений", () => {
    get.mockResolvedValue({ data: [] });
    renderPage();
    expect(screen.getAllByText(/№ 1875/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/ПП-(616|878|925|102|649)/)).not.toBeInTheDocument();
  });

  it("товар вне перечней — «Преимущество 15%», минимальная доля и редакция справочника", async () => {
    get.mockImplementation(async (url: string) => (url.includes("suggest") ? { data: [] } : { data: {
      okpd: "08.12.12.140", found: false, topRegime: "preference", partial: false,
      summary: "Преимущество 15%: товар не входит в перечни запрета и ограничения.",
      matches: [], insideTotal: 0, aiExplanation: null, meta: META,
      minShare: [{ position: "1", name: "Щебень", okpd: "08.12.12.140", share: 80, scope: "covers" }],
    } }));
    await search("08.12.12.140");
    expect((await screen.findAllByText("Преимущество 15%")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Минимальная доля/)).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText(/ред\. от 30\.09\.2026 № 1264/)).toBeInTheDocument();
    expect(screen.queryByText(/ПП-925/)).not.toBeInTheDocument();
  });

  it("широкий код: позиция приложения и пометка «часть кода»", async () => {
    get.mockImplementation(async (url: string) => (url.includes("suggest") ? { data: [] } : { data: {
      okpd: "26.20", found: true, topRegime: "restriction", partial: true, summary: "Ограничение",
      matches: [{
        okpd: "26.20.11.110", name: "Компьютеры портативные", regime: "restriction", appendix: 2, position: "195", scope: "inside",
        decrees: ["ПП-1875"], summary: "Ограничение («второй лишний»)", practicalNote: "Позиция применяется, только если…",
        decreesDetail: [{ number: "1875", date: "23.12.2024", fullTitle: "ПП РФ от 23.12.2024 № 1875, приложение № 2, позиция 195", description: "", regimeType: "", laws: ["44-ФЗ", "223-ФЗ"], note: "" }],
      }],
      insideTotal: 1, minShare: [], aiExplanation: null, meta: META,
    } }));
    await search("26.20");
    expect(await screen.findByText(/для части товаров/i)).toBeInTheDocument();
    expect(screen.getByText(/Приложение № 2, позиция 195/)).toBeInTheDocument();
    expect(screen.getByText(/часть кода/)).toBeInTheDocument();
  });
});
