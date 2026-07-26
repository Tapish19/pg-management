import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "default" | "success" | "warning" | "info" | "destructive" | "muted";

const toneClasses: Record<Tone, string> = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  info: "bg-info/15 text-info",
  destructive: "bg-destructive/15 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

export function StatusPill({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (["paid", "approved", "resolved", "verified", "checked-in", "active", "occupied", "confirmed"].includes(s))
    return "success";
  if (["overdue", "rejected", "urgent", "cancelled", "moved-out", "maintenance", "failed"].includes(s))
    return "destructive";
  if (["pending", "partial", "in-progress", "reserved", "on-leave", "notice", "high"].includes(s))
    return "warning";
  if (["upcoming", "checked-out", "checked_out", "medium", "refunded"].includes(s)) return "info";
  return "muted";
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {Icon && (
          <div className={cn("grid h-9 w-9 place-items-center rounded-lg", toneClasses[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
