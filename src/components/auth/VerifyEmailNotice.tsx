import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { MailCheck, Loader2, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { tokenStorage } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";

// Экран для залогиненного, но НЕподтверждённого пользователя. Без него все
// защищённые маршруты отдают каскад 403 (EMAIL_NOT_VERIFIED) и «ничего не
// грузится». Показываем понятное объяснение + повторная отправка письма.
export function VerifyEmailNotice({ email }: { email?: string }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const resend = useMutation({
    mutationFn: () => apiClient.post("/auth/resend-verification").then((r) => r.data),
    onSuccess: () => toast.success("Письмо отправлено. Проверьте почту и папку «Спам»."),
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429) { toast.error("Слишком часто. Повторная отправка — не более 3 раз в час."); return; }
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Не удалось отправить письмо");
    },
  });

  // Пользователь подтвердил в другой вкладке — перепроверяем профиль.
  const recheck = async () => {
    setChecking(true);
    try {
      const { data } = await apiClient.get<{ user: { emailVerified?: boolean } }>("/auth/me");
      if (data.user?.emailVerified) {
        await queryClient.invalidateQueries({ queryKey: ["current-user"] });
        toast.success("Почта подтверждена!");
        navigate("/", { replace: true });
      } else {
        toast.info("Подтверждение пока не видим. Перейдите по ссылке из письма и повторите.");
      }
    } catch {
      toast.error("Не удалось проверить статус, попробуйте ещё раз.");
    } finally {
      setChecking(false);
    }
  };

  const logout = () => {
    tokenStorage.clearTokens();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <MailCheck className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold">Подтвердите электронную почту</h1>
        </div>

        <Card className="shadow-card">
          <div className="flex flex-col gap-4 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Мы отправили письмо со ссылкой для подтверждения
              {email ? <> на <span className="font-medium text-foreground">{email}</span></> : null}.
              Перейдите по ссылке из письма — после этого откроется доступ ко всем разделам.
            </p>
            <p className="text-xs text-muted-foreground">Письма нет? Загляните в папку «Спам» или отправьте его повторно.</p>

            <div className="flex flex-col gap-2">
              <Button onClick={() => resend.mutate()} disabled={resend.isPending} className="gap-1.5">
                {resend.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
                Отправить письмо повторно
              </Button>
              <Button variant="outline" onClick={recheck} disabled={checking} className="gap-1.5">
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Я подтвердил — обновить
              </Button>
              <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5 text-muted-foreground">
                <LogOut className="h-3.5 w-3.5" /> Выйти
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
