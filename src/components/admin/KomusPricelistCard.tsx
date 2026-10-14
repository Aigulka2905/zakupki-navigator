import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Store, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStorePrices, useUploadKomusPricelist } from "@/hooks/useAdmin";
import { formatDate } from "@/lib/price-search";

/** Админка: прайс-лист Комуса для «Цен в магазинах» — сведения и загрузка CSV/XLSX. */
export function KomusPricelistCard() {
  const { data } = useStorePrices();
  const upload = useUploadKomusPricelist();
  const [file, setFile] = useState<File | null>(null);
  const komus = data?.komus ?? null;

  const send = () => {
    if (!file) { toast.error("Выберите файл прайс-листа (CSV или XLSX)"); return; }
    upload.mutate(file, {
      onSuccess: (r) => {
        toast.success(
          `Загружено товаров: ${r.itemsCount.toLocaleString("ru-RU")}`
          + (r.skipped ? `, пропущено строк: ${r.skipped.toLocaleString("ru-RU")}` : "")
          + `. Прайс от ${formatDate(r.priceDate)}.`,
        );
        setFile(null);
      },
      onError: (e: unknown) =>
        toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Не удалось загрузить прайс-лист"),
    });
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Store className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Прайс-лист Комуса</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {komus ? (
          <>
            Для «Цен в магазинах»: прайс от <span className="font-medium text-foreground">{formatDate(komus.priceDate)}</span>,
            товаров: <span className="font-medium text-foreground">{komus.itemsCount.toLocaleString("ru-RU")}</span>
            {" · "}загружен {new Date(komus.uploadedAt).toLocaleDateString("ru-RU")}
            {komus.uploadedBy ? `, ${komus.uploadedBy}` : ""}
            {komus.fileName ? ` (${komus.fileName})` : ""}.
          </>
        ) : (
          "Прайс не загружен — в «Ценах в магазинах» у Комуса будет «прайс не загружен»."
        )}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm hover:border-primary/40">
          <Upload className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-muted-foreground">{file ? file.name : "CSV или XLSX из кабинета komus-opt.ru"}</span>
          <input
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            aria-label="Файл прайс-листа Комуса"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <Button onClick={send} disabled={upload.isPending} className="shrink-0 gap-1.5">
          {upload.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Загрузить прайс
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Новый прайс заменяет прежний целиком. Берётся базовая (розничная) цена; оптовые колонки не используются.
      </p>
    </Card>
  );
}
