//SE - 09062026 : 09:22
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listProduccion, getDetalleProduccion, actualizarProduccion,
  asignarCarpintero, listCarpinteros,
  asignarUbicacionProduccion, listUbicaciones,
} from "@/lib/pos.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, Hammer, AlertTriangle, CheckCircle2,
  Pause, Clock, Eye, UserCheck, RefreshCw,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { format, isPast, isToday } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/produccion")({
  head: () => ({ meta: [{ title: "Producción — G&M" }] }),
  component: ProduccionPage,
});

// ── Configuración visual ─────────────────────────────────────
const PROD_STATUS_CONFIG = {
  pendiente:          { label: "Pendiente",         color: "#92400e", bg: "#fef3c7", icon: Clock },
  en_proceso:         { label: "En proceso",        color: "#1e40af", bg: "#dbeafe", icon: Hammer },
  pausado:            { label: "Pausado",            color: "#6b7280", bg: "#f3f4f6", icon: Pause },
  terminado:          { label: "Terminado",          color: "#14532d", bg: "#dcfce7", icon: CheckCircle2 },
  rechazado_calidad:  { label: "Rechazado calidad", color: "#7f1d1d", bg: "#fee2e2", icon: AlertTriangle },
} as const;

const PRIORIDAD_CONFIG = {
  1: { label: "Urgente", color: "#dc2626", bg: "#fee2e2" },
  2: { label: "Normal",  color: "#2563eb", bg: "#dbeafe" },
  3: { label: "Baja",    color: "#6b7280", bg: "#f3f4f6" },
} as const;

type ProdStatus = keyof typeof PROD_STATUS_CONFIG;

const fmt    = (n: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);
const fmtDay = (d: string | null) => d ? format(new Date(d), "dd MMM yyyy", { locale: es }) : "—";

// ── Determinar urgencia por fecha fin estimada ────────────────
function getFechaUrgencia(fecha: string | null): "vencida" | "hoy" | "normal" | null {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isPast(d) && !isToday(d)) return "vencida";
  if (isToday(d)) return "hoy";
  return "normal";
}

// ── Dialog detalle de orden de fabricación ───────────────────
function OrdenDetalle({
  orden,
  onClose,
}: {
  orden: any;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [editObs, setEditObs] = useState(false);
  const [obs, setObs] = useState(orden.observaciones ?? "");
  const [asignarOpen, setAsignarOpen] = useState(false);
  const [carpinteroId, setCarpinteroId] = useState(orden.asignado_a ?? "");
  const [ubicacionId, setUbicacionId] = useState(orden.ubicacion_id ?? "");

  const { data: detalle, isLoading } = useQuery({
    queryKey: ["produccion-detalle", orden.order_id],
    queryFn: () => getDetalleProduccion({ order_id: orden.order_id }),
  });

  const { data: carpinterosData } = useQuery({
    queryKey: ["carpinteros"],
    queryFn: listCarpinteros,
  });

  const { data: ubicData } = useQuery({
    queryKey: ["ubicaciones"],
    queryFn: listUbicaciones,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["produccion"] });
    qc.invalidateQueries({ queryKey: ["produccion-detalle", orden.order_id] });
  };

  const statusMut = useMutation({
    mutationFn: (status: string) =>
      actualizarProduccion({ produccion_id: detalle!.produccion!.id, status }),
    onSuccess: () => { toast.success("Estado actualizado"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const obsMut = useMutation({
    mutationFn: () =>
      actualizarProduccion({ produccion_id: detalle!.produccion!.id, observaciones: obs }),
    onSuccess: () => { toast.success("Observaciones guardadas"); setEditObs(false); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const asignarMut = useMutation({
    mutationFn: () =>
      asignarCarpintero({ produccion_id: detalle!.produccion!.id, carpintero_id: carpinteroId }),
    onSuccess: () => {
      toast.success("Carpintero asignado");
      setAsignarOpen(false);
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const ubicacionMut = useMutation({
    mutationFn: () =>
      asignarUbicacionProduccion({ produccion_id: detalle!.produccion!.id, ubicacion_id: ubicacionId }),
    onSuccess: () => {
      toast.success("Taller asignado");
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const prod = detalle?.produccion;
  const urgencia = getFechaUrgencia(prod?.fecha_fin_estimada ?? null);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <Hammer className="h-5 w-5" />
            Orden {orden.order_number}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !prod ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 mt-1">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Cliente</p>
                <p className="font-medium text-sm truncate">{orden.cliente}</p>
                <p className="text-xs text-muted-foreground">{orden.telefono ?? ""}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Fecha fin estimada</p>
                <p className={`font-semibold text-sm ${
                  urgencia === "vencida" ? "text-red-600" :
                  urgencia === "hoy" ? "text-amber-600" : ""
                }`}>
                  {fmtDay(prod.fecha_fin_estimada)}
                  {urgencia === "vencida" && " ⚠️"}
                  {urgencia === "hoy" && " 🔔"}
                </p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Prioridad</p>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    color: PRIORIDAD_CONFIG[prod.prioridad as 1 | 2 | 3].color,
                    background: PRIORIDAD_CONFIG[prod.prioridad as 1 | 2 | 3].bg,
                  }}
                >
                  {PRIORIDAD_CONFIG[prod.prioridad as 1 | 2 | 3].label}
                </span>
              </div>
            </div>

            {/* Estado interno + transiciones */}
            <div className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Estado de fabricación</p>
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5"
                    style={{
                      color: PROD_STATUS_CONFIG[prod.status as ProdStatus]?.color,
                      background: PROD_STATUS_CONFIG[prod.status as ProdStatus]?.bg,
                    }}
                  >
                    {prod.status === "en_proceso" && <Hammer className="h-3 w-3" />}
                    {PROD_STATUS_CONFIG[prod.status as ProdStatus]?.label}
                  </span>
                </div>

                {/* Asignar carpintero */}
                <Button size="sm" variant="outline" onClick={() => setAsignarOpen(true)}>
                  <UserCheck className="h-3.5 w-3.5 mr-1" />
                  {orden.carpintero ? `Asignado: ${orden.carpintero}` : "Asignar carpintero"}
                </Button>
              </div>

              {/* Cambios de estado rápidos */}
              <div className="flex gap-2 flex-wrap">
                {([
                  ["en_proceso",        "Iniciar"],
                  ["pausado",           "Pausar"],
                  ["terminado",         "Marcar terminado"],
                  ["rechazado_calidad", "Rechazar calidad"],
                ] as [string, string][]).map(([s, label]) =>
                  s !== prod.status ? (
                    <Button
                      key={s} size="sm" variant="outline"
                      disabled={statusMut.isPending}
                      onClick={() => statusMut.mutate(s)}
                    >
                      {statusMut.isPending
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : null}
                      {label}
                    </Button>
                  ) : null
                )}
              </div>
            </div>

            {/* Ítems del pedido */}
            <section>
              <h4 className="font-semibold text-sm mb-2">Muebles a fabricar</h4>
              <div className="space-y-2">
                {(detalle?.items ?? []).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 text-sm">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title}
                        className="w-12 h-12 rounded-md object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <Hammer className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.title}</p>
                      {item.sku && <p className="text-xs text-muted-foreground font-mono">SKU: {item.sku}</p>}
                      <p className="text-xs text-muted-foreground">Cantidad: {item.qty}</p>
                    </div>
                    <span className="font-semibold">{fmt(Number(item.total))}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Observaciones */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">Observaciones internas</h4>
                {!editObs
                  ? <Button size="sm" variant="ghost" onClick={() => setEditObs(true)}>Editar</Button>
                  : <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditObs(false)}>Cancelar</Button>
                      <Button size="sm" disabled={obsMut.isPending} onClick={() => obsMut.mutate()}>
                        {obsMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                        Guardar
                      </Button>
                    </div>
                }
              </div>
              {editObs ? (
                <Textarea
                  rows={3} value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Notas de producción, materiales especiales, instrucciones..."
                  className="text-sm"
                />
              ) : (
                <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 min-h-[60px]">
                  {prod.observaciones ?? "Sin observaciones."}
                </p>
              )}
            </section>

            {/* Timeline */}
            <section className="grid grid-cols-3 gap-3 text-sm">
              {[
                ["Inicio",      fmtDay(prod.fecha_inicio)],
                ["Fin estimado", fmtDay(prod.fecha_fin_estimada)],
                ["Fin real",    fmtDay(prod.fecha_fin_real ?? null)],
              ].map(([label, value]) => (
                <div key={label} className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                  <p className="font-medium">{value}</p>
                </div>
              ))}
            </section>
          </div>
        )}

        {/* Dialog asignar carpintero */}
        {asignarOpen && (
          <Dialog open onOpenChange={setAsignarOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Asignar carpintero y taller</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs">Carpintero</Label>
                  <Select value={carpinteroId} onValueChange={setCarpinteroId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {(carpinterosData?.carpinteros ?? []).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full" disabled={!carpinteroId || asignarMut.isPending}
                  onClick={() => asignarMut.mutate()}
                >
                  {asignarMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Asignar carpintero
                </Button>

                <div className="border-t pt-4">
                  <Label className="text-xs">Taller / ubicación</Label>
                  <Select value={ubicacionId} onValueChange={setUbicacionId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {(ubicData?.ubicaciones ?? []).map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full" variant="outline" disabled={!ubicacionId || ubicacionMut.isPending}
                  onClick={() => ubicacionMut.mutate()}
                >
                  {ubicacionMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Asignar taller
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ─────────────────────────────────────────
function ProduccionPage() {
  const qc = useQueryClient();
  const [selectedOrden, setSelectedOrden] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("todos");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["produccion"],
    queryFn: listProduccion,
    refetchInterval: 60_000,
  });

  const ordenes = data?.ordenes ?? [];

  const filtradas = useMemo(() => {
    if (statusFilter === "todos") return ordenes;
    return ordenes.filter((o: any) => o.prod_status === statusFilter);
  }, [ordenes, statusFilter]);

  const stats = useMemo(() => ({
    total:     ordenes.length,
    proceso:   ordenes.filter((o: any) => o.prod_status === "en_proceso").length,
    pendiente: ordenes.filter((o: any) => o.prod_status === "pendiente").length,
    vencidas:  ordenes.filter((o: any) => {
      if (!o.fecha_fin_estimada) return false;
      return isPast(new Date(o.fecha_fin_estimada)) && !isToday(new Date(o.fecha_fin_estimada));
    }).length,
  }), [ordenes]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Producción</h1>
          <p className="text-muted-foreground mt-0.5">Órdenes de fabricación activas</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total activas",  value: stats.total },
          { label: "En proceso",     value: stats.proceso },
          { label: "Pendientes",     value: stats.pendiente },
          { label: "Vencidas ⚠️",   value: stats.vencidas },
        ].map(({ label, value }) => (
          <div key={label} className={`border rounded-xl p-4 ${
            label.includes("Vencidas") && value > 0
              ? "bg-red-50 border-red-200"
              : "bg-card border-border/50"
          }`}>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="font-display text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros de estado */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "todos",             label: "Todas" },
          { key: "pendiente",         label: "Pendientes" },
          { key: "en_proceso",        label: "En proceso" },
          { key: "pausado",           label: "Pausadas" },
          { key: "rechazado_calidad", label: "Rechazadas" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
              statusFilter === key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border/50 hover:border-border"
            }`}
          >
            {label}
            <span className="ml-1.5 text-xs opacity-70">
              ({key === "todos" ? ordenes.length : ordenes.filter((o: any) => o.prod_status === key).length})
            </span>
          </button>
        ))}
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Hammer className="h-10 w-10" />
          <p className="text-sm">No hay órdenes de fabricación activas</p>
        </div>
      ) : (
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/40">
                  {["Pedido", "Cliente", "Carpintero", "Prioridad", "Estado", "Fin estimado", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-xs text-muted-foreground uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtradas.map((orden: any) => {
                  const ps = PROD_STATUS_CONFIG[orden.prod_status as ProdStatus];
                  const pr = PRIORIDAD_CONFIG[orden.prioridad as 1 | 2 | 3];
                  const urgencia = getFechaUrgencia(orden.fecha_fin_estimada);
                  const Icon = ps?.icon ?? Clock;

                  return (
                    <tr
                      key={orden.produccion_id}
                      className={`hover:bg-muted/20 transition-colors ${
                        urgencia === "vencida" ? "bg-red-50/30" :
                        urgencia === "hoy" ? "bg-amber-50/30" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium">{orden.order_number}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[130px]">{orden.cliente}</p>
                        <p className="text-xs text-muted-foreground">{fmt(Number(orden.total))}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {orden.carpintero ?? <span className="italic opacity-50">Sin asignar</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: pr?.color, background: pr?.bg }}>
                          {pr?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: ps?.color, background: ps?.bg }}>
                          <Icon className="h-3 w-3" />
                          {ps?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={
                          urgencia === "vencida" ? "text-red-600 font-semibold" :
                          urgencia === "hoy"     ? "text-amber-600 font-semibold" :
                          "text-muted-foreground"
                        }>
                          {fmtDay(orden.fecha_fin_estimada)}
                          {urgencia === "vencida" && " ⚠️"}
                          {urgencia === "hoy"     && " 🔔"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedOrden(orden)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedOrden && (
        <OrdenDetalle
          orden={selectedOrden}
          onClose={() => {
            setSelectedOrden(null);
            qc.invalidateQueries({ queryKey: ["produccion"] });
          }}
        />
      )}
    </div>
  );
}
//EE - 09062026 : 09:22