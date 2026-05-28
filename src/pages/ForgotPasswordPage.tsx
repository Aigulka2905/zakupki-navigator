import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck, Loader2, ArrowLeft, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import apiClient from "@/lib/api-client";

const schema = z.object({
  email: z.string().email("Некорректный email"),
});
type FormValues = z.infer<typeof schema>;

const ForgotPasswordPage = () => {
  const [sent, setSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await apiClient.post("/auth/forgot-password", values);
      setSubmittedEmail(values.email);
      setSent(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setServerError(msg ?? "Не удалось отправить письмо. Проверьте подключение к серверу.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Забыли пароль?</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Введите email — пришлём ссылку для сброса
            </p>
          </div>
        </div>

        <Card className="shadow-card">
          {sent ? (
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Письмо отправлено</h2>
                <p className="text-sm text-muted-foreground">
                  Мы отправили инструкции на{" "}
                  <span className="font-medium text-foreground">{submittedEmail}</span>.
                  Проверьте папку «Спам», если письмо не пришло.
                </p>
              </div>
              <Link to="/login">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Вернуться ко входу
                </Button>
              </Link>
            </div>
          ) : (
            <div className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.ru"
                    {...register("email")}
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>

                {serverError && (
                  <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {serverError}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Отправка...
                    </>
                  ) : (
                    "Отправить ссылку"
                  )}
                </Button>
              </form>
            </div>
          )}
        </Card>

        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Вернуться ко входу
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
