// src/components/produccion/OrdenCard.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Hammer, Pause, CheckCircle2, ChevronDown, ChevronUp,
  Clock, AlertTriangle, Package, Loader2, Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { getDetalleProduccion, actualizarProduccion } from "@/lib/pos.functions";
import { getMaterialesOrden } from "@/lib/pos.functions"; // función nueva
import {
  type MiOrdenRow,
  type ProduccionStatus,
  PROD_STATUS_CONFIG,
  diasRestantes,
  avancePorEstado,
  parsePersonalizacion,
} from "@/types/produccion";

import { MaterialesLista } from "./MaterialesLista";
import { EspecificacionesGrid } from "./EspecificacionesGrid";
import { PasosFabricacion } from "./PasosFabricacion";

// ─────────────────────────────────────────────────────────────

interface OrdenCardProps {
  orden: MiOrdenRow;
}

const fmtDay = (d: string | null) =>
  d ? format(new Date(d), "dd MMM yyyy", { locale: es }) : "—";

function UrgencyChip({ dias }: { dias: number | null }) {
  if (dias === null) return null;
  if (dias < 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
        <AlertTriangle className="h-3 w-3" />
        Vencida hace {Math.abs(dias)} día{Math.abs(dias) !== 1 ? "s" : ""}
      </span>
    );
  if (dias === 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
        <AlertTriangle className="h-3 w-3" />
        Vence hoy
      </span>
    );
  if (dias <= 2)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
        <Clock className="h-3 w-3" />
        Urgente — {dias} día{dias !== 1 ? "s" : ""}
      </span>
    );
  if (dias <= 5)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">
        <Clock className="h-3 w-3" />
        {dias} días restantes
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
      <Clock className="h-3 w-3" />
      {dias} días restantes
    </span>
  );
}

// ─────────────────────────────────────────────────────────────

export function OrdenCard({ orden }: OrdenCardProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [obs, setObs] = useState(orden.observaciones ?? "");

  const dias = diasRestantes(orden.fecha_fin_estimada);
  const avance = avancePorEstado(orden.prod_status);
  const statusCfg = PROD_STATUS_CONFIG[orden.prod_status];

  // ── Detalle (lazy) ───────────────────────────────────────
  const { data: detalle, isLoading: detalleCargando } = useQuery({
    queryKey: ["mi-produccion-detalle", orden.order_id],
    queryFn: () => getDetalleProduccion({ order_id: orden.order_id }),
    enabled: open,
    staleTime: 60_000,
  });

  // ── Materiales (lazy) ────────────────────────────────────
  const { data: materialesData, isLoading: materialesCargando } = useQuery({
    queryKey: ["mi-produccion-materiales", orden.order_id],
    queryFn: () => getMaterialesOrden({ order_id: orden.order_id }),
    enabled: open,
    staleTime: 60_000,
  });

  // ── Mutations ────────────────────────────────────────────
  const mutStatus = useMutation({
    mutationFn: (status: ProduccionStatus) =>
      actualizarProduccion({ produccion_id: orden.produccion_id, status }),
    onSuccess: (_, status) => {
      toast.success(
        status === "terminado"
          ? "¡Orden marcada como terminada!"
          : "Estado actualizado"
      );
      qc.invalidateQueries({ queryKey: ["mi-produccion"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutObs = useMutation({
    mutationFn: () =>
      actualizarProduccion({
        produccion_id: orden.produccion_id,
        observaciones: obs,
      }),
    onSuccess: () => {
      toast.success("Observación guardada");
      qc.invalidateQueries({ queryKey: ["mi-produccion"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Items del pedido ─────────────────────────────────────
  const items = detalle?.items ?? [];
  const primerItem = items[0];
  const personalizacion = parsePersonalizacion(
    primerItem?.personalizacion ?? null
  );

  // ─────────────────────────────────────────────────────────
  return (
    <div
      className={[
        "bg-card border rounded-xl overflow-hidden transition-all duration-150",
        open ? "border-primary/40 shadow-sm" : "border-border/50",
      ].join(" ")}
    >
      {/* ── CABECERA ──────────────────────────────────────── */}
      <div className="flex items-start justify-between p-5 gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground tracking-wide">
            {orden.order_number}
          </p>
          <p className="font-semibold text-lg mt-0.5 truncate">
            {orden.cliente}
          </p>
          {orden.telefono && (
            <p className="text-sm text-muted-foreground">{orden.telefono}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge className={statusCfg.colorClass} variant="outline">
            <span
              className="h-1.5 w-1.5 rounded-full mr-1.5 inline-block"
              style={{ background: statusCfg.dotColor }}
            />
            {statusCfg.label}
          </Badge>
          <UrgencyChip dias={dias} />
        </div>
      </div>

      {/* ── FECHAS ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 px-5 pb-3">
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-0.5">Inicio</p>
          <p className="text-sm font-medium">{fmtDay(orden.fecha_inicio)}</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-0.5">Entrega estimada</p>
          <p
            className={[
              "text-sm font-medium",
              dias !== null && dias <= 2 ? "text-red-700" : "",
            ].join(" ")}
          >
            {fmtDay(orden.fecha_fin_estimada)}
          </p>
        </div>
      </div>

      {/* ── BARRA DE AVANCE ───────────────────────────────── */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">Avance</span>
          <span className="text-xs font-medium">{avance}%</span>
        </div>
        <Progress value={avance} className="h-1.5" />
      </div>

      {/* ── ACCIONES RÁPIDAS ──────────────────────────────── */}
      <div className="flex items-center gap-2 px-5 pb-4 flex-wrap border-t border-border/40 pt-3">
        {orden.prod_status === "en_proceso" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => mutStatus.mutate("pausado")}
            disabled={mutStatus.isPending}
          >
            <Pause className="h-3.5 w-3.5 mr-1" />
            Pausar
          </Button>
        )}

        {orden.prod_status === "pausado" && (
          <Button
            size="sm"
            onClick={() => mutStatus.mutate("en_proceso")}
            disabled={mutStatus.isPending}
          >
            <Hammer className="h-3.5 w-3.5 mr-1" />
            Reanudar
          </Button>
        )}

        {orden.prod_status === "pendiente" && (
          <Button
            size="sm"
            onClick={() => mutStatus.mutate("en_proceso")}
            disabled={mutStatus.isPending}
          >
            <Hammer className="h-3.5 w-3.5 mr-1" />
            Iniciar
          </Button>
        )}

        {(orden.prod_status === "en_proceso" ||
          orden.prod_status === "pausado") && (
          <Button
            size="sm"
            variant="outline"
            className="border-green-200 text-green-800 hover:bg-green-50"
            onClick={() => mutStatus.mutate("terminado")}
            disabled={mutStatus.isPending}
          >
            {mutStatus.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            )}
            Marcar terminado
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-muted-foreground"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <ChevronUp className="h-4 w-4 mr-1" />
          ) : (
            <ChevronDown className="h-4 w-4 mr-1" />
          )}
          {open ? "Ocultar detalle" : "Ver detalle"}
        </Button>
      </div>

      {/* ── PANEL DE DETALLE (expandible) ─────────────────── */}
      {open && (
        <div className="border-t border-border/40 bg-muted/20 px-5 py-5 space-y-6">
          {detalleCargando ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Muebles a fabricar */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Mueble{items.length > 1 ? "s" : ""} a fabricar
                </h4>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 bg-card rounded-lg border border-border/50 p-3"
                    >
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="h-12 w-12 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded bg-blue-50 flex items-center justify-center shrink-0">
                          <Package className="h-5 w-5 text-blue-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Cant: {item.qty}
                          {item.sku ? ` · SKU: ${item.sku}` : ""}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {item.qty} ud
                      </Badge>
                    </div>
                  ))}

                  {items.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Sin ítems registrados.
                    </p>
                  )}
                </div>
              </section>

              {/* Especificaciones del cliente */}
              {personalizacion.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Especificaciones del cliente
                  </h4>
                  <EspecificacionesGrid specs={personalizacion} />
                </section>
              )}

              {/* Materiales necesarios */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Materiales necesarios
                </h4>
                {materialesCargando ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Calculando materiales...
                  </div>
                ) : (
                  <MaterialesLista
                    materiales={materialesData?.materiales ?? []}
                  />
                )}
              </section>

              {/* Pasos de fabricación */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Pasos de fabricación
                </h4>
                <PasosFabricacion items={items} />
              </section>

              {/* Observaciones */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Observaciones de fabricación
                </h4>
                <Textarea
                  rows={3}
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Anota ajustes, problemas o notas para el supervisor..."
                  className="text-sm resize-none"
                />
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    onClick={() => mutObs.mutate()}
                    disabled={mutObs.isPending}
                  >
                    {mutObs.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5 mr-1" />
                    )}
                    Guardar nota
                  </Button>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}