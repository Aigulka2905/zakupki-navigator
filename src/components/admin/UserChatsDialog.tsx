import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquare, Briefcase, Trash2, FileText, Bot, User as UserIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";
import {
  useUserChats, useUserChatTranscript, useDeleteUserChat, useDeleteAllUserChats,
  type AdminUserChat, type ChatKey,
} from "@/hooks/useAdmin";

// Администратор: чаты пользователя — список диалогов, переписка целиком, удаление диалога или
// всех чатов вместе с прикреплёнными документами. Просмотр и удаление пишутся в аудит.
interface Props {
  user: { id: string; email: string; fullName?: string | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Диалог, открытый сразу (из «Истории»). */
  initial?: ChatKey | null;
}

const keyOf = (c: AdminUserChat): ChatKey => ({ sessionId: c.sessionId, procurementId: c.procurementId });
const sameKey = (a: ChatKey | null, b: ChatKey) => !!a && a.sessionId === b.sessionId && a.procurementId === b.procurementId;
const fmtDate = (s: string) => new Date(s).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};

export function UserChatsDialog({ user, open, onOpenChange, initial = null }: Props) {
  const [selected, setSelected] = useState<ChatKey | null>(initial);
  const { data: chats = [], isLoading } = useUserChats(open ? user.id : null);
  const transcript = useUserChatTranscript(open ? user.id : null, selected);
  const deleteChat = useDeleteUserChat(user.id);
  const deleteAll = useDeleteAllUserChats(user.id);
  const current = chats.find((c) => sameKey(selected, keyOf(c))) ?? null;

  const onDeleteChat = (c: AdminUserChat) => {
    if (!window.confirm("Удалить этот диалог вместе с прикреплёнными документами? Восстановить его будет нельзя.")) return;
    deleteChat.mutate(keyOf(c), {
      onSuccess: () => { setSelected(null); toast.success("Диалог удалён"); },
      onError: () => toast.error("Не удалось удалить диалог"),
    });
  };
  const onDeleteAll = () => {
    if (!window.confirm(`Удалить все чаты пользователя ${user.email} вместе с прикреплёнными документами? Восстановить их будет нельзя.`)) return;
    deleteAll.mutate(undefined, {
      onSuccess: () => { setSelected(null); toast.success("Все чаты пользователя удалены"); },
      onError: () => toast.error("Не удалось удалить чаты"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setSelected(null); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Чаты пользователя</DialogTitle>
          <DialogDescription>{user.fullName ? `${user.fullName} · ` : ""}{user.email}</DialogDescription>
        </DialogHeader>

        <div className="grid h-[60vh] grid-cols-1 gap-3 md:grid-cols-[320px_1fr]">
          {/* Диалоги */}
          <div className="flex min-h-0 flex-col rounded-lg border border-border">
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка…</div>
              ) : chats.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Чатов нет.</p>
              ) : chats.map((c) => (
                <button
                  key={`${c.procurementId ?? ""}:${c.sessionId ?? "legacy"}`}
                  type="button"
                  onClick={() => setSelected(keyOf(c))}
                  className={cn(
                    "flex w-full gap-2 border-b border-border/60 px-3 py-2.5 text-left hover:bg-muted/50",
                    sameKey(selected, keyOf(c)) && "bg-primary/5",
                  )}
                >
                  {c.procurementId
                    ? <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    : <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm">{c.title || c.lastMessage}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {c.procurementId ? `Закупка № ${c.procurementNumber ?? "—"} · ` : c.sessionId ? "" : "Старый диалог · "}
                      {c.count} {plural(c.count, "сообщение", "сообщения", "сообщений")}
                      {c.documents > 0 ? ` · документов: ${c.documents}` : ""} · {fmtDate(c.lastAt)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="border-t border-border p-2">
              <Button size="sm" variant="outline" className="w-full gap-1.5 border-rose-300 text-xs text-rose-600 dark:border-rose-500/40 dark:text-rose-400"
                disabled={chats.length === 0 || deleteAll.isPending} onClick={onDeleteAll}>
                {deleteAll.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Удалить все чаты
              </Button>
            </div>
          </div>

          {/* Переписка */}
          <div className="flex min-h-0 flex-col rounded-lg border border-border">
            {!current ? (
              <p className="m-auto p-4 text-sm text-muted-foreground">Выберите диалог слева.</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
                  <div className="min-w-0 text-xs text-muted-foreground">
                    {current.procurementId ? <>Чат по закупке № {current.procurementNumber ?? "—"} · {current.procurementTitle}</> : "Общий чат"}
                  </div>
                  <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 text-[11px] border-rose-300 text-rose-600 dark:border-rose-500/40 dark:text-rose-400"
                    disabled={deleteChat.isPending} onClick={() => onDeleteChat(current)}>
                    {deleteChat.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Удалить диалог
                  </Button>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-3">
                  {transcript.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка переписки…</div>}
                  {transcript.data && transcript.data.documents.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {transcript.data.documents.map((d) => (
                        <span key={d.id} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          <FileText className="h-3 w-3" />{d.fileName}
                        </span>
                      ))}
                    </div>
                  )}
                  {transcript.data?.messages.map((m) => (
                    <div key={m.id} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                        {m.role === "user" ? <UserIcon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                      </div>
                      <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm", m.role === "user" ? "bg-primary/10" : "bg-muted/50")}>
                        {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <Markdown content={m.content} />}
                        <p className="mt-1 text-[10px] text-muted-foreground">{fmtDate(m.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
