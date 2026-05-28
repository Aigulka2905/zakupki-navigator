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
} from "lucide-react";
import {
  useAdminUsers,
  useAdminStats,
  useSystemInfo,
  useUpdateUserRole,
  useUpdateOrgPlan,
} from "@/hooks/useAdmin";
import type { UserRole, SubscriptionPlan } from "@/types/api";
import { cn } from "@/lib/utils";
import { AdminAiUsageTab } from "./AdminAiUsagePage";

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
        </Tabs>
      </div>
    </AppLayout>
  );
}
