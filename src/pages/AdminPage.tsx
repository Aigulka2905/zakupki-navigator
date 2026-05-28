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
  Search,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  useAdminUsers,
  useAdminStats,
  useSystemInfo,
  useUpdateUserRole,
  useUpdateOrgPlan,
  useAdminLogs,
} from "@/hooks/useAdmin";
import type { LogEntry, LogLevel } from "@/hooks/useAdmin";
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
  const { mutate: updateRole } = useUpdateUserRole();
  const { mutate: updatePlan } = useUpdateOrgPlan();

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
        Загрузка...
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 dark:border-white/[0.06] overflow-hidden">
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const orgType = user.organization?.orgType ?? "participant";
            const plan = (user.organization?.subscriptionPlan ?? "free") as SubscriptionPlan;

            return (
              <TableRow
                key={user.id}
                className="dark:border-white/[0.04] dark:hover:bg-white/[0.02]"
              >
                {/* Name + email */}
                <TableCell className="py-3">
                  <div className="font-medium text-sm leading-tight">{user.fullName}</div>
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

                {/* Email verified */}
                <TableCell className="text-center">
                  <StatusDot ok={!!user.emailVerified} />
                </TableCell>

                {/* Created at */}
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString("ru-RU")}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Parameters tab ────────────────────────────────────────────

function ParametersTab() {
  const { data: sys } = useSystemInfo();
  const { data: stats } = useAdminStats();

  if (!sys) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
        Загрузка...
      </div>
    );
  }

  return (
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

function relTime(ts: number) {
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
          {dataUpdatedAt ? ` · обновлено ${relTime(dataUpdatedAt)} назад` : ""}
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
                      {relTime(entry.time)}
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

          <TabsContent value="logs" className="mt-4">
            <LogsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
