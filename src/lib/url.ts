// Безопасное открытие внешних ссылок в новой вкладке.
// Защита от:
//  1) reverse tabnabbing — новая вкладка не получает window.opener ("noopener");
//  2) XSS-стока — блокируем схемы вроде javascript:/data:, если такой URL
//     случайно попадёт из внешних/синхронизированных данных (documentationUrl и т.п.).
export function openExternal(url?: string | null): void {
  if (!url) return;
  let parsed: URL;
  try {
    parsed = new URL(url, window.location.origin);
  } catch {
    return; // некорректный URL — молча игнорируем
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return;
  window.open(parsed.href, "_blank", "noopener,noreferrer");
}
