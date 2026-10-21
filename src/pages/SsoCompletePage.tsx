import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BASE_URL } from "@/lib/api-client";
import { tokenStorage } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import type { AuthTokens } from "@/types/api";

// Вход через ЭТП «Торги РФ»: backend уже проверил пользователя на площадке и поставил
// httpOnly refresh-cookie, access-токен в адресе намеренно не передаётся. Получаем его
// обычным /auth/refresh — голым axios, без интерсептора apiClient (тот на 401 сам
// уводит на /login без пометки sso_error).
const SsoCompletePage = () => {
  const navigate = useNavigate();
  // Гард от двойного запроса в React StrictMode (dev): второй refresh с уже
  // погашенным (rotate-on-use) токеном сервер счёл бы переиспользованием.
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    axios
      .post<AuthTokens>(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        tokenStorage.setTokens(data.accessToken);
        queryClient.clear();
        navigate("/", { replace: true });
      })
      .catch(() => navigate("/login?sso_error=failed", { replace: true }));
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold">Вход через «Торги РФ»</h1>
        </div>

        <Card className="shadow-card">
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Входим в систему...</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SsoCompletePage;
