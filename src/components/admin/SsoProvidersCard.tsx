import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useCreateSsoProvider, useDeleteSsoProvider, useSsoProviders, useUpdateSsoProvider,
  type SsoProvider, type SsoProviderInput,
} from "@/hooks/useAdmin";

const errorText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
const dateTime = (iso: string) => new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });

// Код — в адресе возврата на площадке и в связях вошедших пользователей: после создания не меняется.
const CODE_RE = /^[a-z][a-z0-9-]{1,31}$/;

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
      () => toast.error("Не удалось скопировать — выделите адрес вручную"),
    );
  };
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-28 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-muted px-1.5 py-0.5 text-[11px]" title={value}>{value}</code>
      <Button type="button" size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={copy} aria-label={`Скопировать: ${label}`}>
        {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function status(p: SsoProvider) {
  if (p.enabled) return <Badge className="bg-emerald-600 hover:bg-emerald-600">Вход включён</Badge>;
  if (!p.hasClientSecret) return <Badge variant="outline">Не настроена: нет секрета</Badge>;
  return <Badge variant="secondary">Выключена</Badge>;
}

interface FormState {
  code: string;
  name: string;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  enabled: boolean;
}
const EMPTY: FormState = { code: "", name: "", baseUrl: "https://", clientId: "zakupki-ai", clientSecret: "", enabled: false };

/**
 * Добавление и правка площадки. Секрет — только ввод: пустое поле при правке оставляет прежний.
 * Монтируется на время открытия — форма каждый раз заполняется заново.
 */
function ProviderDialog({ provider, onClose }: { provider: SsoProvider | null; onClose: () => void }) {
  const create = useCreateSsoProvider();
  const update = useUpdateSsoProvider();
  const editing = provider !== null;
  const [form, setForm] = useState<FormState>(() => (provider
    ? { code: provider.code, name: provider.name, baseUrl: provider.baseUrl, clientId: provider.clientId, clientSecret: "", enabled: provider.enabled }
    : EMPTY));

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const hasSecret = form.clientSecret !== "" || (provider?.hasClientSecret ?? false);
  const codeError = !editing && form.code !== "" && !CODE_RE.test(form.code)
    ? "Латиница в нижнем регистре, цифры и «-», 2–32 символа"
    : null;
  const canSave = form.name.trim() !== "" && form.baseUrl.trim() !== "" && form.clientId.trim() !== ""
    && (editing || CODE_RE.test(form.code));
  const pending = create.isPending || update.isPending;

  const save = () => {
    const body: SsoProviderInput = {
      name: form.name, baseUrl: form.baseUrl, clientId: form.clientId, enabled: form.enabled,
      ...(form.clientSecret ? { clientSecret: form.clientSecret } : {}),
    };
    const done = {
      onSuccess: () => {
        toast.success(editing ? "Настройки площадки сохранены" : "Площадка добавлена");
        onClose();
      },
      onError: (e: unknown) => toast.error(errorText(e, "Не удалось сохранить площадку")),
    };
    if (editing) update.mutate({ code: provider.code, ...body }, done);
    else create.mutate({ code: form.code, ...body }, done);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Площадка «${provider.name}»` : "Новая площадка"}</DialogTitle>
          <DialogDescription>
            Площадка на движке 223-platform. client_id и секрет выдаёт администратор площадки,
            когда регистрирует клиент ZakupkiAI.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="sso-code">Код</Label>
            <Input
              id="sso-code" value={form.code} disabled={editing} placeholder="aftorgi"
              onChange={(e) => set("code", e.target.value.trim().toLowerCase())}
            />
            <p className={codeError ? "text-[11px] text-destructive" : "text-[11px] text-muted-foreground"}>
              {codeError ?? (editing
                ? "Код не меняется: он прописан в адресе возврата на площадке."
                : "Войдёт в адреса входа. После создания изменить нельзя.")}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sso-name">Название</Label>
            <Input id="sso-name" value={form.name} placeholder="АФ-Торги" onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sso-base">Адрес площадки</Label>
            <Input id="sso-base" value={form.baseUrl} placeholder="https://lk.af-torgi.ru" onChange={(e) => set("baseUrl", e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Только домен, без пути. Сюда уходит секрет клиента — проверьте адрес.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sso-client">client_id</Label>
            <Input id="sso-client" value={form.clientId} onChange={(e) => set("clientId", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sso-secret">Секрет клиента</Label>
            <Input
              id="sso-secret" type="password" autoComplete="new-password" value={form.clientSecret}
              placeholder={provider?.hasClientSecret ? "Задан — оставьте пустым, чтобы не менять" : "Не задан"}
              onChange={(e) => set("clientSecret", e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">Хранится зашифрованным; посмотреть его потом нельзя — только заменить.</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <Label htmlFor="sso-enabled">Вход включён</Label>
              {!hasSecret && <p className="text-[11px] text-muted-foreground">Сначала задайте секрет</p>}
            </div>
            <Switch id="sso-enabled" checked={form.enabled} disabled={!hasSecret} onCheckedChange={(v) => set("enabled", v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={save} disabled={!canSave || pending} className="gap-1.5">
            {pending && <RefreshCw className="h-4 w-4 animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Админка: площадки для бесшовного входа из личного кабинета ЭТП (223-platform).
 * Адреса для площадки (возврат и пункт меню) — готовыми, с кнопкой «скопировать».
 */
export function SsoProvidersCard() {
  const { data: providers, isLoading, isError } = useSsoProviders();
  const update = useUpdateSsoProvider();
  const remove = useDeleteSsoProvider();
  // undefined — диалог закрыт, null — новая площадка.
  const [editing, setEditing] = useState<SsoProvider | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<SsoProvider | null>(null);

  const toggle = (p: SsoProvider, enabled: boolean) => update.mutate({ code: p.code, enabled }, {
    onSuccess: () => toast.success(enabled ? `Вход с «${p.name}» включён` : `Вход с «${p.name}» выключен`),
    onError: (e: unknown) => toast.error(errorText(e, "Не удалось изменить площадку")),
  });

  const confirmDelete = () => {
    if (!toDelete) return;
    remove.mutate(toDelete.code, {
      onSuccess: () => toast.success(`Площадка «${toDelete.name}» удалена`),
      onError: (e: unknown) => toast.error(errorText(e, "Не удалось удалить площадку")),
      onSettled: () => setToDelete(null),
    });
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Вход с площадок</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Бесшовный переход из личного кабинета ЭТП на движке 223-platform. Изменения действуют сразу.
          </p>
        </div>
        <Button size="sm" className="shrink-0 gap-1.5" onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4" /> Добавить площадку
        </Button>
      </div>

      {isLoading && <p className="mt-4 text-xs text-muted-foreground">Загрузка…</p>}
      {isError && <p className="mt-4 text-xs text-destructive">Не удалось загрузить список площадок.</p>}
      {providers?.length === 0 && (
        <p className="mt-4 text-xs text-muted-foreground">Площадок пока нет — вход через ЭТП выключен.</p>
      )}

      <div className="mt-4 space-y-3">
        {providers?.map((p) => (
          <div key={p.code} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{p.name}</span>
              <code className="text-[11px] text-muted-foreground">{p.code}</code>
              {status(p)}
              <div className="ml-auto flex items-center gap-1">
                <Switch
                  checked={p.enabled}
                  disabled={!p.hasClientSecret || update.isPending}
                  onCheckedChange={(v) => toggle(p, v)}
                  aria-label={`Вход с «${p.name}»`}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Изменить «${p.name}»`}
                  onClick={() => setEditing(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon" variant="ghost" className="h-7 w-7" aria-label={`Удалить «${p.name}»`}
                  disabled={p.usersCount > 0}
                  title={p.usersCount > 0 ? "Через площадку уже входили — её можно только выключить" : undefined}
                  onClick={() => setToDelete(p)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {p.baseUrl} · client_id <span className="font-mono">{p.clientId}</span>
              {" · "}
              {p.usersCount > 0
                ? `входили: ${p.usersCount.toLocaleString("ru-RU")}${p.lastLoginAt ? `, последний вход ${dateTime(p.lastLoginAt)}` : ""}`
                : "ещё никто не входил"}
            </p>
            <div className="mt-2 space-y-1">
              <CopyField label="Адрес возврата" value={p.callbackUrl} />
              <CopyField label="Пункт меню" value={p.startUrl} />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        На самой площадке: клиент с этим адресом возврата и scope zakupki_ai, клиент — в OAUTH_TRUSTED_CLIENTS,
        пункт меню ведёт на адрес «Пункт меню» с id профиля.
      </p>

      {editing !== undefined && (
        <ProviderDialog key={editing?.code ?? "new"} provider={editing} onClose={() => setEditing(undefined)} />
      )}

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => { if (!open) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить площадку «{toDelete?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Вход с этой площадки перестанет работать. Через неё ещё никто не входил, пользователи не пострадают.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
