import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface FeatureStat {
  feature: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costKopecks: number;
}

// Коды функций журнала расходов (backend: ai-usage-log.js, feature = refType у withAiBilling).
const FEATURE_LABELS: Record<string, string> = {
  chat: "Чат",
  doc_review: "Проверка документации",
  bid_check: "Проверка заявки",
  bid_evaluation: "Анализ заявок",
  nmck: "Обоснование НМЦ",
  eis: "Цены из ЕИС",
  analysis: "Анализ документа",
  national_regime: "Национальный режим",
  other: "Прочее (служебные вызовы)",
};

const rub = (kopecks: number) =>
  (kopecks / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";

const fmtTokens = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n >= 1_000 ? (n / 1_000).toFixed(1) + "K" : String(n);

export function AiFeaturesTable({ features, title }: { features: FeatureStat[]; title: string }) {
  const totalCost = features.reduce((s, f) => s + f.costKopecks, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {features.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Расходов пока нет</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Функция</TableHead>
                <TableHead className="text-right">Вход</TableHead>
                <TableHead className="text-right">Выход</TableHead>
                <TableHead className="text-right">Итого</TableHead>
                <TableHead className="text-right">Стоимость</TableHead>
                <TableHead className="text-right">Доля</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {features.map((f) => (
                <TableRow key={f.feature}>
                  <TableCell className="text-xs">{FEATURE_LABELS[f.feature] ?? f.feature}</TableCell>
                  <TableCell className="text-right text-xs">{fmtTokens(f.inputTokens)}</TableCell>
                  <TableCell className="text-right text-xs">{fmtTokens(f.outputTokens)}</TableCell>
                  <TableCell className="text-right text-xs font-medium">{fmtTokens(f.totalTokens)}</TableCell>
                  <TableCell className="text-right text-xs">{rub(f.costKopecks)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {totalCost > 0 ? `${Math.round((f.costKopecks / totalCost) * 100)}%` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
