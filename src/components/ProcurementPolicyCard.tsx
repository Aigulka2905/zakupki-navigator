import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";
import { Scale, Upload, Trash2, Loader2, AlertCircle, ChevronDown, ChevronUp, Quote } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { fetchProcurementPolicy, clauseLabel } from "@/lib/procurement-policy";
import type { ProcurementPolicy } from "@/types/api";

// Положение о закупке заказчика (223-ФЗ). Сервер выделяет из него свод проверяемых правил —
// каждое с пунктом и дословной цитатой; при проверке документации по 223-ФЗ противоречие
// правилу показывается с основанием «Положение о закупке, п. N».
const POLICY_KEY = ["procurement-policy"];
const SHOWN = 6;

const serverError = (e: unknown, fallback: string) =>
  (axios.isAxiosError(e) ? (e.response?.data as { error?: string } | undefined)?.error : null) ?? fallback;

export function ProcurementPolicyCard() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const canEdit = user?.role !== "viewer";
  const fileRef = useRef<HTMLInputElement>(null);
  const [showAll, setShowAll] = useState(false);

  const { data: policy, isLoading } = useQuery({
    queryKey: POLICY_KEY,
    queryFn: fetchProcurementPolicy,
    // Разбор идёт в фоне (1–3 минуты) — пока он не закончился, спрашиваем статус.
    refetchInterval: (q) => (q.state.data?.status === "processing" ? 5000 : false),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post<{ policy: ProcurementPolicy }>("/organization/procurement-policy", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.policy;
    },
    onSuccess: (p) => { qc.setQueryData(POLICY_KEY, p); toast.success("Положение загружено — выделяем правила для сверки"); },
    onError: (e) => toast.error(serverError(e, "Не удалось загрузить Положение")),
    onSettled: () => { if (fileRef.current) fileRef.current.value = ""; },
  });

  const remove = useMutation({
    mutationFn: () => apiClient.delete("/organization/procurement-policy"),
    onSuccess: () => { qc.setQueryData(POLICY_KEY, null); toast.success("Положение удалено"); },
    onError: () => toast.error("Не удалось удалить Положение"),
  });

  const rules = policy?.status === "ready" ? policy.rules : [];
  const shown = showAll ? rules : rules.slice(0, SHOWN);
  const busy = upload.isPending || remove.isPending;

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm dark:border-white/[0.06] dark:bg-card/40">
      <div className="flex items-center gap-2.5 border-b border-border/30 px-5 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10">
          <Scale className="h-4 w-4 text-indigo-400" />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-foreground">Положение о закупке</div>
          <div className="text-[11px] text-muted-foreground/60">223-ФЗ: проверка документации сверяется с вашим Положением</div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Загрузка...
          </div>
        ) : !policy ? (
          <div className="rounded-lg border border-dashed border-border/50 px-4 py-6 text-center">
            <p className="text-[13px] font-medium text-foreground/80">Положение не загружено</p>
            <p className="mx-auto mt-1 max-w-xl text-[12px] text-muted-foreground/70">
              Загрузите действующее Положение о закупке — при проверке документации по 223-ФЗ сервис покажет,
              где документация ему противоречит, с номером пункта и цитатой. Закупка с нарушением порядка из
              Положения — основание для жалобы в ФАС.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[13px] font-medium text-foreground">{policy.fileName}</span>
              <span className="text-[11px] text-muted-foreground/60">
                обновлено {new Date(policy.updatedAt).toLocaleDateString("ru-RU")}
                {policy.status === "ready" && ` · правил для сверки: ${rules.length}`}
              </span>
            </div>

            {policy.status === "processing" && (
              <div className="flex items-center gap-2 rounded-lg bg-indigo-500/5 px-3 py-2.5 text-[12px] text-foreground/80">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-400" />
                Выделяем правила для сверки: сроки, обеспечение, требования к участникам, способы закупки. Обычно 1–3 минуты.
              </div>
            )}

            {policy.status === "failed" && (
              <div className="flex items-start gap-2 rounded-lg bg-red-500/5 px-3 py-2.5 text-[12px] text-red-600 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{policy.error || "Не удалось разобрать Положение. Загрузите файл ещё раз."}</span>
              </div>
            )}

            {rules.length > 0 && (
              <div className="divide-y divide-border/30 rounded-lg border border-border/40">
                {shown.map((r) => (
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-300">{r.topic}</span>
                      {r.clause && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{clauseLabel(r.clause)}</span>}
                      <span className="text-[13px] text-foreground">{r.rule.charAt(0).toUpperCase() + r.rule.slice(1)}</span>
                    </div>
                    <p className="mt-1 flex gap-1.5 text-[11px] italic text-muted-foreground/80">
                      <Quote className="mt-0.5 h-3 w-3 shrink-0" />«{r.quote}»
                    </p>
                  </div>
                ))}
                {rules.length > SHOWN && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="flex w-full items-center justify-center gap-1 py-2 text-[12px] text-indigo-500 hover:bg-indigo-500/5"
                  >
                    {showAll ? <><ChevronUp className="h-3.5 w-3.5" />Свернуть</> : <><ChevronDown className="h-3.5 w-3.5" />Показать все ({rules.length})</>}
                  </button>
                )}
              </div>
            )}
            {rules.length > 0 && (
              <p className="text-[11px] text-muted-foreground/60">
                В свод попадают только правила, цитата которых дословно найдена в тексте Положения. Сверка — подсказка:
                спорные места проверьте по самому Положению.
              </p>
            )}
          </>
        )}

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium text-muted-foreground ring-1 ring-inset ring-border/60 transition-all hover:bg-indigo-500/5 hover:text-indigo-400 hover:ring-indigo-500/30 disabled:opacity-50"
            >
              {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {upload.isPending ? "Загрузка..." : policy ? "Заменить файл" : "Загрузить Положение"}
            </button>
            {policy && (
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={busy}
                className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium text-muted-foreground transition-all hover:bg-red-500/5 hover:text-red-500 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> Удалить
              </button>
            )}
            <p className="w-full text-[11px] text-muted-foreground/50">PDF с текстовым слоем или Word · до 50 МБ</p>
          </div>
        )}
      </div>
    </div>
  );
}
