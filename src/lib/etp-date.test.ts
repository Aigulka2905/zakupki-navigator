import { describe, it, expect } from "vitest";
import { parseEtpDate } from "./etp-date";

// Даты лотов приходят с площадки без пояса и означают московское время.
describe("parseEtpDate", () => {
  it("строка площадки без пояса — московское время", () => {
    expect(parseEtpDate("2026-10-29 12:00:00")?.toISOString()).toBe("2026-10-29T09:00:00.000Z");
  });

  it("дата из нашего API (ISO с Z) не сдвигается", () => {
    expect(parseEtpDate("2026-10-29T09:00:00.000Z")?.toISOString()).toBe("2026-10-29T09:00:00.000Z");
  });

  it("пусто или мусор — null", () => {
    expect(parseEtpDate("")).toBeNull();
    expect(parseEtpDate(undefined)).toBeNull();
    expect(parseEtpDate("не дата")).toBeNull();
  });
});
