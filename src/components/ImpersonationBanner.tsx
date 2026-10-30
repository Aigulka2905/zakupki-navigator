import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { impersonation } from "@/lib/auth";
import { returnToAdmin } from "@/lib/api-client";

// Администратор вошёл «под пользователем»: видно на каждой странице, под кем он, и как вернуться.
export function ImpersonationBanner() {
  const [leaving, setLeaving] = useState(false);
  const user = impersonation.get();
  if (!user) return null;

  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-500/30 bg-amber-500/15 px-4 py-1.5 text-xs text-amber-900 dark:text-amber-200">
      <Eye className="h-3.5 w-3.5 shrink-0" />
      <span>
        Вы вошли как <b>{user.fullName ? `${user.fullName} (${user.email})` : user.email}</b>. Вход действует 5 минут.
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-6 gap-1 border-amber-500/50 bg-transparent px-2 text-[11px] hover:bg-amber-500/20"
        disabled={leaving}
        onClick={() => { setLeaving(true); void returnToAdmin(); }}
      >
        {leaving && <Loader2 className="h-3 w-3 animate-spin" />}
        Вернуться в админку
      </Button>
    </div>
  );
}
