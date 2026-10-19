// Лимиты и проверки пакета документов — те же, что на сервере
// (backend/src/services/upload-batch.service.js): отказ виден сразу, до загрузки.
export const PACKAGE_LIMITS = {
  maxFiles: 50,
  maxFileBytes: 50 * 1024 * 1024,
  maxTotalBytes: 1024 * 1024 * 1024,
  maxParticipants: 20,
} as const;

export const PACKAGE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";
const ALLOWED = /\.(pdf|docx?|xlsx?|txt|csv)$/i;

/** Почему файл нельзя добавить в пакет, или null. */
export function rejectReason(
  file: { name: string; size: number },
  current: { count: number; totalBytes: number },
): string | null {
  if (!ALLOWED.test(file.name)) return "Формат не поддерживается: нужен PDF, DOC, DOCX, XLS, XLSX, TXT или CSV";
  if (file.size > PACKAGE_LIMITS.maxFileBytes) return "Файл больше 50 МБ";
  if (current.count >= PACKAGE_LIMITS.maxFiles) return "В пакете не больше 50 файлов";
  if (current.totalBytes + file.size > PACKAGE_LIMITS.maxTotalBytes) return "Общий объём пакета — не больше 1 ГБ";
  return null;
}

/** Наименьший свободный номер участника (0–19) или null, если все заняты. */
export function freeSlot(used: number[]): number | null {
  for (let i = 0; i < PACKAGE_LIMITS.maxParticipants; i++) if (!used.includes(i)) return i;
  return null;
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`;
  return `${Math.max(1, Math.round(n / 1024))} КБ`;
}
