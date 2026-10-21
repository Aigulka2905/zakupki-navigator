import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Building2,
  Plug,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { TwoFactorCard } from "@/components/TwoFactorCard";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { OrgType } from "@/types/api";

const ORG_TYPE_LABEL: Record<OrgType, string> = { customer: "Заказчик", participant: "Участник" };

// Значение из учётной записи; пока /auth/me не ответил — «Загрузка…», а не
// выдуманные данные (раньше здесь стояли «Иванов Иван Иванович» и ООО «Ромашка»).
function Field({ label, value, loading }: { label: string; value?: string | null; loading: boolean }) {
  return (
    <div className="space-y-1">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="break-words font-medium text-foreground">{loading ? "Загрузка…" : value || "—"}</div>
    </div>
  );
}

const SettingsPage = () => {
  const { data: user, isLoading } = useCurrentUser();
  const org = user?.organization;
  const loading = isLoading || !user;

  return (
    <AppLayout title="Настройки" subtitle="Профиль, организация и интеграции">
      <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">

        {/* Профиль */}
        <Reveal direction="up" delay={0}>
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Профиль</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ФИО" value={user?.fullName} loading={loading} />
              <Field label="Электронная почта" value={user?.email} loading={loading} />
            </div>
          </Card>
        </Reveal>

        {/* Двухфакторная аутентификация */}
        <Reveal direction="up" delay={0.04}>
          <TwoFactorCard />
        </Reveal>

        {/* Организация */}
        <Reveal direction="up" delay={0.08}>
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Организация</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Наименование" value={org?.name} loading={loading} />
              <Field label="Тип" value={org ? ORG_TYPE_LABEL[org.orgType] : null} loading={loading} />
              <Field label="ИНН" value={org?.inn} loading={loading} />
              <Field label="КПП" value={org?.kpp} loading={loading} />
            </div>
            <div className="mt-5">
              <Button variant="outline" size="sm" asChild>
                <Link to="/organization">Изменить в «Профиле организации»</Link>
              </Button>
            </div>
          </Card>
        </Reveal>

        {/* Интеграции */}
        <Reveal direction="up" delay={0.18}>
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Plug className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Интеграция с РФ Торги</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">РФ Торги (rftorgi.ru)</span>
                    <Badge className="bg-success-soft text-success hover:bg-success-soft">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Подключено
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Автоматическая синхронизация закупок каждые 10 минут
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://rftorgi.ru" target="_blank" rel="noopener noreferrer">
                    Открыть площадку
                  </a>
                </Button>
              </div>
              <div className="rounded-md bg-primary-soft px-4 py-3 text-sm text-foreground">
                <p className="font-medium">Как работает синхронизация</p>
                <p className="mt-1 text-muted-foreground">
                  Система автоматически получает активные закупки с РФ Торги и рассчитывает
                  AI-скоринг релевантности на основе профиля вашей организации.
                </p>
              </div>
            </div>
          </Card>
        </Reveal>

        {/* Безопасность */}
        <Reveal direction="up" delay={0.22}>
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Безопасность и данные</h2>
            </div>
            <div className="space-y-3">
              <div className="rounded-md bg-success-soft p-3 text-sm">
                <div className="font-medium text-success">🔒 Обработка данных: Российская Федерация</div>
                <p className="mt-1 text-muted-foreground">
                  Все данные хранятся и обрабатываются на территории РФ в соответствии с 152-ФЗ
                </p>
              </div>
              <div className="space-y-1.5">
                <Button variant="outline" asChild>
                  <Link to="/forgot-password">Сменить пароль</Link>
                </Button>
                <p className="text-sm text-muted-foreground">Пришлём на вашу почту ссылку для установки нового пароля.</p>
              </div>
            </div>
          </Card>
        </Reveal>

      </div>
    </AppLayout>
  );
};

export default SettingsPage;
