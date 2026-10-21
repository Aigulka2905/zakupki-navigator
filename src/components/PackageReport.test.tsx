import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PackageReport } from "./PackageReport";

describe("PackageReport", () => {
  it("итог по файлам и строка на каждый файл; раскрыт, если что-то не проверено", () => {
    const { container } = render(<PackageReport files={[
      { name: "ТЗ.docx", kind: "text", chars: 1000, checked: "ai", note: "" },
      { name: "АР3.pdf", kind: "drawing", chars: 500, checked: "brand-scan", note: "чертёж — найдены марки" },
      { name: "Скан.pdf", kind: "scan", chars: 0, checked: "none", note: "нет текстового слоя" },
    ]} />);
    expect(screen.getByText(/Что проверено: файлов 3 — ИИ 1, поиск марок 1, не проверено 1/)).toBeInTheDocument();
    expect(screen.getByText("АР3.pdf")).toBeInTheDocument();
    expect(screen.getByText("чертёж")).toBeInTheDocument();
    expect(container.querySelector("details")?.open).toBe(true);
  });
  it("нет отчёта (старая проверка) — ничего не рисует", () => {
    const { container } = render(<PackageReport files={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
