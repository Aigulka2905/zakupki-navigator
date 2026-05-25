import { useCallback, useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Download,
  AlertTriangle,
  CheckCircle2,
  Info,
  FileText,
  Sparkles,
  Upload,
  Loader2,
  X,
  Clock,
  ChevronRight,
} from "lucide-react";
import apiClient from "@/lib/api-client";
import type { DocumentAnalysis as TDocumentAnalysis } from "@/types/api";
import { Reveal } from "@/components/Reveal";

// ── API ───────────────────────────────────────────────────────

async function uploadFile(file: File): Promise<TDocumentAnalysis> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<TDocumentAnalysis>(
    "/analysis/upload",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

async function fetchAnalysis(id: string): Promise<TDocumentAnalysis> {
  const { data } = await apiClient.get<TDocumentAnalysis>(`/analysis/${id}`);
  return data;
}

async function fetchHistory(): Promise<TDocumentAnalysis[]> {
  const { data } = await apiClient.get<TDocumentAnalysis[]>("/analysis");
  return data;
}

// ── Violation card ────────────────────────────────────────────

type Tone = "warning" | "destructive" | "success" | "info";

const toneStyles: Record<Tone, { bg: string; border: string; icon: string; badge: string; label: string }> = {
  destructive: {
    bg: "bg-destructive/5",
    border: "border-l-destructive",
    icon: "text-destructive",
    badge: "bg-destructive text-destructive-foreground",
    label: "Нарушение",
  },
  warning: {
    bg: "bg-warning-soft",
    border: "border-l-warning",
    icon: "text-warning-foreground",
    badge: "bg-warning text-warning-foreground",
    label: "Замечание",
  },
  success: {
    bg: "bg-success-soft",
    border: "border-l-success",
    icon: "text-success",
    badge: "bg-success text-success-foreground",
    label: "Корректно",
  },
  info: {
    bg: "bg-primary-soft",
    border: "border-l-primary",
    icon: "text-primary",
    badge: "bg-primary text-primary-foreground",
    label: "Рекомендация",
  },
};

function CommentCard({ text, tone, index }: { text: string; tone: Tone; index: number }) {
  const t = toneStyles[tone];
  const Icon = tone === "destructive" || tone === "warning" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div className={`rounded-lg border-l-4 ${t.border} ${t.bg} p-3.5`}>
      <div className="flex items-start gap-2.5">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${t.icon}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${t.badge}`}>
              {t.label}
            </span>
            <span className="text-[11px] text-muted-foreground">#{index + 1}</span>
          </div>
          <p className="mt-1.5 text-sm text-foreground break-russian">{text}</p>
        </div>
      </div>
    </div>
  );
}

// ── Dropzone ──────────────────────────────────────────────────

function Dropzone({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 text-center transition ${
        dragging ? "border-primary bg-primary-soft" : "border-border hover:border-primary/50 hover:bg-muted/30"
      }`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Upload className="h-7 w-7" />
      </div>
      <div>
        <p className="font-medium text-foreground">
          Перетащите файл или нажмите для выбора
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, DOCX, TXT — до 50 МБ
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}

// ── Панель результатов ────────────────────────────────────────

function ResultsPanel({ analysis, fileName, onReset }: {
  analysis: TDocumentAnalysis;
  fileName: string;
  onReset: () => void;
}) {
  const violations = (analysis.violations as Array<{ message: string }>) ?? [];
  const recommendations = (analysis.recommendations as string[]) ?? [];

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-primary p-4 shadow-card">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-foreground">Анализ завершён</h2>
              <Badge variant="outline" className="text-[11px]">{fileName}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground break-russian">
              Найдено <strong className="text-foreground">{violations.length} нарушений</strong>,{" "}
              <strong className="text-foreground">{recommendations.length} рекомендаций</strong>.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-center">
              <div className="text-base font-semibold text-destructive">{violations.length}</div>
              <div className="text-muted-foreground">Нарушений</div>
            </div>
            <div className="rounded-md bg-primary-soft px-2.5 py-1.5 text-center">
              <div className="text-base font-semibold text-primary">{recommendations.length}</div>
              <div className="text-muted-foreground">Рекомендаций</div>
            </div>
          </div>
        </div>
      </Card>

      {analysis.analysisResult?.wasTruncated && (
        <div className="flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            Документ слишком большой — анализ выполнен по первым{" "}
            <strong>{(analysis.analysisResult.analyzedLength ?? 0).toLocaleString("ru-RU")}</strong> символам
            из <strong>{(analysis.analysisResult.originalLength ?? 0).toLocaleString("ru-RU")}</strong>.
            Для полного анализа разбейте документ на части.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden shadow-card">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold text-foreground">Нарушения</span>
            </div>
            <Badge variant="outline" className="text-[11px]">{violations.length}</Badge>
          </div>
          <div className="max-h-[400px] space-y-3 overflow-y-auto p-4">
            {violations.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
                Нарушений не обнаружено
              </div>
            ) : (
              violations.map((v, i) => (
                <CommentCard key={i} text={v.message} tone="destructive" index={i} />
              ))
            )}
          </div>
        </Card>

        <Card className="overflow-hidden shadow-card">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Рекомендации</span>
            </div>
            <Badge variant="outline" className="text-[11px]">{recommendations.length}</Badge>
          </div>
          <div className="max-h-[400px] space-y-3 overflow-y-auto p-4">
            {recommendations.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Рекомендаций нет</div>
            ) : (
              recommendations.map((r, i) => (
                <CommentCard key={i} text={r} tone="info" index={i} />
              ))
            )}
          </div>
          <div className="border-t border-border bg-card p-3">
            <Button size="sm" className="w-full justify-start bg-primary hover:bg-primary-hover" disabled>
              <ClipboardList className="mr-2 h-4 w-4" />
              Сформировать чек-лист
            </Button>
          </div>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onReset}>
          <X className="mr-1.5 h-4 w-4" />
          Закрыть
        </Button>
        <Button size="sm" className="bg-secondary hover:bg-secondary-hover" disabled>
          <Download className="mr-1.5 h-4 w-4" />
          Экспорт PDF
        </Button>
      </div>
    </div>
  );
}


// ── Главный компонент ─────────────────────────────────────────

const DocumentAnalysis = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [historyItem, setHistoryItem] = useState<TDocumentAnalysis | null>(null);

  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ["analysis-history"],
    queryFn: fetchHistory,
    staleTime: 30_000,
  } as Parameters<typeof useQuery>[0]);

  const { data: analysis, isError: analysisError } = useQuery({
    queryKey: ["analysis", analysisId],
    queryFn: () => fetchAnalysis(analysisId!),
    enabled: !!analysisId,
    refetchInterval: (query) => {
      const status = (query.state.data as TDocumentAnalysis | undefined)?.status;
      if (status === "completed" || status === "failed") return false;
      return 2500;
    },
  } as Parameters<typeof useQuery>[0]);

  const prevAnalysisStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!analysis || analysis.status === prevAnalysisStatus.current) return;
    prevAnalysisStatus.current = analysis.status;
    if (analysis.status === "completed") {
      toast.success("Анализ документа завершён");
      refetchHistory();
    } else if (analysis.status === "failed") {
      toast.error("Анализ не удался. Попробуйте загрузить файл ещё раз.");
    }
  }, [analysis?.status]);

  useEffect(() => {
    if (analysisError) {
      toast.error("Не удалось получить результаты анализа");
      setAnalysisId(null);
    }
  }, [analysisError]);

  const handleFile = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Файл слишком большой. Максимальный размер — 50 МБ.");
      return;
    }
    setSelectedFile(file);
    setHistoryItem(null);
    setIsUploading(true);
    setAnalysisId(null);
    try {
      const result = await uploadFile(file) as TDocumentAnalysis & { _cached?: boolean };
      setAnalysisId(result.id);
      if (result._cached) {
        toast.info("Найден готовый анализ этого документа — результаты загружены мгновенно");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Ошибка при загрузке файла");
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setAnalysisId(null);
    setHistoryItem(null);
  };

  const isProcessing = !!analysisId && analysis?.status === "processing";
  const isCompleted = analysis?.status === "completed";
  const isFailed = analysis?.status === "failed";

  const showUpload = !selectedFile && !analysisId && !historyItem;
  const showProcessing = isUploading || isProcessing;
  const showResults = isCompleted && analysis;
  const showHistoryResult = !!historyItem;

  return (
    <AppLayout
      title="Анализ документа"
      subtitle="Загрузите документ для проверки по 223-ФЗ и 44-ФЗ"
      headerRight={
        (showResults || showHistoryResult) ? (
          <div className="hidden gap-1.5 md:flex">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <Upload className="mr-1.5 h-4 w-4" />
              Новый анализ
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="mx-auto max-w-[1600px] p-4 md:p-6">
        <div className="flex gap-6">

          {/* ── История (левая панель) ──────────────────────── */}
          <Reveal direction="left" delay={0} className="hidden w-64 shrink-0 lg:block">
            <Card className="overflow-hidden shadow-card">
              <div className="border-b border-border bg-muted/40 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  История анализов
                </h3>
              </div>
              <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
                {history.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                    История пуста
                  </div>
                ) : (
                  history.map((item) => {
                    const name = item.originalFileName ?? 'Документ';
                    const violations = (item.violations as Array<{ message: string }> | null) ?? [];
                    const isActive = historyItem?.id === item.id || analysisId === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setHistoryItem(item); setSelectedFile(null); setAnalysisId(null); }}
                        className={`w-full border-b border-border px-4 py-3 text-left transition hover:bg-muted/40 ${isActive ? "bg-primary-soft" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-foreground">{name}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {new Date(item.createdAt).toLocaleDateString("ru-RU")}
                            </p>
                          </div>
                          <div className="shrink-0">
                            {item.status === "completed" ? (
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${violations.length > 0 ? "bg-destructive/10 text-destructive" : "bg-success-soft text-success"}`}>
                                {violations.length > 0 ? `${violations.length} нар.` : "OK"}
                              </span>
                            ) : item.status === "processing" ? (
                              <Loader2 className="h-3 w-3 animate-spin text-primary" />
                            ) : (
                              <span className="text-[9px] text-destructive">Ошибка</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className={`mt-1 h-3 w-3 ${isActive ? "text-primary" : "text-muted-foreground/40"}`} />
                      </button>
                    );
                  })
                )}
              </div>
              {!showUpload && (
                <div className="border-t border-border p-3">
                  <Button variant="outline" size="sm" className="w-full" onClick={handleReset}>
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Новый анализ
                  </Button>
                </div>
              )}
            </Card>
          </Reveal>

          {/* ── Основное содержимое ─────────────────────────── */}
          <div className="min-w-0 flex-1">

            {/* Загрузка / обработка */}
            {showProcessing && (
              <div className="flex h-[calc(100vh-16rem)] items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {isUploading ? "Загрузка файла..." : "Идёт анализ документа..."}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground break-russian">
                      {isUploading
                        ? "Передаём файл на сервер"
                        : "AI проверяет документ по нормам 223-ФЗ и 44-ФЗ"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Ошибка */}
            {isFailed && !isUploading && (
              <div className="flex h-[calc(100vh-16rem)] items-center justify-center">
                <Card className="max-w-md p-8 text-center shadow-card">
                  <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
                  <h3 className="mt-4 font-semibold text-foreground">Анализ не удался</h3>
                  <p className="mt-2 text-sm text-muted-foreground break-russian">
                    Не удалось проанализировать документ. Убедитесь, что файл не повреждён.
                  </p>
                  <Button onClick={handleReset} className="mt-6">Попробовать снова</Button>
                </Card>
              </div>
            )}

            {/* Результаты текущего анализа */}
            {showResults && !isUploading && (
              <ResultsPanel
                analysis={analysis}
                fileName={selectedFile?.name ?? "Документ"}
                onReset={handleReset}
              />
            )}

            {/* Результаты из истории */}
            {showHistoryResult && !showProcessing && !showResults && (
              <ResultsPanel
                analysis={historyItem}
                fileName={historyItem.originalFileName ?? 'Документ'}
                onReset={handleReset}
              />
            )}

            {/* Начальный экран */}
            {showUpload && (
              <Reveal direction="up" delay={0}>
              <div className="space-y-6">
                <Dropzone onFile={handleFile} />
                <div className="grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
                  {[
                    { icon: FileText, label: "PDF, DOCX, TXT" },
                    { icon: Sparkles, label: "AI-анализ по 223-ФЗ" },
                    { icon: CheckCircle2, label: "Список нарушений" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5">
                      <Icon className="h-5 w-5 text-primary" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              </Reveal>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default DocumentAnalysis;
