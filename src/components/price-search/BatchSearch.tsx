import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, ChevronUp, Download, ExternalLink, FileSpreadsheet, Loader2, Search, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate, formatRub, isHttpUrl, STATUS_TEXT, type StoreResult, type StoreStatus } from "@/lib/price-search";
import { batchTotal, pickOffer, positionMin, positionSum, type BatchChoices, type BatchPosition } from "@/lib/price-batch";
import { saveBatchTemplate, saveBatchXlsx, usePriceBatch } from "@/hooks/usePriceBatch";
import { SimilarBadge } from "./SimilarBadge";

const STORE_COLUMNS = [
  { store: "komus", title: "Комус" },
  { store: "officemag", title: "ОфисМаг" },
];

const statusText = (status: StoreStatus) => (status === "ok" ? STATUS_TEXT.empty : STATUS_TEXT[status]);
const qtyText = (p: BatchPosition) => (p.qty == null ? null : `${p.qty.toLocaleString("ru-RU")}${p.unit ? ` ${p.unit}` : ""}`);

function OfferLink({ name, url, className }: { name: string; url: string; className?: string }) {
  if (!isHttpUrl(url)) return <span className={className}>{name}</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-start gap-1 hover:text-primary hover:underline", className)}>
      <span>{name}</span>
      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
    </a>
  );
}

// Ячейка магазина: ближайшее (или выбранное) предложение — цена и название со ссылкой.
function StoreCell({ s, choice }: { s?: StoreResult; choice?: number }) {
  if (!s) return <TableCell className="text-xs text-muted-foreground">—</TableCell>;
  if (s.status === "pending") {
    return (
      <TableCell>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {STATUS_TEXT.pending}
        </span>
      </TableCell>
    );
  }
  const pick = pickOffer(s, choice);
  if (!pick) {
    return <TableCell className={cn("text-xs", s.status === "unavailable" ? "text-destructive" : "text-muted-foreground")}>{statusText(s.status)}</TableCell>;
  }
  return (
    <TableCell className="max-w-xs">
      <div className={cn("whitespace-nowrap font-medium tabular-nums", !pick.counted && "text-muted-foreground")}>
        {formatRub(pick.offer.price)}
        {!pick.counted && <SimilarBadge />}
      </div>
      <OfferLink name={pick.offer.name} url={pick.offer.url} className="text-xs text-muted-foreground" />
    </TableCell>
  );
}

// Раскрытая строка: до 5 вариантов каждого магазина с кнопкой «Выбрать».
function VariantsRow({ p, choice, onChoose }: { p: BatchPosition; choice?: Record<string, number>; onChoose: (store: string, index: number) => void }) {
  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell />
      <TableCell colSpan={6}>
        <div className="grid gap-4 md:grid-cols-2">
          {STORE_COLUMNS.map(({ store, title }) => {
            const s = p.stores.find((x) => x.store === store);
            const pick = pickOffer(s, choice?.[store]);
            return (
              <div key={store} className="space-y-1">
                <p className="text-xs font-semibold">
                  {title}
                  {s?.similar && <span className="font-normal text-muted-foreground"> — точных совпадений нет, выберите подходящий</span>}
                </p>
                {s?.offers.length ? (
                  <ul className="space-y-1">
                    {s.offers.map((o, i) => {
                      const chosen = !!pick?.counted && pick.index === i;
                      return (
                        <li key={`${o.url}|${i}`} className="flex items-start justify-between gap-2 text-xs">
                          <span>
                            <OfferLink name={o.name} url={o.url} />
                            {o.match === false && <SimilarBadge />}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="font-medium tabular-nums">{formatRub(o.price)}</span>
                            <Button
                              size="sm"
                              variant={chosen ? "secondary" : "outline"}
                              className="h-6 px-2 text-xs"
                              disabled={chosen}
                              aria-label={`${chosen ? "Выбран" : "Выбрать"}: ${o.name}`}
                              onClick={() => onChoose(store, i)}
                            >
                              {chosen ? "Выбран" : "Выбрать"}
                            </Button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">{s ? statusText(s.status) : "—"}</p>
                )}
                {s?.status === "too_broad" && !!s.suggestions?.length && (
                  <p className="text-xs text-muted-foreground">Разделы магазина: {s.suggestions.join(", ")}</p>
                )}
              </div>
            );
          })}
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * «Цены в магазинах», список из Excel: шаблон, загрузка, прогресс, таблица с выбором
 * вариантов и выгрузка в Excel. Номер списка — в адресе (?batch=…): после обновления
 * страницы таблица восстанавливается, выбор вариантов — нет.
 */
export function BatchSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { upload, restore, batch, loading, error } = usePriceBatch();
  const [file, setFile] = useState<File | null>(null);
  const [choices, setChoices] = useState<BatchChoices>({});
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const [saving, setSaving] = useState<"template" | "xlsx" | null>(null);

  useEffect(() => {
    const id = searchParams.get("batch");
    if (id) restore(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при открытии страницы
  }, []);

  // Пока идёт сама загрузка — ждём; во время опроса прежнего списка можно загрузить другой.
  const uploading = loading && !batch;

  const send = async () => {
    if (!file || uploading) return;
    setChoices({});
    setOpen(new Set());
    const id = await upload(file);
    if (id) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("batch", id);
        return next;
      }, { replace: true });
    }
  };

  const save = async (kind: "template" | "xlsx") => {
    setSaving(kind);
    try {
      if (kind === "template") await saveBatchTemplate();
      else if (batch) await saveBatchXlsx(batch.batchId, choices);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const choose = (n: number, store: string, index: number) => setChoices((c) => ({ ...c, [n]: { ...c[n], [store]: index } }));
  const toggle = (n: number) => setOpen((o) => {
    const next = new Set(o);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    return next;
  });

  const total = batch ? batchTotal(batch.positions, choices) : null;
  const staleKomus = batch?.positions.flatMap((p) => p.stores).find((s) => s.store === "komus" && s.stale && s.priceDate);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Список товаров из Excel — до 50 позиций</p>
            <Button variant="outline" size="sm" onClick={() => save("template")} disabled={saving === "template"} className="gap-1.5">
              {saving === "template" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Скачать шаблон
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm hover:border-primary/40">
              <Upload className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-muted-foreground">{file ? file.name : "Файл .xlsx — шаблон или своя таблица с колонкой «Наименование»"}</span>
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                aria-label="Файл списка товаров"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <Button onClick={send} disabled={!file || uploading} className="shrink-0 gap-1.5">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Найти цены
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            По каждой позиции — ближайшее по названию предложение Комуса и ОфисМага, строка раскрывается: до 5 вариантов на выбор.
            ОфисМаг открывается страница за страницей — 50 позиций занимают 2–3 минуты.
          </p>
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </Card>

      {batch && total && (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 text-sm">
            <div className="space-y-0.5">
              <p>Список «{batch.fileName}» · позиций: {total.total}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {batch.status === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}
                Комус — готово · ОфисМаг: {batch.progress.done} из {batch.progress.total}
              </p>
              {staleKomus?.priceDate && (
                <p className="text-xs text-amber-700 dark:text-amber-400">Прайс Комуса от {formatDate(staleKomus.priceDate)} — мог устареть</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => save("xlsx")} disabled={saving === "xlsx"} className="gap-1.5">
              {saving === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Скачать Excel
            </Button>
          </div>
          <p className="border-b border-border px-4 py-2 text-sm">
            Итого по минимальным ценам: <span className="font-semibold">{formatRub(total.sum)}</span> (с ценой: {total.priced} из {total.total})
            {total.noQty > 0 && <span className="text-muted-foreground"> · без количества: {total.noQty} — в итог не вошли</span>}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">№</TableHead>
                <TableHead>Товар из файла</TableHead>
                {STORE_COLUMNS.map((c) => <TableHead key={c.store}>{c.title}</TableHead>)}
                <TableHead className="text-right">Мин. цена</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.positions.map((p) => {
                const min = positionMin(p, choices);
                const sum = positionSum(p, choices);
                const expanded = open.has(p.n);
                return (
                  <Fragment key={p.n}>
                    <TableRow>
                      <TableCell className="text-muted-foreground">{p.n}</TableCell>
                      <TableCell className="max-w-xs">
                        <div>{p.name}</div>
                        {qtyText(p) && <div className="text-xs text-muted-foreground">{qtyText(p)}</div>}
                      </TableCell>
                      {p.error ? (
                        <TableCell colSpan={4} className="text-xs text-muted-foreground">пропущена: {p.error}</TableCell>
                      ) : (
                        <>
                          {STORE_COLUMNS.map(({ store }) => (
                            <StoreCell key={store} s={p.stores.find((s) => s.store === store)} choice={choices[p.n]?.[store]} />
                          ))}
                          <TableCell className="whitespace-nowrap text-right">
                            {min ? (
                              <>
                                <div className="font-semibold tabular-nums">{formatRub(min.price)}</div>
                                <div className="text-xs text-muted-foreground">{min.title}</div>
                              </>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">{sum == null ? "—" : formatRub(sum)}</TableCell>
                        </>
                      )}
                      <TableCell>
                        {p.stores.some((s) => s.offers.length > 0 || !!s.suggestions?.length) && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Варианты: ${p.name}`} aria-expanded={expanded} onClick={() => toggle(p.n)}>
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {expanded && <VariantsRow p={p} choice={choices[p.n]} onChoose={(store, i) => choose(p.n, store, i)} />}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
