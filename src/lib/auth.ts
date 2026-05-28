const ACCESS_TOKEN_KEY = 'zakupki_access_token';

export const tokenStorage = {
  getAccessToken: (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY),

  setTokens: (accessToken: string): void => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  },

  clearTokens: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  },

  isAuthenticated: (): boolean => !!localStorage.getItem(ACCESS_TOKEN_KEY),
};
