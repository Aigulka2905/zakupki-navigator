import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAccessSettings, useUpdateAccessSettings, type AccessOrgType, type AccessSettings } from "@/hooks/useAdmin";

const errorText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
const dateTime = (iso: string) => new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });

const TYPES: { value: AccessOrgType; label: string; many: string }[] = [
  { value: "customer", label: "Заказчики", many: "заказчиков" },
  { value: "participant", label: "Поставщики", many: "поставщиков" },
];

interface Draft { orgTypes: AccessOrgType[]; registrationEnabled: boolean }

function AccessForm({ settings }: { settings: AccessSettings }) {
  const save = useUpdateAccessSettings();
  const [draft, setDraft] = useState<Draft>({ orgTypes: settings.orgTypes, registrationEnabled: settings.registrationEnabled });
  const [confirming, setConfirming] = useState(false);

  const toggleType = (t: AccessOrgType, on: boolean) => setDraft((d) => ({
    ...d,
    orgTypes: on ? TYPES.map((x) => x.value).filter((v) => v === t || d.orgTypes.includes(v)) : d.orgTypes.filter((v) => v !== t),
  }));

  const changed = draft.registrationEnabled !== settings.registrationEnabled
    || draft.orgTypes.length !== settings.orgTypes.length
    || draft.orgTypes.some((t) => !settings.orgTypes.includes(t));
  // Закрываемые типы с пользователями: те потеряют доступ сразу — спрашиваем подтверждение.
  const losing = TYPES.filter((t) => settings.orgTypes.includes(t.value) && !draft.orgTypes.includes(t.value)
    && settings.usersByOrgType[t.value] > 0);

  const submit = () => save.mutate(draft, {
    onSuccess: () => toast.success("Настройки доступа сохранены — действуют сразу"),
    onError: (e: unknown) => toast.error(errorText(e, "Не удалось сохранить настройки доступа")),
    onSettled: () => setConfirming(false),
  });

  return (
    <>
      <div className="mt-4 space-y-3">
        <div>
          <p className="text-xs font-medium">Кому доступен сервис</p>
          <div className="mt-2 flex flex-wrap gap-4">
            {TYPES.map((t) => (
              <div key={t.value} className="flex items-center gap-2">
                <Checkbox
                  id={`access-${t.value}`}
                  checked={draft.orgTypes.includes(t.value)}
                  // Последний тип не снимается: сервис без пользователей — не настройка, а авария.
                  disabled={draft.orgTypes.length === 1 && draft.orgTypes.includes(t.value)}
                  onCheckedChange={(v) => toggleType(t.value, v === true)}
                />
                <Label htmlFor={`access-${t.value}`} className="text-sm font-normal">
                  {t.label}
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    (пользователей: {settings.usersByOrgType[t.value].toLocaleString("ru-RU")})
                  </span>
                </Label>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Не допущенные не входят ни с площадки, ни по паролю; уже открытые сессии получают отказ.
            Оператор платформы (admin) не ограничивается.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div>
            <Label htmlFor="access-registration">Самостоятельная регистрация</Label>
            <p className="text-[11px] text-muted-foreground">
              Выключена — новые пользователи приходят только с площадки или по приглашению организации.
            </p>
          </div>
          <Switch
            id="access-registration"
            checked={draft.registrationEnabled}
            onCheckedChange={(v) => setDraft((d) => ({ ...d, registrationEnabled: v }))}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={() => (losing.length ? setConfirming(true) : submit())} disabled={!changed || save.isPending} className="gap-1.5">
            {save.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
            Сохранить
          </Button>
        </div>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Закрыть доступ?</AlertDialogTitle>
            <AlertDialogDescription>
              {losing.map((t) => `${settings.usersByOrgType[t.value].toLocaleString("ru-RU")} пользователей-${t.many}`).join(" и ")}
              {" "}потеряют доступ сразу после сохранения, включая уже открытые сессии.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={submit}>Закрыть доступ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Админка: кто пользуется сервисом — типы организаций и самостоятельная регистрация. */
export function AccessSettingsCard() {
  const { data, isLoading, isError } = useAccessSettings();

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <UsersRound className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Кто пользуется сервисом</h3>
      </div>
      {data && (
        <p className="mt-1 text-xs text-muted-foreground">
          {data.source === "env"
            ? "Сейчас действуют значения из окружения сервера (ACCESS_ORG_TYPES, REGISTRATION_ENABLED). После сохранения здесь — значения из админки."
            : `Изменено ${data.updatedAt ? dateTime(data.updatedAt) : "—"}${data.updatedBy ? `, ${data.updatedBy}` : ""}.`}
        </p>
      )}
      {isLoading && <p className="mt-4 text-xs text-muted-foreground">Загрузка…</p>}
      {isError && <p className="mt-4 text-xs text-destructive">Не удалось загрузить настройки доступа.</p>}
      {/* key: после сохранения форма берёт новые значения с сервера */}
      {data && <AccessForm key={`${data.updatedAt}-${data.orgTypes.join()}-${data.registrationEnabled}`} settings={data} />}
    </Card>
  );
}
