import { useState, useRef, useCallback, useEffect } from "react";
import { openExternal } from "@/lib/url";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Search,
  FileText,
  Plus,
  Calendar,
  Bookmark,
  Upload,
  X,
  Loader2,
  ExternalLink,
  MessageSquare,
  Eye,
  Download,
  ArrowLeft,
  Scale,
  BookOpen,
  FileSpreadsheet,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import apiClient from "@/lib/api-client";
import type { Document, DocumentType } from "@/types/api";
import { Reveal } from "@/components/Reveal";

// ── Constants ─────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  law: "Нормативный акт",
  regulation: "Положение / Регламент",
  template: "Шаблон",
  court_practice: "Судебная практика",
  etp_rules: "Регламент ЭТП",
};

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "law", label: "Нормативный акт" },
  { value: "regulation", label: "Положение / Регламент" },
  { value: "template", label: "Шаблон" },
  { value: "court_practice", label: "Судебная практика" },
  { value: "etp_rules", label: "Регламент ЭТП" },
];

const TYPE_COLORS: Record<DocumentType, string> = {
  law: "bg-primary-soft text-primary",
  regulation: "bg-secondary-soft text-secondary",
  template: "bg-success/10 text-success",
  court_practice: "bg-warning-soft text-warning-foreground",
  etp_rules: "bg-muted text-muted-foreground",
};

// stat cards — type=null means "show all"
const STAT_CARDS: {
  label: string;
  type: DocumentType | null;
  icon: React.ElementType;
}[] = [
  { label: "Всего документов", type: null, icon: BookOpen },
  { label: "Нормативные акты", type: "law", icon: Scale },
  { label: "Судебная практика", type: "court_practice", icon: FileText },
  { label: "Шаблоны", type: "template", icon: FileSpreadsheet },
];

// ── API ───────────────────────────────────────────────────────

async function fetchDocuments(
  q: string,
  tags: string[],
  type: DocumentType | null
): Promise<Document[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tags.length) params.set("tags", tags.join(","));
  if (type) params.set("type", type);
  const { data } = await apiClient.get<Document[]>(`/knowledge?${params}`);
  return data;
}

async function fetchAllDocs(): Promise<Document[]> {
  const { data } = await apiClient.get<Document[]>("/knowledge");
  return data;
}

async function fetchTags(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>("/knowledge/tags");
  return data;
}

async function uploadDocument(form: FormData): Promise<Document> {
  const { data } = await apiClient.post<Document>("/knowledge", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ── Helpers ───────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isPdf(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".pdf");
}

// ── Document Viewer ───────────────────────────────────────────

function DocViewer({
  doc,
  onClose,
}: {
  doc: Document | null;
  onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!doc) return;
    if (!isPdf(doc.filePath)) return;

    setLoading(true);
    setBlobUrl(null);

    apiClient
      .get(`/knowledge/${doc.id}/file`, { responseType: "blob" })
      .then(({ data }) => {
        setBlobUrl(URL.createObjectURL(data));
      })
      .catch(() => toast.error("Не удалось загрузить файл для просмотра"))
      .finally(() => setLoading(false));

    return () => {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [doc?.id]);

  const handleDownload = async () => {
    if (!doc) return;
    try {
      const { data } = await apiClient.get(`/knowledge/${doc.id}/file`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.title;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Не удалось скачать файл");
    }
  };

  if (!doc) return null;

  const typeLabel = DOC_TYPE_LABELS[doc.type] ?? doc.type;
  const typeColor = TYPE_COLORS[doc.type] ?? "bg-muted text-muted-foreground";
  const canPreview = isPdf(doc.filePath);

  return (
    <Sheet open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="break-russian text-base leading-snug">
                {doc.title}
              </SheetTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${typeColor}`}
                >
                  {typeLabel}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDate(doc.createdAt)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(doc.fileSize)}
                </span>
              </div>
              {doc.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {doc.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Скачать
            </Button>
            {doc.sourceUrl && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openExternal(doc.sourceUrl!)}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Источник
              </Button>
            )}
            <Button size="sm" className="ml-auto" asChild>
              <Link
                to={`/chat?docId=${doc.id}`}
                onClick={() => {
                  sessionStorage.setItem('chat_doc_id', doc.id);
                  onClose();
                }}
              >
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                Спросить ИИ
              </Link>
            </Button>
          </div>
        </SheetHeader>

        {/* Preview area */}
        <div className="flex-1 overflow-hidden bg-muted/30">
          {canPreview ? (
            loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : blobUrl ? (
              <iframe
                src={blobUrl}
                className="h-full w-full border-0"
                title={doc.title}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Не удалось загрузить предпросмотр
                </p>
                <Button size="sm" variant="outline" onClick={handleDownload}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Скачать файл
                </Button>
              </div>
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-6">
              <FileText className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground break-russian">
                Предпросмотр для этого формата недоступен. Скачайте файл для
                просмотра.
              </p>
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Скачать файл
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Upload Modal ──────────────────────────────────────────────

function UploadModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocumentType>("law");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: uploadDocument,
    onSuccess: () => {
      toast.success("Документ добавлен в базу знаний");
      qc.invalidateQueries({ queryKey: ["knowledge"] });
      qc.invalidateQueries({ queryKey: ["knowledge-all"] });
      qc.invalidateQueries({ queryKey: ["knowledge-tags"] });
      onClose();
      setTitle("");
      setType("law");
      setTags("");
      setFile(null);
    },
    onError: () => toast.error("Не удалось загрузить документ"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Выберите файл");
      return;
    }
    if (!title.trim()) {
      toast.error("Укажите название");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("title", title.trim());
    form.append("type", type);
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    form.append("tags", JSON.stringify(tagList));
    mutate(form);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить документ</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition cursor-pointer ${
              dragging
                ? "border-primary bg-primary-soft"
                : "border-border hover:border-primary/40 hover:bg-muted/30"
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">{file.name}</span>
                <button
                  type="button"
                  className="ml-1 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  PDF, DOCX, TXT — перетащите или нажмите
                </span>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Название
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Положение о закупке ред. 2026"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Тип документа
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {DOC_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Теги{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (через запятую)
              </span>
            </label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="223ФЗ, Шаблоны, ЭТП"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              Загрузить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Document Card ─────────────────────────────────────────────

function DocCard({
  doc,
  onView,
}: {
  doc: Document;
  onView: (doc: Document) => void;
}) {
  const typeLabel = DOC_TYPE_LABELS[doc.type] ?? doc.type;
  const typeColor = TYPE_COLORS[doc.type] ?? "bg-muted text-muted-foreground";

  return (
    <Card className="p-5 shadow-card transition hover:shadow-elevated hover:border-primary/30">
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <FileText className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${typeColor}`}
            >
              {typeLabel}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(doc.createdAt)}
            </span>
            {doc.fileSize > 0 && (
              <span className="text-xs text-muted-foreground">
                {formatFileSize(doc.fileSize)}
              </span>
            )}
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${
                doc.isActual
                  ? "bg-success/10 text-success"
                  : "bg-warning-soft text-warning-foreground"
              }`}
            >
              {doc.isActual ? "Актуально" : "Требует проверки"}
            </span>
          </div>

          <h3 className="mt-1.5 text-base font-semibold text-foreground break-russian">
            {doc.title}
          </h3>

          {doc.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {doc.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => onView(doc)}
            >
              <Eye className="mr-1 h-3.5 w-3.5" />
              Просмотр
            </Button>
            {doc.sourceUrl && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-muted-foreground"
                onClick={() => openExternal(doc.sourceUrl!)}
              >
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                Источник
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-muted-foreground"
            >
              <Bookmark className="mr-1 h-3.5 w-3.5" />
              Сохранить
            </Button>
            <Button
              size="sm"
              className="ml-auto h-8 bg-secondary text-secondary-foreground hover:bg-secondary-hover"
              asChild
            >
              <Link
                to={`/chat?docId=${doc.id}`}
                onClick={() => sessionStorage.setItem('chat_doc_id', doc.id)}
              >
                <MessageSquare className="mr-1 h-3.5 w-3.5" />
                Спросить ИИ
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────

const KnowledgeBase = () => {
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<DocumentType | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);

  const { data: allTags = [] } = useQuery({
    queryKey: ["knowledge-tags"],
    queryFn: fetchTags,
    staleTime: 300_000,
  });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["knowledge", search, activeTags, typeFilter],
    queryFn: () => fetchDocuments(search, activeTags, typeFilter),
    staleTime: 30_000,
  });

  // unfiltered list for stats
  const { data: allDocs = [] } = useQuery({
    queryKey: ["knowledge-all"],
    queryFn: fetchAllDocs,
    staleTime: 60_000,
  });

  const counts = {
    total: allDocs.length,
    law: allDocs.filter((d) => d.type === "law").length,
    court_practice: allDocs.filter((d) => d.type === "court_practice").length,
    template: allDocs.filter((d) => d.type === "template").length,
  };

  const statValues: Record<DocumentType | "total", number> = {
    total: counts.total,
    law: counts.law,
    court_practice: counts.court_practice,
    template: counts.template,
    regulation: allDocs.filter((d) => d.type === "regulation").length,
    etp_rules: allDocs.filter((d) => d.type === "etp_rules").length,
  };

  const toggleTag = (tag: string) =>
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  const handleStatClick = (type: DocumentType | null) => {
    setTypeFilter((prev) => (prev === type ? null : type));
    setSearch("");
    setActiveTags([]);
  };

  return (
    <AppLayout
      title="База знаний"
      subtitle="Нормативные акты, шаблоны и судебная практика"
      headerRight={
        <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Добавить документ
        </Button>
      }
    >
      <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
        {/* Search */}
        <Reveal direction="up" delay={0}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по базе знаний..."
            className="h-12 rounded-xl border-border bg-card pl-10 pr-12 text-base shadow-card"
          />
          {search && (
            <button
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        </Reveal>

        {/* Stats row — кликабельные карточки-фильтры */}
        <Reveal direction="up" delay={0.07}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STAT_CARDS.map((s) => {
            const count =
              s.type === null
                ? statValues.total
                : statValues[s.type as DocumentType];
            const isActive = typeFilter === s.type;
            return (
              <button
                key={s.label}
                onClick={() => handleStatClick(s.type)}
                className={`rounded-lg border px-4 py-3 text-left transition shadow-card hover:shadow-elevated ${
                  isActive
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground break-russian">
                    {s.label}
                  </div>
                  <s.icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? "text-primary" : "text-muted-foreground/50"
                    }`}
                  />
                </div>
                <div
                  className={`mt-0.5 text-xl font-semibold ${
                    isActive ? "text-primary" : "text-foreground"
                  }`}
                >
                  {count}
                </div>
              </button>
            );
          })}
        </div>
        </Reveal>

        {/* Filter chips */}
        {allTags.length > 0 && (
          <Reveal direction="up" delay={0.12}>
          <div className="flex flex-wrap gap-1.5">
            {typeFilter && (
              <button
                onClick={() => setTypeFilter(null)}
                className="flex items-center gap-1 rounded-full border border-primary bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20"
              >
                <X className="h-3 w-3" />
                {DOC_TYPE_LABELS[typeFilter]}
              </button>
            )}
            {allTags.map((tag) => {
              const isActive = activeTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary-soft"
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
            {activeTags.length > 0 && (
              <button
                onClick={() => setActiveTags([])}
                className="flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition"
              >
                <X className="h-3 w-3" />
                Сбросить теги
              </button>
            )}
          </div>
          </Reveal>
        )}

        {/* Document list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Найдено:{" "}
              <span className="font-normal text-muted-foreground">
                {documents.length} документов
              </span>
            </h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <Card className="py-16 text-center shadow-card">
              <p className="text-sm text-muted-foreground">
                {search || activeTags.length || typeFilter
                  ? "Документы не найдены — попробуйте другой запрос"
                  : "База знаний пуста — загрузите первый документ"}
              </p>
              {!search && !activeTags.length && !typeFilter && (
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => setUploadOpen(true)}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Добавить документ
                </Button>
              )}
            </Card>
          ) : (
            documents.map((doc, i) => (
              <Reveal key={doc.id} direction="up" delay={0.05 + i * 0.06}>
                <DocCard doc={doc} onView={setViewDoc} />
              </Reveal>
            ))
          )}
        </div>
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <DocViewer doc={viewDoc} onClose={() => setViewDoc(null)} />
    </AppLayout>
  );
};

export default KnowledgeBase;
