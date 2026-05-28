import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import apiClient from "@/lib/api-client";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Минимум 8 символов")
      .regex(/\d/, "Нужна хотя бы одна цифра")
      .regex(/[^a-zA-Z0-9а-яА-ЯёЁ]/, "Нужен хотя бы один специальный символ (!@#$%...)"),
    confirm: z.string().min(1, "Повторите пароль"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Пароли не совпадают",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await apiClient.post("/auth/reset-password", { token, password: values.password });
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setServerError(msg ?? "Не удалось сбросить пароль. Ссылка могла устареть.");
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-sm p-8 text-center shadow-card">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
          <h2 className="mb-2 text-base font-semibold">Недействительная ссылка</h2>
          <p className="mb-4 text-sm text-muted-foreground">Ссылка для сброса пароля неверна или устарела.</p>
          <Link to="/forgot-password">
            <Button variant="outline" size="sm">Запросить новую ссылку</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Новый пароль</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Придумайте надёжный пароль</p>
          </div>
        </div>

        <Card className="shadow-card">
          {done ? (
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-7 w-7 text-success" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Пароль изменён!</h2>
                <p className="text-sm text-muted-foreground">
                  Перенаправляем на страницу входа...
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Новый пароль</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPass ? "text" : "password"}
                      autoComplete="new-password"
                      className="pr-10"
                      {...register("password")}
                      aria-invalid={!!errors.password}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password.message}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Минимум 8 символов, цифра и спецсимвол (!@#$%...)
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Повторите пароль</Label>
                  <div className="relative">
                    <Input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      className="pr-10"
                      {...register("confirm")}
                      aria-invalid={!!errors.confirm}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirm && (
                    <p className="text-xs text-destructive">{errors.confirm.message}</p>
                  )}
                </div>

                {serverError && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {serverError}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    "Сохранить пароль"
                  )}
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
