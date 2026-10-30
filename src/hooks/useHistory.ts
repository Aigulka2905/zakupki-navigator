import { useInfiniteQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

// «История» (GET /history): у пользователя — его действия, у администратора — все действия
// в системе с тем, кто их сделал (scope: 'all'). Страницы — по границе nextBefore.
export type HistoryType = "all" | "chat" | "analysis" | "nmck" | "bids" | "packages" | "other" | "admin";

export interface HistoryActor {
  id: string;
  fullName: string | null;
  email: string;
  organization: string | null;
}

interface HistoryBase {
  id: string;
  at: string;
  /** Только у администратора (scope 'all'); null — системное действие. */
  user?: HistoryActor | null;
}

export interface HistoryChat extends HistoryBase {
  kind: "chat";
  chat: {
    sessionId: string | null;
    procurementId: string | null;
    title: string | null;
    count: number;
    procurementTitle: string | null;
    procurementNumber: string | null;
  };
}

export interface HistoryAnalysis extends HistoryBase {
  kind: "analysis";
  analysis: { id: string; status: "processing" | "completed" | "failed"; fileName: string | null; violations: number };
}

export interface HistoryAction extends HistoryBase {
  kind: "action";
  action: string;
  entityType: string;
  entityId: string | null;
  entityTitle: string | null;
  details: Record<string, unknown> | null;
  /** Действие сделал администратор «под пользователем» (имя — только у администратора). */
  viaAdmin: { fullName: string | null; email: string | null } | null;
}

export type HistoryItem = HistoryChat | HistoryAnalysis | HistoryAction;

export interface HistoryPage {
  scope: "own" | "all";
  items: HistoryItem[];
  nextBefore: string | null;
}

export function useHistory({ type, userId }: { type: HistoryType; userId?: string | null }) {
  return useInfiniteQuery({
    queryKey: ["history", type, userId ?? null],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { type };
      if (userId) params.userId = userId;
      if (pageParam) params.before = pageParam;
      const { data } = await apiClient.get<HistoryPage>("/history", { params });
      return data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
    staleTime: 30_000,
  });
}
