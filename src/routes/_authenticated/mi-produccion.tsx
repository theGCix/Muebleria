import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listMiProduccion, actualizarProduccion, getDetalleProduccion } from "@/lib/pos.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Hammer, Clock, CheckCircle2, Pause, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/mi-produccion")({
  head: () => ({ meta: [{ title: "Mis órdenes — G&M" }] }),
  component: MiProduccionPage,
});

const PROD_STATUS = {
  pendiente:         { label: "Pendiente",         color: "#92400e", bg: "#fef3c7", icon: Clock },
  en_proceso:        { label: "En proceso",         color: "#1e40af", bg: "#dbeafe", icon: Hammer },
  pausado:           { label: "Pausado",             color: "#6b7280", bg: "#f3f4f6", icon: Pause },
  terminado:         { label: "Terminado",           color: "#14532d", bg: "#dcfce7", icon: CheckCircle2 },
  rechazado_calidad: { label: "Rechazado calidad",  color: "#7f1d1d", bg: "#fee2e2", icon: AlertTriangle },
} as const;

type ProdStatus = keyof typeof PROD_STATUS;

const fmtDay = (d: string | null) => d ? format(new Date(d), "dd MMM yyyy", { locale: es }) : "—";
const fmt    = (n: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

function OrdenCard({ orden }: { orden: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [obs, setObs] = useState(orden.observaciones ?? "");

  const { data: detalle, isLoading } = useQuery({
    queryKey: ["mi-produccion-detalle", orden.order_id],
    queryFn: () => getDetalleProduccion({ order_id: orden.order_id }),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: (status: string) =>
      actualizarProduccion({ produccion_id: orden.produccion_id, status }),
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["mi-produccion"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const obsMut = useMutation({
    mutationFn: () =>
      actualizarProduccion({ produccion_id: orden.produccion_id, observaciones: obs }),
    onSuccess: () => {
      toast.success("Observaciones guardadas");
      qc.invalidateQueries({ queryKey: ["mi-produccion"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const ps = PROD_STATUS[orden.prod_status as ProdStatus];
  const Icon = ps?.icon ?? Clock;

  return (
    <>
      <div className="bg-card border border-border/50 rounded-xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{orden.order_number}</p>
            <p className="font-display font-semibold text-lg">{orden.cliente}</p>
            <p className="text-sm text-muted-foreground">{orden.telefono ?? ""}</p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ color: ps?.color, background: ps?.bg }}
          >
            <Icon className="h-3.5 w-3.5" />
            {ps?.label}
          </span>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Inicio</p>
            <p className="font-medium">{fmtDay(orden.fecha_inicio)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Entrega estimada</p>
            <p className="font-medium">{fmtDay(orden.fecha_fin_estimada)}</p>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="flex gap-2 flex-wrap">
          {orden.prod_status !== "en_proceso" && (
            <Button size="sm" onClick={() => mut.mutate("en_proceso")} disabled={mut.isPending}>
              <Hammer className="h-3.5 w-3.5 mr-1" /> Iniciar
            </Button>
          )}
          {orden.prod_status === "en_proceso" && (
            <Button size="sm" variant="outline" onClick={() => mut.mutate("pausado")} disabled={mut.isPending}>
              <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
            </Button>
          )}
          {(orden.prod_status === "en_proceso" || orden.prod_status === "pausado") && (
            <Button size="sm" variant="outline" onClick={() => mut.mutate("terminado")} disabled={mut.isPending}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marcar terminado
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            Ver detalle
          </Button>
        </div>
      </div>

      {/* Dialog detalle */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{orden.order_number} — Detalle</DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <section>
                <h4 className="font-semibold text-sm mb-2">Muebles</h4>
                <div className="space-y-2">
                  {(detalle?.items ?? []).map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">Cant: {item.qty} · {item.sku ?? ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h4 className="font-semibold text-sm mb-2">Observaciones</h4>
                <Textarea
                  rows={3} value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Notas de fabricación..."
                  className="text-sm"
                />
                <Button size="sm" className="mt-2" onClick={() => obsMut.mutate()} disabled={obsMut.isPending}>
                  {obsMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Guardar observaciones
                </Button>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function MiProduccionPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["mi-produccion"],
    queryFn: listMiProduccion,
    refetchInterval: 120_000,
  });

  const ordenes = data?.ordenes ?? [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-semibold">Mis órdenes</h1>
        <p className="text-muted-foreground mt-0.5">
          {ordenes.length === 0
            ? "No tienes órdenes asignadas"
            : `${ordenes.length} orden${ordenes.length > 1 ? "es" : ""} asignada${ordenes.length > 1 ? "s" : ""}`}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : ordenes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Hammer className="h-10 w-10" />
          <p className="text-sm">Sin órdenes asignadas por ahora</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ordenes.map((orden: any) => (
            <OrdenCard key={orden.produccion_id} orden={orden} />
          ))}
        </div>
      )}
    </div>
  );
}