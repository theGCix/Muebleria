// src/routes/_authenticated/mi-produccion.tsx
// ─────────────────────────────────────────────────────────────
// Vista "Mis órdenes" — rediseñada para el carpintero.
// Muestra qué fabricar, materiales, especificaciones y pasos
// directamente desde la tarjeta, sin necesidad de abrir otro módulo.
//
// Parte 8.3:
//  · F13  Pestañas Pendientes / En proceso / Terminadas (lib/ordenesProduccion).
//  · F14  Skeleton con la estructura final en vez de "Cargando…" + spinner.
// ─────────────────────────────────────────────────────────────

import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Hammer, RefreshCw, TriangleAlert } from "lucide-react";

import { listMiProduccion } from "@/lib/pos.functions";
import type { MiOrdenRow } from "@/types/produccion";
import {
  PESTANAS_PRODUCCION,
  agruparPorPestana,
  esPestanaProduccion,
  pestanaInicial,
  type GrupoPestana,
  type PestanaProduccion,
} from "@/lib/ordenesProduccion";
import { OrdenCard } from "@/components/produccion/OrdenCard";
import { MiProduccionSkeleton } from "@/components/produccion/MiProduccionSkeleton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/states";

// ─────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_authenticated/mi-produccion")({
  head: () => ({ meta: [{ title: "Mis órdenes — G&M" }] }),
  component: MiProduccionPage,
});

// ─────────────────────────────────────────────────────────────
// La pestaña elegida se recuerda mientras dure la sesión del navegador.
// Con try/catch: sessionStorage puede estar bloqueado o lleno.

const CLAVE_PESTANA = "gm:mi-produccion:pestana";

function leerPestanaGuardada(): PestanaProduccion | null {
  try {
    const v = window.sessionStorage.getItem(CLAVE_PESTANA);
    return esPestanaProduccion(v) ? v : null;
  } catch {
    return null;
  }
}

function guardarPestana(p: PestanaProduccion) {
  try {
    window.sessionStorage.setItem(CLAVE_PESTANA, p);
  } catch {
    /* sin almacenamiento: se sigue funcionando sin recordar la pestaña */
  }
}

const VACIO_POR_PESTANA: Record<PestanaProduccion, { title: string; description: string }> = {
  pendientes: {
    title: "No tienes órdenes pendientes",
    description: "Cuando el supervisor te asigne trabajo nuevo, aparecerá aquí.",
  },
  en_proceso: {
    title: "No tienes órdenes en proceso",
    description: "Inicia una orden desde Pendientes y la verás aquí.",
  },
  terminadas: {
    title: "Aún no tienes órdenes terminadas",
    description: "Las órdenes que marques como terminadas se guardan aquí.",
  },
};

function ListaOrdenes({ grupo, vacio }: { grupo: GrupoPestana; vacio: PestanaProduccion }) {
  if (grupo.total === 0) {
    return <EmptyState icon={Hammer} {...VACIO_POR_PESTANA[vacio]} />;
  }
  return (
    <div className="space-y-6">
      {/* Órdenes urgentes primero (nunca hay urgentes en Terminadas) */}
      {grupo.urgentes.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <h2 className="text-sm font-semibold text-red-700">Urgentes — entrega próxima</h2>
          </div>
          <div className="space-y-3">
            {grupo.urgentes.map((orden: MiOrdenRow) => (
              <OrdenCard key={orden.produccion_id} orden={orden} />
            ))}
          </div>
        </section>
      )}

      {grupo.resto.length > 0 && (
        <section>
          {grupo.urgentes.length > 0 && (
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Demás órdenes</h2>
          )}
          <div className="space-y-3">
            {grupo.resto.map((orden: MiOrdenRow) => (
              <OrdenCard key={orden.produccion_id} orden={orden} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function MiProduccionPage() {
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["mi-produccion"],
    queryFn: listMiProduccion,
    refetchInterval: 120_000, // auto-refresh cada 2 min
    staleTime: 60_000,
  });

  const ordenes: MiOrdenRow[] = useMemo(() => data?.ordenes ?? [], [data]);
  const grupos = useMemo(() => agruparPorPestana(ordenes), [ordenes]);

  // Pestaña: la que el carpintero eligió (o la recordada); si no hay, la inicial se decide UNA sola vez
  // con la primera carga, para que el auto-refresh no le cambie la pestaña sola.
  const [elegida, setElegida] = useState<PestanaProduccion | null>(leerPestanaGuardada);
  const inicial = useRef<PestanaProduccion | null>(null);
  if (data && inicial.current === null) inicial.current = pestanaInicial(grupos);
  const activa: PestanaProduccion = elegida ?? inicial.current ?? "en_proceso";

  const elegir = (v: string) => {
    if (!esPestanaProduccion(v)) return;
    setElegida(v);
    guardarPestana(v);
  };

  const cargando = isLoading;
  const fallo = isError && !data;
  const total = ordenes.length;

  // ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Header: título y botón reales desde el primer frame */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold">Mis órdenes</h1>
          {/* Altura reservada (min-h-6) para que no salte al cargar */}
          <div className="text-muted-foreground mt-1 min-h-6 flex items-center">
            {cargando ? (
              <Skeleton className="h-4 w-36" />
            ) : fallo ? (
              "No se pudieron cargar tus órdenes"
            ) : total === 0 ? (
              "No tienes órdenes asignadas"
            ) : (
              `${total} orden${total !== 1 ? "es" : ""} asignada${total !== 1 ? "s" : ""}`
            )}
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="shrink-0 mt-1 h-11 sm:h-8"
        >
          <RefreshCw
            className={["h-3.5 w-3.5 mr-1.5", isFetching ? "animate-spin" : ""].join(" ")}
          />
          Actualizar
        </Button>
      </div>

      {fallo ? (
        <EmptyState
          icon={TriangleAlert}
          title="No pudimos cargar tus órdenes"
          description="Revisa tu conexión e inténtalo otra vez. Tus órdenes no se perdieron."
          action={
            <Button size="sm" variant="outline" className="h-11 sm:h-8" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : (
        <Tabs value={activa} onValueChange={elegir}>
          {/* Las etiquetas de las pestañas están desde el primer frame; solo el contador carga */}
          <TabsList
            aria-label="Estado de las órdenes"
            className="grid w-full grid-cols-3 h-auto"
          >
            {PESTANAS_PRODUCCION.map((p) => (
              <TabsTrigger
                key={p.key}
                value={p.key}
                className="flex-col sm:flex-row gap-0.5 sm:gap-1.5 min-h-11 sm:min-h-9 px-2"
              >
                <span>{p.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground inline-flex h-4 min-w-5 items-center justify-center">
                  {cargando ? (
                    <Skeleton className="h-3.5 w-5" aria-hidden />
                  ) : (
                    <>
                      <span aria-hidden>{grupos[p.key].total}</span>
                      <span className="sr-only">, {grupos[p.key].total} órdenes</span>
                    </>
                  )}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {PESTANAS_PRODUCCION.map((p) => (
            <TabsContent key={p.key} value={p.key} className="mt-4">
              {cargando ? (
                <MiProduccionSkeleton />
              ) : total === 0 ? (
                <EmptyState
                  icon={Hammer}
                  title="Sin órdenes asignadas"
                  description="El supervisor te asignará trabajo en breve. Esta lista se actualiza sola."
                />
              ) : (
                <ListaOrdenes grupo={grupos[p.key]} vacio={p.key} />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
