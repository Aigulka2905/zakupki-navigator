import { describe, it, expect } from "vitest";
import { rejectReason, freeSlot, formatBytes, PACKAGE_LIMITS } from "./package-upload";

const MB = 1024 * 1024;

describe("rejectReason", () => {
  const empty = { count: 0, totalBytes: 0 };
  it("принимает документы допустимых форматов", () => {
    expect(rejectReason({ name: "ТЗ.PDF", size: 10 }, empty)).toBeNull();
    expect(rejectReason({ name: "Смета.xlsx", size: 10 }, empty)).toBeNull();
  });
  it("отказ: формат, размер файла, число файлов, объём пакета", () => {
    expect(rejectReason({ name: "чертёж.dwg", size: 10 }, empty)).toMatch(/Формат/);
    expect(rejectReason({ name: "a.pdf", size: 51 * MB }, empty)).toBe("Файл больше 50 МБ");
    expect(rejectReason({ name: "a.pdf", size: 1 }, { count: 50, totalBytes: 0 })).toMatch(/50 файлов/);
    expect(rejectReason({ name: "a.pdf", size: 2 * MB }, { count: 1, totalBytes: PACKAGE_LIMITS.maxTotalBytes - MB })).toMatch(/1 ГБ/);
  });
});

describe("freeSlot", () => {
  it("наименьший свободный номер; null, если заняты все 20", () => {
    expect(freeSlot([])).toBe(0);
    expect(freeSlot([0, 1, 3])).toBe(2);
    expect(freeSlot(Array.from({ length: 20 }, (_, i) => i))).toBeNull();
  });
});

describe("formatBytes", () => {
  it("КБ и МБ по-русски", () => {
    expect(formatBytes(1536)).toBe("2 КБ");
    expect(formatBytes(12.34 * MB)).toBe("12,3 МБ");
  });
});
