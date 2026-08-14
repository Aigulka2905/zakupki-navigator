import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Download, Loader2 } from "lucide-react";

interface Invoice {
  id: string;
  number: number;
  amountRubles: string;
  status: "pending" | "paid" | "cancelled";
  createdAt: string;
}

const STATUS: Record<Invoice["status"], { label: string; cls: string }> = {
  pending:   { label: "Ожидает оплаты", cls: "text-amber-600 dark:text-amber-400" },
  paid:      { label: "Оплачен",        cls: "text-emerald-600 dark:text-emerald-400" },
  cancelled: { label: "Отменён",        cls: "text-muted-foreground line-through" },
};

export function InvoiceSection() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");

  const { data: invoices = [] } = useQuery({
    queryKey: ["billing-invoices"],
    queryFn: () => apiClient.get<Invoice[]>("/billing/invoices").then((r) => r.data),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (rub: number) => apiClient.post<Invoice>("/billing/invoice", { amount: rub }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["billing-invoices"] }); setAmount(""); toast.success("Счёт выставлен — скачайте PDF и оплатите по реквизитам"); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Не удалось выставить счёт"),
  });

  const [downloading, setDownloading] = useState<string | null>(null);
  const downloadPdf = async (inv: Invoice) => {
    setDownloading(inv.id);
    try {
      const res = await apiClient.get(`/billing/invoice/${inv.id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url; a.download = `schet-${inv.number}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Не удалось сформировать PDF. Убедитесь, что сервис генерации запущен.");
    } finally { setDownloading(null); }
  };

  const onCreate = () => {
    const rub = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(rub) || rub < 100) { toast.error("Укажите сумму от 100 ₽"); return; }
    create.mutate(rub);
  };

  return (
    <Card className="p-5 shadow-card">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
        <FileText className="h-4 w-4 text-indigo-400" /> Оплата по счёту (для юрлиц)
      </h3>
      <p className="mb-4 max-w-2xl text-xs text-muted-foreground">
        Выставите счёт на нужную сумму, скачайте PDF и оплатите по расчётному счёту (платёжное поручение).
        После поступления средств оператор подтвердит оплату — сумма зачислится на баланс, с которого покупаются тарифы.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Сумма счёта, ₽</label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
            placeholder="напр. 10000" className="h-9 w-40 text-sm" />
        </div>
        <Button onClick={onCreate} disabled={create.isPending} className="h-9 gap-1.5 text-sm">
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Выставить счёт
        </Button>
      </div>

      {invoices.length > 0 && (
        <div className="mt-4 divide-y divide-border/60 dark:divide-white/[0.06] rounded-lg border border-border/60 dark:border-white/[0.06]">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <div>
                <div className="font-medium">Счёт № {inv.number} — {inv.amountRubles} ₽</div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(inv.createdAt).toLocaleDateString("ru-RU")} · <span className={STATUS[inv.status].cls}>{STATUS[inv.status].label}</span>
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs"
                disabled={downloading === inv.id} onClick={() => downloadPdf(inv)}>
                {downloading === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Скачать счёт
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
