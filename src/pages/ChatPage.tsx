import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Markdown } from "@/components/Markdown";
import {
  Send, FileCheck2, Scale, CalendarClock, Sparkles, Bot,
  Loader2, Building2, ExternalLink, MessageSquare, BookOpen,
  Copy, Check, Clock, ChevronRight, TrendingUp, AlertTriangle,
  FileText, Zap, Plus, Paperclip, X, CheckCircle2, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import apiClient from "@/lib/api-client";
import type { ChatMessage, ChatResponse, Procurement, Document, ChatDocument } from "@/types/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatSession {
  sessionId: string | null;
  procurementId: string | null;
  procurementTitle: string | null;
  procurementNumber: string | null;
  lastMessage: string;
  lastAt: string;
  count: number;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchSessions(): Promise<ChatSession[]> {
  const { data } = await apiClient.get<ChatSession[]>("/assistant/sessions");
  return data;
}

async function fetchHistory(sessionId?: string, procurementId?: string): Promise<ChatMessage[]> {
  const p = new URLSearchParams();
  if (procurementId) p.set("procurementId", procurementId);
  else if (sessionId) p.set("sessionId", sessionId);
  const { data } = await apiClient.get<ChatMessage[]>(`/assistant/conversations?${p}`);
  return [...data].reverse();
}

async function fetchProcurement(id: string): Promise<Procurement> {
  const { data } = await apiClient.get<Procurement>(`/procurements/${id}`);
  return data;
}

async function fetchDocument(id: string): Promise<Document> {
  const { data } = await apiClient.get<Document>(`/knowledge/${id}`);
  return data;
}

async function sendMessage(payload: {
  message: string;
  sessionId?: string;
  procurementId?: string;
  docId?: string;
}): Promise<ChatResponse> {
  const { data } = await apiClient.post<ChatResponse>("/assistant/chat", payload);
  return data;
}

const fmtPrice = (p: string | number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(p));

// ─── Message bubble ───────────────────────────────────────────────────────────

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[72%]">
        <div className="rounded-2xl rounded-tr-sm bg-indigo-500 px-4 py-3 text-[14px] leading-[1.65] text-white shadow-md shadow-indigo-500/15 whitespace-pre-wrap">
          {content}
        </div>
      </div>
    </div>
  );
}

function AssistantBubble({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="group flex gap-3">
      {/* Avatar */}
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/25">
        <Bot className="h-3.5 w-3.5 text-white" />
      </div>

      <div className="min-w-0 flex-1 max-w-[92%]">
        {/* Message card — markdown от ИИ (таблицы, жирный, списки) */}
        <div className="rounded-2xl rounded-tl-sm border border-border/40 bg-card/70 px-5 py-4 text-[14px] leading-[1.7] text-foreground backdrop-blur-sm">
          <Markdown content={content} />
        </div>

        {/* Actions row (on hover) */}
        <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground/60 hover:bg-muted/40 hover:text-muted-foreground transition-colors"
          >
            {copied
              ? <><Check className="h-3 w-3 text-emerald-400" />Скопировано</>
              : <><Copy className="h-3 w-3" />Копировать</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/25">
        <Bot className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border/40 bg-card/70 px-5 py-4 backdrop-blur-sm">
        <Sparkles className="h-3.5 w-3.5 animate-pulse text-indigo-400" />
        <span className="text-[13px] text-muted-foreground">Думаю...</span>
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

interface QuickAction {
  icon: React.ElementType;
  label: string;
  desc: string;
  text: string;
}

function EmptyState({
  procurement,
  quickActions,
  onSelect,
}: {
  procurement?: Procurement;
  quickActions: QuickAction[];
  onSelect: (text: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center">
      {/* Icon */}
      <div className="relative">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-500/25">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[8px] font-bold text-white ring-2 ring-background">
          AI
        </span>
      </div>

      {/* Greeting */}
      <div>
        <h2 className="text-[17px] font-bold text-foreground">
          {procurement ? `Консультация по закупке №${procurement.number}` : "Ассистент по закупкам"}
        </h2>
        <p className="mt-1.5 max-w-md text-[13px] text-muted-foreground leading-relaxed">
          {procurement
            ? `Задайте вопрос по документации, срокам, требованиям и рискам этой процедуры — отвечу со ссылками на нормы 223-ФЗ.`
            : "Задайте вопрос по 223-ФЗ, 44-ФЗ или загрузите документ для проверки. Работаю на YandexGPT."}
        </p>
      </div>

      {/* Featured prompts grid */}
      <div className="grid w-full max-w-lg grid-cols-2 gap-2">
        {quickActions.map((q) => (
          <button
            key={q.label}
            onClick={() => onSelect(q.text)}
            className="group flex flex-col items-start gap-2 rounded-xl p-4 text-left ring-1 ring-inset ring-border/50 bg-card/40 hover:ring-indigo-500/30 hover:bg-indigo-500/5 transition-all duration-150"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
              <q.icon className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <div className="text-[12px] font-semibold text-foreground">{q.label}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground/60 leading-tight">{q.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Right context panel ──────────────────────────────────────────────────────

function ContextCard({
  procurement,
  knowledgeDoc,
  historyLoading,
}: {
  procurement?: Procurement;
  knowledgeDoc?: Document;
  historyLoading: boolean;
}) {
  if (procurement) {
    const days = Math.floor((new Date(procurement.applicationDeadline).getTime() - Date.now()) / 86_400_000);
    const deadlineCls = days < 0 ? "text-muted-foreground" : days <= 7 ? "text-red-400" : days <= 14 ? "text-amber-400" : "text-emerald-400";

    return (
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-500/15">
            <Building2 className="h-3 w-3 text-indigo-400" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-indigo-400">Контекст закупки</span>
        </div>

        <p className="text-[12px] font-semibold leading-snug text-foreground line-clamp-3 mb-3">{procurement.title}</p>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground/60">Цена</span>
            <span className="text-[12px] font-semibold text-foreground">{fmtPrice(procurement.initialPrice)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground/60">Дедлайн</span>
            <span className={cn("text-[12px] font-semibold", deadlineCls)}>
              {days < 0 ? "Истёк" : `${days} дн.`}
            </span>
          </div>
          {procurement.etp && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground/60">Площадка</span>
              <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">{procurement.etp.name}</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-1.5">
          <Link
            to={`/procurements/${procurement.id}`}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium ring-1 ring-inset ring-border/50 text-muted-foreground hover:ring-indigo-500/30 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all"
          >
            <ChevronRight className="h-3 w-3" />
            К закупке
          </Link>
          {procurement.documentationUrl && (
            <button
              onClick={() => window.open(procurement.documentationUrl!, "_blank")}
              className="flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] ring-1 ring-inset ring-border/50 text-muted-foreground hover:ring-indigo-500/30 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all"
            >
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (knowledgeDoc) {
    return (
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/15">
            <FileText className="h-3 w-3 text-violet-400" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-violet-400">Контекст документа</span>
        </div>
        <p className="text-[12px] font-semibold text-foreground leading-snug line-clamp-3">{knowledgeDoc.title}</p>
        <Link
          to="/knowledge"
          className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-violet-400 transition-colors"
        >
          <BookOpen className="h-3 w-3" />
          К документу
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-500/10">
          <Zap className="h-3 w-3 text-indigo-400" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">Режим</span>
      </div>
      <div className="space-y-2">
        <div className="text-[13px] font-semibold text-foreground">223-ФЗ / 44-ФЗ</div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {historyLoading ? "Загрузка..." : "Ассистент готов"}
        </div>
      </div>
    </div>
  );
}

function QuickActionsPanel({ actions, onSelect }: { actions: QuickAction[]; onSelect: (text: string) => void }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-3">
      <div className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
        Быстрые вопросы
      </div>
      <div className="space-y-1">
        {actions.map((q) => (
          <button
            key={q.label}
            onClick={() => onSelect(q.text)}
            className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all hover:bg-indigo-500/5"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/40 group-hover:bg-indigo-500/10 transition-colors">
              <q.icon className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-indigo-400 transition-colors" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-foreground truncate">{q.label}</div>
              <div className="text-[10px] text-muted-foreground/50 truncate">{q.desc}</div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover:text-indigo-400 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

function SessionsPanel({
  sessions,
  sessionId,
  procurementId,
  onNewChat,
}: {
  sessions: ChatSession[];
  sessionId?: string;
  procurementId?: string;
  onNewChat: () => void;
}) {
  const generalSessions = sessions.filter((s) => !s.procurementId);
  const procurementSessions = sessions.filter((s) => s.procurementId);

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">История</span>
        </div>
        <button
          type="button"
          onClick={onNewChat}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground/50 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all"
        >
          <Plus className="h-3 w-3" />
          Новый
        </button>
      </div>

      <div className="max-h-52 overflow-y-auto">
        {/* General chat sessions */}
        {generalSessions.map((s) => {
          const to = s.sessionId ? `/chat?session=${s.sessionId}` : "/chat";
          const isActive = s.sessionId ? sessionId === s.sessionId : (!sessionId && !procurementId);
          return (
            <Link
              key={s.sessionId ?? "__legacy__"}
              to={to}
              className={cn(
                "flex items-center gap-2.5 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-muted/30",
                isActive && "bg-indigo-500/8",
              )}
            >
              <div className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                isActive ? "bg-indigo-500/20 text-indigo-400" : "bg-muted/40 text-muted-foreground/50",
              )}>
                <MessageSquare className="h-3 w-3" />
              </div>
              <div className="min-w-0 flex-1">
                <div className={cn("text-[12px] font-medium truncate", isActive ? "text-indigo-400" : "text-foreground")}>
                  {s.lastMessage.slice(0, 28)}{s.lastMessage.length > 28 ? "…" : ""}
                </div>
                <div className="text-[10px] text-muted-foreground/50">{s.count} сообщ. · 223-ФЗ / 44-ФЗ</div>
              </div>
            </Link>
          );
        })}

        {generalSessions.length === 0 && !procurementId && (
          <div className="px-3 py-4 text-center text-[11px] text-muted-foreground/40">
            Нажмите «Новый» чтобы начать
          </div>
        )}

        {/* Procurement sessions */}
        {procurementSessions.map((s) => (
          <Link
            key={s.procurementId}
            to={`/chat?procurement=${s.procurementId}`}
            className={cn(
              "flex items-start gap-2.5 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-muted/30 last:border-0",
              procurementId === s.procurementId && "bg-indigo-500/8",
            )}
          >
            <div className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
              procurementId === s.procurementId ? "bg-indigo-500/20 text-indigo-400" : "bg-muted/40 text-muted-foreground/50",
            )}>
              <Building2 className="h-3 w-3" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn("text-[11px] font-medium truncate", procurementId === s.procurementId ? "text-indigo-400" : "text-foreground")}>
                {s.procurementTitle ? s.procurementTitle.slice(0, 32) + (s.procurementTitle.length > 32 ? "…" : "") : "Закупка"}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {s.procurementNumber && (
                  <span className="font-mono text-[9px] text-muted-foreground/40">{s.procurementNumber.slice(0, 16)}</span>
                )}
                <span className="text-[9px] text-muted-foreground/40">{s.count} сообщ.</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Chat documents API ───────────────────────────────────────────────────────

function chatDocsParams(sessionId?: string, procurementId?: string) {
  const p = new URLSearchParams();
  if (procurementId) p.set("procurementId", procurementId);
  else if (sessionId) p.set("sessionId", sessionId);
  return p.toString();
}

async function fetchChatDocs(sessionId?: string, procurementId?: string): Promise<ChatDocument[]> {
  const { data } = await apiClient.get<ChatDocument[]>(`/chat-documents?${chatDocsParams(sessionId, procurementId)}`);
  return data;
}

async function attachDoc(file: File, sessionId?: string, procurementId?: string): Promise<ChatDocument> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<ChatDocument>(
    `/chat-documents?${chatDocsParams(sessionId, procurementId)}`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

async function detachDoc(docId: string): Promise<void> {
  await apiClient.delete(`/chat-documents/${docId}`);
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
}

// ─── Chat documents panel ─────────────────────────────────────────────────────

const ALLOWED_EXTS = ".pdf,.doc,.docx,.txt";
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function ChatDocsPanel({
  docs,
  attaching,
  onAttach,
  onDetach,
}: {
  docs: ChatDocument[];
  attaching: boolean;
  onAttach: (files: FileList | null) => void;
  onDetach: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const canAttach = !attaching && docs.length < 10;

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
            Документы чата
          </span>
          {docs.length > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-500/20 px-1 text-[9px] font-bold text-indigo-400">
              {docs.length}
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={!canAttach}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] transition-all",
            canAttach
              ? "text-muted-foreground/50 hover:text-indigo-400 hover:bg-indigo-500/5"
              : "cursor-not-allowed opacity-40",
          )}
        >
          {attaching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Добавить
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_EXTS}
          className="hidden"
          onChange={(e) => { onAttach(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* Drop zone (shown only when empty) */}
      {docs.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); onAttach(e.dataTransfer.files); }}
          className={cn(
            "flex flex-col items-center gap-2 px-4 py-5 text-center transition-colors cursor-pointer",
            dragging ? "bg-indigo-500/10" : "hover:bg-muted/20",
          )}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className={cn("h-6 w-6", dragging ? "text-indigo-400" : "text-muted-foreground/30")} />
          <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
            Перетащите или нажмите<br />PDF, DOCX, TXT · до 5 МБ
          </p>
        </div>
      )}

      {/* Document list */}
      {docs.length > 0 && (
        <div className="divide-y divide-border/20">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 px-3 py-2">
              <div className="shrink-0">
                {doc.status === "processing" && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />}
                {doc.status === "ready"      && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                {doc.status === "failed"     && <XCircle className="h-3.5 w-3.5 text-red-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium text-foreground" title={doc.fileName}>
                  {doc.fileName}
                </div>
                <div className="text-[10px] text-muted-foreground/50">
                  {fmtBytes(doc.fileSize)}
                  {doc.status === "ready"      && doc.chunkCount > 0 && ` · ${doc.chunkCount} фр.`}
                  {doc.status === "processing" && " · обработка…"}
                  {doc.status === "failed"     && " · ошибка"}
                </div>
              </div>
              <button
                onClick={() => onDetach(doc.id)}
                className="shrink-0 rounded p-0.5 text-muted-foreground/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Удалить"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {canAttach && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); onAttach(e.dataTransfer.files); }}
              className={cn(
                "px-3 py-2 text-center text-[10px] text-muted-foreground/30 transition-colors",
                dragging ? "bg-indigo-500/10 text-indigo-400" : "hover:bg-muted/20",
              )}
            >
              + перетащите ещё файл
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ChatPage ────────────────────────────────────────────────────────────

const ChatPage = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const procurementId = searchParams.get("procurement") ?? undefined;
  const sessionId = searchParams.get("session") ?? undefined;

  const [docId] = useState<string | undefined>(() => {
    const stored = sessionStorage.getItem("chat_doc_id");
    if (stored) { sessionStorage.removeItem("chat_doc_id"); return stored; }
    return searchParams.get("docId") ?? undefined;
  });

  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string; id: string }>
  >([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const autoQueryRef  = useRef(searchParams.get('q') ?? '');
  const autoSentRef   = useRef(false);

  // ── Inline document attachment ─────────────────────────────────
  const chatDocsKey = ["chat-docs", sessionId ?? null, procurementId ?? null];
  const { data: chatDocs = [] } = useQuery({
    queryKey: chatDocsKey,
    queryFn: () => fetchChatDocs(sessionId, procurementId),
    staleTime: 10_000,
    refetchInterval: (query) => {
      const d = query.state.data as ChatDocument[] | undefined;
      return d?.some((x) => x.status === "processing") ? 3000 : false;
    },
  });

  const { mutate: doAttach, isPending: attaching } = useMutation({
    mutationFn: (file: File) => attachDoc(file, sessionId, procurementId),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatDocsKey }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Не удалось прикрепить файл");
    },
  });

  const { mutate: doDetach } = useMutation({
    mutationFn: (docId: string) => detachDoc(docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatDocsKey }),
    onError: () => toast.error("Не удалось удалить документ"),
  });

  function handleAttachFile(files: FileList | null) {
    if (!files || !files[0]) return;
    const file = files[0];
    if (file.size > MAX_SIZE_BYTES) { toast.error("Файл слишком большой. Максимум 5 МБ."); return; }
    doAttach(file);
  }

  // ── Data fetching ──────────────────────────────────────────────
  const { data: sessions = [] } = useQuery({
    queryKey: ["chat-sessions"],
    queryFn: fetchSessions,
    staleTime: 30_000,
  } as Parameters<typeof useQuery>[0]);

  const { data: procurement } = useQuery({
    queryKey: ["procurement", procurementId],
    queryFn: () => fetchProcurement(procurementId!),
    enabled: !!procurementId,
    staleTime: 60_000,
  } as Parameters<typeof useQuery>[0]);

  const { data: knowledgeDoc } = useQuery({
    queryKey: ["knowledge-doc", docId],
    queryFn: () => fetchDocument(docId!),
    enabled: !!docId,
    staleTime: 300_000,
  } as Parameters<typeof useQuery>[0]);

  const { isLoading: historyLoading, data: historyData, isError: historyError } = useQuery({
    queryKey: ["conversations", sessionId ?? null, procurementId ?? null],
    queryFn: () => fetchHistory(sessionId, procurementId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (historyData) {
      setLocalMessages(historyData.map((m) => ({
        id: m.id,
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })));
    }
  }, [historyData]);

  useEffect(() => {
    if (historyError) toast.error("Не удалось загрузить историю сообщений");
  }, [historyError]);

  // ── Mutation ───────────────────────────────────────────────────
  const { mutate: sendMsg, isPending: isSending } = useMutation({
    mutationFn: sendMessage,
    onMutate: (variables) => {
      const oid = `opt-${Date.now()}`;
      setLocalMessages((prev) => [...prev, { id: oid, role: "user", content: variables.message }]);
      return { optimisticId: oid };
    },
    onSuccess: (data) => {
      setLocalMessages((prev) => [...prev, { id: `ai-${Date.now()}`, role: "assistant", content: data.content }]);
      qc.invalidateQueries({ queryKey: ["conversations", sessionId ?? null, procurementId ?? null] });
      qc.invalidateQueries({ queryKey: ["chat-sessions"] });
    },
    onError: (err: unknown, _v, context) => {
      if (context?.optimisticId) {
        setLocalMessages((prev) => prev.filter((m) => m.id !== context.optimisticId));
      }
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Ошибка при отправке");
    },
  });

  // ── Auto-send message arriving from Dashboard "Спросите ассистента" ──
  useEffect(() => {
    const q = autoQueryRef.current;
    if (!q || autoSentRef.current || historyLoading) return;
    autoSentRef.current = true;
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('q'); return n; }, { replace: true });
    sendMsg({ message: q, sessionId, procurementId, docId });
  }, [historyLoading, sendMsg, sessionId, procurementId, docId, setSearchParams]);

  // ── New chat ───────────────────────────────────────────────────
  const handleNewChat = useCallback(async () => {
    const { data } = await apiClient.post<{ sessionId: string }>("/assistant/sessions");
    navigate(`/chat?session=${data.sessionId}`);
  }, [navigate]);

  // ── Auto-scroll ────────────────────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [localMessages, isSending]);

  // ── Auto-resize textarea ───────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    sendMsg({ message: text, sessionId, procurementId, docId });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Quick actions (context-aware) ──────────────────────────────
  const quickActions: QuickAction[] = procurement
    ? [
        {
          icon: FileCheck2, label: "Проверить документацию",
          desc: "Соответствие 223-ФЗ",
          text: `Проверь документацию по закупке «${procurement.title}» на соответствие 223-ФЗ`,
        },
        {
          icon: CalendarClock, label: "Минимальные сроки",
          desc: "Подача заявок",
          text: `Какие минимальные сроки подачи заявок для закупки №${procurement.number}?`,
        },
        {
          icon: AlertTriangle, label: "Риски и нарушения",
          desc: "Анализ рисков",
          text: `Какие риски и нарушения 223-ФЗ в закупке «${procurement.title}»?`,
        },
        {
          icon: TrendingUp, label: "Шансы на победу",
          desc: "Оценка участия",
          text: `Оцени шансы на победу в закупке №${procurement.number} с начальной ценой ${fmtPrice(procurement.initialPrice)}`,
        },
      ]
    : [
        {
          icon: FileCheck2, label: "Проверить документ",
          desc: "На соответствие 223-ФЗ",
          text: "Проверь этот документ на соответствие 223-ФЗ и выяви нарушения",
        },
        {
          icon: Scale, label: "Сравнить нормы",
          desc: "223-ФЗ vs 44-ФЗ",
          text: "Сравни нормы 223-ФЗ и 44-ФЗ: основные отличия и ограничения",
        },
        {
          icon: CalendarClock, label: "Рассчитать сроки",
          desc: "Минимальные сроки",
          text: "Рассчитай минимальные сроки подачи заявок по 223-ФЗ для конкурса",
        },
        {
          icon: AlertTriangle, label: "Типичные ошибки",
          desc: "Нарушения заказчиков",
          text: "Какие типичные нарушения 223-ФЗ допускают заказчики при проведении закупок?",
        },
      ];

  // ── Title ──────────────────────────────────────────────────────
  const pageTitle = procurement
    ? "Консультация по закупке"
    : knowledgeDoc
    ? "Консультация по документу"
    : "Ассистент по закупкам";

  const pageSubtitle = isSending
    ? "Думает..."
    : `Онлайн · ${procurement ? `Закупка №${procurement.number}` : "Режим 223-ФЗ / 44-ФЗ"}`;

  return (
    <AppLayout title={pageTitle} subtitle={pageSubtitle}>
      <div
        className="mx-auto flex max-w-[1320px] gap-4 px-4 pb-4 md:px-6"
        style={{ height: "calc(100vh - 7.5rem)" }}
      >
        {/* ── Main chat area ──────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/20 backdrop-blur-sm dark:border-white/[0.05]">

          {/* Messages area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-5 py-6 space-y-5 md:px-8"
          >
            {historyLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
                  <p className="text-[12px] text-muted-foreground">Загружаем историю...</p>
                </div>
              </div>
            ) : localMessages.length === 0 ? (
              <EmptyState
                procurement={procurement}
                quickActions={quickActions}
                onSelect={(text) => { setInput(text); textareaRef.current?.focus(); }}
              />
            ) : (
              localMessages.map((m) =>
                m.role === "user"
                  ? <UserBubble key={m.id} content={m.content} />
                  : <AssistantBubble key={m.id} content={m.content} />
              )
            )}
            {isSending && <TypingIndicator />}
          </div>

          {/* ── Input area ──────────────────────────────────────── */}
          <div className="shrink-0 border-t border-border/30 bg-card/40 px-4 py-3 md:px-6">
            {/* Quick chips */}
            {localMessages.length > 0 && (
              <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
                {quickActions.slice(0, 3).map((q) => (
                  <button
                    key={q.label}
                    onClick={() => setInput(q.text)}
                    className="shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium ring-1 ring-inset ring-border/50 text-muted-foreground hover:ring-indigo-500/30 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all"
                  >
                    <q.icon className="h-3 w-3" />
                    {q.label}
                  </button>
                ))}
              </div>
            )}

            {/* Attached files bar */}
            {chatDocs.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {chatDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                      doc.status === "ready"    && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
                      doc.status === "processing" && "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",
                      doc.status === "failed"   && "border-red-500/30 bg-red-500/10 text-red-400",
                    )}
                  >
                    {doc.status === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}
                    {doc.status === "ready"      && <CheckCircle2 className="h-3 w-3" />}
                    {doc.status === "failed"     && <XCircle className="h-3 w-3" />}
                    <span className="max-w-[140px] truncate" title={doc.fileName}>
                      {doc.fileName}
                    </span>
                    <button
                      onClick={() => doDetach(doc.id)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                      title="Удалить"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Textarea + send */}
            <div className={cn(
              "flex items-end gap-2 rounded-xl border bg-background/50 px-3 py-3 transition-all",
              "border-border/40 focus-within:border-indigo-500/40 focus-within:ring-2 focus-within:ring-indigo-500/10",
            )}>
              {/* Paperclip button */}
              <button
                type="button"
                disabled={attaching || chatDocs.length >= 10}
                onClick={() => attachInputRef.current?.click()}
                title="Прикрепить документ (PDF, DOCX, TXT · до 5 МБ)"
                className={cn(
                  "mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all",
                  attaching || chatDocs.length >= 10
                    ? "cursor-not-allowed text-muted-foreground/20"
                    : "text-muted-foreground/40 hover:bg-indigo-500/10 hover:text-indigo-400",
                )}
              >
                {attaching
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Paperclip className="h-4 w-4" />}
              </button>
              <input
                ref={attachInputRef}
                type="file"
                accept={ALLOWED_EXTS}
                className="hidden"
                onChange={(e) => { handleAttachFile(e.target.files); e.target.value = ""; }}
              />

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  procurement
                    ? `Спросите про закупку №${procurement.number}...`
                    : knowledgeDoc
                    ? `Спросите про документ «${knowledgeDoc.title.slice(0, 30)}...»`
                    : "Задайте вопрос по 223-ФЗ или 44-ФЗ..."
                }
                disabled={isSending || historyLoading}
                className="min-h-[28px] flex-1 resize-none bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none leading-relaxed"
              />

              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden text-[10px] text-muted-foreground/30 sm:block">
                  Enter ↵
                </span>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isSending || historyLoading}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150",
                    input.trim() && !isSending
                      ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 hover:shadow-indigo-400/30"
                      : "bg-muted/40 text-muted-foreground/40 cursor-not-allowed",
                  )}
                  aria-label="Отправить"
                >
                  {isSending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Footer hint */}
            <p className="mt-2 text-center text-[10px] text-muted-foreground/30">
              Ответы сверяются с нормами 223-ФЗ и 44-ФЗ · Shift+Enter — новая строка
            </p>
          </div>
        </div>

        {/* ── Right context panel ─────────────────────────────── */}
        <div className="hidden w-64 shrink-0 flex-col gap-3 overflow-y-auto lg:flex xl:w-72">
          {/* Context */}
          <ContextCard
            procurement={procurement}
            knowledgeDoc={knowledgeDoc}
            historyLoading={historyLoading}
          />

          {/* Quick actions */}
          <QuickActionsPanel
            actions={quickActions}
            onSelect={(text) => { setInput(text); textareaRef.current?.focus(); }}
          />

          {/* Chat documents (RAG) */}
          <ChatDocsPanel
            docs={chatDocs}
            attaching={attaching}
            onAttach={handleAttachFile}
            onDetach={(id) => doDetach(id)}
          />

          {/* Sessions */}
          <SessionsPanel sessions={sessions} sessionId={sessionId} procurementId={procurementId} onNewChat={handleNewChat} />

          {/* Footer note */}
          <div className="rounded-xl border border-border/30 bg-card/30 p-3 text-center">
            <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
              Работает на YandexGPT.<br />
              Не является юридической консультацией.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ChatPage;
