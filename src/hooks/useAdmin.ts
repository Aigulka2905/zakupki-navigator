import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
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
