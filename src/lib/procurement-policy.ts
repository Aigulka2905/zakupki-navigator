import apiClient from "@/lib/api-client";
import type { ProcurementPolicy } from "@/types/api";

// Положение о закупке организации (223-ФЗ): с ним сверяется проверка документации.
export async function fetchProcurementPolicy(): Promise<ProcurementPolicy | null> {
  const { data } = await apiClient.get<{ policy: ProcurementPolicy | null }>("/organization/procurement-policy");
  return data.policy;
}

/** «7.3» → «п. 7.3»; «раздел 9», «п. 8.1» — как есть (как на сервере, utils/procurement-policy.js). */
export function clauseLabel(clause: string): string {
  const c = (clause || "").trim();
  return /^\d+(\.\d+)*\.?$/.test(c) ? `п. ${c.replace(/\.$/, "")}` : c;
}
