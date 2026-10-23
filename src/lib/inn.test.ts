import { describe, it, expect } from "vitest";
import { isValidInn, parseInnList } from "./inn";

// Массовая проверка разбирала ввод регуляркой \d{10,12}: короткий номер молча пропадал,
// 11 цифр принимались за ИНН, опечатка в цифре давала «не найден» вместо «ошибка в ИНН».
describe("isValidInn — контрольные цифры ФНС", () => {
  it("верные: юрлицо (10) и физлицо/ИП (12)", () => {
    expect(isValidInn("7707083893")).toBe(true);   // ПАО Сбербанк
    expect(isValidInn("500100732259")).toBe(true);
  });
  it("опечатка в цифре — неверный", () => {
    expect(isValidInn("7707083894")).toBe(false);
    expect(isValidInn("500100732258")).toBe(false);
  });
  it("не 10 и не 12 цифр — неверный", () => {
    expect(isValidInn("77070838")).toBe(false);
    expect(isValidInn("77070838931")).toBe(false);
  });
});

describe("parseInnList", () => {
  it("разделители: строки, запятые, точки с запятой, пробелы; без повторов", () => {
    expect(parseInnList("7707083893,\n500100732259; 7707083893").inns).toEqual(["7707083893", "500100732259"]);
  });
  it("всё, что не прошло, — в списке пропущенных с причиной", () => {
    const r = parseInnList("7707083893 12345 77070838931 7707083894 ООО");
    expect(r.inns).toEqual(["7707083893"]);
    expect(r.invalid).toEqual([
      { value: "12345", reason: "5 цифр — нужно 10 или 12" },
      { value: "77070838931", reason: "11 цифр — нужно 10 или 12" },
      { value: "7707083894", reason: "неверная контрольная цифра" },
      { value: "ООО", reason: "не число" },
    ]);
  });
  it("склонение числа цифр", () => {
    expect(parseInnList("1 12 123456789012345678901").invalid.map((x) => x.reason)).toEqual([
      "1 цифра — нужно 10 или 12", "2 цифры — нужно 10 или 12", "21 цифра — нужно 10 или 12",
    ]);
  });
  it("пустой ввод", () => {
    expect(parseInnList("  \n ")).toEqual({ inns: [], invalid: [] });
  });
});
