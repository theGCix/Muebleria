// src/routes/_authenticated/mi-produccion.tsx
// ─────────────────────────────────────────────────────────────
// Vista "Mis órdenes" — rediseñada para el carpintero.
// Muestra qué fabricar, materiales, especificaciones y pasos
// directamente desde la tarjeta, sin necesidad de abrir otro módulo.
// ─────────────────────────────────────────────────────────────

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Hammer, Loader2, RefreshCw } from "lucide-react";

import { listMiProduccion } from "@/lib/pos.functions";
import type { MiOrdenRow } from "@/types/produccion";
import { OrdenCard } from "@/components/produccion/OrdenCard";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_authenticated/mi-produccion")({
  head: () => ({ meta: [{ title: "Mis órdenes — G&M" }] }),
  component: MiProduccionPage,
});

// ─────────────────────────────────────────────────────────────

function MiProduccionPage() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["mi-produccion"],
    queryFn: listMiProduccion,
    refetchInterval: 120_000, // auto-refresh cada 2 min
    staleTime: 60_000,
  });

  const ordenes: MiOrdenRow[] = data?.ordenes ?? [];

  // Separar urgentes (≤ 2 días) del resto para ordenarlas primero
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const urgentes = ordenes.filter((o) => {
    if (!o.fecha_fin_estimada) return false;
    const fin = new Date(o.fecha_fin_estimada);
    fin.setHours(0, 0, 0, 0);
    return (fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24) <= 2;
  });

  const normales = ordenes.filter((o) => !urgentes.includes(o));

  // ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold">Mis órdenes</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading
              ? "Cargando..."
              : ordenes.length === 0
              ? "No tienes órdenes asignadas"
              : `${ordenes.length} orden${ordenes.length !== 1 ? "es" : ""} asignada${ordenes.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="shrink-0 mt-1"
        >
          <RefreshCw
            className={["h-3.5 w-3.5 mr-1.5", isFetching ? "animate-spin" : ""].join(" ")}
          />
          Actualizar
        </Button>
      </div>

      {/* Estado cargando */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Estado vacío */}
      {!isLoading && ordenes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Hammer className="h-7 w-7" />
          </div>
          <div className="text-center">
            <p className="font-medium">Sin órdenes asignadas</p>
            <p className="text-sm mt-1">
              El supervisor te asignará trabajo en breve.
            </p>
          </div>
        </div>
      )}

      {/* Órdenes urgentes primero */}
      {!isLoading && urgentes.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <h2 className="text-sm font-semibold text-red-700">
              Urgentes — entrega próxima
            </h2>
          </div>
          <div className="space-y-3">
            {urgentes.map((orden) => (
              <OrdenCard key={orden.produccion_id} orden={orden} />
            ))}
          </div>
        </section>
      )}

      {/* Resto de órdenes */}
      {!isLoading && normales.length > 0 && (
        <section>
          {urgentes.length > 0 && (
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">
              En proceso
            </h2>
          )}
          <div className="space-y-3">
            {normales.map((orden) => (
              <OrdenCard key={orden.produccion_id} orden={orden} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
