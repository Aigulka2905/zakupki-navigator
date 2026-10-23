// Подпись диалога: первый вопрос пользователя (title с сервера), иначе последнее сообщение.
// Раньше бралось последнее сообщение — обычно начало ответа ассистента.
export function sessionTitle(s: { title?: string | null; lastMessage: string }): string {
  return (s.title || s.lastMessage || "").replace(/\s+/g, " ").trim();
}
