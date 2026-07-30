import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { tokenStorage } from "@/lib/auth";
import type { AdminUser, AdminStats, SystemInfo } from "@/types/api";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LogEntry {
  time: number;
  level: LogLevel;
  msg: string;
  err?: { message: string; type?: string; stack?: string };
  model?: string;
  provider?: string;
  reset?: string;
  balance?: number;
  threshold?: number;
  req?: { method: string; url: string };
  res?: { statusCode: number };
  [key: string]: unknown;
}

interface LogsResponse {
  entries: LogEntry[];
  total: number;
  note?: string;
}

async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data } = await apiClient.get<AdminUser[]>("/admin/users");
  return data;
}

async function fetchAdminStats(): Promise<AdminStats> {
  const { data } = await apiClient.get<AdminStats>("/admin/statistics");
  return data;
}

async function fetchSystemInfo(): Promise<SystemInfo> {
  const { data } = await apiClient.get<SystemInfo>("/admin/system");
  return data;
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchAdminUsers,
    staleTime: 30_000,
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
    staleTime: 60_000,
  });
}

export function useSystemInfo() {
  return useQuery({
    queryKey: ["admin-system"],
    queryFn: fetchSystemInfo,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiClient.patch(`/admin/users/${userId}/role`, { role }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

export function useUpdateOrgPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, plan }: { orgId: string; plan: string }) =>
      apiClient.patch(`/admin/organizations/${orgId}/plan`, { plan }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

// Подтверждение аккаунта вручную (вместо письма).
export function useVerifyUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiClient.patch(`/admin/users/${userId}/verify`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

// Блокировка / разблокировка.
export function useSetUserBlocked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, blocked }: { userId: string; blocked: boolean }) =>
      apiClient.patch(`/admin/users/${userId}/block`, { blocked }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

// Вход под пользователем: получаем его access-токен, подменяем сессию и
// перезагружаем приложение с чистого листа (жёсткая навигация сбрасывает всё
// состояние react-query от админа).
export function useImpersonate() {
  return useMutation({
    mutationFn: (userId: string) =>
      apiClient.post<{ accessToken: string }>(`/admin/users/${userId}/impersonate`).then((r) => r.data),
    onSuccess: (data) => {
      tokenStorage.setTokens(data.accessToken);
      window.location.href = "/";
    },
  });
}

export function useSetActiveModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (model: string) =>
      apiClient.post("/admin/ai-model", { model }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-ai-usage"] }),
  });
}

export function useResetActiveModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.delete("/admin/ai-model").then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-ai-usage"] }),
  });
}

// ── Правовой корпус (нормативные документы + свежесть редакций) ──
export interface LegalDocument {
  id: string;
  law: string;
  name: string;
  url?: string | null;
  currentRevision?: string | null;
  latestRevision?: string | null;
  ranges?: string | null;
  updateAvailable: boolean;
  articleCount: number;
  ingestedAt: string;
  lastCheckedAt?: string | null;
}

export function useLegalCorpus() {
  return useQuery({
    queryKey: ["admin-legal"],
    queryFn: () => apiClient.get<LegalDocument[]>("/admin/legal").then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useLegalCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<LegalDocument[]>("/admin/legal/check").then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(["admin-legal"], data),
  });
}

export function useLegalAck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch(`/admin/legal/${id}/ack`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-legal"] }),
  });
}

export function useLegalReingest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      // Переигестия закона (извлечение + эмбеддинги) может идти минуты — большой таймаут.
      return apiClient.post(`/admin/legal/${id}/reingest`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 600_000,
      }).then((r) => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-legal"] }),
  });
}

// Добавить НОВЫЙ закон в корпус (файл + метаданные). Обновление существующего — useLegalReingest.
export function useLegalAdd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { file: File; law: string; name?: string; url?: string; ranges?: string }) => {
      const fd = new FormData();
      fd.append("file", payload.file);
      fd.append("law", payload.law);
      if (payload.name) fd.append("name", payload.name);
      if (payload.url) fd.append("url", payload.url);
      if (payload.ranges) fd.append("ranges", payload.ranges);
      return apiClient.post("/admin/legal", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 600_000,
      }).then((r) => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-legal"] }),
  });
}

// ── Реестр контрактов ЕИС (собственная база для НМЦ) ──
export interface EisStats { contracts: number; lastUpdatedAt?: string | null }
export function useEisStats() {
  return useQuery({
    queryKey: ["admin-eis"],
    queryFn: () => apiClient.get<EisStats>("/admin/eis").then((r) => r.data),
    staleTime: 30_000,
  });
}
export function useEisIngest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (query: string) =>
      apiClient.post<{ ingested: number; total: number }>("/admin/eis/ingest", { query }, { timeout: 300_000 }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-eis"] }),
  });
}

export function useResetModelLimit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (model: string) =>
      apiClient.delete(`/admin/ai-model/${encodeURIComponent(model)}/limit`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-ai-usage"] }),
  });
}

export function useSetFallbackModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (model: string) =>
      apiClient.post("/admin/ai-fallback-model", { model }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-ai-usage"] }),
  });
}

export function useResetFallbackModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.delete("/admin/ai-fallback-model").then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-ai-usage"] }),
  });
}

export interface AuditUser {
  id: string;
  fullName: string;
  email: string;
}

export interface AuditEntry {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: AuditUser | null;
}

interface AuditResponse {
  logs: AuditEntry[];
  total: number;
}

export function useAdminAudit(params: {
  userId?: string;
  category?: string;
  limit?: number;
} = {}) {
  return useQuery<AuditResponse>({
    queryKey: ["admin-audit", params.userId, params.category],
    queryFn: () =>
      apiClient
        .get<AuditResponse>("/admin/audit", {
          params: {
            ...(params.userId   ? { userId: params.userId }     : {}),
            ...(params.category ? { category: params.category } : {}),
            limit: params.limit ?? 200,
          },
        })
        .then((r) => r.data),
    staleTime: 30_000,
  });
}

export interface SyncStatus {
  lastSyncAt: string | null;
  procurementCount: number;
}

export interface AiPresetModel {
  model: string;
  provider: string;
  label: string;
  note?: string;
}

export function useAiPresetModels() {
  return useQuery<AiPresetModel[]>({
    queryKey: ["admin-ai-models"],
    queryFn: () => apiClient.get<AiPresetModel[]>("/admin/ai-models").then((r) => r.data),
    staleTime: 10 * 60_000,
  });
}

export function useSyncStatus() {
  return useQuery<SyncStatus>({
    queryKey: ["admin-sync-status"],
    queryFn: () => apiClient.get<SyncStatus>("/admin/sync-status").then((r) => r.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useSyncRftorgi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post("/admin/sync-rftorgi").then((r) => r.data),
    onSuccess: () => {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["admin-sync-status"] });
        qc.invalidateQueries({ queryKey: ["admin-stats"] });
      }, 3000);
    },
  });
}

export function useSyncAftorgi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post("/admin/sync-aftorgi").then((r) => r.data),
    onSuccess: () => {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["admin-sync-status"] });
        qc.invalidateQueries({ queryKey: ["admin-stats"] });
      }, 3000);
    },
  });
}

export function useAdminLogs(params: {
  level?: string;
  search?: string;
  limit?: number;
} = {}) {
  const { level, search, limit = 200 } = params;
  return useQuery<LogsResponse>({
    queryKey: ["admin-logs", level, search],
    queryFn: () =>
      apiClient
        .get<LogsResponse>("/admin/logs", {
          params: {
            ...(level  ? { level }  : {}),
            ...(search ? { search } : {}),
            limit,
          },
        })
        .then((r) => r.data),
    staleTime: 0,
  });
}
