import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { Notification } from "@/types/api";

const LIST_KEY   = ["notifications"] as const;
const UNREAD_KEY = ["notifications-unread"] as const;

async function fetchNotifications(): Promise<Notification[]> {
  const { data } = await apiClient.get<Notification[]>("/dashboard/notifications");
  return data;
}

async function fetchUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>("/dashboard/notifications/unread-count");
  return data.count;
}

export function useNotifications() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: UNREAD_KEY,
    queryFn: fetchUnreadCount,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch(`/dashboard/notifications/${id}/read`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: LIST_KEY });
      const prev = qc.getQueryData<Notification[]>(LIST_KEY);
      qc.setQueryData<Notification[]>(LIST_KEY, (old) =>
        old?.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(LIST_KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: UNREAD_KEY });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.patch("/dashboard/notifications/read-all"),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: LIST_KEY });
      const prev = qc.getQueryData<Notification[]>(LIST_KEY);
      qc.setQueryData<Notification[]>(LIST_KEY, (old) =>
        old?.map((n) => ({ ...n, isRead: true })),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(LIST_KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: UNREAD_KEY });
    },
  });
}
