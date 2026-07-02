import { useEffect, useRef, useState } from "react";
import { openExternal } from "@/lib/url";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, CalendarClock, ExternalLink, MessageSquare,
  Loader2, BadgeCheck, CircleDot, FileText, Download, Package,
  ScrollText, ClipboardList, HelpCircle, ShieldCheck, Receipt,
  Sparkles, Send, Bot, User, CheckCircle2, ChevronDown,
  ChevronUp, Zap, TrendingUp, AlertTriangle,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import apiClient from "@/lib/api-client";
import type { Procurement, ProcurementStatus, ChatMessage, ChatResponse } from "@/types/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RftOrganizer {
  inn?: string; kpp?: string; ogrn?: string;
  short_title?: string; full_title?: string;
  phone_number?: string; email?: string;
  legal_address?: string; fact_address?: string;
  first_name?: string; last_name?: string; middle_name?: string;
}

interface RftPosition {
  id: string; number?: number; name?: string;
  okpd_code?: string; okpd_name?: string;
  region_name?: string; region_address?: string;
  qty?: string | number; unit_name?: string;
  unit_price?: string | number | null;
  price?: string | number | null;
  amount?: string | number | null;
  type_item?: string; info?: string | null;
}

interface RftLot {
  id: string; status?: string;
  start_bid_date?: string; close_bid_date?: string;
  customer_short_name?: string; customer_full_name?: string;
  customer_legal_address?: string; place_of_delivery?: string; nds?: string;
  positions?: RftPosition[];
}

interface RftDocument {
  id: string; name: string; url: string;
  version?: string; signed_at?: string; size?: string;
}

interface RftProtocol {
  id: string; type_localized?: string; status_localized?: string;
  published_at?: string; documents?: RftDocument[];
}

interface RftExplanation {
  id: string; type_localized?: string; published_at?: string;
  title?: string; text?: string; documents?: RftDocument[];
}

interface RftDetail {
  type_localized?: string; platform_type_localized?: string;
  bidding_procedures?: string; requirements_participant?: string;
  requirements?: { rnp?: boolean; only_for_smb?: boolean };
  provision_bid?: {
    amount?: { amount: string; currency: string }; is_specified?: boolean;
    percent?: number; methods?: string[]; payment_return?: string;
  };
  provision_contract?: {
    amount?: { amount: string; currency: string } | null;
    is_specified?: boolean; percent?: number; payment_return?: string;
  };
  tariff?: { text?: string; percent?: number | null; nds?: string };
  info_trading_venue?: string; order_review_and_summing_up?: string;
  place_review_and_summing_up?: string; summing_up_date?: string;
  organizer?: RftOrganizer;
}

interface LiveData {
  detail: RftDetail; lots: RftLot[];
  documents: RftDocument[]; protocols: RftProtocol[]; explanations: RftExplanation[];
}

interface ProcurementLiveResponse {
  procurement: Procurement; live: LiveData | null; error?: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchProcurementLive(id: string): Promise<ProcurementLiveResponse> {
  const { data } = await apiClient.get<ProcurementLiveResponse>(`/procurements/${id}/live`);
  return data;
}

async function fetchWhy(id: string): Promise<{ explanation: string; score: number }> {
  const { data } = await apiClient.get(`/procurements/${id}/why`);
  return data;
}

async function fetchHistory(procurementId: string): Promise<ChatMessage[]> {
  const { data } = await apiClient.get<ChatMessage[]>(`/assistant/conversations?procurementId=${procurementId}`);
  return [...data].reverse();
}

async function sendMessage(payload: { message: string; procurementId: string }): Promise<ChatResponse> {
  const { data } = await apiClient.post<ChatResponse>("/assistant/chat", payload);
  return data;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (p: string | number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(p));

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });

const fmtRft = (val?: string | null) => {
  if (!val) return "—";
  const d = new Date(val.replace(" ", "T"));
  return isNaN(d.getTime()) ? val : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

function daysLeft(deadline: string) {
  return Math.floor((new Date(deadline).getTime() - Date.now()) / 86_400_000);
}

const STATUS: Record<ProcurementStatus, { label: string; ring: string; dot: string }> = {
  active:    { label: "Активна",   ring: "ring-indigo-500/30 text-indigo-400 bg-indigo-500/10",    dot: "bg-indigo-400" },
  draft:     { label: "Черновик",  ring: "ring-border text-muted-foreground bg-muted/50",           dot: "bg-muted-foreground/50" },
  completed: { label: "Завершена", ring: "ring-emerald-500/30 text-emerald-400 bg-emerald-500/10", dot: "bg-emerald-400" },
  cancelled: { label: "Отменена",  ring: "ring-red-500/30 text-red-400 bg-red-500/10",             dot: "bg-red-400" },
};

function scoreGrad(s: number) {
  if (s >= 70) return { from: "from-emerald-500", to: "to-teal-500", label: "Высокая", bar: "bg-emerald-500" };
  if (s >= 40) return { from: "from-amber-500",   to: "to-orange-500", label: "Средняя", bar: "bg-amber-500" };
  return           { from: "from-slate-500",    to: "to-slate-600",  label: "Низкая",  bar: "bg-slate-500" };
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function GlassCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn(
      "rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm",
      "dark:border-white/[0.06] dark:bg-card/40",
      className,
    )}>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 border-b border-border/20 py-2.5 last:border-0">
      <span className="pt-px text-[12px] text-muted-foreground/70">{label}</span>
      <span className="text-[13px] leading-relaxed text-foreground">{value}</span>
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", className)}>
      {children}
    </span>
  );
}

// ─── Hero top-bar ─────────────────────────────────────────────────────────────

function ProcurementHero({ p, live, score }: { p: Procurement; live: LiveData | null; score?: number }) {
  const meta = STATUS[p.status] ?? STATUS.draft;
  const days = daysLeft(p.applicationDeadline);
  const deadlineCls = days < 0 ? "text-muted-foreground" : days <= 7 ? "text-red-400" : days <= 14 ? "text-amber-400" : "text-foreground";
  const displayScore = score ?? p.relevanceScore;
  const sg = scoreGrad(displayScore);

  return (
    <div className="relative overflow-hidden rounded-2xl p-px">
      {/* gradient border */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/30 via-violet-500/10 to-transparent" />

      <div className="relative rounded-[calc(1rem-1px)] bg-card/70 p-5 backdrop-blur-sm dark:bg-[#0E1120]/80 space-y-4">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2">
          <Chip className={meta.ring}>
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
            {meta.label}
          </Chip>
          {live?.detail?.type_localized && (
            <Chip className="ring-border/50 text-muted-foreground">{live.detail.type_localized}</Chip>
          )}
          {p.etp && (
            <Chip className="ring-border/50 text-muted-foreground">
              <BadgeCheck className="h-3 w-3 text-indigo-400" />
              {p.etp.name}
            </Chip>
          )}
          <span className="font-mono text-[11px] text-muted-foreground/50 ml-1">{p.number}</span>
          {!live && (
            <Chip className="ring-amber-500/30 text-amber-400 bg-amber-500/8 ml-auto">
              <AlertTriangle className="h-3 w-3" />
              Данные РФТорги недоступны
            </Chip>
          )}
        </div>

        {/* Title */}
        <h1 className="text-[18px] font-bold leading-snug text-foreground">{p.title}</h1>

        {/* Metric strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Price */}
          <div className="rounded-xl bg-muted/30 px-4 py-3 ring-1 ring-inset ring-border/40 dark:bg-background/40 dark:ring-white/[0.05]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">Цена</div>
            <div className="mt-1.5 text-[15px] font-bold tracking-tight text-foreground">{fmt(p.initialPrice)}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground/50">{p.currency}</div>
          </div>

          {/* Deadline */}
          <div className="rounded-xl bg-muted/30 px-4 py-3 ring-1 ring-inset ring-border/40 dark:bg-background/40 dark:ring-white/[0.05]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">Дедлайн</div>
            <div className={cn("mt-1.5 text-[15px] font-bold tracking-tight", deadlineCls)}>
              {days < 0 ? "Истёк" : `${days} дн.`}
            </div>
            <div className={cn("mt-0.5 flex items-center gap-1 text-[10px]", deadlineCls)}>
              <CalendarClock className="h-3 w-3 shrink-0" />
              {fmtDate(p.applicationDeadline)}
            </div>
          </div>

          {/* Publication */}
          <div className="rounded-xl bg-muted/30 px-4 py-3 ring-1 ring-inset ring-border/40 dark:bg-background/40 dark:ring-white/[0.05]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">Публикация</div>
            <div className="mt-1.5 text-[13px] font-semibold text-foreground">{fmtDate(p.publicationDate)}</div>
          </div>

          {/* Score */}
          <div className="rounded-xl bg-muted/30 px-4 py-3 ring-1 ring-inset ring-border/40 dark:bg-background/40 dark:ring-white/[0.05]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">Релевантность</div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className={cn("text-[15px] font-bold bg-gradient-to-r bg-clip-text text-transparent", sg.from, sg.to)}>
                {displayScore}
              </span>
              <span className="text-[10px] text-muted-foreground/60">{sg.label}</span>
            </div>
            {/* micro-bar */}
            <div className="mt-1.5 h-1 w-full rounded-full bg-muted/40">
              <div className={cn("h-1 rounded-full transition-all", sg.bar)} style={{ width: `${displayScore}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Инфо ────────────────────────────────────────────────────────────────

function LotRow({ lot, idx }: { lot: RftLot; idx: number }) {
  const [open, setOpen] = useState(false);
  const fmtMoney = (v?: string | number | null) => {
    if (v == null || v === "0" || v === 0) return "—";
    const n = Number(v);
    return isNaN(n) ? String(v) : fmt(n);
  };

  return (
    <div className="rounded-xl border border-border/30 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-[11px] font-bold text-indigo-400">
          {idx + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-foreground">Лот №{idx + 1}</div>
          {lot.customer_short_name && (
            <div className="text-[11px] text-muted-foreground/60 truncate">{lot.customer_short_name}</div>
          )}
        </div>
        {lot.status && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] ring-1 ring-inset ring-border/50 text-muted-foreground">
            {lot.status === "STATUS_ACCEPTING_APPLICATIONS" ? "Приём заявок" : lot.status}
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground/50 shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border/30 px-4 pb-4 pt-3 bg-background/30">
          <div className="divide-y divide-border/20 mb-3">
            <InfoRow label="Заказчик" value={lot.customer_short_name ?? lot.customer_full_name} />
            <InfoRow label="Юрадрес" value={lot.customer_legal_address} />
            <InfoRow label="Начало заявок" value={fmtRft(lot.start_bid_date)} />
            <InfoRow label="Конец заявок" value={fmtRft(lot.close_bid_date)} />
            <InfoRow label="Место поставки" value={lot.place_of_delivery} />
            <InfoRow label="НДС" value={lot.nds === "INCLUDE_NDS" ? "С НДС" : lot.nds === "WITHOUT_NDS" ? "Без НДС" : lot.nds} />
          </div>

          {lot.positions && lot.positions.length > 0 && (
            <>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
                Позиции ({lot.positions.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30">
                      {["№", "Наименование", "ОКПД2", "Кол.", "Ед.", "Цена/ед.", "Сумма"].map((h) => (
                        <th key={h} className="pb-2 pr-3 text-left text-[11px] font-semibold text-muted-foreground/50 last:text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lot.positions.map((pos, i) => (
                      <tr key={pos.id} className="border-b border-border/20 last:border-0">
                        <td className="py-2 pr-3 text-[12px] text-muted-foreground/50">{pos.number ?? i + 1}</td>
                        <td className="py-2 pr-3">
                          <div className="text-[13px] font-medium text-foreground">{pos.name ?? "—"}</div>
                          {pos.info && <div className="text-[11px] text-muted-foreground/50">{pos.info}</div>}
                        </td>
                        <td className="py-2 pr-3">
                          {pos.okpd_code ? (
                            <span className="font-mono text-[11px] text-muted-foreground">{pos.okpd_code}</span>
                          ) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-[12px] tabular-nums">{pos.qty ?? "—"}</td>
                        <td className="py-2 pr-3 text-[12px] text-muted-foreground/60">{pos.unit_name ?? "—"}</td>
                        <td className="py-2 pr-3 text-right text-[12px] tabular-nums text-muted-foreground">{fmtMoney(pos.unit_price)}</td>
                        <td className="py-2 text-right text-[13px] tabular-nums font-semibold text-foreground">{fmtMoney(pos.price ?? pos.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TabInfo({ p, live }: { p: Procurement; live: LiveData | null }) {
  const d = live?.detail;

  return (
    <div className="space-y-4">
      {/* Organizer */}
      <GlassCard className="p-5">
        <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/10">
            <Building2 className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          Заказчик / Организатор
        </div>
        <div className="divide-y divide-border/20">
          <InfoRow label="Наименование" value={d?.organizer?.short_title ?? d?.organizer?.full_title ?? p.customer?.name} />
          <InfoRow label="Полное название" value={d?.organizer?.full_title} />
          <InfoRow label="ИНН" value={d?.organizer?.inn ?? p.customer?.inn} />
          <InfoRow label="КПП" value={d?.organizer?.kpp ?? p.customer?.kpp} />
          <InfoRow label="ОГРН" value={d?.organizer?.ogrn} />
          <InfoRow label="Юридический адрес" value={d?.organizer?.legal_address} />
          <InfoRow label="Фактический адрес" value={d?.organizer?.fact_address} />
          <InfoRow label="Телефон" value={d?.organizer?.phone_number} />
          <InfoRow label="Email" value={d?.organizer?.email} />
          {d?.organizer?.last_name && (
            <InfoRow
              label="Контактное лицо"
              value={[d.organizer.last_name, d.organizer.first_name, d.organizer.middle_name].filter(Boolean).join(" ")}
            />
          )}
        </div>
      </GlassCard>

      {/* Порядок проведения процедуры */}
      <GlassCard className="p-5">
        <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/10">
            <CalendarClock className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          Порядок проведения процедуры
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-0 sm:grid-cols-2">
          <div className="divide-y divide-border/20">
            <InfoRow label="Дата начала срока подачи заявок"        value={fmtRft(p.publicationDate)} />
            <InfoRow label="Дата и время окончания срока подачи заявок" value={fmtRft(p.applicationDeadline)} />
            <InfoRow label="Порядок подачи заявок"                  value={p.biddingProcedures ?? d?.bidding_procedures} />
          </div>
          <div className="divide-y divide-border/20">
            <InfoRow label="Место подведения итогов"   value={p.summingUpPlace ?? d?.place_review_and_summing_up} />
            <InfoRow label="Дата подведения итогов"    value={(p.summingUpDate ?? d?.summing_up_date) ? fmtRft(p.summingUpDate ?? d?.summing_up_date) : undefined} />
            <InfoRow label="Порядок подведения итогов" value={p.summingUpOrder ?? d?.order_review_and_summing_up} />
          </div>
        </div>
        {p.statusLabel && (
          <div className="mt-4 border-t border-border/20 pt-3 text-[12px] text-muted-foreground/70 italic">
            {p.statusLabel}
          </div>
        )}
      </GlassCard>

      {/* Provisions */}
      {d && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GlassCard className="p-5">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-foreground">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/10">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
              </div>
              Обеспечение заявки
              <Tooltip>
                <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-muted-foreground/40 cursor-help" /></TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-xs">Блокируется при подаче. Возвращается всем, кроме победителя.</TooltipContent>
              </Tooltip>
            </div>
            {d.provision_bid ? (
              <>
                <div className="text-[18px] font-bold text-foreground">
                  {d.provision_bid.is_specified && d.provision_bid.amount?.amount && Number(d.provision_bid.amount.amount) > 0
                    ? fmt(Number(d.provision_bid.amount.amount))
                    : d.provision_bid.percent ? `${d.provision_bid.percent}%` : "Без обеспечения"}
                </div>
                {d.provision_bid.methods?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {d.provision_bid.methods.map((m) => (
                      <span key={m} className="rounded-md px-2 py-0.5 text-[11px] ring-1 ring-inset ring-border/50 text-muted-foreground">
                        {m === "WITHOUT_COLLATERAL" ? "Без залога" : m === "CASH" ? "Наличные" : m === "BANK_GUARANTEE" ? "Банковская гарантия" : m}
                      </span>
                    ))}
                  </div>
                ) : null}
                {d.provision_bid.payment_return && (
                  <p className="mt-2 text-[11px] text-muted-foreground/60">{d.provision_bid.payment_return}</p>
                )}
              </>
            ) : <p className="text-[13px] text-muted-foreground/60">Не указано</p>}
          </GlassCard>

          <GlassCard className="p-5">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-foreground">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/10">
                <Receipt className="h-3.5 w-3.5 text-indigo-400" />
              </div>
              Комиссия ЭТП
            </div>
            {d.tariff ? (
              <>
                <div className="text-[18px] font-bold text-foreground">
                  {d.tariff.percent != null ? `${d.tariff.percent}%`
                    : d.tariff.text && d.tariff.text !== "Не определен" ? d.tariff.text
                    : "Не определена"}
                </div>
                {d.tariff.nds && (
                  <span className="mt-2 inline-block rounded-md px-2 py-0.5 text-[11px] ring-1 ring-inset ring-border/50 text-muted-foreground">
                    {d.tariff.nds === "INCLUDE_NDS" ? "С НДС" : d.tariff.nds === "WITHOUT_NDS" ? "Без НДС" : d.tariff.nds}
                  </span>
                )}
              </>
            ) : <p className="text-[13px] text-muted-foreground/60">Не указана</p>}
          </GlassCard>
        </div>
      )}

      {/* Conditions */}
      {d && (d.info_trading_venue || d.bidding_procedures || d.requirements_participant || d.order_review_and_summing_up) && (
        <GlassCard className="p-5">
          <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-foreground">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/10">
              <CircleDot className="h-3.5 w-3.5 text-indigo-400" />
            </div>
            Условия процедуры
          </div>
          <div className="divide-y divide-border/20">
            <InfoRow label="Площадка торгов" value={d.info_trading_venue} />
            <InfoRow label="Порядок проведения" value={d.bidding_procedures} />
            <InfoRow label="Требования к участникам" value={d.requirements_participant} />
            <InfoRow label="Порядок рассмотрения" value={d.order_review_and_summing_up} />
            {d.requirements?.rnp !== undefined && <InfoRow label="Из РНП исключённые" value={d.requirements.rnp ? "Да" : "Нет"} />}
            {d.requirements?.only_for_smb !== undefined && <InfoRow label="Только для МСП" value={d.requirements.only_for_smb ? "Да" : "Нет"} />}
          </div>
        </GlassCard>
      )}

      {/* Contract provision */}
      {d?.provision_contract?.is_specified && (
        <GlassCard className="p-5">
          <div className="mb-3 text-[13px] font-semibold text-foreground">Обеспечение контракта</div>
          <div className="divide-y divide-border/20">
            <InfoRow
              label="Сумма"
              value={d.provision_contract.amount?.amount && Number(d.provision_contract.amount.amount) > 0
                ? fmt(Number(d.provision_contract.amount.amount))
                : d.provision_contract.percent ? `${d.provision_contract.percent}%` : "Указано в документации"}
            />
            {d.provision_contract.payment_return && (
              <InfoRow label="Порядок возврата" value={d.provision_contract.payment_return} />
            )}
          </div>
        </GlassCard>
      )}

      {/* Lots */}
      {live?.lots && live.lots.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/10">
              <Package className="h-3.5 w-3.5 text-indigo-400" />
            </div>
            <span className="text-[13px] font-semibold text-foreground">Лоты ({live.lots.length})</span>
          </div>
          <div className="space-y-2">
            {live.lots.map((lot, idx) => <LotRow key={lot.id} lot={lot} idx={idx} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Документы ───────────────────────────────────────────────────────────

type DocEntry = RftDocument & { _cat: "main" | "explanation" | "protocol"; _group?: string };

function DocRow({ doc }: { doc: DocEntry }) {
  const catColor: Record<DocEntry["_cat"], string> = {
    main:        "bg-indigo-500/10 text-indigo-400",
    explanation: "bg-amber-500/10 text-amber-400",
    protocol:    "bg-emerald-500/10 text-emerald-400",
  };
  const catLabel: Record<DocEntry["_cat"], string> = {
    main: "Основной", explanation: "Разъяснение", protocol: "Протокол",
  };

  return (
    <div className="flex items-center gap-3 border-b border-border/20 py-3 last:border-0 group">
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", catColor[doc._cat])}>
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-foreground truncate">{doc.name}</div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50">{catLabel[doc._cat]}</span>
          {doc._group && <span className="text-[10px] text-muted-foreground/40 truncate max-w-[200px]">{doc._group}</span>}
          {doc.size && <span className="text-[10px] text-muted-foreground/40">{doc.size}</span>}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => openExternal(doc.url)}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border/50 hover:ring-indigo-500/30 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all"
        >
          <Download className="h-3.5 w-3.5" />
          Скачать
        </button>
      </div>
    </div>
  );
}

function TabDocuments({ live }: { live: LiveData | null }) {
  const [filter, setFilter] = useState<"all" | "main" | "explanation" | "protocol">("all");

  if (!live) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40">
          <FileText className="h-5 w-5 text-muted-foreground/30" />
        </div>
        <p className="text-[13px] text-muted-foreground/60">Данные РФТорги недоступны</p>
      </div>
    );
  }

  const allDocs: DocEntry[] = [
    ...live.documents.map((d) => ({ ...d, _cat: "main" as const })),
    ...live.explanations.flatMap((e) =>
      (e.documents ?? []).map((d) => ({ ...d, _cat: "explanation" as const, _group: e.title ?? e.type_localized }))
    ),
    ...live.protocols.flatMap((pr) =>
      (pr.documents ?? []).map((d) => ({ ...d, _cat: "protocol" as const, _group: pr.type_localized }))
    ),
  ];

  const filtered = filter === "all" ? allDocs : allDocs.filter((d) => d._cat === filter);

  const counts = {
    all: allDocs.length,
    main: allDocs.filter((d) => d._cat === "main").length,
    explanation: allDocs.filter((d) => d._cat === "explanation").length,
    protocol: allDocs.filter((d) => d._cat === "protocol").length,
  };

  const filters: Array<{ key: typeof filter; label: string }> = [
    { key: "all",         label: `Все (${counts.all})` },
    { key: "main",        label: `Основные (${counts.main})` },
    { key: "explanation", label: `Разъяснения (${counts.explanation})` },
    { key: "protocol",    label: `Протоколы (${counts.protocol})` },
  ];

  return (
    <div className="space-y-3">
      {/* Filter strip */}
      <div className="flex flex-wrap gap-1.5">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-medium transition-all ring-1 ring-inset",
              filter === key
                ? "bg-indigo-500 text-white ring-indigo-500 shadow-sm"
                : "ring-border/50 text-muted-foreground hover:ring-indigo-500/30 hover:text-indigo-400 hover:bg-indigo-500/5",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40">
            <FileText className="h-5 w-5 text-muted-foreground/30" />
          </div>
          <p className="text-[13px] text-muted-foreground/60">Документы не найдены</p>
        </div>
      ) : (
        <GlassCard className="overflow-hidden px-5">
          {filtered.map((doc) => <DocRow key={`${doc._cat}-${doc.id}`} doc={doc} />)}
        </GlassCard>
      )}

      {/* Also show explanations with text */}
      {(filter === "all" || filter === "explanation") && live.explanations.some((e) => e.text) && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 px-1">
            Тексты разъяснений
          </div>
          {live.explanations.filter((e) => e.text).map((exp) => (
            <GlassCard key={exp.id} className="p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-[13px] font-medium text-foreground">{exp.title ?? exp.type_localized ?? "Разъяснение"}</span>
                {exp.published_at && <span className="shrink-0 text-[11px] text-muted-foreground/50">{fmtRft(exp.published_at)}</span>}
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{exp.text}</p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: AI Анализ ───────────────────────────────────────────────────────────

function TabAiInsights({
  p, whyData, whyLoading, onOpenChat,
}: {
  p: Procurement;
  whyData?: { explanation: string; score: number };
  whyLoading: boolean;
  onOpenChat: () => void;
}) {
  // Use live per-user score from /why; fall back to DB value while loading
  const score = whyData?.score ?? p.relevanceScore;
  const sg = scoreGrad(score);

  return (
    <div className="space-y-4">
      {/* Score hero card */}
      <div className="relative overflow-hidden rounded-2xl p-px">
        <div className={cn("pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br opacity-20", sg.from, sg.to)} />
        <div className="relative rounded-[calc(1rem-1px)] bg-card/70 p-6 backdrop-blur-sm dark:bg-[#0E1120]/80">
          <div className="flex items-start gap-6">
            {/* Score ring */}
            <div className="relative shrink-0">
              <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                <circle
                  cx="40" cy="40" r="34" fill="none" strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - score / 100)}`}
                  strokeLinecap="round"
                  className={cn("transition-all duration-700", sg.bar.replace("bg-", "stroke-"))}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[20px] font-black text-foreground">{score}</span>
              </div>
            </div>

            {/* Label + bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">AI Оценка релевантности</span>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset",
                  score >= 70 ? "bg-emerald-500/10 ring-emerald-500/30 text-emerald-400"
                  : score >= 40 ? "bg-amber-500/10 ring-amber-500/30 text-amber-400"
                  : "bg-muted/40 ring-border/50 text-muted-foreground")}>
                  {sg.label}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted/30 overflow-hidden mb-4">
                <div
                  className={cn("h-2 rounded-full transition-all duration-700", sg.bar)}
                  style={{ width: `${score}%` }}
                />
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground/60">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                Рассчитано на основе профиля вашей организации
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <GlassCard className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/10">
            <Zap className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <span className="text-[13px] font-semibold text-foreground">Почему эта закупка?</span>
        </div>

        {whyLoading ? (
          <div className="space-y-2">
            {[100, 85, 60].map((w) => (
              <div key={w} className="h-3 rounded-full bg-muted/40 animate-pulse" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            {whyData?.explanation ?? "Оценка рассчитана на основе профиля вашей организации."}
          </p>
        )}
      </GlassCard>

      {/* Insights grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span className="text-[12px] font-semibold text-foreground">Потенциал</span>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Начальная цена {fmt(p.initialPrice)} — {score >= 60 ? "высокая вероятность успешного участия" : "оцените соответствие требованиям"}
          </p>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="h-4 w-4 text-amber-400" />
            <span className="text-[12px] font-semibold text-foreground">Сроки</span>
          </div>
          {(() => {
            const d = daysLeft(p.applicationDeadline);
            return (
              <p className={cn("text-[12px] leading-relaxed", d <= 7 ? "text-red-400" : d <= 14 ? "text-amber-400" : "text-muted-foreground")}>
                {d < 0 ? "Срок подачи заявок истёк" : d === 0 ? "Последний день подачи заявок!" : `До дедлайна ${d} дней — ${d <= 7 ? "критично мало, действуйте сейчас" : "есть время на подготовку"}`}
              </p>
            );
          })()}
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-violet-400" />
            <span className="text-[12px] font-semibold text-foreground">Рекомендация</span>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            {score >= 70
              ? "Рекомендуем участие. Закупка хорошо соответствует профилю организации."
              : score >= 40
              ? "Частичное соответствие. Изучите требования внимательно."
              : "Низкая релевантность. Взвесьте затраты на подготовку заявки."}
          </p>
        </GlassCard>
      </div>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onOpenChat}
          className="flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-semibold bg-indigo-500 text-white hover:bg-indigo-400 shadow-lg shadow-indigo-500/20 transition-all duration-150"
        >
          <MessageSquare className="h-4 w-4" />
          Проконсультироваться с AI
        </button>
        {p.documentationUrl && (
          <button
            onClick={() => openExternal(p.documentationUrl!)}
            className="flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-semibold ring-1 ring-inset ring-border/60 text-muted-foreground hover:ring-indigo-500/30 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all duration-150"
          >
            <ExternalLink className="h-4 w-4" />
            Открыть на РФТорги
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Чат ─────────────────────────────────────────────────────────────────

function TabChat({ procurementId, p }: { procurementId: string; p: Procurement }) {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Array<{ id: string; role: "user" | "assistant"; content: string }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { isLoading: histLoading, data: historyData } = useQuery({
    queryKey: ["conversations", procurementId],
    queryFn: () => fetchHistory(procurementId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (historyData) {
      setMsgs(historyData.map((m) => ({ id: m.id, role: m.role === "assistant" ? "assistant" : "user", content: m.content })));
    }
  }, [historyData]);

  const { mutate: doSend, isPending: sending } = useMutation({
    mutationFn: (message: string) => sendMessage({ message, procurementId }),
    onMutate: (message) => {
      const oid = `opt-${Date.now()}`;
      setMsgs((prev) => [...prev, { id: oid, role: "user", content: message }]);
      return { oid };
    },
    onSuccess: (data) => {
      setMsgs((prev) => [...prev, { id: `ai-${Date.now()}`, role: "assistant", content: data.content }]);
      qc.invalidateQueries({ queryKey: ["conversations", procurementId] });
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.oid) setMsgs((prev) => prev.filter((m) => m.id !== ctx.oid));
      toast.error("Ошибка при отправке");
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, sending]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    doSend(text);
  };

  const quickActions = [
    { icon: CheckCircle2,  label: "Проверить документацию", text: `Проверь документацию по закупке «${p.title}» на соответствие 223-ФЗ` },
    { icon: CalendarClock, label: "Сроки",                  text: `Какие минимальные сроки подачи заявок для закупки №${p.number}?` },
    { icon: AlertTriangle, label: "Риски и нарушения",      text: `Какие риски и возможные нарушения 223-ФЗ есть в закупке «${p.title}»?` },
    { icon: TrendingUp,    label: "Шансы на победу",        text: `Оцени наши шансы на победу в закупке №${p.number} с начальной ценой ${fmt(p.initialPrice)}` },
  ];

  return (
    <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm">
      {/* Context banner */}
      <div className="flex items-center gap-3 border-b border-border/30 px-4 py-3 bg-indigo-500/5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15">
          <Bot className="h-4 w-4 text-indigo-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-indigo-400">Контекст: закупка №{p.number}</div>
          <div className="truncate text-[12px] text-muted-foreground/70">{p.title}</div>
        </div>
        <Link
          to={`/chat?procurement=${procurementId}`}
          className="shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-indigo-400 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Открыть полный чат</span>
        </Link>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {histLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        ) : msgs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10">
              <Sparkles className="h-7 w-7 text-indigo-400" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-foreground">Спросите AI по этой закупке</p>
              <p className="mt-1 text-[12px] text-muted-foreground max-w-sm">
                Консультация по документации, срокам, рискам и требованиям
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {quickActions.map((q) => (
                <button
                  key={q.label}
                  onClick={() => setInput(q.text)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium ring-1 ring-inset ring-indigo-500/30 text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors"
                >
                  <q.icon className="h-3 w-3" />
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          msgs.map((m) => (
            <div key={m.id} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
              <div className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px]",
                m.role === "assistant" ? "bg-indigo-500/15 text-indigo-400" : "bg-muted/60 text-muted-foreground",
              )}>
                {m.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              </div>
              <div className={cn("max-w-[80%]", m.role === "user" && "text-right")}>
                <div className={cn(
                  "inline-block rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap",
                  m.role === "assistant"
                    ? "rounded-tl-sm bg-card/80 text-foreground border border-border/30"
                    : "rounded-tr-sm bg-indigo-500 text-white",
                )}>
                  {m.content}
                </div>
              </div>
            </div>
          ))
        )}

        {sending && (
          <div className="flex gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/15">
              <Bot className="h-3.5 w-3.5 text-indigo-400" />
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border/30 bg-card/80 px-3.5 py-2.5 text-[12px] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-indigo-400" />
              Анализирую...
            </div>
          </div>
        )}
      </div>

      {/* Quick chips (when has messages) */}
      {msgs.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto border-t border-border/20 bg-background/20 px-4 py-2">
          {quickActions.map((q) => (
            <button
              key={q.label}
              onClick={() => setInput(q.text)}
              className="shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ring-border/40 text-muted-foreground hover:ring-indigo-500/30 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all"
            >
              <q.icon className="h-3 w-3" />
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/30 bg-card/60 p-3">
        <div className={cn(
          "flex items-end gap-2 rounded-xl border bg-background/60 p-2 transition-all",
          "border-border/40 focus-within:border-indigo-500/40 focus-within:ring-1 focus-within:ring-indigo-500/20",
        )}>
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Спросите про закупку №${p.number}...`}
            disabled={sending || histLoading}
            className="min-h-[32px] flex-1 resize-none bg-transparent px-1 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending || histLoading}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/40">
          <CheckCircle2 className="mr-0.5 inline h-3 w-3 text-emerald-500/70" />
          Ответы проверяются по нормам 223-ФЗ и 44-ФЗ
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const ProcurementDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState("info");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["procurement-live", id],
    queryFn: () => fetchProcurementLive(id!),
    enabled: !!id,
  });

  if (isError) toast.error("Не удалось загрузить закупку");

  const { data: whyData, isLoading: whyLoading } = useQuery({
    queryKey: ["procurement-why", id],
    queryFn: () => fetchWhy(id!),
    enabled: !!id && !!data?.procurement,
    staleTime: 300_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <AppLayout title="Загрузка..." subtitle="">
        <div className="flex flex-col items-center justify-center gap-3 py-32">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-[13px] text-muted-foreground">Загружаем данные закупки...</p>
        </div>
      </AppLayout>
    );
  }

  const p = data?.procurement;
  if (!p) {
    return (
      <AppLayout title="Не найдено" subtitle="">
        <div className="flex flex-col items-center justify-center gap-3 py-32">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/40">
            <FileText className="h-7 w-7 text-muted-foreground/30" />
          </div>
          <p className="text-[14px] text-muted-foreground">Закупка не найдена</p>
        </div>
      </AppLayout>
    );
  }

  const live = data?.live ?? null;
  const totalDocs =
    (live?.documents.length ?? 0) +
    (live?.explanations.flatMap((e) => e.documents ?? []).length ?? 0) +
    (live?.protocols.flatMap((pr) => pr.documents ?? []).length ?? 0);

  return (
    <AppLayout
      title="Детали закупки"
      subtitle={p.number}
      headerRight={
        <div className="flex items-center gap-2">
          {p.documentationUrl && (
            <button
              onClick={() => openExternal(p.documentationUrl!)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset ring-border/60 text-muted-foreground hover:ring-indigo-500/30 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              РФТорги
            </button>
          )}
          <button
            onClick={() => setActiveTab("chat")}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium bg-indigo-500 text-white hover:bg-indigo-400 shadow-md shadow-indigo-500/20 transition-all"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            AI Чат
          </button>
        </div>
      }
    >
      <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
        {/* Back */}
        <Button variant="ghost" size="sm" asChild className="-ml-1 h-8 gap-1.5 text-[12px] text-muted-foreground hover:text-foreground">
          <Link to="/procurements">
            <ArrowLeft className="h-3.5 w-3.5" />
            Назад к списку
          </Link>
        </Button>

        {/* Hero — pass live per-user score once /why resolves */}
        <ProcurementHero p={p} live={live} score={whyData?.score} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start gap-1 rounded-xl border border-border/40 bg-card/40 p-1 backdrop-blur-sm dark:border-white/[0.05] overflow-x-auto">
            {[
              { value: "info",    icon: ClipboardList, label: "Инфо",       count: 0 },
              { value: "docs",    icon: FileText,      label: "Документы",  count: totalDocs },
              { value: "ai",      icon: Sparkles,      label: "AI Анализ",  count: 0 },
              { value: "chat",    icon: MessageSquare, label: "Чат",        count: 0 },
            ].map(({ value, icon: Icon, label, count }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap",
                  "data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-indigo-500/20",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{label}</span>
                {count > 0 && (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold leading-none">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="info"  className="mt-4"><TabInfo p={p} live={live} /></TabsContent>
          <TabsContent value="docs"  className="mt-4"><TabDocuments live={live} /></TabsContent>
          <TabsContent value="ai"    className="mt-4">
            <TabAiInsights p={p} whyData={whyData} whyLoading={whyLoading} onOpenChat={() => setActiveTab("chat")} />
          </TabsContent>
          <TabsContent value="chat"  className="mt-4">
            <TabChat procurementId={p.id} p={p} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ProcurementDetailPage;
