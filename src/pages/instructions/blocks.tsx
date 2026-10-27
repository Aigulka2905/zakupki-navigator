// Блоки оформления инструкций: подсказки, шаги, сетка возможностей.
import { Lightbulb, AlertTriangle, Info, CheckCircle2, ChevronRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────

export type Audience = "customer" | "participant";

export interface Topic {
  id: string;
  icon: React.ElementType;
  label: string;
  badge?: string;
  sections: Section[];
}

export interface Section {
  title: string;
  content: React.ReactNode;
}

// ── Callout components ────────────────────────────────────────

export function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary-soft/60 p-4 text-sm">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="text-foreground/80">{children}</span>
    </div>
  );
}

export function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft/70 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
      <span className="text-foreground/80">{children}</span>
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-muted/50 p-4 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}

export function Success({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-success/30 bg-success/5 p-4 text-sm">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <span className="text-foreground/80">{children}</span>
    </div>
  );
}

// ── Numbered step ─────────────────────────────────────────────

export function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {n}
        </div>
        <div className="mt-1 w-px flex-1 bg-border" />
      </div>
      <div className="pb-6 pt-0.5 min-w-0 flex-1">
        <p className="mb-1.5 text-sm font-semibold text-foreground">{title}</p>
        <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

export function Steps({ children }: { children: React.ReactNode }) {
  return <div className="mt-3">{children}</div>;
}

// ── Key shortcut ──────────────────────────────────────────────

export function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">
      {children}
    </kbd>
  );
}

// ── Feature grid ──────────────────────────────────────────────

export function FeatureGrid({ items }: { items: { icon: React.ElementType; title: string; desc: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.title} className="flex gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
            <item.icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Список с маркерами ────────────────────────────────────────

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
