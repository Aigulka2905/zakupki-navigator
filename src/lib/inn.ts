// Контрольные цифры ИНН (алгоритм ФНС): у юрлица — одна (10-я), у физлица и ИП — две.
const W10 = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const W11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const W12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

function check(d: number[], w: number[]): number {
  return (w.reduce((s, k, i) => s + k * d[i], 0) % 11) % 10;
}

export function isValidInn(inn: string): boolean {
  if (!/^\d{10}$|^\d{12}$/.test(inn)) return false;
  const d = [...inn].map(Number);
  if (d.length === 10) return check(d, W10) === d[9];
  return check(d, W11) === d[10] && check(d, W12) === d[11];
}

function digits(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "цифра";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) return "цифры";
  return "цифр";
}

export interface InnList {
  inns: string[];
  invalid: { value: string; reason: string }[];
}

// Список ИНН из свободного ввода: всё, что не ИНН, возвращается с причиной — раньше
// такие строки молча пропадали из проверки.
export function parseInnList(text: string): InnList {
  const inns: string[] = [];
  const invalid: InnList["invalid"] = [];
  for (const value of text.split(/[\s,;]+/).filter(Boolean)) {
    if (!/^\d+$/.test(value)) invalid.push({ value, reason: "не число" });
    else if (value.length !== 10 && value.length !== 12) invalid.push({ value, reason: `${value.length} ${digits(value.length)} — нужно 10 или 12` });
    else if (!isValidInn(value)) invalid.push({ value, reason: "неверная контрольная цифра" });
    else if (!inns.includes(value)) inns.push(value);
  }
  return { inns, invalid };
}
