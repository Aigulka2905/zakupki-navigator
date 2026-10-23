import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AiFeaturesTable } from "./AiFeaturesTable";

// Расходы ИИ по функциям — из журнала ai_usage_events. Раньше админка знала только чат и
// анализ документов, и было не видно, во что обходится, например, проверка заявок.
const FEATURES = [
  { feature: "bid_check", inputTokens: 30000, outputTokens: 5000, totalTokens: 35000, costKopecks: 2800 },
  { feature: "chat", inputTokens: 14000, outputTokens: 3000, totalTokens: 17000, costKopecks: 960 },
  { feature: "new_feature", inputTokens: 100, outputTokens: 0, totalTokens: 100, costKopecks: 0 },
];

describe("AiFeaturesTable", () => {
  it("русские названия функций, стоимость и доля в расходах", () => {
    render(<AiFeaturesTable features={FEATURES} title="По функциям" />);
    expect(screen.getByText("Проверка заявки")).toBeInTheDocument();
    expect(screen.getByText("Чат")).toBeInTheDocument();
    expect(screen.getByText(/28,00\s₽/)).toBeInTheDocument();
    expect(screen.getByText("74%")).toBeInTheDocument(); // 2800 из 3760
  });

  it("незнакомая функция — под своим кодом", () => {
    render(<AiFeaturesTable features={FEATURES} title="По функциям" />);
    expect(screen.getByText("new_feature")).toBeInTheDocument();
  });

  it("пусто — понятная строка", () => {
    render(<AiFeaturesTable features={[]} title="По функциям" />);
    expect(screen.getByText(/Расходов пока нет/)).toBeInTheDocument();
  });
});
