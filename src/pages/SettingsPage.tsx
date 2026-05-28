import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Building2,
  Bell,
  Plug,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Reveal } from "@/components/Reveal";


const SettingsPage = () => {
  const [defaultMode, setDefaultMode]       = useState("223");
  const [notifyDeadlines, setNotifyDeadlines] = useState(true);
  const [notifyUpdates, setNotifyUpdates]   = useState(true);
  const [notifyDigest, setNotifyDigest]     = useState(false);

  const handleSave = () => {
    toast.success("✅ Настройки сохранены");
  };

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
              <div className="space-y-2">
                <Label htmlFor="name">ФИО</Label>
                <Input id="name" defaultValue="Иванов Иван Иванович" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Электронная почта</Label>
                <Input id="email" type="email" defaultValue="ivanov@romashka.ru" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Телефон</Label>
                <Input id="phone" defaultValue="+7 (495) 123-45-67" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Должность</Label>
                <Input id="role" defaultValue="Специалист по закупкам" />
              </div>
            </div>
          </Card>
        </Reveal>

        {/* Организация */}
        <Reveal direction="up" delay={0.08}>
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Организация</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org">Наименование</Label>
                <Input id="org" defaultValue="ООО «Ромашка»" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inn">ИНН</Label>
                <Input id="inn" defaultValue="7701234567" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpp">КПП</Label>
                <Input id="kpp" defaultValue="770101001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mode">Режим по умолчанию</Label>
                <Select value={defaultMode} onValueChange={setDefaultMode}>
                  <SelectTrigger id="mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="223">223-ФЗ</SelectItem>
                    <SelectItem value="commerce">Коммерция</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </Reveal>

        {/* Уведомления */}
        <Reveal direction="up" delay={0.14}>
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Уведомления</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="n1" className="font-medium">Дедлайны по закупкам</Label>
                  <p className="text-sm text-muted-foreground">
                    Уведомлять за 3 дня до окончания подачи заявки
                  </p>
                </div>
                <Switch id="n1" checked={notifyDeadlines} onCheckedChange={setNotifyDeadlines} />
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="n2" className="font-medium">Изменения в законодательстве</Label>
                  <p className="text-sm text-muted-foreground">
                    Новые редакции 223-ФЗ и связанных нормативных актов
                  </p>
                </div>
                <Switch id="n2" checked={notifyUpdates} onCheckedChange={setNotifyUpdates} />
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="n3" className="font-medium">Еженедельный дайджест</Label>
                  <p className="text-sm text-muted-foreground">
                    Сводка активности по понедельникам в 09:00
                  </p>
                </div>
                <Switch id="n3" checked={notifyDigest} onCheckedChange={setNotifyDigest} />
              </div>
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
              <Button variant="outline">Сменить пароль</Button>
            </div>
          </Card>
        </Reveal>

        <Reveal direction="up" delay={0.26}>
          <div className="flex justify-end gap-2">
            <Button variant="outline">Отмена</Button>
            <Button onClick={handleSave}>Сохранить изменения</Button>
          </div>
        </Reveal>

      </div>
    </AppLayout>
  );
};

export default SettingsPage;
