const ACCESS_TOKEN_KEY = 'zakupki_access_token';
const IMPERSONATION_KEY = 'zakupki_impersonation';

export const tokenStorage = {
  getAccessToken: (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY),

  setTokens: (accessToken: string): void => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  },

  clearTokens: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(IMPERSONATION_KEY);
  },

  isAuthenticated: (): boolean => !!localStorage.getItem(ACCESS_TOKEN_KEY),
};

export interface ImpersonatedUser {
  id: string;
  email: string;
  fullName?: string | null;
}

// Администратор вошёл «под пользователем»: под кем именно. Сессия самого администратора
// (refresh в cookie) при этом остаётся — по ней «Вернуться в админку» (returnToAdmin).
export const impersonation = {
  get: (): ImpersonatedUser | null => {
    try {
      const raw = localStorage.getItem(IMPERSONATION_KEY);
      return raw ? (JSON.parse(raw) as ImpersonatedUser) : null;
    } catch {
      return null;
    }
  },

  start: (user: ImpersonatedUser): void => {
    localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(user));
  },

  clear: (): void => {
    localStorage.removeItem(IMPERSONATION_KEY);
  },
};
