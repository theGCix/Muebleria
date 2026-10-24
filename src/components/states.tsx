import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ── Estado vacío ─────────────────────────────────────────────
// Un icono, un mensaje que explica por qué está vacío y, si aplica, la acción para salir de ahí.
export function EmptyState({
  icon: Icon, title, description, action, compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? "gap-1.5 py-6" : "gap-3 py-16"}`}
    >
      {Icon && (
        <div
          className={`flex items-center justify-center rounded-full bg-muted text-muted-foreground ${
            compact ? "h-9 w-9" : "h-14 w-14"
          }`}
        >
          <Icon className={compact ? "h-4 w-4" : "h-6 w-6"} />
        </div>
      )}
      <div className="max-w-sm space-y-1 px-4">
        <p className={`font-medium ${compact ? "text-xs" : "text-sm"}`}>{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Esqueletos de carga ──────────────────────────────────────
// Reservan el espacio del contenido real para que la página no "salte" al cargar.
const widths = ["w-3/4", "w-1/2", "w-2/3", "w-1/3", "w-5/6", "w-1/4"];

export function TableSkeleton({
  rows = 6, cols = 5, bare = false,
}: { rows?: number; cols?: number; bare?: boolean }) {
  const body = (
    <div role="status" aria-busy="true" aria-label="Cargando" className="divide-y divide-border/50">
      <div className="flex gap-4 bg-muted/40 px-4 py-3">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-4 flex-1 ${c === 0 ? "" : widths[(r + c) % widths.length]}`} />
          ))}
        </div>
      ))}
    </div>
  );
  return bare ? body : <div className="overflow-hidden rounded-xl border border-border/50 bg-card">{body}</div>;
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      role="status" aria-busy="true" aria-label="Cargando"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-border/50 bg-card p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando" className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-border/50 bg-card p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function KanbanSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando" className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="w-72 flex-shrink-0 space-y-3">
          <Skeleton className="h-6 w-1/2" />
          {Array.from({ length: 3 - (c % 2) }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border/50 bg-card p-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
