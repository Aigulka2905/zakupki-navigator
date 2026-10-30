import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { tokenStorage, impersonation } from './auth';
import type { AuthTokens } from '@/types/api';

export const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ── Request interceptor: добавить Bearer токен ────────────────

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Вход «под пользователем»: возврат в админку ──────────────
// Токен «под пользователем» живёт 5 минут и не продлевается. Продлевать его обычным refresh
// нельзя: cookie — администратора, сессия молча стала бы админской, а на экране оставался бы
// пользователь. Поэтому по кнопке или по истечении — явно возвращаем администратора в его
// сессию и в админку. Один refresh на все одновременные запросы: повтор уже использованного
// refresh-токена сервер считает кражей сессии.
let returning: Promise<void> | null = null;

export function returnToAdmin(reason?: 'expired' | 'org_type'): Promise<void> {
  returning ??= (async () => {
    try {
      const { data } = await axios.post<AuthTokens>(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });
      // Метку «под пользователем» снимаем только теперь: пока refresh идёт, остальные
      // запросы с 401 ждут этот же возврат, а не запускают обычный refresh.
      impersonation.clear();
      tokenStorage.setTokens(data.accessToken);
      window.location.href = `/admin?tab=users${reason ? `&imp_end=${reason}` : ''}`;
    } catch {
      tokenStorage.clearTokens();
      window.location.href = '/login';
    }
  })().finally(() => { returning = null; });
  return returning;
}

// ── Response interceptor: обновить токен при 401 ─────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401 от самих auth-эндпоинтов (login/refresh/register) — это «неверные
    // данные»/«нет сессии», а НЕ «протух access-токен». Их нельзя гонять через
    // refresh: иначе реальная ошибка входа подменяется на «Refresh token
    // отсутствует» и происходит лишний редирект. Отдаём ошибку как есть.
    const url = original.url ?? '';
    const isAuthEndpoint = /\/auth\/(login|refresh|register)/.test(url);

    // Прод «только для заказчиков»: организация поставщика не допущена — сессия бесполезна,
    // выходим на страницу входа с объяснением (а не оставляем пустые страницы с ошибками).
    const code = (error.response?.data as { code?: string } | undefined)?.code;
    const impersonating = !isAuthEndpoint && !!impersonation.get();
    if (error.response?.status === 403 && code === 'ORG_TYPE_NOT_ALLOWED' && !isAuthEndpoint) {
      if (impersonating) {
        await returnToAdmin('org_type');
        return Promise.reject(error);
      }
      tokenStorage.clearTokens();
      window.location.href = '/login?sso_error=org_type';
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && impersonating) {
      await returnToAdmin('expired');
      return Promise.reject(error);
    }

    // Пропускаем не-401 ошибки, повторные запросы и auth-эндпоинты
    if (error.response?.status !== 401 || original._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    // Если рефреш уже идёт — ставим запрос в очередь
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      // Cookie is sent automatically; no body needed
      const { data } = await axios.post<AuthTokens>(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });

      tokenStorage.setTokens(data.accessToken);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;

      processQueue(null, data.accessToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return apiClient(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // Выходим, только если сервер ОТКЛОНИЛ refresh-токен (4xx: 401 — нет/протух/
      // переиспользован). Сбой сети, 429 (лимит) и 5xx (рестарт при деплое,
      // перегрузка) — сессия жива: токены оставляем и просто отдаём ошибку,
      // следующий запрос попробует обновиться снова. Раньше любой такой сбой
      // выкидывал пользователя на /login.
      const status = (refreshError as AxiosError)?.response?.status;
      const transient = !status || status === 429 || status >= 500;
      if (!transient) {
        tokenStorage.clearTokens();
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default apiClient;
