import { ExternalLink, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { SimilarBadge } from "./SimilarBadge";
import { formatDate, formatRub, isHttpUrl, overallMin, STATUS_TEXT, type PriceSearchResult, type StoreResult } from "@/lib/price-search";

// Подпись группы: откуда цена и на какую дату.
function storeMeta(s: StoreResult): string | null {
  if (!s.priceDate) return null;
  return s.store === "komus" ? `прайс от ${formatDate(s.priceDate)} · базовая цена` : `цены на сайте на ${formatDate(s.priceDate)}`;
}

function StoreRows({ store: s }: { store: StoreResult }) {
  const meta = storeMeta(s);
  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell colSpan={6} className="py-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-semibold">{s.title}</span>
            {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
            {s.stale && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">мог устареть</span>
            )}
            {s.status === "ok" && s.similar && (
              <span className="text-xs text-muted-foreground">точных совпадений нет — показаны похожие</span>
            )}
            {s.status !== "ok" && (
              <span className={cn("flex items-center gap-1 text-xs", s.status === "unavailable" ? "text-destructive" : "text-muted-foreground")}>
                {s.status === "pending" && <Loader2 className="h-3 w-3 animate-spin" />}
                {STATUS_TEXT[s.status]}
              </span>
            )}
          </div>
          {s.status === "too_broad" && !!s.suggestions?.length && (
            <p className="mt-1 text-xs text-muted-foreground">Разделы магазина: {s.suggestions.join(", ")}</p>
          )}
        </TableCell>
      </TableRow>
      {s.status === "ok" && s.offers.map((o) => (
        <TableRow key={`${o.url}|${o.name}`}>
          <TableCell className="max-w-md">
            {isHttpUrl(o.url) ? (
              <a href={o.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 hover:text-primary hover:underline">
                <span>{o.name}</span>
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
              </a>
            ) : (
              o.name
            )}
            {o.match === false && <SimilarBadge />}
          </TableCell>
          <TableCell className={cn("whitespace-nowrap text-right font-medium tabular-nums", o.match === false && "text-muted-foreground")}>{formatRub(o.price)}</TableCell>
          <TableCell className="text-muted-foreground">{o.unit ?? "—"}</TableCell>
          <TableCell className="text-xs text-muted-foreground">{o.stock ?? "—"}</TableCell>
          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(o.priceDate)}</TableCell>
          <TableCell className="text-xs text-muted-foreground">{o.note ?? ""}</TableCell>
        </TableRow>
      ))}
    </>
  );
}

/** Таблица сравнения цен: группа на магазин, над таблицей — общий минимум. */
export function PriceResults({ result }: { result: PriceSearchResult }) {
  const min = overallMin(result.stores);
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3 text-sm">
        <p>Результаты по запросу <span className="font-medium">«{result.query}»</span></p>
        {min ? (
          <p>Минимальная цена: <span className="font-semibold">от {formatRub(min.price)}</span> ({min.title})</p>
        ) : (
          <p className="text-muted-foreground">{result.status === "processing" ? "Ищем цены…" : "Точных совпадений не найдено"}</p>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Товар</TableHead>
            <TableHead className="text-right">Цена</TableHead>
            <TableHead>Ед.</TableHead>
            <TableHead>Наличие</TableHead>
            <TableHead>Дата цены</TableHead>
            <TableHead>Примечание</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.stores.map((s) => <StoreRows key={s.store} store={s} />)}
        </TableBody>
      </Table>
    </Card>
  );
}
