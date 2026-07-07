import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Settings2,
  CheckCircle2,
  XCircle,
  Bot,
  Mail,
  CreditCard,
  HardDrive,
  ShieldCheck,
  ServerCog,
  BarChart2,
  ScrollText,
  RefreshCw,
  RotateCcw,
  Search,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  User,
  LogIn,
  Ban,
  ShieldCheck as ShieldCheckIcon,
  BadgeCheck,
  FileScan,
  Landmark,
  Database,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  useAdminUsers,
  useAdminStats,
  useSystemInfo,
  useUpdateUserRole,
  useUpdateOrgPlan,
  useVerifyUser,
  useSetUserBlocked,
  useImpersonate,
  useAdminLogs,
  useAdminAudit,
  useSyncStatus,
  useSyncRftorgi,
  useSyncAftorgi,
} from "@/hooks/useAdmin";
import type { LogEntry, LogLevel, AuditEntry } from "@/hooks/useAdmin";
import { toast } from "sonner";
import type { UserRole, SubscriptionPlan } from "@/types/api";
import { cn } from "@/lib/utils";
import { AdminAiUsageTab } from "./AdminAiUsagePage";
import { useState, useEffect } from "react";

// ── Role badge ────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Администратор",
  specialist: "Специалист",
  viewer: "Наблюдатель",
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "bg-red-500/10 text-red-400 border-red-500/20",
  specialist: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  viewer: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const ORG_TYPE_LABELS = { customer: "Заказчик", participant: "Участник" };
const ORG_TYPE_COLORS = {
  customer: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  participant: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};
const PLAN_COLORS: Record<SubscriptionPlan, string> = {
  free: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  pro: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  enterprise: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

// ── StatusDot ─────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
  ) : (
    <XCircle className="h-4 w-4 text-slate-500" />
  );
}

// ── Info card ─────────────────────────────────────────────────

function InfoCard({
  icon: Icon,
  title,
  rows,
}: {
  icon: React.ElementType;
  title: string;
  rows: { label: string; value: React.ReactNode }[];
}) {
  return (
    <Card className="border-border/60 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="h-4 w-4 text-indigo-400" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <dt className="text-xs text-muted-foreground shrink-0">{label}</dt>
              <dd className="text-xs font-medium text-foreground text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

// ── Users tab ─────────────────────────────────────────────────

function UsersTab() {
  const { data: users = [], isLoading } = useAdminUsers();
  const { data: me } = useCurrentUser();
  const { mutate: updateRole } = useUpdateUserRole();
  const { mutate: updatePlan } = useUpdateOrgPlan();
  const verify = useVerifyUser();
  const block = useSetUserBlocked();
  const impersonate = useImpersonate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [orgTypeFilter, setOrgTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const PAGE_SIZE = 10;

  // Сброс на первую страницу при смене фильтров/поиска.
  useEffect(() => { setPage(1); }, [search, roleFilter, orgTypeFilter, statusFilter]);

  const onVerify = (id: string) =>
    verify.mutate(id, {
      onSuccess: () => toast.success("Аккаунт подтверждён"),
      onError: () => toast.error("Не удалось подтвердить аккаунт"),
    });

  const onToggleBlock = (id: string, currentlyBlocked: boolean) => {
    if (!currentlyBlocked && !window.confirm("Заблокировать пользователя? Он не сможет войти и будет отключён от текущих сессий.")) return;
    block.mutate(
      { userId: id, blocked: !currentlyBlocked },
      {
        onSuccess: () => toast.success(currentlyBlocked ? "Пользователь разблокирован" : "Пользователь заблокирован"),
        onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Не удалось изменить статус"),
      },
    );
  };

  const onImpersonate = (id: string, email: string) => {
    if (!window.confirm(`Войти под пользователем ${email}?\nТекущая админ-сессия будет заменена. Чтобы вернуться, выйдите и войдите снова как администратор.`)) return;
    impersonate.mutate(id, {
      onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Не удалось войти под пользователем"),
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
        Загрузка...
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    const ot = u.organization?.orgType ?? "participant";
    if (orgTypeFilter !== "all" && ot !== orgTypeFilter) return false;
    if (statusFilter === "blocked" && !u.blockedAt) return false;
    if (statusFilter === "active" && u.blockedAt) return false;
    if (statusFilter === "unverified" && u.emailVerified) return false;
    if (q) {
      const hay = [u.email, u.fullName, u.organization?.name, u.organization?.inn]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageUsers = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-3">
    {/* Поиск и фильтры */}
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по email, имени, организации, ИНН"
          className="h-8 pl-8 text-xs"
        />
      </div>
      <Select value={roleFilter} onValueChange={setRoleFilter}>
        <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все роли</SelectItem>
          <SelectItem value="admin">Администратор</SelectItem>
          <SelectItem value="specialist">Специалист</SelectItem>
          <SelectItem value="viewer">Наблюдатель</SelectItem>
        </SelectContent>
      </Select>
      <Select value={orgTypeFilter} onValueChange={setOrgTypeFilter}>
        <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все типы</SelectItem>
          <SelectItem value="participant">Участник</SelectItem>
          <SelectItem value="customer">Заказчик</SelectItem>
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Любой статус</SelectItem>
          <SelectItem value="active">Активные</SelectItem>
          <SelectItem value="blocked">Заблокированные</SelectItem>
          <SelectItem value="unverified">Email не подтверждён</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="rounded-lg border border-border/60 dark:border-white/[0.06] overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="dark:border-white/[0.06] hover:bg-transparent">
            <TableHead className="text-xs font-semibold text-muted-foreground">Пользователь</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Роль</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Тип орг.</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Организация</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Тариф</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground text-center">Email</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Регистрация</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageUsers.map((user) => {
            const orgType = user.organization?.orgType ?? "participant";
            const plan = (user.organization?.subscriptionPlan ?? "free") as SubscriptionPlan;
            const isSelf = user.id === me?.id;
            const isAdmin = user.role === "admin";
            const isBlocked = !!user.blockedAt;

            return (
              <TableRow
                key={user.id}
                className={cn(
                  "dark:border-white/[0.04] dark:hover:bg-white/[0.02]",
                  isBlocked && "opacity-60",
                )}
              >
                {/* Name + email */}
                <TableCell className="py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm leading-tight">{user.fullName}</span>
                    {isBlocked && (
                      <Badge variant="outline" className="text-[10px] font-semibold border-rose-300 text-rose-600 dark:border-rose-500/40 dark:text-rose-400">
                        Заблокирован
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{user.email}</div>
                </TableCell>

                {/* Role select */}
                <TableCell>
                  <Select
                    value={user.role}
                    onValueChange={(role) => updateRole({ userId: user.id, role })}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-7 w-36 text-xs border",
                        ROLE_COLORS[user.role as UserRole],
                        "dark:bg-transparent",
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Администратор</SelectItem>
                      <SelectItem value="specialist">Специалист</SelectItem>
                      <SelectItem value="viewer">Наблюдатель</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* Org type badge */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-semibold",
                      ORG_TYPE_COLORS[orgType as keyof typeof ORG_TYPE_COLORS],
                    )}
                  >
                    {ORG_TYPE_LABELS[orgType as keyof typeof ORG_TYPE_LABELS] ?? orgType}
                  </Badge>
                </TableCell>

                {/* Org name + INN */}
                <TableCell>
                  {user.organization ? (
                    <>
                      <div className="text-sm leading-tight">{user.organization.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        ИНН: {user.organization.inn}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>

                {/* Plan select */}
                <TableCell>
                  {user.organization ? (
                    <Select
                      value={plan}
                      onValueChange={(p) =>
                        updatePlan({ orgId: user.organization!.id, plan: p })
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          "h-7 w-28 text-xs border",
                          PLAN_COLORS[plan],
                          "dark:bg-transparent",
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>

                {/* Email verified + ручное подтверждение */}
                <TableCell className="text-center">
                  {user.emailVerified ? (
                    <StatusDot ok />
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-[11px]"
                      disabled={verify.isPending}
                      onClick={() => onVerify(user.id)}
                    >
                      <BadgeCheck className="h-3.5 w-3.5" /> Подтвердить
                    </Button>
                  )}
                </TableCell>

                {/* Created at */}
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(user.createdAt).toLocaleDateString("ru-RU")}
                </TableCell>

                {/* Действия: вход под пользователем + блокировка */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-[11px]"
                      disabled={isSelf || isAdmin || isBlocked || impersonate.isPending}
                      title={isSelf ? "Это ваша учётная запись" : isAdmin ? "Нельзя войти под администратором" : isBlocked ? "Разблокируйте пользователя" : "Войти в систему под этим пользователем"}
                      onClick={() => onImpersonate(user.id, user.email)}
                    >
                      <LogIn className="h-3.5 w-3.5" /> Войти
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(
                        "h-7 gap-1 text-[11px]",
                        isBlocked
                          ? "border-emerald-300 text-emerald-600 dark:border-emerald-500/40 dark:text-emerald-400"
                          : "border-rose-300 text-rose-600 dark:border-rose-500/40 dark:text-rose-400",
                      )}
                      disabled={isSelf || isAdmin || block.isPending}
                      title={isSelf ? "Нельзя заблокировать себя" : isAdmin ? "Нельзя заблокировать администратора" : ""}
                      onClick={() => onToggleBlock(user.id, isBlocked)}
                    >
                      {isBlocked ? <ShieldCheckIcon className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                      {isBlocked ? "Разблок." : "Блок"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {pageUsers.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                Ничего не найдено по заданным условиям
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>

    <div className="flex items-center justify-between px-1">
      <span className="text-xs text-muted-foreground">
        {filtered.length === 0
          ? "Нет пользователей"
          : `Показаны ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} из ${filtered.length}`}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
            Назад
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">{currentPage} / {totalPages}</span>
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
            Вперёд
          </Button>
        </div>
      )}
    </div>
    </div>
  );
}

// ── Parameters tab ────────────────────────────────────────────

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "только что";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} мин назад`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ч назад`;
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function SyncCard({ title, onSync, isPending, lastSyncAt, procurementCount, statusLoading }: {
  title: string;
  onSync: () => void;
  isPending: boolean;
  lastSyncAt?: string | null;
  procurementCount?: number;
  statusLoading?: boolean;
}) {
  return (
    <Card className="border-border/60 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <RotateCcw className="h-4 w-4 text-indigo-400" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4">
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <dt className="text-xs text-muted-foreground">Последняя синхронизация</dt>
              <dd className="text-xs font-medium text-foreground mt-0.5">
                {statusLoading ? "..." : lastSyncAt ? relTime(lastSyncAt) : "Нет данных"}
              </dd>
            </div>
            {procurementCount !== undefined && (
              <div>
                <dt className="text-xs text-muted-foreground">Закупок в базе</dt>
                <dd className="text-xs font-medium text-foreground mt-0.5">
                  {statusLoading ? "..." : procurementCount.toLocaleString("ru-RU")}
                </dd>
              </div>
            )}
          </dl>

          <button
            type="button"
            disabled={isPending}
            onClick={onSync}
            className={cn(
              "ml-auto flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              "bg-indigo-500/15 text-indigo-400 ring-1 ring-inset ring-indigo-500/25",
              "hover:bg-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
            {isPending ? "Запускается..." : "Запустить"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function SyncCards() {
  const { data: status, isLoading: statusLoading } = useSyncStatus();
  const { mutate: triggerRftorgi, isPending: rftorgiPending } = useSyncRftorgi();
  const { mutate: triggerAftorgi, isPending: aftorgiPending } = useSyncAftorgi();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:col-span-3 sm:col-span-2">
      <SyncCard
        title="Синхронизация РФТорги"
        isPending={rftorgiPending}
        lastSyncAt={status?.lastSyncAt}
        procurementCount={status?.procurementCount}
        statusLoading={statusLoading}
        onSync={() => triggerRftorgi(undefined, {
          onSuccess: () => toast.success("РФТорги: синхронизация поставлена в очередь"),
          onError: () => toast.error("Не удалось запустить синхронизацию"),
        })}
      />
      <SyncCard
        title="Синхронизация АФ Торги"
        isPending={aftorgiPending}
        lastSyncAt={status?.lastSyncAt}
        statusLoading={statusLoading}
        onSync={() => triggerAftorgi(undefined, {
          onSuccess: () => toast.success("АФ Торги: синхронизация поставлена в очередь"),
          onError: () => toast.error("Не удалось запустить синхронизацию"),
        })}
      />
    </div>
  );
}

function ParametersTab() {
  const { data: sys, refetch, isFetching } = useSystemInfo();
  const { data: stats } = useAdminStats();

  if (!sys) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
        Загрузка...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Текущая конфигурация окружения ({sys.environment}).</p>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} /> Обновить
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <InfoCard
        icon={Bot}
        title="AI-ассистент"
        rows={[
          { label: "Провайдер", value: sys.ai.provider },
          { label: "Модель", value: <span className="font-mono text-[11px]">{sys.ai.model}</span> },
          { label: "Настроен", value: <StatusDot ok={sys.ai.configured} /> },
          { label: "Температура", value: sys.ai.temperature },
          { label: "Макс. токенов", value: sys.ai.maxTokens.toLocaleString("ru-RU") },
        ]}
      />

      <InfoCard
        icon={Mail}
        title="Email / SMTP"
        rows={[
          { label: "Настроен", value: <StatusDot ok={sys.email.configured} /> },
          { label: "Хост", value: sys.email.host ?? "—" },
          { label: "Отправитель", value: sys.email.from ?? "—" },
        ]}
      />

      <InfoCard
        icon={CreditCard}
        title="Биллинг"
        rows={[
          {
            label: "ЮKassa",
            value: <StatusDot ok={sys.billing.yookassaConfigured} />,
          },
        ]}
      />

      <InfoCard
        icon={HardDrive}
        title="Хранилище"
        rows={[
          { label: "S3 / MinIO", value: <StatusDot ok={sys.storage.s3Configured} /> },
          {
            label: "Путь",
            value: <span className="font-mono text-[11px]">{sys.storage.uploadPath}</span>,
          },
          { label: "Макс. файл", value: `${sys.storage.maxFileSizeMb} МБ` },
        ]}
      />

      <InfoCard
        icon={ShieldCheck}
        title="Безопасность"
        rows={[
          { label: "BCrypt rounds", value: sys.security.bcryptRounds },
          { label: "Access TTL", value: sys.security.accessTokenTtl },
          { label: "Refresh TTL", value: sys.security.refreshTokenTtl },
          { label: "Макс. сессий", value: sys.security.maxSessions },
          {
            label: "CORS origin",
            value: <span className="font-mono text-[11px]">{sys.security.corsOrigin}</span>,
          },
        ]}
      />

      <InfoCard
        icon={ServerCog}
        title="Платформа"
        rows={[
          { label: "Среда", value: sys.environment },
          { label: "Node.js", value: <span className="font-mono text-[11px]">{sys.nodeVersion}</span> },
          ...(stats
            ? [
                { label: "Пользователей", value: stats.users.toLocaleString("ru-RU") },
                { label: "Закупок", value: stats.procurements.toLocaleString("ru-RU") },
                { label: "Документов БЗ", value: stats.documents.toLocaleString("ru-RU") },
              ]
            : []),
        ]}
      />

      <InfoCard
        icon={FileScan}
        title="Документы / OCR"
        rows={[
          { label: "Сайдкар", value: <StatusDot ok={!!sys.integrations?.docExtraction.configured} /> },
          { label: "Извлечение", value: sys.integrations?.docExtraction.configured ? "markitdown + OCR" : "встроенное (unpdf)" },
          ...(sys.integrations?.docExtraction.url
            ? [{ label: "URL", value: <span className="font-mono text-[11px]">{sys.integrations.docExtraction.url}</span> }]
            : []),
        ]}
      />

      <InfoCard
        icon={Landmark}
        title="ЕГРЮЛ / контрагенты"
        rows={[
          { label: "Checko", value: <StatusDot ok={!!sys.integrations?.egrul.configured} /> },
          { label: "Источник", value: sys.integrations?.egrul.provider ?? "—" },
        ]}
      />

      <InfoCard
        icon={Database}
        title="Redis"
        rows={[
          { label: "Очереди / кэш", value: <StatusDot ok={!!sys.integrations?.redis.configured} /> },
        ]}
      />

      <SyncCards />
      </div>
    </div>
  );
}

// ── Logs tab ──────────────────────────────────────────────────

const LEVEL_OPTIONS = ["all", "error", "warn", "info"] as const;
type LevelFilter = (typeof LEVEL_OPTIONS)[number];

const LEVEL_LABELS: Record<LevelFilter, string> = {
  all: "Все",
  error: "Error",
  warn: "Warn",
  info: "Info",
};

const LEVEL_BADGE: Record<LogLevel, string> = {
  fatal: "bg-red-600/15 text-red-300 border-red-600/25",
  error: "bg-red-500/15 text-red-400 border-red-500/25",
  warn:  "bg-amber-500/15 text-amber-400 border-amber-500/25",
  info:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  debug: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  trace: "bg-slate-500/10 text-slate-300 border-slate-500/15",
};

function relTimeMs(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}с`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}м`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}ч`;
  return new Date(ts).toLocaleDateString("ru-RU", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatDetails(entry: LogEntry): string {
  const lines: string[] = [`Время: ${new Date(entry.time).toLocaleString("ru-RU")}`];
  if (entry.err) {
    lines.push(`Ошибка: ${entry.err.message}`);
    if (entry.err.type)  lines.push(`Тип: ${entry.err.type}`);
    if (entry.err.stack) lines.push(`\n${entry.err.stack}`);
  }
  const skip = new Set(["time", "level", "msg", "err"]);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entry)) {
    if (!skip.has(k) && v !== undefined) extra[k] = v;
  }
  if (Object.keys(extra).length > 0) {
    lines.push(`\n${JSON.stringify(extra, null, 2)}`);
  }
  return lines.join("\n");
}

function LogsTab() {
  const [level, setLevel]           = useState<LevelFilter>("warn");
  const [search, setSearch]         = useState("");
  const [debSearch, setDebSearch]   = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expanded, setExpanded]     = useState<Set<number>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useAdminLogs({
    level:  level === "all" ? undefined : level,
    search: debSearch || undefined,
  });

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => void refetch(), 15_000);
    return () => clearInterval(id);
  }, [autoRefresh, refetch]);

  const entries = data?.entries ?? [];

  function toggle(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Level buttons */}
        <div className="flex rounded-md border border-border/60 dark:border-white/[0.06] overflow-hidden">
          {LEVEL_OPTIONS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                level === l
                  ? "bg-indigo-500/15 text-indigo-400"
                  : "text-muted-foreground hover:text-foreground dark:hover:bg-white/[0.03]",
              )}
            >
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="h-8 pl-8 text-xs dark:bg-white/[0.02]"
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Auto-refresh */}
        <button
          onClick={() => setAutoRefresh((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs border transition-colors",
            autoRefresh
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-border/60 dark:border-white/[0.06] text-muted-foreground hover:text-foreground",
          )}
          title="Автообновление каждые 15 секунд"
        >
          <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
          {autoRefresh ? "Авто 15с" : "Вручную"}
        </button>

        <button
          onClick={() => void refetch()}
          className="flex items-center gap-1.5 rounded-md border border-border/60 dark:border-white/[0.06] px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Обновить
        </button>

        <span className="text-xs text-muted-foreground ml-auto">
          {entries.length} записей
          {dataUpdatedAt ? ` · обновлено ${relTimeMs(dataUpdatedAt)} назад` : ""}
        </span>
      </div>

      {/* Note (e.g. file not created yet) */}
      {data?.note && (
        <p className="text-xs text-muted-foreground px-1">{data.note}</p>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
          Загрузка...
        </div>
      ) : entries.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
          Записей нет
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 dark:border-white/[0.06] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/60 dark:border-white/[0.06] bg-white/[0.01]">
                <th className="py-2 px-3 text-left font-semibold text-muted-foreground w-10" />
                <th className="py-2 px-3 text-left font-semibold text-muted-foreground w-20">Время</th>
                <th className="py-2 px-3 text-left font-semibold text-muted-foreground w-16">Уровень</th>
                <th className="py-2 px-3 text-left font-semibold text-muted-foreground">Сообщение</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <>
                  <tr
                    key={idx}
                    onClick={() => toggle(idx)}
                    className={cn(
                      "border-b border-border/60 dark:border-white/[0.04] cursor-pointer transition-colors select-none",
                      "dark:hover:bg-white/[0.02]",
                      expanded.has(idx) && "dark:bg-white/[0.025]",
                    )}
                  >
                    <td className="py-2 px-3 text-muted-foreground">
                      {expanded.has(idx)
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap font-mono">
                      {relTimeMs(entry.time)}
                    </td>
                    <td className="py-2 px-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-semibold uppercase px-1.5",
                          LEVEL_BADGE[entry.level] ?? LEVEL_BADGE.debug,
                        )}
                      >
                        {entry.level}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 max-w-0 w-full">
                      <span className="block truncate text-foreground/90">
                        {entry.msg}
                        {entry.err && (
                          <span className="text-red-400 ml-1.5">
                            — {entry.err.message}
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>

                  {expanded.has(idx) && (
                    <tr
                      key={`${idx}-d`}
                      className="border-b border-border/60 dark:border-white/[0.04] dark:bg-white/[0.015]"
                    >
                      <td colSpan={4} className="px-4 py-3">
                        <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                          {formatDetails(entry)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Audit tab ─────────────────────────────────────────────────

const ACTION_CATEGORIES = [
  { value: "all",          label: "Все действия" },
  { value: "auth",         label: "Авторизация" },
  { value: "procurement",  label: "Закупки" },
  { value: "document",     label: "База знаний" },
  { value: "org",          label: "Организация" },
  { value: "analysis",     label: "Анализ" },
  { value: "admin",        label: "Администр." },
] as const;

const ACTION_LABELS: Record<string, string> = {
  "auth.login":                    "Вход в систему",
  "auth.login_failed":             "Неудачный вход",
  "auth.email_verified":           "Подтверждение email",
  "auth.password_reset_requested": "Запрос сброса пароля",
  "auth.password_reset":           "Сброс пароля",
  "procurement.create":            "Создание закупки",
  "procurement.update":            "Изменение закупки",
  "procurement.delete":            "Удаление закупки",
  "document.create":               "Добавление документа",
  "document.update":               "Изменение документа",
  "document.delete":               "Удаление документа",
  "org.update":                    "Обновление профиля",
  "org_document.upload":           "Загрузка документа",
  "org_document.delete":           "Удаление документа",
  "analysis.upload":               "Анализ документа",
  "admin.role_update":             "Изменение роли",
  "admin.plan_update":             "Изменение тарифа",
  "admin.user_verify":             "Подтверждение аккаунта",
  "admin.user_block":              "Блокировка пользователя",
  "admin.user_unblock":            "Разблокировка пользователя",
  "admin.impersonate":             "Вход под пользователем",
  "admin.model_change":            "Смена AI-модели",
  "admin.sync_rftorgi":            "Синхронизация РФТорги",
};

const ACTION_CATEGORY_STYLE: Record<string, string> = {
  auth:        "bg-slate-500/10 text-slate-400 border-slate-500/20",
  procurement: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  document:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
  org:         "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  org_document:"bg-amber-500/10 text-amber-400 border-amber-500/20",
  analysis:    "bg-violet-500/10 text-violet-400 border-violet-500/20",
  admin:       "bg-red-500/10 text-red-400 border-red-500/20",
};

function actionCategory(action: string) {
  return action.split(".")[0] ?? "other";
}

function AuditTab() {
  const { data: users = [] } = useAdminUsers();
  const [userId, setUserId]     = useState<string>("");
  const [category, setCategory] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch, isFetching } = useAdminAudit({
    userId:   userId   || undefined,
    category: category === "all" ? undefined : category,
  });

  const entries = data?.logs ?? [];

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* User filter */}
        <Select value={userId || "all"} onValueChange={(v) => setUserId(v === "all" ? "" : v)}>
          <SelectTrigger className="h-8 w-52 text-xs dark:bg-white/[0.02]">
            <User className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
            <SelectValue placeholder="Все пользователи" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все пользователи</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category filter */}
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-8 w-44 text-xs dark:bg-white/[0.02]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          onClick={() => void refetch()}
          className="flex items-center gap-1.5 rounded-md border border-border/60 dark:border-white/[0.06] px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
          Обновить
        </button>

        <span className="text-xs text-muted-foreground ml-auto">
          {data?.total ?? 0} записей
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
          Загрузка...
        </div>
      ) : entries.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
          Нет записей
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 dark:border-white/[0.06] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/60 dark:border-white/[0.06] bg-white/[0.01]">
                <th className="py-2 px-3 text-left font-semibold text-muted-foreground w-8" />
                <th className="py-2 px-3 text-left font-semibold text-muted-foreground w-36">Время</th>
                <th className="py-2 px-3 text-left font-semibold text-muted-foreground w-44">Пользователь</th>
                <th className="py-2 px-3 text-left font-semibold text-muted-foreground">Действие</th>
                <th className="py-2 px-3 text-left font-semibold text-muted-foreground w-28 hidden sm:table-cell">
                  Сущность
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <>
                  <tr
                    key={entry.id}
                    onClick={() => toggle(entry.id)}
                    className={cn(
                      "border-b border-border/60 dark:border-white/[0.04] cursor-pointer transition-colors select-none",
                      "dark:hover:bg-white/[0.02]",
                      expanded.has(entry.id) && "dark:bg-white/[0.025]",
                    )}
                  >
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {expanded.has(entry.id)
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap font-mono">
                      {new Date(entry.createdAt).toLocaleString("ru-RU", {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 px-3">
                      {entry.user ? (
                        <>
                          <div className="font-medium leading-tight">{entry.user.fullName}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{entry.user.email}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground italic">Анонимный</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-medium",
                          ACTION_CATEGORY_STYLE[actionCategory(entry.action)] ?? "bg-slate-500/10 text-slate-400",
                        )}
                      >
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground hidden sm:table-cell">
                      {entry.entityType}
                    </td>
                  </tr>

                  {expanded.has(entry.id) && (
                    <tr
                      key={`${entry.id}-d`}
                      className="border-b border-border/60 dark:border-white/[0.04] dark:bg-white/[0.015]"
                    >
                      <td colSpan={5} className="px-4 py-3">
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px]">
                          {entry.entityId && (
                            <>
                              <dt className="text-muted-foreground">ID сущности</dt>
                              <dd className="font-mono text-foreground/80">{entry.entityId}</dd>
                            </>
                          )}
                          {entry.ipAddress && (
                            <>
                              <dt className="text-muted-foreground">IP</dt>
                              <dd className="font-mono text-foreground/80">{entry.ipAddress}</dd>
                            </>
                          )}
                          {entry.changes != null && (
                            <>
                              <dt className="text-muted-foreground">Изменения</dt>
                              <dd>
                                <pre className="font-mono text-foreground/80 whitespace-pre-wrap">
                                  {JSON.stringify(entry.changes, null, 2)}
                                </pre>
                              </dd>
                            </>
                          )}
                        </dl>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function AdminPage() {
  return (
    <AppLayout title="Администрирование" subtitle="Управление пользователями и параметрами системы">
      <div className="p-4 md:p-6 space-y-6">
        <Tabs defaultValue="users">
          <TabsList className="h-9 dark:bg-white/[0.04]">
            <TabsTrigger value="users" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />
              Пользователи
            </TabsTrigger>
            <TabsTrigger value="params" className="gap-1.5 text-xs">
              <Settings2 className="h-3.5 w-3.5" />
              Параметры системы
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5 text-xs">
              <BarChart2 className="h-3.5 w-3.5" />
              AI / Расходы
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5 text-xs">
              <ClipboardList className="h-3.5 w-3.5" />
              Аудит
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5 text-xs">
              <ScrollText className="h-3.5 w-3.5" />
              Логи
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <UsersTab />
          </TabsContent>

          <TabsContent value="params" className="mt-4">
            <ParametersTab />
          </TabsContent>

          <TabsContent value="ai" className="mt-4">
            <AdminAiUsageTab />
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <AuditTab />
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <LogsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
