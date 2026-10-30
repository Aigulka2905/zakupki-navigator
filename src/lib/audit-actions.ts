import { priceLabel } from "./money";

// Подписи действий журнала (аудита) — общие для «Истории» и вкладки «Аудит» в админке.
export const ACTION_LABELS: Record<string, string> = {
  "auth.login":                    "Вход в систему",
  "auth.login_failed":             "Неудачный вход",
  "auth.logout":                   "Выход из системы",
  "auth.sso_login":                "Вход с площадки",
  "auth.sso_login_failed":         "Неудачный вход с площадки",
  "auth.email_verified":           "Подтверждение email",
  "auth.verification_resent":      "Повторное письмо для подтверждения",
  "auth.password_reset_requested": "Запрос сброса пароля",
  "auth.password_reset":           "Сброс пароля",
  "procurement.create":            "Создание закупки",
  "procurement.update":            "Изменение закупки",
  "procurement.delete":            "Удаление закупки",
  "document.create":               "Добавление документа",
  "document.update":               "Изменение документа",
  "document.delete":               "Удаление документа",
  "org.update":                    "Обновление профиля",
  "org.invite_created":            "Приглашение сотрудника",
  "org.invite_revoked":            "Отзыв приглашения",
  "org_document.upload":           "Загрузка документа",
  "org_document.delete":           "Удаление документа",
  "analysis.upload":               "Анализ документа",
  "doc_review.run":                "Анализ документов",
  "nmck.create":                   "Расчёт НМЦ",
  "nmck.export_xlsx":              "Выгрузка НМЦ в Excel",
  "bid_check.run":                 "Проверка заявок",
  "bid_evaluation.create":         "Оценка заявок",
  "upload_batch.start":            "Проверка пакета документов",
  "procurement_policy.upload":     "Загрузка Положения о закупке",
  "procurement_policy.delete":     "Удаление Положения о закупке",
  "subscription.okpd.create":      "Подписка на ОКПД",
  "billing.topup_created":         "Пополнение баланса",
  "billing.invoice_created":       "Выставлен счёт",
  "billing.invoice_confirmed":     "Оплата по счёту",
  "billing.invoice_cancelled":     "Отмена счёта",
  "billing.payment_synced":        "Платёж получен",
  "billing.webhook_succeeded":     "Платёж прошёл",
  "billing.balance_credited":      "Зачисление на баланс",
  "billing.manual_credit":         "Ручное зачисление",
  "billing.plan_changed":          "Смена тарифа",
  "billing.refund_succeeded":      "Возврат средств",
  "admin.role_update":             "Изменение роли",
  "admin.plan_update":             "Изменение тарифа",
  "admin.user_verify":             "Подтверждение аккаунта",
  "admin.user_block":              "Блокировка пользователя",
  "admin.user_unblock":            "Разблокировка пользователя",
  "admin.recover":                 "Восстановление доступа",
  "admin.impersonate.start":       "Вход под пользователем",
  "admin.chat_view":               "Просмотр чата пользователя",
  "admin.chat_delete":             "Удаление чата пользователя",
  "admin.chats_delete_all":        "Удаление всех чатов пользователя",
  "admin.invoice_confirm":         "Подтверждение счёта",
  "admin.access_settings_update":  "Изменение доступа к сервису",
  "admin.sso_provider_create":     "Добавление площадки для входа",
  "admin.sso_provider_update":     "Изменение площадки для входа",
  "admin.sso_provider_delete":     "Удаление площадки для входа",
  "admin.model_change":            "Смена AI-модели",
  "admin.legal_check":             "Проверка обновлений правового корпуса",
  "admin.legal_reingest":          "Обновление правового документа",
  "admin.legal_add":               "Добавление правового документа",
  "admin.legal_ack":               "Скрытие уведомления об обновлении закона",
  "admin.legal_practice_delete":   "Удаление документа практики",
  "admin.eis_ingest":              "Загрузка из ЕИС",
  "admin.store_prices_import":     "Загрузка прайса магазина",
  "admin.store_prices_sync":       "Обновление цен магазина",
  "admin.sync_rftorgi":            "Синхронизация РФТорги",
  "admin.sync_aftorgi":            "Синхронизация АФТорги",
};

export const actionLabel = (action: string): string => ACTION_LABELS[action] ?? action;

type Details = Record<string, unknown> | null | undefined;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** Короткая подробность к действию по данным журнала: файл, сумма, количество. */
export function actionDetails(d: Details): string | null {
  if (!d) return null;
  const parts: string[] = [];
  const text = str(d.fileName) ?? str(d.name) ?? str(d.targetEmail);
  if (text) parts.push(text);
  if (num(d.number) != null || str(d.number)) parts.push(`№ ${d.number}`);
  const sum = d.amountRubles != null ? priceLabel(d.amountRubles as string | number, { compact: false })
    : num(d.amountKopecks) != null ? priceLabel((d.amountKopecks as number) / 100, { compact: false }) : null;
  if (sum) parts.push(sum);
  const counts: [string, string][] = [
    ["sources", "источников цен"], ["bids", "заявок"], ["participants", "участников"],
    ["files", "файлов"], ["messages", "сообщений"], ["articles", "статей"],
  ];
  for (const [key, label] of counts) if (num(d[key]) != null) parts.push(`${label}: ${d[key]}`);
  if (str(d.from) && str(d.to)) parts.push(`${d.from} → ${d.to}`);
  else if (str(d.plan)) parts.push(`тариф ${d.plan}`);
  if (str(d.revision)) parts.push(`редакция ${d.revision}`);
  return parts.length ? parts.join(" · ") : null;
}

/** Раздел, где действие можно открыть (у самого пользователя); null — открывать нечего. */
export function actionHref(action: string, entityId: string | null): string | null {
  const [area] = action.split(".");
  switch (area) {
    case "nmck": return "/nmck";
    case "bid_check": return "/bid-check";
    case "bid_evaluation": return entityId ? `/bid-evaluation?id=${entityId}` : "/bid-evaluation";
    case "upload_batch": return "/batch-check";
    case "procurement_policy":
    case "org":
    case "org_document": return "/organization";
    case "document": return "/knowledge";
    case "billing": return "/billing";
    case "subscription": return "/subscriptions";
    case "procurement": return entityId && action !== "procurement.delete" ? `/procurements/${entityId}` : null;
    default: return null;
  }
}
