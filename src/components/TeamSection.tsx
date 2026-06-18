import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Mail, Trash2, Loader2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import apiClient from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { OrgMember, OrgInvite } from "@/types/api";

const roleLabel: Record<string, string> = {
  admin: "Администратор",
  specialist: "Специалист",
  viewer: "Просмотр",
};

export function TeamSection() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const isOwner = !!me?.isOrgOwner;
  const [email, setEmail] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["org-members"],
    queryFn: async () => (await apiClient.get<OrgMember[]>("/organization/members")).data,
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["org-invites"],
    queryFn: async () => (await apiClient.get<OrgInvite[]>("/organization/invites")).data,
    enabled: isOwner,
  });

  const createInvite = useMutation({
    mutationFn: async (inviteEmail: string) =>
      (await apiClient.post<{ link: string }>("/organization/invites", { email: inviteEmail })).data,
    onSuccess: (data) => {
      setEmail("");
      qc.invalidateQueries({ queryKey: ["org-invites"] });
      navigator.clipboard?.writeText(data.link).catch(() => {});
      toast.success("Приглашение создано", { description: "Ссылка скопирована в буфер обмена" });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Не удалось создать приглашение");
    },
  });

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/organization/invites/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-invites"] });
      toast.success("Приглашение отозвано");
    },
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-violet-600" />
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Команда организации</h3>
      </div>

      {/* Участники */}
      <ul className="mb-5 space-y-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-800">
            <div className="flex items-center gap-2">
              {m.isOrgOwner && <Crown className="h-4 w-4 text-amber-500" aria-label="Владелец" />}
              <span className="font-medium text-slate-700 dark:text-slate-200">{m.fullName}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">{m.email}</span>
            </div>
            <span className="text-xs text-slate-400">{roleLabel[m.role] ?? m.role}</span>
          </li>
        ))}
      </ul>

      {/* Приглашения — только владелец */}
      {isOwner ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="email коллеги@company.ru"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9"
            />
            <Button
              onClick={() => email.trim() && createInvite.mutate(email.trim())}
              disabled={createInvite.isPending || !email.trim()}
              className="h-9 shrink-0"
            >
              {createInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Пригласить
            </Button>
          </div>

          {invites.length > 0 && (
            <ul className="space-y-1.5">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
                  <span className="text-slate-600 dark:text-slate-300">{inv.email}</span>
                  <button
                    onClick={() => revokeInvite.mutate(inv.id)}
                    className="rounded p-1 text-slate-400 hover:text-rose-600"
                    title="Отозвать"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-400">
            Приглашённый коллега получит письмо со ссылкой и присоединится к вашей организации как «Специалист».
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Приглашать коллег может только владелец организации.</p>
      )}
    </div>
  );
}
