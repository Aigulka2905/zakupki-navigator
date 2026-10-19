import { useState } from "react";
import { Upload, Loader2, CheckCircle2, AlertTriangle, RotateCw, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UploadItem } from "@/hooks/usePackageUpload";
import { PACKAGE_ACCEPT, formatBytes } from "@/lib/package-upload";

interface Props {
  items: UploadItem[];
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
  /** Подпись в поле выбора файлов. */
  label?: string;
  disabled?: boolean;
}

function StatusIcon({ status }: { status: UploadItem["status"] }) {
  if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="Загружен" />;
  if (status === "uploading") return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-label="Загружается" />;
  if (status === "error") return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Ошибка" />;
  return <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="В очереди" />;
}

// Список файлов пакета со статусами: каждый файл грузится отдельно; упавший —
// повторить или убрать. Файлы можно перетащить мышью.
export function PackageUploader({ items, onAdd, onRemove, onRetry, label, disabled }: Props) {
  const [over, setOver] = useState(false);
  const done = items.filter((i) => i.status === "done").length;
  const bytes = items.reduce((n, i) => n + i.file.size, 0);
  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) onAdd(Array.from(e.dataTransfer.files)); }}
        className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm transition-colors ${
          over ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <Upload className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate text-muted-foreground">{label ?? "Выберите файлы или перетащите их сюда (PDF, DOCX, XLSX, TXT)"}</span>
        <input type="file" multiple accept={PACKAGE_ACCEPT} className="hidden" disabled={disabled}
          onChange={(e) => { onAdd(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      </label>
      {items.length > 0 && (
        <>
          <ul className="mt-2 divide-y divide-border rounded-md border border-border">
            {items.map((it) => (
              <li key={it.key} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                <StatusIcon status={it.status} />
                <span className="min-w-0 flex-1 truncate" title={it.file.name}>{it.file.name}</span>
                {it.status === "error" ? (
                  <span className="max-w-[45%] truncate text-destructive" title={it.error}>{it.error}</span>
                ) : (
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {it.status === "uploading" ? `${it.progress}% · ` : ""}{formatBytes(it.file.size)}
                  </span>
                )}
                {it.status === "error" && it.retryable && (
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6"
                    onClick={() => onRetry(it.key)} aria-label={`Повторить загрузку: ${it.file.name}`}>
                    <RotateCw className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(it.key)} aria-label={`Убрать: ${it.file.name}`}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
            Загружено {done} из {items.length} · {formatBytes(bytes)}
          </p>
        </>
      )}
    </div>
  );
}
