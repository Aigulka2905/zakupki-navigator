import { describe, it, expect } from "vitest";
import { tokensIncluded, balanceLow, priceRows } from "./billing";

// «Биллинг» показывал красное «Баланс заканчивается» и «≈47 ₽ за месяц», хотя поштучное
// списание за токены выключено (квотный режим: баланс тратится только на тариф). Цены
// моделей были зашиты на фронте и отстали от прайса Yandex — теперь приходят с сервера.
const billed = { isFree: false, tokensBilled: true, balanceKopecks: 1200 };
const quota = { isFree: false, tokensBilled: false, balanceKopecks: 1200 };

describe("tokensIncluded", () => {
  it("квотный режим — токены входят в тариф", () => {
    expect(tokensIncluded(quota)).toBe(true);
  });
  it("поштучное списание платной модели — не входят", () => {
    expect(tokensIncluded(billed)).toBe(false);
  });
  it("бесплатная модель — входят", () => {
    expect(tokensIncluded({ ...billed, isFree: true })).toBe(true);
  });
});

describe("balanceLow", () => {
  it("в квотном режиме малый баланс — не тревога", () => {
    expect(balanceLow(quota)).toBe(false);
  });
  it("при поштучном списании меньше 50 ₽ — тревога", () => {
    expect(balanceLow(billed)).toBe(true);
    expect(balanceLow({ ...billed, balanceKopecks: 5000 })).toBe(false);
  });
});

describe("priceRows", () => {
  it("строки из цен сервера с понятным названием и отметкой активной модели", () => {
    const rows = priceRows([{ model: "yandexgpt/rc", input: "0.80", output: "0.80" }, { model: "yandexgpt-lite/latest", input: "0.20", output: "0.20" }], "yandexgpt/rc");
    expect(rows).toEqual([
      { model: "yandexgpt/rc", label: "YandexGPT 5.1 Pro", input: "0.80", output: "0.80", active: true },
      { model: "yandexgpt-lite/latest", label: "YandexGPT Lite", input: "0.20", output: "0.20", active: false },
    ]);
  });
  it("незнакомая модель — под своим идентификатором", () => {
    expect(priceRows([{ model: "new/model", input: "1.00", output: "1.00" }])[0].label).toBe("new/model");
  });
});
