import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriceResults } from "@/components/price-search/PriceResults";
import { BatchSearch } from "@/components/price-search/BatchSearch";
import { usePriceSearch } from "@/hooks/usePriceSearch";

// «Цены в магазинах»: быстрая справка — в расчёт НМЦК цены не переносятся.
// Вкладки: один товар и список из Excel. Обе остаются смонтированными (forceMount),
// чтобы переключение не сбрасывало результат и выбор вариантов.
export default function PriceSearchPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("batch") ? "batch" : "single");
  const [query, setQuery] = useState("");
  const { start, result, loading, error } = usePriceSearch();
  const tooShort = query.trim().length < 3;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!tooShort && !loading) start(query.trim());
  };

  return (
    <AppLayout title="Цены в магазинах" subtitle="Быстрая справка о ценах в интернет-магазинах — в расчёт НМЦК не переносится">
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="single">Один товар</TabsTrigger>
            <TabsTrigger value="batch">Список из Excel</TabsTrigger>
          </TabsList>

          <TabsContent value="single" forceMount className="space-y-6 data-[state=inactive]:hidden">
            <Card className="p-6">
              <form onSubmit={submit} className="grid gap-2">
                <label htmlFor="price-query" className="text-sm font-medium">Наименование товара</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="price-query"
                    value={query}
                    maxLength={200}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="напр. бумага А4 SvetoCopy"
                  />
                  <Button type="submit" disabled={loading || tooShort} className="shrink-0 gap-1.5">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Найти цены
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Комус — по прайс-листу «Комус ОПТ» (базовая цена), ОфисМаг — поиск на сайте.
                  По каждому магазину — до 5 подходящих предложений.
                </p>
              </form>
              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </Card>
            {result && <PriceResults result={result} />}
          </TabsContent>

          <TabsContent value="batch" forceMount className="data-[state=inactive]:hidden">
            <BatchSearch />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
