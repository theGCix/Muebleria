// src/routes/_authenticated/pedidos.tsx
// G&M Mueblería — Pedidos online con pipeline de producción
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, Search, ShoppingBag, Eye, RefreshCw,
  Clock, Package, Hammer, CheckCircle2, Truck, XCircle,
  ChevronRight, AlertCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos online — G&M" }] }),
  component: PedidosPage,
});

// ── Formateadores ────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);
const fmtDate = (d: string) =>
  new Intl.DateTimeFormat("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));

// ── Tipos ────────────────────────────────────────────────────
type OrderStatus =
  | "pendiente" | "pagado" | "en_produccion"
  | "control_calidad" | "listo_despacho" | "enviado"
  | "entregado" | "cancelado";

interface StatusConfig {
  label: string;
  color: string;
  bg: string;
  icon: React.ElementType;
  next: OrderStatus[];     // transiciones válidas
}

// ── Pipeline de estados ──────────────────────────────────────
const STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  pendiente:       { label: "Pendiente",        color: "#92400e", bg: "#fef3c7", icon: Clock,         next: ["pagado", "cancelado"] },
  pagado:          { label: "Pagado",            color: "#065f46", bg: "#d1fae5", icon: CheckCircle2,  next: ["en_produccion", "cancelado"] },
  en_produccion:   { label: "En producción",     color: "#1e40af", bg: "#dbeafe", icon: Hammer,        next: ["control_calidad", "cancelado"] },
  control_calidad: { label: "Control calidad",   color: "#5b21b6", bg: "#ede9fe", icon: AlertCircle,   next: ["listo_despacho", "en_produccion"] },
  listo_despacho:  { label: "Listo despacho",    color: "#0e7490", bg: "#cffafe", icon: Package,       next: ["enviado", "entregado"] },
  enviado:         { label: "Enviado",            color: "#6d28d9", bg: "#ede9fe", icon: Truck,         next: ["entregado"] },
  entregado:       { label: "Entregado",          color: "#14532d", bg: "#dcfce7", icon: CheckCircle2,  next: [] },
  cancelado:       { label: "Cancelado",          color: "#7f1d1d", bg: "#fee2e2", icon: XCircle,       next: [] },
};

const PIPELINE_ORDER: OrderStatus[] = [
  "pendiente", "pagado", "en_produccion",
  "control_calidad", "listo_despacho", "enviado", "entregado",
];

const STATUSES = Object.entries(STATUS_CONFIG) as [OrderStatus, StatusConfig][];

// ── Queries ──────────────────────────────────────────────────
async function fetchOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, nombre, email, telefono, dni,
      direccion, distrito, ciudad, notas,
      subtotal, envio, total, currency, status,
      niubiz_token, niubiz_auth_code, niubiz_ref_code,
      paid_at, created_at,
      produccion (
        id, status, prioridad, fecha_inicio,
        fecha_fin_estimada, fecha_fin_real, observaciones
      )
    `)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchOrderItems(orderId: string) {
  const { data, error } = await supabase
    .from("order_items")
    .select("id, sku, title, qty, unit_price, total, image_url")
    .eq("order_id", orderId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchHistorial(orderId: string) {
  const { data, error } = await supabase
    .from("order_estado_historial")
    .select("id, estado_anterior, estado_nuevo, motivo, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function cambiarEstado(orderId: string, nuevoEstado: OrderStatus) {
  const { data, error } = await supabase.rpc("cambiar_estado_pedido", {
    _order_id: orderId,
    _nuevo_estado: nuevoEstado,
  });
  if (error) throw new Error(error.message);
  return data;
}

// ── Componente principal ─────────────────────────────────────
function PedidosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
    refetchInterval: 60_000,
  });

  const { data: orderItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ["order-items", selectedId],
    queryFn: () => fetchOrderItems(selectedId!),
    enabled: !!selectedId,
  });

  const { data: historial = [] } = useQuery({
    queryKey: ["order-historial", selectedId],
    queryFn: () => fetchHistorial(selectedId!),
    enabled: !!selectedId,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      cambiarEstado(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order-historial", selectedId] });
      toast.success("Estado actualizado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = statusFilter === "todos" || o.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        o.order_number?.toLowerCase().includes(q) ||
        o.nombre?.toLowerCase().includes(q) ||
        o.email?.toLowerCase().includes(q) ||
        o.telefono?.includes(q);
      return matchStatus && matchSearch;
    });
  }, [orders, search, statusFilter]);

  // KPIs rápidos
  const stats = useMemo(() => {
    const total = orders.reduce((s, o) => s + Number(o.total), 0);
    return {
      total,
      enProduccion: orders.filter((o) => o.status === "en_produccion" || o.status === "control_calidad").length,
      pendientes:   orders.filter((o) => o.status === "pendiente" || o.status === "pagado").length,
      count:        orders.length,
    };
  }, [orders]);

  const selected = orders.find((o) => o.id === selectedId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Pedidos online</h1>
          <p className="text-muted-foreground mt-0.5">Pipeline de producción y entregas</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total pedidos",    value: stats.count,          suffix: "" },
          { label: "Pendientes/Pagados", value: stats.pendientes,   suffix: "" },
          { label: "En producción",    value: stats.enProduccion,   suffix: "" },
          { label: "Facturado",        value: fmt(stats.total),     suffix: "" },
        ].map(({ label, value, suffix }) => (
          <div key={label} className="bg-card border border-border/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="font-display text-2xl font-semibold">{value}{suffix}</p>
          </div>
        ))}
      </div>

      {/* Pipeline visual */}
      <div className="bg-card border border-border/50 rounded-xl p-4 overflow-x-auto">
        <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">Pipeline de estados</p>
        <div className="flex items-center gap-1 min-w-max">
          {PIPELINE_ORDER.map((status, i) => {
            const cfg = STATUS_CONFIG[status];
            const count = orders.filter((o) => o.status === status).length;
            const Icon = cfg.icon;
            return (
              <div key={status} className="flex items-center gap-1">
                <button
                  onClick={() => setStatusFilter(statusFilter === status ? "todos" : status)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all text-left ${
                    statusFilter === status
                      ? "border-primary bg-primary/5"
                      : "border-border/40 hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                    <span className="text-xs font-medium whitespace-nowrap">{cfg.label}</span>
                  </div>
                  <span
                    className="text-sm font-semibold rounded-full w-6 h-6 flex items-center justify-center"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {count}
                  </span>
                </button>
                {i < PIPELINE_ORDER.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                )}
              </div>
            );
          })}
          {/* Cancelados aparte */}
          <div className="ml-3 pl-3 border-l border-border/40">
            <button
              onClick={() => setStatusFilter(statusFilter === "cancelado" ? "todos" : "cancelado")}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all ${
                statusFilter === "cancelado" ? "border-primary bg-primary/5" : "border-border/40 hover:border-border"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-red-600" />
                <span className="text-xs font-medium">Cancelado</span>
              </div>
              <span className="text-sm font-semibold rounded-full w-6 h-6 flex items-center justify-center bg-red-50 text-red-700">
                {orders.filter((o) => o.status === "cancelado").length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por pedido, nombre, email o teléfono…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {STATUSES.map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <ShoppingBag className="h-10 w-10" />
          <p className="text-sm">No hay pedidos que coincidan</p>
        </div>
      ) : (
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/40">
                  {["Nº Pedido", "Cliente", "Productos", "Total", "Estado", "Fecha", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((order) => {
                  const cfg = STATUS_CONFIG[order.status as OrderStatus] ?? STATUS_CONFIG.pendiente;
                  const Icon = cfg.icon;
                  return (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium">{order.order_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[140px]">{order.nombre}</p>
                        <p className="text-xs text-muted-foreground">{order.email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {order.dni && <span className="text-xs">DNI: {order.dni}</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold">{fmt(Number(order.total))}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: cfg.color, background: cfg.bg }}
                        >
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {order.paid_at ? fmtDate(order.paid_at) : fmtDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedId(order.id)}
                        >
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

      {/* Modal detalle */}
      <Dialog open={!!selectedId && !selectedId !== null} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              Pedido {selected?.order_number}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-5 mt-2">
              {/* Pipeline de avance */}
              <div className="bg-muted/30 rounded-xl p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Avance del pedido</p>
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {PIPELINE_ORDER.map((status, i) => {
                    const cfg = STATUS_CONFIG[status];
                    const Icon = cfg.icon;
                    const currentIdx = PIPELINE_ORDER.indexOf(selected.status as OrderStatus);
                    const isActive = selected.status === status;
                    const isDone = currentIdx > i;
                    return (
                      <div key={status} className="flex items-center gap-1 flex-shrink-0">
                        <div className={`flex flex-col items-center gap-0.5 ${isActive || isDone ? "opacity-100" : "opacity-30"}`}>
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center border-2"
                            style={{
                              background: isActive || isDone ? cfg.bg : "transparent",
                              borderColor: isActive || isDone ? cfg.color : "currentColor",
                            }}
                          >
                            <Icon className="h-3.5 w-3.5" style={{ color: isActive || isDone ? cfg.color : "currentColor" }} />
                          </div>
                          <span className="text-[10px] whitespace-nowrap">{cfg.label}</span>
                        </div>
                        {i < PIPELINE_ORDER.length - 1 && (
                          <div className={`w-4 h-0.5 mb-3 flex-shrink-0 ${isDone ? "bg-green-400" : "bg-border"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cambio de estado */}
              {STATUS_CONFIG[selected.status as OrderStatus]?.next.length > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Cambiar a:</span>
                  <div className="flex gap-2 flex-wrap">
                    {STATUS_CONFIG[selected.status as OrderStatus].next.map((nextStatus) => {
                      const cfg = STATUS_CONFIG[nextStatus];
                      const Icon = cfg.icon;
                      return (
                        <Button
                          key={nextStatus}
                          size="sm"
                          variant="outline"
                          disabled={mutation.isPending}
                          onClick={() => mutation.mutate({ id: selected.id, status: nextStatus })}
                          className="gap-1.5"
                        >
                          {mutation.isPending
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />}
                          {cfg.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Datos del cliente */}
              <section>
                <h3 className="font-semibold text-sm mb-2">Datos del cliente</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm bg-muted/30 rounded-lg p-4">
                  {[
                    ["Nombre",    selected.nombre],
                    ["Email",     selected.email],
                    ["Teléfono",  selected.telefono],
                    ["DNI/RUC",   selected.dni],
                    ["Dirección", selected.direccion],
                    ["Distrito",  selected.distrito],
                    ["Ciudad",    selected.ciudad],
                  ].map(([label, value]) => value ? (
                    <div key={label}>
                      <span className="text-muted-foreground">{label}:</span>{" "}
                      <span className="font-medium">{value}</span>
                    </div>
                  ) : null)}
                </div>
              </section>

              {/* Productos */}
              <section>
                <h3 className="font-semibold text-sm mb-2">Productos</h3>
                {loadingItems ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orderItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        {item.image_url ? (
                          <img
                            src={item.image_url} alt={item.title}
                            className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.title}</p>
                          {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                          <p className="text-xs text-muted-foreground">
                            {fmt(Number(item.unit_price))} × {item.qty}
                          </p>
                        </div>
                        <span className="font-semibold">{fmt(Number(item.total))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Totales */}
              <section className="border-t pt-4 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span>{fmt(Number(selected.subtotal))}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Envío</span>
                  <span>{Number(selected.envio) === 0 ? "Gratis" : fmt(Number(selected.envio))}</span>
                </div>
                <div className="flex justify-between font-semibold font-display pt-1 border-t">
                  <span>Total</span><span>{fmt(Number(selected.total))}</span>
                </div>
              </section>

              {/* Historial de estados */}
              {historial.length > 0 && (
                <section>
                  <h3 className="font-semibold text-sm mb-2">Historial de estados</h3>
                  <div className="space-y-1">
                    {historial.map((h) => {
                      const cfgNuevo = STATUS_CONFIG[h.estado_nuevo as OrderStatus];
                      return (
                        <div key={h.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="whitespace-nowrap">{fmtDate(h.created_at)}</span>
                          {h.estado_anterior && (
                            <>
                              <span
                                className="px-1.5 py-0.5 rounded-full"
                                style={{
                                  color: STATUS_CONFIG[h.estado_anterior as OrderStatus]?.color,
                                  background: STATUS_CONFIG[h.estado_anterior as OrderStatus]?.bg,
                                }}
                              >
                                {STATUS_CONFIG[h.estado_anterior as OrderStatus]?.label}
                              </span>
                              <ChevronRight className="h-3 w-3" />
                            </>
                          )}
                          <span
                            className="px-1.5 py-0.5 rounded-full"
                            style={{ color: cfgNuevo?.color, background: cfgNuevo?.bg }}
                          >
                            {cfgNuevo?.label}
                          </span>
                          {h.motivo && <span>— {h.motivo}</span>}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Datos Niubiz */}
              {(selected.niubiz_token || selected.niubiz_auth_code) && (
                <section>
                  <h3 className="font-semibold text-sm mb-2">Datos de pago Niubiz</h3>
                  <div className="bg-muted/30 rounded-lg p-4 space-y-1 font-mono text-xs text-muted-foreground">
                    {selected.niubiz_token     && <div><span className="w-28 inline-block text-muted-foreground/70">Token:</span><span className="truncate">{selected.niubiz_token}</span></div>}
                    {selected.niubiz_auth_code && <div><span className="w-28 inline-block text-muted-foreground/70">Auth code:</span>{selected.niubiz_auth_code}</div>}
                    {selected.niubiz_ref_code  && <div><span className="w-28 inline-block text-muted-foreground/70">Ref code:</span>{selected.niubiz_ref_code}</div>}
                    {selected.paid_at          && <div><span className="w-28 inline-block text-muted-foreground/70">Pagado el:</span>{fmtDate(selected.paid_at)}</div>}
                  </div>
                </section>
              )}

              {selected.notas && (
                <section>
                  <h3 className="font-semibold text-sm mb-1">Notas del cliente</h3>
                  <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">{selected.notas}</p>
                </section>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
