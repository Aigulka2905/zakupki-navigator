import { FileCheck2 } from "lucide-react";
import type { PackageFileReport } from "@/types/api";

const KIND: Record<PackageFileReport["kind"], string> = {
  text: "текст", drawing: "чертёж", scan: "скан", error: "не прочитан",
};
const AMBER = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
const CHECKED: Record<PackageFileReport["checked"], { label: string; cls: string }> = {
  ai: { label: "проверен ИИ", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  "brand-scan": { label: "поиск марок", cls: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  "over-limit": { label: "не проверен", cls: AMBER },
  none: { label: "не проверен", cls: AMBER },
};

// «Что проверено»: как обработан каждый файл пакета — чтобы не казалось, что
// проверено всё, если часть файлов — сканы, чертежи или не влезла в предел.
export function PackageReport({ files }: { files?: PackageFileReport[] | null }) {
  if (!files?.length) return null;
  const ai = files.filter((f) => f.checked === "ai").length;
  const brands = files.filter((f) => f.checked === "brand-scan").length;
  const skipped = files.length - ai - brands;
  return (
    <details className="rounded-lg border border-border" open={skipped > 0}>
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium">
        <FileCheck2 className="h-4 w-4 text-primary" />
        Что проверено: файлов {files.length} — ИИ {ai}, поиск марок {brands}, не проверено {skipped}
      </summary>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5">Файл</th>
              <th className="px-3 py-1.5">Тип</th>
              <th className="px-3 py-1.5">Проверка</th>
              <th className="px-3 py-1.5">Примечание</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {files.map((f, i) => (
              <tr key={i} className="align-top">
                <td className="break-all px-3 py-1.5 font-medium">{f.name}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">{KIND[f.kind] ?? f.kind}</td>
                <td className="whitespace-nowrap px-3 py-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CHECKED[f.checked]?.cls ?? ""}`}>
                    {CHECKED[f.checked]?.label ?? f.checked}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">{f.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
