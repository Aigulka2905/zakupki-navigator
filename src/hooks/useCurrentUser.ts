import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { User } from "@/types/api";

async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<{ user: User }>("/auth/me");
  return data.user;
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: fetchMe,
    staleTime: 5 * 60_000,
  });
}
