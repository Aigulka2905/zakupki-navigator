import { describe, it, expect } from "vitest";
import { actionLabel, actionDetails, actionHref } from "./audit-actions";

// Подписи действий журнала — общие для «Истории» и «Аудита»: понятное название вместо кода,
// короткая подробность из данных журнала и раздел, где действие можно открыть.
describe("audit-actions", () => {
  it("понятные названия действий, неизвестное — кодом", () => {
    expect(actionLabel("nmck.create")).toBe("Расчёт НМЦ");
    expect(actionLabel("bid_check.run")).toBe("Проверка заявок");
    expect(actionLabel("admin.impersonate.start")).toBe("Вход под пользователем");
    expect(actionLabel("something.new")).toBe("something.new");
  });

  it("подробности: файлы, суммы, количества", () => {
    expect(actionDetails({ sources: 3 })).toBe("источников цен: 3");
    expect(actionDetails({ fileName: "Положение.pdf" })).toBe("Положение.pdf");
    // Суммы — как в остальном приложении (неразрывные пробелы Intl сводим к обычным).
    const norm = (s: string | null) => s?.replace(/\s/g, " ");
    expect(norm(actionDetails({ number: 3, amountRubles: "1000.00" }))).toBe("№ 3 · 1 000 ₽");
    expect(norm(actionDetails({ amountKopecks: 99000 }))).toBe("990 ₽");
    expect(actionDetails({ from: "specialist", to: "viewer" })).toBe("specialist → viewer");
    expect(actionDetails(null)).toBeNull();
    expect(actionDetails({ resultId: "x" })).toBeNull();
  });

  it("куда перейти по действию", () => {
    expect(actionHref("nmck.create", "n1")).toBe("/nmck");
    expect(actionHref("bid_evaluation.create", "e1")).toBe("/bid-evaluation?id=e1");
    expect(actionHref("procurement_policy.upload", "p1")).toBe("/organization");
    expect(actionHref("procurement.update", "p1")).toBe("/procurements/p1");
    expect(actionHref("procurement.delete", "p1")).toBeNull();
    expect(actionHref("admin.plan_update", "o1")).toBeNull();
  });
});
