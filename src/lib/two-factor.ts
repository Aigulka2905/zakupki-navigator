import axios from 'axios';
import { apiClient } from './api-client';
import type {
  BackupCodesResponse,
  TwoFactorSetupResponse,
  TwoFactorVerifyResponse,
} from '@/types/api';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

// Отдельный инстанс БЕЗ auth-интерсептора.
// Причина: setup-токен (scope:'2fa_setup') — не сессия. Он не кладётся в
// tokenStorage (иначе ProtectedRoute счёл бы пользователя авторизованным, а
// токен даёт доступ только к настройке 2FA), поэтому передаём его явным
// заголовком. Интерсептор apiClient перезаписал бы Authorization значением из
// localStorage, поэтому здесь он не нужен.
// withCredentials — verify-setup ставит httpOnly refresh-cookie.
const setupClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

const withSetupToken = (setupToken: string) => ({
  headers: { Authorization: `Bearer ${setupToken}` },
});

export const twoFactorApi = {
  /** Шаг 1: выпустить секрет (pending) и получить otpauth-URI для QR. */
  setup: (setupToken: string) =>
    setupClient
      .post<TwoFactorSetupResponse>('/auth/2fa/setup', {}, withSetupToken(setupToken))
      .then((r) => r.data),

  /** Шаг 2: подтвердить кодом → 2FA включена, выдаются токены + backup-коды (разово). */
  verifySetup: (setupToken: string, code: string) =>
    setupClient
      .post<TwoFactorVerifyResponse>('/auth/2fa/verify-setup', { code }, withSetupToken(setupToken))
      .then((r) => r.data),

  // ── Настройка из Настроек: пользователь уже авторизован ────────────────────
  // Бэкенд (require2faSetupContext) принимает и обычный access-токен, поэтому
  // здесь идём через apiClient — setup-токен не нужен.

  /** Шаг 1 из Настроек (добровольное включение 2FA обычным пользователем). */
  setupWithSession: () =>
    apiClient.post<TwoFactorSetupResponse>('/auth/2fa/setup').then((r) => r.data),

  /** Шаг 2 из Настроек. */
  verifySetupWithSession: (code: string) =>
    apiClient.post<TwoFactorVerifyResponse>('/auth/2fa/verify-setup', { code }).then((r) => r.data),

  // ── Управление уже включённой 2FA (полноценная сессия → обычный apiClient) ──

  /** Перевыпуск backup-кодов (старые инвалидируются). */
  regenerateBackupCodes: (code: string) =>
    apiClient
      .post<BackupCodesResponse>('/auth/2fa/regenerate-backup-codes', { code })
      .then((r) => r.data),

  /** Отключить 2FA. Для admin бэкенд отвечает 403 — админу 2FA обязательна. */
  disable: (code: string) =>
    apiClient.post('/auth/2fa/disable', { code }).then((r) => r.data),
};

/** Достать base32-секрет из otpauth-URI — для ручного ввода, если QR не сканируется. */
export function secretFromOtpauthUri(uri: string): string | null {
  try {
    return new URL(uri).searchParams.get('secret');
  } catch {
    return null;
  }
}
