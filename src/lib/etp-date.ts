// Даты с площадок «Торги РФ» / «АФ-Торги» приходят без часового пояса
// («2026-10-29 12:00:00») и означают московское время. Без явного пояса браузер
// разобрал бы их как местное время пользователя.
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

export function parseEtpDate(val?: string | null): Date | null {
  if (!val) return null;
  let s = String(val).trim().replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += "T00:00:00";
  if (!HAS_ZONE.test(s)) s += "+03:00";
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
