import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ShieldCheck, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import apiClient from "@/lib/api-client";
import { tokenStorage } from "@/lib/auth";
import type { AuthTokens } from "@/types/api";
import { Link } from "react-router-dom";

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Токен подтверждения не найден");
      return;
    }

    apiClient
      .get<AuthTokens & { message: string }>(`/auth/verify-email?token=${token}`)
      .then(({ data }) => {
        tokenStorage.setTokens(data.accessToken);
        setStatus("success");
        setTimeout(() => navigate("/", { replace: true }), 2500);
      })
      .catch((err) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setErrorMsg(msg ?? "Не удалось подтвердить email");
        setStatus("error");
      });
  }, [token, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold">Подтверждение email</h1>
        </div>

        <Card className="shadow-card">
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            {status === "loading" && (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Проверяем ссылку...</p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle2 className="h-7 w-7 text-success" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold">Email подтверждён!</h2>
                  <p className="text-sm text-muted-foreground">Перенаправляем в систему...</p>
                </div>
              </>
            )}

            {status === "error" && (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-7 w-7 text-destructive" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold">Ошибка подтверждения</h2>
                  <p className="text-sm text-muted-foreground">{errorMsg}</p>
                </div>
                <Link to="/login">
                  <Button variant="outline" size="sm">Вернуться ко входу</Button>
                </Link>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
