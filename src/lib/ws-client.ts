import { tokenStorage } from './auth';

const WS_BASE = import.meta.env.VITE_WS_URL ?? (
  window.location.protocol === 'https:' ? 'wss://' : 'ws://'
) + (import.meta.env.VITE_API_HOST ?? 'localhost:3000');

type WSMessage = { type: string; [key: string]: unknown };
type MessageHandler = (msg: WSMessage) => void;

/**
 * Connects to the backend WS endpoint and authenticates via first message.
 * Protocol (server expects within 5 s):
 *   client → { type: 'auth', token: '<access_token>' }
 *   server → { type: 'connected', message: '...' }
 *
 * Returns a cleanup function that closes the socket.
 */
export function connectNotificationSocket(onMessage: MessageHandler): () => void {
  const token = tokenStorage.getAccessToken();
  if (!token) return () => {};

  const socket = new WebSocket(`${WS_BASE}/ws`);

  socket.addEventListener('open', () => {
    // Send auth frame immediately — server closes after 5 s without it
    socket.send(JSON.stringify({ type: 'auth', token }));
  });

  socket.addEventListener('message', (event) => {
    try {
      const msg: WSMessage = JSON.parse(event.data as string);
      onMessage(msg);
    } catch {
      // ignore malformed frames
    }
  });

  socket.addEventListener('close', (event) => {
    if (event.code === 4001) {
      // Auth failure — token expired between page load and WS open
      // The http interceptor will refresh it; no action needed here
    }
  });

  return () => {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close(1000, 'component unmounted');
    }
  };
}
