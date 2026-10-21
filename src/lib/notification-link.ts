// Уведомление со ссылкой открывает страницу: карточку закупки или результат
// фоновой проверки пакета (проверка документации, анализ заявок).
export function hasDetailLink(link: string | null | undefined): link is string {
  if (!link) return false;
  if (link.startsWith("/procurements/") && link.length > "/procurements/".length) return true;
  return /^\/(doc-review|bid-evaluation)\?id=[\w-]+$/.test(link);
}
