import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell, BellOff, Mail, BellRing, Star, Plus, Trash2, Loader2, Search, Tag, Building2,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// ── Types ─────────────────────────────────────────────────────
interface FavoriteOrg {
  id: string;
  name: string;
  inn?: string;
  kpp?: string;
  favId: string;
  since: string;
  notifyInApp: boolean;
  notifyEmail: boolean;
}

interface OkpdSubscription {
  id: string;
  okpdCode: string | null;
  label: string;
  keywords: string[];
  notifyInApp: boolean;
  notifyEmail: boolean;
  createdAt: string;
}

interface OkpdSuggestion {
  okpd: string;
  name: string;
}

// ── Channel picker ────────────────────────────────────────────
// Отражает две булевы (notifyInApp / notifyEmail) как один понятный выбор.
type Channels = { notifyInApp: boolean; notifyEmail: boolean };

const CHANNEL_OPTIONS: { key: string; label: string; icon: React.ElementType; value: Channels }[] = [
  { key: "off",   label: "Выкл",           icon: BellOff,  value: { notifyInApp: false, notifyEmail: false } },
  { key: "inapp", label: "В приложении",   icon: Bell,     value: { notifyInApp: true,  notifyEmail: false } },
  { key: "email", label: "Email",          icon: Mail,     value: { notifyInApp: false, notifyEmail: true  } },
  { key: "both",  label: "Оба",            icon: BellRing, value: { notifyInApp: true,  notifyEmail: true  } },
];

function channelKey(c: Channels) {
  if (c.notifyInApp && c.notifyEmail) return "both";
  if (c.notifyInApp) return "inapp";
  if (c.notifyEmail) return "email";
  return "off";
}

function ChannelPicker({
  value, onChange, disabled,
}: { value: Channels; onChange: (c: Channels) => void; disabled?: boolean }) {
  const active = channelKey(value);
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border/60 p-1">
      {CHANNEL_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isActive = opt.key === active;
        return (
          <button
            key={opt.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            title={opt.label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              "disabled:opacity-50",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── API ───────────────────────────────────────────────────────
async function fetchFavorites() {
  const { data } = await apiClient.get<FavoriteOrg[]>("/customers/favorites");
  return data;
}
async function fetchOkpdSubs() {
  const { data } = await apiClient.get<OkpdSubscription[]>("/subscriptions/okpd");
  return data;
}
async function fetchOkpdSuggest(q: string) {
  if (q.trim().length < 2) return [];
  const { data } = await apiClient.get<OkpdSuggestion[]>("/national-regime/suggest", { params: { q } });
  return data;
}

// ── Favorites section ─────────────────────────────────────────
function FavoritesSection() {
  const qc = useQueryClient();
  const { data: favorites = [], isLoading } = useQuery({ queryKey: ["favorites"], queryFn: fetchFavorites });

  const updateChannels = useMutation({
    mutationFn: ({ customerId, channels }: { customerId: string; channels: Channels }) =>
      apiClient.patch(`/customers/favorites/${customerId}`, channels),
    onMutate: async ({ customerId, channels }) => {
      await qc.cancelQueries({ queryKey: ["favorites"] });
      const prev = qc.getQueryData<FavoriteOrg[]>(["favorites"]);
      qc.setQueryData<FavoriteOrg[]>(["favorites"], (old) =>
        (old ?? []).map((f) => (f.id === customerId ? { ...f, ...channels } : f)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["favorites"], ctx.prev);
      toast.error("Не удалось изменить способ уведомления");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const remove = useMutation({
    mutationFn: (customerId: string) => apiClient.delete(`/customers/favorites/${customerId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favorites"] });
      toast.success("Заказчик удалён из избранного");
    },
    onError: () => toast.error("Не удалось удалить заказчика"),
  });

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-1">
        <Star className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-semibold">Избранные заказчики</h2>
        <Badge variant="secondary" className="ml-auto">{favorites.length}</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Уведомления о новых закупках выбранных заказчиков. Способ уведомления настраивается отдельно для каждого.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : favorites.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
          <Building2 className="mx-auto mb-2 h-7 w-7 opacity-40" />
          Пока нет избранных заказчиков.<br />
          Добавьте заказчика из карточки закупки или раздела «Все закупки».
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {favorites.map((f) => (
            <li key={f.favId} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="truncate font-medium">{f.name}</div>
                {f.inn && <div className="text-xs text-muted-foreground">ИНН {f.inn}{f.kpp ? ` · КПП ${f.kpp}` : ""}</div>}
              </div>
              <div className="flex items-center gap-2">
                <ChannelPicker
                  value={{ notifyInApp: f.notifyInApp, notifyEmail: f.notifyEmail }}
                  disabled={updateChannels.isPending}
                  onChange={(channels) => updateChannels.mutate({ customerId: f.id, channels })}
                />
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(f.id)}
                  title="Удалить из избранного"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── ОКПД subscriptions section ────────────────────────────────
function OkpdSection() {
  const qc = useQueryClient();
  const { data: subs = [], isLoading } = useQuery({ queryKey: ["okpd-subs"], queryFn: fetchOkpdSubs });

  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<OkpdSuggestion | null>(null);
  const { data: suggestions = [] } = useQuery({
    queryKey: ["okpd-suggest", term],
    queryFn: () => fetchOkpdSuggest(term),
    enabled: term.trim().length >= 2 && !picked,
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiClient.post("/subscriptions/okpd", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["okpd-subs"] });
      setTerm(""); setPicked(null);
      toast.success("Подписка создана");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Не удалось создать подписку");
    },
  });

  const updateChannels = useMutation({
    mutationFn: ({ id, channels }: { id: string; channels: Channels }) =>
      apiClient.patch(`/subscriptions/okpd/${id}`, channels),
    onMutate: async ({ id, channels }) => {
      await qc.cancelQueries({ queryKey: ["okpd-subs"] });
      const prev = qc.getQueryData<OkpdSubscription[]>(["okpd-subs"]);
      qc.setQueryData<OkpdSubscription[]>(["okpd-subs"], (old) =>
        (old ?? []).map((s) => (s.id === id ? { ...s, ...channels } : s)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["okpd-subs"], ctx.prev);
      toast.error("Не удалось изменить способ уведомления");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["okpd-subs"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/subscriptions/okpd/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["okpd-subs"] }); toast.success("Подписка удалена"); },
    onError: () => toast.error("Не удалось удалить подписку"),
  });

  const submit = () => {
    if (picked) {
      create.mutate({ okpdCode: picked.okpd, label: picked.name });
    } else if (term.trim().length >= 2) {
      create.mutate({ keywords: term.trim(), label: term.trim() });
    } else {
      toast.error("Введите код ОКПД или ключевые слова (мин. 2 символа)");
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-1">
        <Tag className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Подписки по ОКПД</h2>
        <Badge variant="secondary" className="ml-auto">{subs.length}</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Уведомления о новых закупках по коду ОКПД2 или ключевым словам. Совпадение определяется по названию закупки.
      </p>

      {/* Add form */}
      <div className="relative mb-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => { setTerm(e.target.value); setPicked(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="Код ОКПД2 (напр. 49.41) или ключевые слова"
              className="pl-9"
            />
            {/* Suggestions dropdown */}
            {!picked && suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                {suggestions.map((s) => (
                  <button
                    key={s.okpd}
                    type="button"
                    onClick={() => { setPicked(s); setTerm(`${s.okpd} — ${s.name}`); }}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <Badge variant="outline" className="mt-0.5 shrink-0 font-mono text-[11px]">{s.okpd}</Badge>
                    <span className="text-muted-foreground">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={submit} disabled={create.isPending} className="shrink-0">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1.5">Подписаться</span>
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Выберите код из подсказок каталога или введите свои ключевые слова через пробел.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : subs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
          <Tag className="mx-auto mb-2 h-7 w-7 opacity-40" />
          Пока нет подписок по ОКПД.
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {subs.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {s.okpdCode && <Badge variant="outline" className="font-mono text-[11px]">{s.okpdCode}</Badge>}
                  <span className="truncate font-medium">{s.label}</span>
                </div>
                {s.keywords.length > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Ключевые слова: {s.keywords.join(", ")}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ChannelPicker
                  value={{ notifyInApp: s.notifyInApp, notifyEmail: s.notifyEmail }}
                  disabled={updateChannels.isPending}
                  onChange={(channels) => updateChannels.mutate({ id: s.id, channels })}
                />
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(s.id)}
                  title="Удалить подписку"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function SubscriptionsPage() {
  const { data: currentUser } = useCurrentUser();
  const isCustomer = currentUser?.organization?.orgType === "customer";

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Подписки</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Отслеживайте новые закупки избранных заказчиков и по интересующим кодам ОКПД.
          </p>
        </header>

        {isCustomer ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Подписки на закупки доступны участникам. Ваша организация зарегистрирована как заказчик.
          </Card>
        ) : (
          <div className="flex flex-col gap-5">
            <FavoritesSection />
            <OkpdSection />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
