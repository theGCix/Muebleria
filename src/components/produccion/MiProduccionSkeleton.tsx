// src/components/produccion/MiProduccionSkeleton.tsx
// ─────────────────────────────────────────────────────────────
// Esqueleto de la lista de "Mis órdenes" (Parte 8.3 · F14).
// Copia la estructura y las medidas de OrdenCard colapsada
// (cabecera, 2 cajas de fechas, barra de avance, fila de acciones)
// en la misma columna que la pantalla real, para que no haya salto
// al cargar. Si cambia el diseño de OrdenCard, ajustar este archivo.
// ─────────────────────────────────────────────────────────────
import { Skeleton } from "@/components/ui/skeleton";

function OrdenCardSkeleton() {
  return (
    <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
      {/* Cabecera: n.º de orden, cliente, teléfono · estado y urgencia */}
      <div className="flex items-start justify-between p-5 gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-48 max-w-full" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Skeleton className="h-[22px] w-24 rounded-full" />
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-2 px-5 pb-3">
        {[0, 1].map((i) => (
          <div key={i} className="bg-muted/40 rounded-lg p-3 space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>

      {/* Barra de avance */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-8" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 px-5 pb-4 border-t border-border/40 pt-3">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-32 ml-auto" />
      </div>
    </div>
  );
}

export function MiProduccionSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando tus órdenes</span>
      {Array.from({ length: count }).map((_, i) => (
        <OrdenCardSkeleton key={i} />
      ))}
    </div>
  );
}
