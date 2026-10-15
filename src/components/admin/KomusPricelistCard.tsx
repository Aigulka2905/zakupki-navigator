import { useState } from "react";
import { toast } from "sonner";
import { CloudDownload, RefreshCw, Store, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStorePrices, useSyncKomusApi, useUploadKomusPricelist, type KomusSyncStatus } from "@/hooks/useAdmin";
import { formatDate } from "@/lib/price-search";

const errorText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
const dateTime = (iso: string) => new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });

function syncLine(sync: KomusSyncStatus | null | undefined): string {
  if (!sync) return "Прайс обновляется из API каждую ночь в 05:30 МСК.";
  if (sync.state === "running") return "Обновление из API идёт — около 3 минут…";
  if (sync.state === "failed") return `Последнее обновление из API не удалось: ${sync.error ?? "причина не указана"}`;
  return `Последнее обновление из API: ${sync.finishedAt ? dateTime(sync.finishedAt) : "—"}, товаров ${(sync.itemsCount ?? 0).toLocaleString("ru-RU")}.`;
}

/**
 * Админка: прайс-лист Комуса для «Цен в магазинах» — сведения, обновление из API «Комус ОПТ»
 * (если на сервере задан KOMUS_API_TOKEN) и загрузка CSV/XLSX как запасной путь.
 */
export function KomusPricelistCard() {
  const { data } = useStorePrices();
  const upload = useUploadKomusPricelist();
  const sync = useSyncKomusApi();
  const [file, setFile] = useState<File | null>(null);
  const komus = data?.komus ?? null;
  const api = data?.api;
  const running = api?.sync?.state === "running";

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
      onError: (e: unknown) => toast.error(errorText(e, "Не удалось загрузить прайс-лист")),
    });
  };

  const refresh = () => sync.mutate(undefined, {
    onSuccess: () => toast.success("Обновление из API запущено — займёт около 3 минут."),
    onError: (e: unknown) => toast.error(errorText(e, "Не удалось запустить обновление из API")),
  });

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
            {komus.source === "api" ? (
              <>{" · "}обновлён из API {dateTime(komus.uploadedAt)}.</>
            ) : (
              <>
                {" · "}загружен {new Date(komus.uploadedAt).toLocaleDateString("ru-RU")}
                {komus.uploadedBy ? `, ${komus.uploadedBy}` : ""}
                {komus.fileName ? ` (${komus.fileName})` : ""}.
              </>
            )}
          </>
        ) : (
          "Прайс не загружен — в «Ценах в магазинах» у Комуса будет «прайс не загружен»."
        )}
      </p>

      {api?.configured ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className={api.sync?.state === "failed" ? "flex-1 text-xs text-destructive" : "flex-1 text-xs text-muted-foreground"}>
            {syncLine(api.sync)}
          </p>
          <Button variant="outline" onClick={refresh} disabled={running || sync.isPending} className="shrink-0 gap-1.5">
            {running || sync.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
            Обновить из API
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">
          API «Комус ОПТ» не подключён: задайте KOMUS_API_TOKEN на сервере — прайс будет обновляться сам каждую ночь.
        </p>
      )}

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
        Новый прайс заменяет прежний целиком. Цена — базовая (ПМЦ), из API ещё и РРЦ (в примечании); оптовые цены не используются.
      </p>
    </Card>
  );
}
