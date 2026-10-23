import { describe, it, expect } from "vitest";
import { priceLabel } from "./money";

// У закупок без цены (площадка не прислала НМЦ) сервер отдаёт "0.00" — непустая строка
// проходила проверку `p.initialPrice &&`, и на главной, в списке и календаре было «0 ₽».
const nb = (s: string | null) => s?.replace(/\s/g, " ");

describe("priceLabel", () => {
  it("нет цены — null", () => {
    expect(priceLabel("0.00")).toBeNull();
    expect(priceLabel(0)).toBeNull();
    expect(priceLabel(null)).toBeNull();
    expect(priceLabel(undefined)).toBeNull();
    expect(priceLabel("")).toBeNull();
    expect(priceLabel("abc")).toBeNull();
  });
  it("рубли без копеек", () => {
    expect(nb(priceLabel("125400.50"))).toBe("125 401 ₽");
  });
  it("от миллиона — коротко", () => {
    expect(nb(priceLabel("2500000"))).toBe("2,5 млн ₽");
  });
  it("compact: false — полностью", () => {
    expect(nb(priceLabel("2500000", { compact: false }))).toBe("2 500 000 ₽");
  });
});
