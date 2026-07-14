import { useState, useEffect, forwardRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck, Loader2, Eye, EyeOff, Mail, Sparkles, Building2, Users, KeyRound, Copy, Check, ArrowLeft } from "lucide-react";
import type { OrgType } from "@/types/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import apiClient from "@/lib/api-client";
import { tokenStorage } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import { twoFactorApi, secretFromOtpauthUri } from "@/lib/two-factor";
import {
  isTwoFactorRequired,
  isTwoFactorSetupRequired,
  type AuthTokens,
  type LoginResponse,
} from "@/types/api";

// ── Schemas ───────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
});

const registerSchema = z.object({
  orgType: z.enum(["customer", "participant"], { required_error: "Выберите тип участника" }),
  email: z.string().email("Некорректный email"),
  username: z
    .string()
    .min(3, "Минимум 3 символа")
    .max(30, "Максимум 30 символов")
    .regex(/^[a-zA-Z0-9_-]+$/, "Только латиница, цифры, _ и -"),
  password: z
    .string()
    .min(8, "Минимум 8 символов")
    .regex(/\d/, "Должна быть хотя бы одна цифра")
    .regex(/[^a-zA-Z0-9а-яА-ЯёЁ]/, "Должен быть хотя бы один спецсимвол (!@#$ и т.п.)"),
  fullName: z.string().min(2, "Укажите имя"),
  orgName: z.string().min(2, "Укажите название организации"),
  inn: z.string().min(10, "ИНН 10 или 12 цифр").max(12).regex(/^\d+$/, "Только цифры"),
  kpp: z.string().length(9, "КПП — 9 цифр").regex(/^\d+$/, "Только цифры"),
});

// При регистрации по приглашению организация уже существует — нужны только
// личные поля пользователя.
const inviteRegisterSchema = z.object({
  email: z.string().email("Некорректный email"),
  username: z
    .string()
    .min(3, "Минимум 3 символа")
    .max(30, "Максимум 30 символов")
    .regex(/^[a-zA-Z0-9_-]+$/, "Только латиница, цифры, _ и -"),
  password: z
    .string()
    .min(8, "Минимум 8 символов")
    .regex(/\d/, "Должна быть хотя бы одна цифра")
    .regex(/[^a-zA-Z0-9а-яА-ЯёЁ]/, "Должен быть хотя бы один спецсимвол (!@#$ и т.п.)"),
  fullName: z.string().min(2, "Укажите имя"),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

// ── Helpers ───────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-rose-500">{message}</p> : null;
}

function PasswordInput({
  id,
  placeholder,
  autoComplete,
  registration,
  error,
}: {
  id: string;
  placeholder?: string;
  autoComplete?: string;
  registration: ReturnType<ReturnType<typeof useForm>["register"]>;
  error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder ?? "••••••••"}
          className="h-11 rounded-xl border-white/40 bg-white/60 pr-10 backdrop-blur-sm placeholder:text-slate-400 focus:border-violet-300 focus:ring-violet-200"
          aria-invalid={!!error}
          {...registration}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <FieldError message={error} />
    </div>
  );
}

const GlassInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { error?: string }
>(({ error, className, ...rest }, ref) => (
  <div>
    <input
      ref={ref}
      className={`h-11 w-full rounded-xl border border-white/40 bg-white/60 px-3 py-2 text-sm backdrop-blur-sm placeholder:text-slate-400 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-200/50 ${className ?? ""}`}
      {...rest}
    />
    <FieldError message={error} />
  </div>
));
GlassInput.displayName = "GlassInput";

// ── 2FA helpers ───────────────────────────────────────────────

const errText = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;

const primaryBtn =
  "relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition-all hover:from-violet-600 hover:to-indigo-600 hover:shadow-violet-300 disabled:opacity-60";

function ErrorBanner({ message }: { message: string | null }) {
  return message ? (
    <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-sm text-rose-600">
      {message}
    </div>
  ) : null;
}

/** Поле второго фактора: 6-значный TOTP либо backup-код XXXX-XXXX. */
function CodeField({
  value, onChange, autoFocus, placeholder = "123456",
}: { value: string; onChange: (v: string) => void; autoFocus?: boolean; placeholder?: string }) {
  return (
    <GlassInput
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoFocus={autoFocus}
      autoComplete="one-time-code"
      inputMode="text"
      maxLength={9}
      placeholder={placeholder}
      className="text-center font-mono text-lg tracking-[0.3em]"
    />
  );
}

// ── Шаг: ввод кода (2FA уже включена) ─────────────────────────

function TwoFactorCodeStep({
  creds, onAuthenticated, onBack,
}: {
  creds: LoginValues;
  onAuthenticated: (t: AuthTokens) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Повторяем логин, добавив второй фактор — бэкенд выдаёт токены только теперь.
      const { data } = await apiClient.post<LoginResponse>("/auth/login", { ...creds, totp: code.trim() });
      if ("accessToken" in data) return onAuthenticated(data);
      setError("Не удалось войти. Попробуйте ещё раз.");
    } catch (err) {
      setError(errText(err, "Неверный код"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
          <KeyRound className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-base font-semibold text-slate-800">Подтвердите вход</h2>
        <p className="text-sm text-slate-500">
          Введите 6-значный код из приложения-аутентификатора
          <br />или один из ваших backup-кодов.
        </p>
      </div>

      <CodeField value={code} onChange={setCode} autoFocus />

      <ErrorBanner message={error} />

      <button type="submit" disabled={busy || code.trim().length < 6} className={primaryBtn}>
        {busy ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Проверка...
          </span>
        ) : "Подтвердить"}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="flex w-full items-center justify-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-slate-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Вернуться ко входу
      </button>
    </form>
  );
}

// ── Шаг: обязательная настройка 2FA (admin без 2FA) ───────────

function TwoFactorSetupStep({
  otpauthUri, setupToken, onEnabled,
}: {
  otpauthUri: string;
  setupToken: string;
  onEnabled: (t: AuthTokens, backupCodes: string[]) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const secret = secretFromOtpauthUri(otpauthUri);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await twoFactorApi.verifySetup(setupToken, code.trim());
      onEnabled(data, data.backupCodes);
    } catch (err) {
      setError(errText(err, "Неверный код. Проверьте время на устройстве."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-base font-semibold text-slate-800">Настройте двухфакторную аутентификацию</h2>
        <p className="text-sm text-slate-500">
          Для учётной записи администратора 2FA обязательна.
          <br />Отсканируйте QR-код в Google Authenticator, Aegis или 1Password.
        </p>
      </div>

      {/* QR рисуется на фронте из otpauth-URI — секрет не покидает эту страницу. */}
      <div className="flex justify-center">
        <div className="rounded-2xl border border-white/60 bg-white p-3 shadow-sm">
          <QRCodeSVG value={otpauthUri} size={168} level="M" />
        </div>
      </div>

      {secret && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowSecret((v) => !v)}
            className="text-xs text-violet-600 transition-colors hover:text-violet-800"
          >
            {showSecret ? "Скрыть ключ" : "QR не сканируется? Ввести ключ вручную"}
          </button>
          {showSecret && (
            <p className="mt-2 select-all break-all rounded-xl border border-white/50 bg-white/60 px-3 py-2 font-mono text-xs text-slate-600">
              {secret}
            </p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-slate-700">Код из приложения</Label>
        <CodeField value={code} onChange={setCode} />
      </div>

      <ErrorBanner message={error} />

      <button type="submit" disabled={busy || code.trim().length !== 6} className={primaryBtn}>
        {busy ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Включаем...
          </span>
        ) : "Включить 2FA"}
      </button>
    </form>
  );
}

// ── Шаг: backup-коды (показываются РОВНО один раз) ────────────

function BackupCodesStep({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const [ack, setAck] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* буфер обмена недоступен — коды всё равно видны на экране */
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg">
          <Check className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-base font-semibold text-slate-800">2FA включена</h2>
        <p className="text-sm text-slate-500">
          Сохраните backup-коды. Каждый работает <span className="font-medium">один раз</span> и
          заменяет код из приложения, если вы потеряете доступ к нему.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-700">
        Коды показываются только сейчас — на сервере хранятся лишь их хэши. Повторно посмотреть их нельзя.
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/50 bg-white/60 p-3">
        {codes.map((c) => (
          <code key={c} className="select-all text-center font-mono text-sm tracking-wider text-slate-700">
            {c}
          </code>
        ))}
      </div>

      <button
        type="button"
        onClick={copy}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/50 bg-white/60 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white/80"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        {copied ? "Скопировано" : "Скопировать все"}
      </button>

      <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400"
        />
        Я сохранил коды в надёжном месте
      </label>

      <button type="button" disabled={!ack} onClick={onDone} className={primaryBtn}>
        Продолжить
      </button>
    </div>
  );
}

// ── Login form (state machine) ────────────────────────────────

type LoginStep =
  | { kind: "credentials" }
  | { kind: "code"; creds: LoginValues }
  | { kind: "setup"; setupToken: string; otpauthUri: string }
  | { kind: "backup"; codes: string[] };

function LoginForm() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [step, setStep] = useState<LoginStep>({ kind: "credentials" });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  // Единая точка завершения входа: кладём access-токен и уходим в приложение.
  const finish = (tokens: AuthTokens) => {
    tokenStorage.setTokens(tokens.accessToken);
    queryClient.clear();
    navigate("/", { replace: true });
  };

  const onSubmit = async (values: LoginValues) => {
    setServerError(null);
    try {
      const { data } = await apiClient.post<LoginResponse>("/auth/login", values);

      // 2FA включена — запрашиваем код (токенов сервер не выдал).
      if (isTwoFactorRequired(data)) {
        setStep({ kind: "code", creds: values });
        return;
      }

      // admin без 2FA — обязательная настройка. setupToken живёт только в стейте
      // (в localStorage его класть нельзя: ProtectedRoute счёл бы это сессией).
      if (isTwoFactorSetupRequired(data)) {
        const { otpauthUri } = await twoFactorApi.setup(data.setupToken);
        setStep({ kind: "setup", setupToken: data.setupToken, otpauthUri });
        return;
      }

      finish(data);
    } catch (err) {
      setServerError(errText(err, "Неверный email или пароль"));
    }
  };

  if (step.kind === "code") {
    return (
      <TwoFactorCodeStep
        creds={step.creds}
        onAuthenticated={finish}
        onBack={() => setStep({ kind: "credentials" })}
      />
    );
  }

  if (step.kind === "setup") {
    return (
      <TwoFactorSetupStep
        otpauthUri={step.otpauthUri}
        setupToken={step.setupToken}
        onEnabled={(tokens, codes) => {
          // Токен уже валиден: сохраняем сессию, но сперва показываем backup-коды.
          tokenStorage.setTokens(tokens.accessToken);
          queryClient.clear();
          setStep({ kind: "backup", codes });
        }}
      />
    );
  }

  if (step.kind === "backup") {
    return <BackupCodesStep codes={step.codes} onDone={() => navigate("/", { replace: true })} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="login-email" className="text-sm font-medium text-slate-700">Email</Label>
        <GlassInput
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.ru"
          error={errors.email?.message}
          {...register("email")}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password" className="text-sm font-medium text-slate-700">Пароль</Label>
          <Link to="/forgot-password" className="text-xs text-violet-600 hover:text-violet-800 transition-colors">
            Забыли пароль?
          </Link>
        </div>
        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          registration={register("password")}
          error={errors.password?.message}
        />
      </div>

      <ErrorBanner message={serverError} />

      <button type="submit" disabled={isSubmitting} className={primaryBtn}>
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Вход...
          </span>
        ) : "Войти"}
      </button>
    </form>
  );
}

// ── Register form ─────────────────────────────────────────────

function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const isInvite = !!inviteToken;

  const [serverError, setServerError] = useState<string | null>(null);
  const [orgType, setOrgType] = useState<OrgType | null>(null);
  const [invitePreview, setInvitePreview] = useState<{ organizationName: string; email: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<RegisterValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(isInvite ? inviteRegisterSchema : registerSchema) as any,
  });

  // Подгружаем данные приглашения и подставляем email.
  useEffect(() => {
    if (!inviteToken) return;
    apiClient
      .get<{ organizationName: string; email: string }>(`/auth/invite/${inviteToken}`)
      .then(({ data }) => {
        setInvitePreview(data);
        if (data.email) setValue("email", data.email);
      })
      .catch(() => setInviteError("Приглашение недействительно или истекло."));
  }, [inviteToken, setValue]);

  const selectOrgType = (type: OrgType) => {
    setOrgType(type);
    setValue("orgType", type, { shouldValidate: true });
  };

  const onSubmit = async (values: RegisterValues) => {
    setServerError(null);
    try {
      const body = isInvite
        ? {
            email: values.email,
            username: values.username,
            password: values.password,
            fullName: values.fullName,
            inviteToken,
          }
        : {
            email: values.email,
            username: values.username,
            password: values.password,
            fullName: values.fullName,
            orgType: values.orgType,
            organization: { name: values.orgName, inn: values.inn, kpp: values.kpp },
          };
      const { data } = await apiClient.post<AuthTokens>("/auth/register", body);
      tokenStorage.setTokens(data.accessToken);
      queryClient.clear();
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setServerError(msg ?? "Ошибка регистрации. Попробуйте ещё раз.");
    }
  };

  // Валидация не пройдена: ошибки полей могут быть выше зоны прокрутки, и клик
  // по кнопке выглядит «без реакции». Показываем видимый баннер у кнопки с
  // перечнем проблемных полей и прокручиваем форму к первой ошибке.
  const onInvalid = (errs: Record<string, unknown>) => {
    const labels: Record<string, string> = {
      orgType: "тип организации", email: "email", username: "логин",
      fullName: "полное имя", password: "пароль",
      orgName: "название организации", inn: "ИНН", kpp: "КПП",
    };
    const fields = Object.keys(errs).map((k) => labels[k] ?? k);
    setServerError(
      fields.length
        ? `Заполните корректно: ${fields.join(", ")}.`
        : "Проверьте правильность заполнения формы.",
    );
    document.querySelector('[aria-invalid="true"], input')?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Приглашение недействительно — показываем только ошибку.
  if (isInvite && inviteError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
        {inviteError}
      </div>
    );
  }

  const inputClass = "h-11 rounded-xl border-white/40 bg-white/60 backdrop-blur-sm placeholder:text-slate-400 focus:border-violet-300 focus:ring-violet-200";

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-3" noValidate>
      {/* Приглашение в организацию */}
      {isInvite && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm text-violet-700">
          {invitePreview
            ? <>Вы присоединяетесь к организации <span className="font-semibold">«{invitePreview.organizationName}»</span>.</>
            : "Загрузка приглашения…"}
        </div>
      )}

      {/* Тип участника — только при создании новой организации */}
      {!isInvite && (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Я являюсь</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => selectOrgType("participant")}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-left transition-all ${
              orgType === "participant"
                ? "border-violet-500 bg-violet-50/80 shadow-sm"
                : "border-white/50 bg-white/30 hover:border-violet-300 hover:bg-white/50"
            }`}
          >
            <Users className={`h-6 w-6 ${orgType === "participant" ? "text-violet-600" : "text-slate-400"}`} />
            <div>
              <div className={`text-sm font-semibold ${orgType === "participant" ? "text-violet-700" : "text-slate-700"}`}>
                Участник
              </div>
              <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                Участвую в закупках, подаю заявки
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => selectOrgType("customer")}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-left transition-all ${
              orgType === "customer"
                ? "border-violet-500 bg-violet-50/80 shadow-sm"
                : "border-white/50 bg-white/30 hover:border-violet-300 hover:bg-white/50"
            }`}
          >
            <Building2 className={`h-6 w-6 ${orgType === "customer" ? "text-violet-600" : "text-slate-400"}`} />
            <div>
              <div className={`text-sm font-semibold ${orgType === "customer" ? "text-violet-700" : "text-slate-700"}`}>
                Заказчик
              </div>
              <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                Размещаю закупки, выбираю поставщиков
              </div>
            </div>
          </button>
        </div>
        <input type="hidden" {...register("orgType")} />
        <FieldError message={errors.orgType?.message} />
      </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-slate-700">Email</Label>
        <Input type="email" placeholder="you@company.ru" className={inputClass} {...register("email")} />
        <FieldError message={errors.email?.message} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-slate-700">Логин</Label>
        <Input placeholder="ivan_petrov" autoComplete="username" className={inputClass} {...register("username")} />
        <FieldError message={errors.username?.message} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-slate-700">Полное имя</Label>
        <Input placeholder="Иванов Иван Иванович" className={inputClass} {...register("fullName")} />
        <FieldError message={errors.fullName?.message} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-slate-700">Пароль</Label>
        <PasswordInput
          id="reg-password"
          autoComplete="new-password"
          registration={register("password")}
          error={errors.password?.message}
        />
        <p className="text-[11px] text-slate-400">Минимум 8 символов, цифра и спецсимвол (!@#$...)</p>
      </div>

      {!isInvite && (
      <div className="rounded-xl border border-white/50 bg-white/30 p-3 backdrop-blur-sm">
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Организация</p>
        <div className="space-y-2.5">
          <div>
            <Input placeholder='ООО "Моя компания"' className={inputClass} {...register("orgName")} />
            <FieldError message={errors.orgName?.message} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Input placeholder="ИНН" maxLength={12} className={inputClass} {...register("inn")} />
              <FieldError message={errors.inn?.message} />
            </div>
            <div>
              <Input placeholder="КПП" maxLength={9} className={inputClass} {...register("kpp")} />
              <FieldError message={errors.kpp?.message} />
            </div>
          </div>
        </div>
      </div>
      )}

      {serverError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-sm text-rose-600">
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full overflow-hidden rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition-all hover:from-violet-600 hover:to-indigo-600 hover:shadow-violet-300 disabled:opacity-60"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Регистрация...
          </span>
        ) : "Зарегистрироваться"}
      </button>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────

type Tab = "login" | "register";

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // По ссылке-приглашению (?invite=) сразу открываем вкладку регистрации.
  const [tab, setTab] = useState<Tab>(searchParams.get("invite") ? "register" : "login");
  const [registered, setRegistered] = useState(false);

  const handleRegisterSuccess = () => {
    setRegistered(true);
    setTimeout(() => navigate("/", { replace: true }), 2500);
  };

  return (
    <>
      {/* ── CSS animations ─────────────────────────────────── */}
      <style>{`
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes blob1 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33%       { transform: translate(40px, -30px) scale(1.08); }
          66%       { transform: translate(-25px, 20px) scale(0.94); }
        }
        @keyframes blob2 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33%       { transform: translate(-35px, 25px) scale(1.1); }
          66%       { transform: translate(30px, -40px) scale(0.92); }
        }
        @keyframes blob3 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50%       { transform: translate(25px, 35px) scale(1.06); }
        }
        @keyframes blob4 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          40%       { transform: translate(-30px, -25px) scale(1.12); }
          80%       { transform: translate(20px, 15px) scale(0.96); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1; }
        }
        .bg-animated {
          background: linear-gradient(
            -45deg,
            #ede9fe, #e0f2fe, #d1fae5, #fce7f3,
            #ffedd5, #dbeafe, #f0fdf4, #fdf4ff
          );
          background-size: 400% 400%;
          animation: gradientShift 18s ease infinite;
        }
        .blob-1 { animation: blob1 9s ease-in-out infinite; }
        .blob-2 { animation: blob2 12s ease-in-out infinite; }
        .blob-3 { animation: blob3 15s ease-in-out infinite; }
        .blob-4 { animation: blob4 10s ease-in-out infinite; }
        .card-enter { animation: fadeUp 0.6s ease both; }
        .shimmer-logo { animation: shimmer 3s ease-in-out infinite; }
      `}</style>

      <div className="bg-animated relative flex min-h-screen items-center justify-center overflow-hidden p-4">

        {/* ── Floating blobs ───────────────────────────────── */}
        <div className="blob-1 pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-200/50 blur-3xl" />
        <div className="blob-2 pointer-events-none absolute -right-40 top-20 h-[28rem] w-[28rem] rounded-full bg-sky-200/45 blur-3xl" />
        <div className="blob-3 pointer-events-none absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-pink-200/40 blur-3xl" />
        <div className="blob-4 pointer-events-none absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-1/4 h-64 w-64 -translate-x-1/2 rounded-full bg-amber-100/35 blur-3xl" />

        {/* ── Noise texture overlay ─────────────────────────── */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* ── Card ─────────────────────────────────────────── */}
        <div className="card-enter relative w-full max-w-md">

          {/* Glow behind card */}
          <div className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-r from-violet-300/30 via-sky-300/20 to-pink-300/30 blur-xl" />

          <div
            className="relative rounded-3xl p-8"
            style={{
              background: "rgba(255,255,255,0.72)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.6)",
              boxShadow: "0 32px 64px rgba(99,70,255,0.08), 0 8px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
            }}
          >
            {/* ── Logo ───────────────────────────────────────── */}
            <div className="mb-8 flex flex-col items-center gap-3 text-center">
              <div className="shimmer-logo relative">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-500 blur-md opacity-50" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
                  <ShieldCheck className="h-7 w-7 text-white" />
                </div>
              </div>
              <div>
                <h1 className="bg-gradient-to-r from-violet-700 to-indigo-600 bg-clip-text text-xl font-bold text-transparent">
                  Ассистент 223-ФЗ
                </h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  {tab === "login" ? "Войдите в свой аккаунт" : "Создайте аккаунт организации"}
                </p>
              </div>
            </div>

            {/* ── Tabs ───────────────────────────────────────── */}
            {!registered && (
              <div
                className="mb-6 flex rounded-2xl p-1"
                style={{
                  background: "rgba(241,235,255,0.6)",
                  border: "1px solid rgba(221,214,254,0.5)",
                }}
              >
                {(["login", "register"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`flex-1 rounded-xl py-2 text-sm font-medium transition-all duration-200 ${
                      tab === t
                        ? "bg-white text-violet-700 shadow-sm shadow-violet-100"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {t === "login" ? "Войти" : "Регистрация"}
                  </button>
                ))}
              </div>
            )}

            {/* ── Form or success ─────────────────────────────── */}
            {registered ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-emerald-300/40 blur-lg" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg">
                    <Mail className="h-7 w-7 text-white" />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Добро пожаловать!</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Письмо с подтверждением отправлено на ваш email.
                    <br />Переходим в систему...
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-violet-400"
                      style={{ animation: `shimmer 1.2s ease-in-out ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            ) : tab === "login" ? (
              <LoginForm />
            ) : (
              <div className="max-h-[55vh] overflow-y-auto pr-1 custom-scroll">
                <RegisterForm onSuccess={handleRegisterSuccess} />
              </div>
            )}

            {/* ── Footer ─────────────────────────────────────── */}
            {!registered && (
              <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <Sparkles className="h-3 w-3 text-violet-400" />
                <span>Данные обрабатываются на серверах в РФ</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Corner decorations ──────────────────────────────── */}
        <div className="pointer-events-none absolute left-6 top-6 flex gap-1.5">
          {["bg-rose-300", "bg-amber-300", "bg-emerald-300"].map((c) => (
            <div key={c} className={`h-2.5 w-2.5 rounded-full ${c} opacity-60`} />
          ))}
        </div>
      </div>
    </>
  );
};

export default LoginPage;
