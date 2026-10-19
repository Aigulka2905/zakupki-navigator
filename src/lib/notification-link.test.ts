import { describe, it, expect } from "vitest";
import { hasDetailLink } from "./notification-link";

describe("hasDetailLink", () => {
  it("открываются закупка и результаты фоновых проверок", () => {
    expect(hasDetailLink("/procurements/123")).toBe(true);
    expect(hasDetailLink("/doc-review?id=0c3a-11")).toBe(true);
    expect(hasDetailLink("/bid-evaluation?id=0c3a-11")).toBe(true);
  });
  it("прочие ссылки — нет", () => {
    expect(hasDetailLink("/procurements/")).toBe(false);
    expect(hasDetailLink("/admin?tab=ai")).toBe(false);
    expect(hasDetailLink("/doc-review?id=<script>")).toBe(false);
    expect(hasDetailLink(null)).toBe(false);
  });
});
