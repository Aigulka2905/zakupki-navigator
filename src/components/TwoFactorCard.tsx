import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { KeyRound, ShieldCheck, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { twoFactorApi, secretFromOtpauthUri } from "@/lib/two-factor";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const errText = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;

/** Список backup-кодов — показывается ровно один раз после выдачи. */
function BackupCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* буфер недоступен — коды видны на экране */ }
  };

  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Сохраните коды сейчас — на сервере хранятся только их хэши, повторно показать их нельзя.
        Каждый код одноразовый.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {codes.map((c) => (
          <code key={c} className="select-all rounded bg-background/70 px-2 py-1 text-center font-mono text-sm">
            {c}
          </code>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={copy} className="gap-2">
        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        {copied ? "Скопировано" : "Скопировать все"}
      </Button>
    </div>
  );
}

export function TwoFactorCard() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();

  const enabled = !!user?.totpEnabledAt;
  const isAdmin = user?.role === "admin";

  // Мастер включения: otpauthUri появляется после setup, затем ждём код.
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const refreshUser = () => queryClient.invalidateQueries({ queryKey: ["current-user"] });

  const startSetup = async () => {
    setBusy(true);
    try {
      const { otpauthUri } = await twoFactorApi.setupWithSession();
      setOtpauthUri(otpauthUri);
      setBackupCodes(null);
    } catch (err) {
      toast.error(errText(err, "Не удалось начать настройку 2FA"));
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async () => {
    setBusy(true);
    try {
      const data = await twoFactorApi.verifySetupWithSession(code.trim());
      // verify-setup отзывает старые refresh-токены и выдаёт новую пару.
      const { tokenStorage } = await import("@/lib/auth");
      tokenStorage.setTokens(data.accessToken);
      setBackupCodes(data.backupCodes);
      setOtpauthUri(null);
      setCode("");
      refreshUser();
      toast.success("Двухфакторная аутентификация включена");
    } catch (err) {
      toast.error(errText(err, "Неверный код"));
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      const { backupCodes } = await twoFactorApi.regenerateBackupCodes(code.trim());
      setBackupCodes(backupCodes);
      setCode("");
      toast.success("Backup-коды перевыпущены — старые больше не действуют");
    } catch (err) {
      toast.error(errText(err, "Неверный код"));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await twoFactorApi.disable(code.trim());
      setCode("");
      setBackupCodes(null);
      refreshUser();
      toast.success("Двухфакторная аутентификация отключена");
    } catch (err) {
      toast.error(errText(err, "Не удалось отключить 2FA"));
    } finally {
      setBusy(false);
    }
  };

  const secret = otpauthUri ? secretFromOtpauthUri(otpauthUri) : null;

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Двухфакторная аутентификация</h2>
        {enabled ? (
          <Badge className="ml-auto bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">Включена</Badge>
        ) : (
          <Badge variant="outline" className="ml-auto">Выключена</Badge>
        )}
      </div>

      {/* ── Включена: перевыпуск кодов / отключение ── */}
      {enabled && !otpauthUri && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Вход защищён кодом из приложения-аутентификатора.
            {isAdmin && " Для администратора 2FA обязательна — отключить её нельзя."}
          </p>

          {backupCodes && <BackupCodes codes={backupCodes} />}

          <div className="space-y-2">
            <Label htmlFor="tfa-code">Код из приложения</Label>
            <Input
              id="tfa-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
              maxLength={6}
              className="max-w-[160px] text-center font-mono tracking-[0.3em]"
            />
            <p className="text-xs text-muted-foreground">
              Требуется для перевыпуска кодов{!isAdmin && " и отключения 2FA"}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={regenerate} disabled={busy || code.trim().length !== 6} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Перевыпустить backup-коды
            </Button>
            {/* Админу кнопку отключения не показываем: бэкенд всё равно ответит 403. */}
            {!isAdmin && (
              <Button variant="destructive" onClick={disable} disabled={busy || code.trim().length !== 6}>
                Отключить 2FA
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Выключена и мастер не запущен ── */}
      {!enabled && !otpauthUri && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Добавьте второй фактор: даже зная пароль, войти без кода из вашего телефона не получится.
          </p>
          {backupCodes && <BackupCodes codes={backupCodes} />}
          <Button onClick={startSetup} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Включить 2FA
          </Button>
        </div>
      )}

      {/* ── Мастер: QR + подтверждение кодом ── */}
      {otpauthUri && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Отсканируйте QR в Google Authenticator, Aegis или 1Password, затем введите код из приложения.
          </p>

          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <div className="rounded-xl border bg-white p-3">
              <QRCodeSVG value={otpauthUri} size={160} level="M" />
            </div>
            <div className="space-y-2">
              {secret && (
                <div>
                  <Label className="text-xs text-muted-foreground">Ключ для ручного ввода</Label>
                  <p className="select-all break-all font-mono text-xs text-muted-foreground">{secret}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="tfa-setup-code">Код из приложения</Label>
                <Input
                  id="tfa-setup-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  maxLength={6}
                  className="max-w-[160px] text-center font-mono tracking-[0.3em]"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={confirmSetup} disabled={busy || code.trim().length !== 6} className="gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Подтвердить
                </Button>
                <Button variant="ghost" onClick={() => { setOtpauthUri(null); setCode(""); }} disabled={busy}>
                  Отмена
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
