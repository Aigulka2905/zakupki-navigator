import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2, Phone, CreditCard, FileText, Upload, Trash2, Loader2,
  Save, Sparkles, Search, CheckCircle2, ChevronDown, ChevronUp,
  ExternalLink, CalendarClock, TrendingUp, AlertCircle, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Reveal } from "@/components/Reveal";
import apiClient from "@/lib/api-client";
import type { Organization, OrgDocument, Procurement } from "@/types/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OkvedCode {
  code: string;
  name: string;
}

interface EgrulData {
  inn: string;
  ogrn: string;
  kpp: string;
  fullName: string;
  shortName: string;
  legalAddress: string;
  director: string;
  okvedMain: OkvedCode | null;
  okvedAdditional: OkvedCode[];
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchOrg(): Promise<Organization> {
  const { data } = await apiClient.get<Organization>("/organization");
  return data;
}

async function fetchDocs(): Promise<OrgDocument[]> {
  const { data } = await apiClient.get<OrgDocument[]>("/organization/documents");
  return data;
}

async function lookupEgrul(inn: string): Promise<EgrulData> {
  const { data } = await apiClient.get<EgrulData>(`/egrul/lookup?inn=${inn}`);
  return data;
}

async function fetchByOkved(keywords: string): Promise<Procurement[]> {
  const { data } = await apiClient.get<{ procurements: Procurement[] }>(
    `/procurements/by-okved?keywords=${encodeURIComponent(keywords)}&limit=8`
  );
  return data.procurements;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

const fmtPrice = (p: string | number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(p));

const OKVED_STOP = new Set(["деятел", "связан", "прочая", "прочие", "иных", "иного", "облас", "услуг", "работ"]);

/** Extract search keywords from ОКВЭД names (Cyrillic stems ≥5 chars) */
function okvedKeywords(codes: OkvedCode[]): string {
  const words = codes.flatMap(c => c.name.toLowerCase().split(/[\s,\-–—()/.]+/));
  const stems = [...new Set(
    words.filter(w => w.length >= 5 && !OKVED_STOP.has(w.slice(0, 6))).map(w => w.slice(0, 6))
  )].slice(0, 10);
  return stems.join(",");
}

/** Find which ОКВЭД codes contributed to matching a procurement title */
function matchingOkvedForTitle(title: string, codes: OkvedCode[]): OkvedCode[] {
  const t = title.toLowerCase();
  return codes.filter(c => {
    const words = c.name.toLowerCase().split(/[\s,\-–—()/.]+/);
    return words.some(w => w.length >= 5 && !OKVED_STOP.has(w.slice(0, 6)) && t.includes(w.slice(0, 6)));
  });
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  name:                z.string().min(1, "Обязательное поле"),
  inn:                 z.string().min(10, "ИНН — 10 или 12 цифр"),
  kpp:                 z.string().min(9, "КПП — 9 цифр"),
  ogrn:                z.string().optional(),
  legalAddress:        z.string().optional(),
  actualAddress:       z.string().optional(),
  phone:               z.string().optional(),
  email:               z.string().email("Некорректный email").optional().or(z.literal("")),
  website:             z.string().optional(),
  director:            z.string().optional(),
  description:         z.string().optional(),
  activities:          z.string().optional(),
  bankName:            z.string().optional(),
  bankAccount:         z.string().optional(),
  correspondentAccount:z.string().optional(),
  bik:                 z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── ОКВЭД Badge ──────────────────────────────────────────────────────────────

function OkvedBadge({ code, name, main }: { code: string; name: string; main?: boolean }) {
  return (
    <div className={cn(
      "flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] ring-1 ring-inset",
      main
        ? "bg-indigo-500/10 ring-indigo-500/30 text-indigo-600 dark:text-indigo-400"
        : "bg-muted/40 ring-border/50 text-muted-foreground",
    )}>
      <span className={cn("shrink-0 font-mono font-bold text-[11px] mt-px", main ? "text-indigo-500" : "text-muted-foreground/70")}>
        {code}
      </span>
      <span className="leading-snug">{name}</span>
      {main && (
        <span className="ml-auto shrink-0 rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-500">
          Осн.
        </span>
      )}
    </div>
  );
}

// ─── ЕГРЮЛ Panel ──────────────────────────────────────────────────────────────

function EgrulPanel({
  data,
  onApply,
  onDismiss,
}: {
  data: EgrulData;
  onApply: (data: EgrulData) => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const allOkved = [
    ...(data.okvedMain ? [{ ...data.okvedMain, main: true }] : []),
    ...data.okvedAdditional.map(o => ({ ...o, main: false })),
  ];

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-foreground truncate">{data.fullName || data.shortName}</div>
          <div className="text-[11px] text-muted-foreground/70">ИНН {data.inn} · ОГРН {data.ogrn}</div>
        </div>
        <button onClick={onDismiss} className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ОКВЭД summary */}
      {data.okvedMain && (
        <div className="border-t border-emerald-500/15 px-4 py-2.5 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/60">Основной ОКВЭД:</span>
          <span className="font-mono text-[12px] font-bold text-indigo-500">{data.okvedMain.code}</span>
          <span className="text-[12px] text-muted-foreground truncate">{data.okvedMain.name}</span>
          {data.okvedAdditional.length > 0 && (
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/50">
              + {data.okvedAdditional.length} доп.
            </span>
          )}
        </div>
      )}

      {/* Toggle details */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center gap-2 border-t border-emerald-500/15 px-4 py-2 text-[12px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {expanded ? "Скрыть" : "Показать все данные"}
      </button>

      {expanded && (
        <div className="border-t border-emerald-500/15 px-4 pb-4 pt-3 space-y-4">
          {/* Org details */}
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            {data.kpp && (
              <div><span className="text-muted-foreground/60">КПП: </span><span className="font-medium">{data.kpp}</span></div>
            )}
            {data.director && (
              <div className="col-span-2"><span className="text-muted-foreground/60">Руководитель: </span><span className="font-medium">{data.director}</span></div>
            )}
            {data.legalAddress && (
              <div className="col-span-2"><span className="text-muted-foreground/60">Адрес: </span><span className="font-medium">{data.legalAddress}</span></div>
            )}
          </div>

          {/* All ОКВЭД */}
          {allOkved.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 mb-2">
                Коды ОКВЭД ({allOkved.length})
              </div>
              {allOkved.map(o => (
                <OkvedBadge key={o.code} code={o.code} name={o.name} main={o.main} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action */}
      <div className="border-t border-emerald-500/15 px-4 py-3 flex gap-2">
        <button
          onClick={() => onApply(data)}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold bg-emerald-500 text-white hover:bg-emerald-400 shadow-sm transition-all"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Применить данные
        </button>
        <button
          onClick={onDismiss}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] text-muted-foreground ring-1 ring-inset ring-border/60 hover:text-foreground transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

// ─── Relevant procurements block ──────────────────────────────────────────────

function OkvedProcurements({ okvedCodes }: { okvedCodes: OkvedCode[] }) {
  const keywords = okvedKeywords(okvedCodes);

  const { data: procurements = [], isLoading, isError } = useQuery({
    queryKey: ["procurements-by-okved", keywords],
    queryFn: () => fetchByOkved(keywords),
    enabled: !!keywords,
    staleTime: 120_000,
  } as Parameters<typeof useQuery>[0]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-[13px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
        Ищем релевантные закупки...
      </div>
    );
  }

  if (isError || !procurements.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-[13px] text-muted-foreground/60">
          {isError ? "Не удалось загрузить закупки" : "По вашим ОКВЭД активных закупок не найдено"}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/30">
      {procurements.map(p => {
        const hits = (p as Procurement & { _hits?: number })._hits ?? 0;
        const days = Math.floor((new Date(p.applicationDeadline).getTime() - Date.now()) / 86_400_000);
        const deadlineCls = days < 0 ? "text-muted-foreground/50" : days <= 7 ? "text-red-500" : days <= 14 ? "text-amber-500" : "text-muted-foreground/70";
        const matched = matchingOkvedForTitle(p.title, okvedCodes);

        const scoreBg = hits >= 3 ? "bg-emerald-500"
          : hits >= 2 ? "bg-emerald-400"
          : hits >= 1 ? "bg-amber-500"
          : "bg-muted-foreground/40";

        return (
          <Link
            key={p.id}
            to={`/procurements/${p.id}`}
            className="group flex items-start gap-3 px-4 py-3.5 hover:bg-muted/30 dark:hover:bg-white/[0.02] transition-colors"
          >
            {/* Score circle with ОКВЭД tooltip */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 cursor-help items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-white/10",
                  scoreBg,
                )}>
                  {hits}
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="max-w-[260px] rounded-xl border border-border/60 bg-popover p-3 shadow-xl"
              >
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                  Совпадение по ОКВЭД
                </p>
                {matched.length > 0 ? (
                  <div className="space-y-1.5">
                    {matched.map(o => (
                      <div key={o.code} className="flex items-start gap-2">
                        <span className="mt-px shrink-0 rounded bg-indigo-500/15 px-1 py-px font-mono text-[10px] font-bold text-indigo-400">
                          {o.code}
                        </span>
                        <span className="text-[12px] leading-snug text-foreground/80">{o.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground/60">
                    Совпадение по общим критериям профиля организации
                  </p>
                )}
                <div className="mt-2 border-t border-border/30 pt-2 text-[10px] text-muted-foreground/40">
                  {hits} {hits === 1 ? "ключевое слово" : hits < 5 ? "ключевых слова" : "ключевых слов"}
                </div>
              </TooltipContent>
            </Tooltip>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-foreground leading-snug line-clamp-2 group-hover:text-indigo-400 transition-colors">
                {p.title}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/60">
                <span className="font-semibold text-foreground/80">{fmtPrice(p.initialPrice)}</span>
                {p.customer && <span>{p.customer.name}</span>}
                <span className={cn("flex items-center gap-1", deadlineCls)}>
                  <CalendarClock className="h-3 w-3" />
                  {days < 0 ? "Истёк" : `${days} дн.`}
                </span>
              </div>
            </div>

            <ExternalLink className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground/30 group-hover:text-indigo-400 transition-colors" />
          </Link>
        );
      })}

      <div className="px-4 py-3 text-center">
        <Link
          to="/procurements"
          className="text-[12px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Смотреть все закупки →
        </Link>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const OrganizationPage = () => {
  const { data: currentUser } = useCurrentUser();
  const isCustomer = currentUser?.organization?.orgType === "customer";
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [egrulData, setEgrulData] = useState<EgrulData | null>(null);
  const [egrulLoading, setEgrulLoading] = useState(false);
  const [savedOkved, setSavedOkved] = useState<OkvedCode[]>([]);

  const { data: org, isLoading } = useQuery({
    queryKey: ["organization"],
    queryFn: fetchOrg,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!org) return;
    const s = org.settings as Record<string, unknown> | null;
    if (s?.okvedMain || s?.okvedAdditional) {
      const main = s.okvedMain as OkvedCode | undefined;
      const additional = (s.okvedAdditional as OkvedCode[]) ?? [];
      setSavedOkved([...(main ? [main] : []), ...additional]);
    }
  }, [org]);

  const { data: docs = [], isLoading: docsLoading } = useQuery({
    queryKey: ["org-documents"],
    queryFn: fetchDocs,
  } as Parameters<typeof useQuery>[0]);

  const { register, handleSubmit, setValue, getValues, formState: { errors, isDirty, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: org ? {
      name:                org.name,
      inn:                 org.inn,
      kpp:                 org.kpp,
      ogrn:                org.settings?.ogrn ?? "",
      legalAddress:        org.settings?.legalAddress ?? "",
      actualAddress:       org.settings?.actualAddress ?? "",
      phone:               org.settings?.phone ?? "",
      email:               org.settings?.email ?? "",
      website:             org.settings?.website ?? "",
      director:            org.settings?.director ?? "",
      description:         org.settings?.description ?? "",
      activities:          org.settings?.activities ?? "",
      bankName:            org.settings?.bankName ?? "",
      bankAccount:         org.settings?.bankAccount ?? "",
      correspondentAccount:org.settings?.correspondentAccount ?? "",
      bik:                 org.settings?.bik ?? "",
    } : undefined,
  });

  // ── ЕГРЮЛ lookup ──────────────────────────────────────────────
  const handleEgrulLookup = async () => {
    const inn = getValues("inn").trim();
    if (!inn || !/^\d{10,12}$/.test(inn)) {
      toast.error("Введите корректный ИНН (10 или 12 цифр)");
      return;
    }
    setEgrulLoading(true);
    try {
      const data = await lookupEgrul(inn);
      setEgrulData(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Не удалось получить данные из ЕГРЮЛ");
    } finally {
      setEgrulLoading(false);
    }
  };

  // ── Apply ЕГРЮЛ data to form ──────────────────────────────────
  const applyEgrulData = (data: EgrulData) => {
    if (data.fullName)     setValue("name", data.fullName, { shouldDirty: true });
    if (data.kpp)          setValue("kpp",  data.kpp,      { shouldDirty: true });
    if (data.ogrn)         setValue("ogrn", data.ogrn,     { shouldDirty: true });
    if (data.legalAddress) setValue("legalAddress", data.legalAddress, { shouldDirty: true });
    if (data.director)     setValue("director", data.director, { shouldDirty: true });

    // Build activities text from ОКВЭД names
    const allCodes = [data.okvedMain, ...data.okvedAdditional].filter(Boolean) as OkvedCode[];
    if (allCodes.length) {
      const acts = allCodes.map(c => c.name).join("; ");
      setValue("activities", acts, { shouldDirty: true });
      setSavedOkved(allCodes);
    }

    setEgrulData(null);
    toast.success("Данные из ЕГРЮЛ применены");
  };

  // ── Submit ────────────────────────────────────────────────────
  const onSubmit = async (values: FormValues) => {
    const { name, inn, kpp, ...rest } = values;
    const allOkved = savedOkved.length ? savedOkved : undefined;
    const [mainOkved, ...additionalOkved] = allOkved ?? [];
    try {
      await apiClient.put("/organization", {
        name, inn, kpp,
        settings: {
          ...rest,
          ...(mainOkved ? { okvedMain: mainOkved, okvedAdditional: additionalOkved } : {}),
        },
      });
      qc.invalidateQueries({ queryKey: ["organization"] });
      toast.success("Профиль организации сохранён");
    } catch {
      toast.error("Не удалось сохранить профиль");
    }
  };

  // ── File upload ───────────────────────────────────────────────
  const deleteDoc = useMutation({
    mutationFn: (docId: string) => apiClient.delete(`/organization/documents/${docId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["org-documents"] }); toast.success("Документ удалён"); },
    onError: () => toast.error("Не удалось удалить документ"),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name);
      await apiClient.post("/organization/documents", form, { headers: { "Content-Type": "multipart/form-data" } });
      qc.invalidateQueries({ queryKey: ["org-documents"] });
      toast.success("Документ загружен");
    } catch {
      toast.error("Не удалось загрузить документ");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Профиль организации" subtitle="">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
        </div>
      </AppLayout>
    );
  }

  const GlassCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn(
      "rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm dark:border-white/[0.06] dark:bg-card/40",
      className,
    )}>
      {children}
    </div>
  );

  const SectionHeader = ({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) => (
    <div className="flex items-center gap-2.5 border-b border-border/30 px-5 py-4">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10">
        <Icon className="h-4 w-4 text-indigo-400" />
      </div>
      <div>
        <div className="text-[13px] font-semibold text-foreground">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground/60">{subtitle}</div>}
      </div>
    </div>
  );

  const Field = ({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[12px] font-medium text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );

  return (
    <AppLayout
      title="Профиль организации"
      subtitle="Данные используются ИИ при консультациях и генерации заявок"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">

          {/* Info banner */}
          <Reveal direction="up" delay={0}>
          <div className="flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
            <p className="text-[13px] text-foreground/80 leading-relaxed">
              Заполненный профиль позволяет ИИ генерировать тексты заявок, проверять соответствие
              требованиям и автоматически подставлять реквизиты. Используйте кнопку{" "}
              <span className="font-semibold text-indigo-400">Загрузить из ЕГРЮЛ</span> для автозаполнения по ИНН.
            </p>
          </div>
          </Reveal>

          {/* ── Основные реквизиты ─────────────────────────────── */}
          <Reveal direction="up" delay={0.07}>
          <GlassCard>
            <SectionHeader icon={Building2} title="Основные реквизиты" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field id="name" label="Полное наименование *" error={errors.name?.message}>
                  <Input id="name" {...register("name")} placeholder='ООО "Пример"' />
                </Field>
              </div>

              {/* INN row with ЕГРЮЛ button */}
              <Field id="inn" label="ИНН *" error={errors.inn?.message}>
                <div className="flex gap-2">
                  <Input id="inn" {...register("inn")} placeholder="7701234567" className="flex-1" />
                  <button
                    type="button"
                    onClick={handleEgrulLookup}
                    disabled={egrulLoading}
                    title="Загрузить данные организации из ЕГРЮЛ по ИНН"
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all",
                      "ring-1 ring-inset ring-border/60 text-muted-foreground",
                      "hover:ring-indigo-500/40 hover:text-indigo-400 hover:bg-indigo-500/5",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    {egrulLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Search className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">ЕГРЮЛ</span>
                  </button>
                </div>
              </Field>

              <Field id="kpp" label="КПП *" error={errors.kpp?.message}>
                <Input id="kpp" {...register("kpp")} placeholder="770101001" />
              </Field>
              <Field id="ogrn" label="ОГРН">
                <Input id="ogrn" {...register("ogrn")} placeholder="1027700132195" />
              </Field>
              <Field id="director" label="Руководитель (ФИО)">
                <Input id="director" {...register("director")} placeholder="Иванов Иван Иванович" />
              </Field>
              <div className="sm:col-span-2">
                <Field id="legalAddress" label="Юридический адрес">
                  <Input id="legalAddress" {...register("legalAddress")} placeholder="123456, г. Москва, ул. Примерная, д. 1" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field id="actualAddress" label="Фактический адрес">
                  <Input id="actualAddress" {...register("actualAddress")} placeholder="Совпадает с юридическим" />
                </Field>
              </div>
            </div>

            {/* ЕГРЮЛ result panel */}
            {egrulData && (
              <div className="border-t border-border/30 px-5 pb-5">
                <EgrulPanel
                  data={egrulData}
                  onApply={applyEgrulData}
                  onDismiss={() => setEgrulData(null)}
                />
              </div>
            )}
          </GlassCard>
          </Reveal>

          {/* ── Контакты ───────────────────────────────────────── */}
          <Reveal direction="up" delay={0.12}>
          <GlassCard>
            <SectionHeader icon={Phone} title="Контактные данные" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field id="phone" label="Телефон">
                <Input id="phone" {...register("phone")} placeholder="+7 (495) 123-45-67" />
              </Field>
              <Field id="email" label="Email" error={errors.email?.message}>
                <Input id="email" type="email" {...register("email")} placeholder="info@company.ru" />
              </Field>
              <div className="sm:col-span-2">
                <Field id="website" label="Сайт">
                  <Input id="website" {...register("website")} placeholder="https://company.ru" />
                </Field>
              </div>
            </div>
          </GlassCard>
          </Reveal>

          {/* ── Профиль деятельности (участники) ───────────────── */}
          {!isCustomer && (
            <Reveal direction="up" delay={0.17}>
            <GlassCard>
              <SectionHeader
                icon={Sparkles}
                title="Профиль деятельности"
                subtitle="ИИ использует эти данные для оценки релевантности закупок и генерации заявок"
              />
              <div className="space-y-4 p-5">
                <Field id="description" label="Описание организации">
                  <Textarea
                    id="description"
                    {...register("description")}
                    rows={3}
                    placeholder="Краткое описание деятельности, специализации и опыта компании..."
                  />
                </Field>
                <Field id="activities" label="Виды деятельности / специализация">
                  <Textarea
                    id="activities"
                    {...register("activities")}
                    rows={3}
                    placeholder="Поставка оборудования, строительство, IT-услуги, медицинские изделия..."
                  />
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    Заполняется автоматически при загрузке ОКВЭД из ЕГРЮЛ
                  </p>
                </Field>
              </div>
            </GlassCard>
            </Reveal>
          )}

          {/* ── ОКВЭД блок ─────────────────────────────────────── */}
          {savedOkved.length > 0 && (
            <Reveal direction="up" delay={0.22}>
            <GlassCard>
              <div className="flex items-center gap-2.5 border-b border-border/30 px-5 py-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10">
                  <TrendingUp className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-foreground">
                    Коды ОКВЭД
                    <span className="ml-2 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] font-bold text-indigo-400">
                      {savedOkved.length}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground/50">
                    Данные из ЕГРЮЛ · используются для подбора релевантных закупок
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-2">
                {/* Main ОКВЭД — prominent */}
                {savedOkved[0] && (
                  <div className="flex items-start gap-3 rounded-xl bg-indigo-500/8 px-4 py-3 ring-1 ring-inset ring-indigo-500/20">
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <span className="font-mono text-[13px] font-bold text-indigo-400">{savedOkved[0].code}</span>
                      <span className="rounded-full bg-indigo-500/20 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-indigo-400">
                        осн.
                      </span>
                    </div>
                    <span className="text-[13px] text-foreground/85 leading-snug">{savedOkved[0].name}</span>
                  </div>
                )}

                {/* Additional ОКВЭД */}
                {savedOkved.length > 1 && (
                  <div className="space-y-1.5">
                    <div className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/40">
                      Дополнительные виды деятельности ({savedOkved.length - 1})
                    </div>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {savedOkved.slice(1).map(o => (
                        <div
                          key={o.code}
                          className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 ring-1 ring-inset ring-border/40 dark:bg-white/[0.02]"
                        >
                          <span className="shrink-0 font-mono text-[11px] font-bold text-muted-foreground/60 mt-px">
                            {o.code}
                          </span>
                          <span className="text-[12px] text-muted-foreground leading-snug">{o.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
            </Reveal>
          )}

          {/* ── Банковские реквизиты ────────────────────────────── */}
          <Reveal direction="up" delay={0.22}>
          <GlassCard>
            <SectionHeader icon={CreditCard} title="Банковские реквизиты" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field id="bankName" label="Наименование банка">
                  <Input id="bankName" {...register("bankName")} placeholder='ПАО "Сбербанк России"' />
                </Field>
              </div>
              <Field id="bankAccount" label="Расчётный счёт">
                <Input id="bankAccount" {...register("bankAccount")} placeholder="40702810123450101234" />
              </Field>
              <Field id="bik" label="БИК">
                <Input id="bik" {...register("bik")} placeholder="044525225" />
              </Field>
              <div className="sm:col-span-2">
                <Field id="correspondentAccount" label="Корреспондентский счёт">
                  <Input id="correspondentAccount" {...register("correspondentAccount")} placeholder="30101810400000000225" />
                </Field>
              </div>
            </div>
          </GlassCard>
          </Reveal>

          {/* ── Документы ──────────────────────────────────────── */}
          <Reveal direction="up" delay={0.27}>
          <GlassCard>
            <SectionHeader
              icon={FileText}
              title="Документы организации"
              subtitle="Уставные документы, лицензии, сертификаты"
            />
            <div className="p-5">
              {docsLoading ? (
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Загрузка...
                </div>
              ) : docs.length > 0 ? (
                <div className="mb-4 divide-y divide-border/30 rounded-lg border border-border/40">
                  {docs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-foreground">{doc.name}</p>
                        <p className="text-[11px] text-muted-foreground/60">
                          {formatBytes(doc.fileSize)} · {new Date(doc.uploadedAt).toLocaleDateString("ru-RU")}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/5 transition-all"
                        onClick={() => deleteDoc.mutate(doc.id)}
                        disabled={deleteDoc.isLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mb-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/50 py-8 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-[13px] text-muted-foreground/60">Документы не загружены</p>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium ring-1 ring-inset ring-border/60 text-muted-foreground hover:ring-indigo-500/30 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Загрузка..." : "Загрузить документ"}
              </button>
              <p className="mt-2 text-[11px] text-muted-foreground/50">PDF, Word, Excel, изображения · до 50 МБ</p>
            </div>
          </GlassCard>
          </Reveal>

          {/* ── Save button ─────────────────────────────────────── */}
          <Reveal direction="up" delay={0.3}>
          <div className="flex justify-end gap-3 pb-4">
            <Button type="submit" disabled={isSubmitting || !isDirty} className="gap-2">
              {isSubmitting
                ? <><Loader2 className="h-4 w-4 animate-spin" />Сохранение...</>
                : <><Save className="h-4 w-4" />Сохранить профиль</>}
            </Button>
          </div>
          </Reveal>

          {/* ── Релевантные закупки по ОКВЭД (участники) ──────── */}
          {!isCustomer && savedOkved.length > 0 && (
            <Reveal direction="up" delay={0.33}>
            <GlassCard className="overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-border/30 px-5 py-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-foreground">Закупки по вашему профилю ОКВЭД</div>
                  <div className="text-[11px] text-muted-foreground/60">
                    Активные закупки, соответствующие вашим видам деятельности
                  </div>
                </div>
                <Link
                  to="/procurements"
                  className="shrink-0 flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Все закупки
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <OkvedProcurements okvedCodes={savedOkved} />
            </GlassCard>
            </Reveal>
          )}

        </div>
      </form>
    </AppLayout>
  );
};

export default OrganizationPage;
