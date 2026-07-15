import { tokenStorage } from './auth';

// Приоритет: VITE_WS_URL (полный override) → VITE_API_HOST (только хост) →
// window.location.host (тот же origin, что и страница).
//
// Раньше дефолт был захардкожен на localhost:3000 — и в dev это не работало
// вовсе: абсолютный URL шёл мимо Vite-прокси, а :3000 не слушал ни host-run
// бэкенд (:4002), ни docker (порт наружу не публикуется). Дефолт от
// window.location.host решает это без env-переменных: в dev это localhost:5173,
// и Vite-прокси (см. vite.config.ts) заворачивает /ws на бэкенд; в проде это
// боевой домен, где nginx проксирует /ws (хендшейк 101 подтверждён).
const WS_PROTO = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
const WS_BASE =
  import.meta.env.VITE_WS_URL ??
  WS_PROTO + (import.meta.env.VITE_API_HOST ?? window.location.host);

type WSMessage = { type: string; [key: string]: unknown };
type MessageHandler = (msg: WSMessage) => void;

/**
 * Connects to the backend WS endpoint and authenticates via the first message.
 * Protocol (server expects within 5 s):
 *   client → { type: 'auth', token: '<access_token>' }
 *   server → { type: 'connected', message: '...' }
 *
 * Авто-реконнект: сервер закрывает сокет при истечении access-токена (код 4003),
 * чтобы ограничить окно после отзыва доступа. На любое неожиданное закрытие
 * переподключаемся со свежим токеном из storage (его обновляет http-интерцептор),
 * с экспоненциальным backoff — чтобы не зациклиться, пока токен ещё не обновлён.
 *
 * Returns a cleanup function that closes the socket and stops reconnects.
 */
export function connectNotificationSocket(onMessage: MessageHandler): () => void {
  let socket: WebSocket | null = null;
  let closedByCaller = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  const MAX_DELAY_MS = 30_000;

  function scheduleReconnect() {
    if (closedByCaller || reconnectTimer) return;
    attempt += 1;
    const delay = Math.min(1000 * 2 ** Math.min(attempt, 5), MAX_DELAY_MS); // 2s,4s,…,30s
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function connect() {
    if (closedByCaller) return;
    const token = tokenStorage.getAccessToken();
    if (!token) {
      // Токена пока нет — повторим позже (интерцептор мог обновить его на других запросах)
      scheduleReconnect();
      return;
    }

    socket = new WebSocket(`${WS_BASE}/ws`);

    socket.addEventListener('open', () => {
      attempt = 0;
      // Берём актуальный токен из storage на момент открытия
      socket?.send(JSON.stringify({ type: 'auth', token: tokenStorage.getAccessToken() }));
    });

    socket.addEventListener('message', (event) => {
      try {
        onMessage(JSON.parse(event.data as string) as WSMessage);
      } catch {
        // ignore malformed frames
      }
    });

    socket.addEventListener('close', () => {
      // 1000 — наше намеренное закрытие; иначе (4003 истёк токен, 4001, обрыв сети)
      // переподключаемся со свежим токеном.
      if (!closedByCaller) scheduleReconnect();
    });
  }

  connect();

  return () => {
    closedByCaller = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      socket.close(1000, 'component unmounted');
    }
  };
}
