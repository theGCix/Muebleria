// src/routes/_authenticated/pedidos.tsx
// G&M Mueblería — Lista de pedidos ecommerce
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
import { Loader2, Search, ShoppingBag, Eye, RefreshCw } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos online — G&M" }] }),
  component: PedidosPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

const fmtDate = (d: string) =>
  new Intl.DateTimeFormat("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));

// ── Status config ──────────────────────────────────────────
type OrderStatus = "pendiente" | "pagado" | "en_preparacion" | "enviado" | "entregado" | "cancelado";

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pendiente:       { label: "Pendiente",       color: "#92400e", bg: "#fef3c7" },
  pagado:          { label: "Pagado",           color: "#065f46", bg: "#d1fae5" },
  en_preparacion:  { label: "En preparación",  color: "#1e40af", bg: "#dbeafe" },
  enviado:         { label: "Enviado",          color: "#5b21b6", bg: "#ede9fe" },
  entregado:       { label: "Entregado",        color: "#14532d", bg: "#dcfce7" },
  cancelado:       { label: "Cancelado",        color: "#7f1d1d", bg: "#fee2e2" },
};

const STATUSES = Object.entries(STATUS_CONFIG) as [OrderStatus, typeof STATUS_CONFIG[OrderStatus]][];

// ── Queries ────────────────────────────────────────────────
async function fetchOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, nombre, email, telefono, dni,
      direccion, distrito, ciudad, notas,
      subtotal, envio, total, currency, status,
      niubiz_token, niubiz_auth_code, niubiz_ref_code,
      paid_at, created_at
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

async function updateStatus(orderId: string, status: OrderStatus) {
  const { error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

// ── Component ──────────────────────────────────────────────
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

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
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

  const selected = orders.find((o) => o.id === selectedId);

  // ── Stats ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = orders.reduce((s, o) => s + Number(o.total), 0);
    const pagados = orders.filter((o) => o.status === "pagado" || o.status === "entregado").length;
    const pendientes = orders.filter((o) => o.status === "pendiente").length;
    return { total, pagados, pendientes, count: orders.length };
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Pedidos online</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pedidos recibidos a través del ecommerce con pago Niubiz
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total pedidos",  value: stats.count,                          suffix: "" },
          { label: "Pagados",        value: stats.pagados,                         suffix: "" },
          { label: "Pendientes",     value: stats.pendientes,                      suffix: "" },
          { label: "Facturado",      value: fmt(stats.total),                      suffix: "" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-border/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="font-display text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por pedido, nombre, email o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
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
                <tr className="border-b border-border bg-muted/40">
                  {["N° Pedido", "Cliente", "Productos", "Total", "Estado", "Fecha", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((order) => {
                  const cfg = STATUS_CONFIG[order.status as OrderStatus] ?? STATUS_CONFIG.pendiente;
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
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: cfg.color, background: cfg.bg }}
                        >
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
      <Dialog open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              Pedido {selected?.order_number}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-5 mt-2">
              {/* Estado + cambiar */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                <span className="text-sm font-medium">Estado:</span>
                <Select
                  value={selected.status}
                  onValueChange={(val) =>
                    mutation.mutate({ id: selected.id, status: val as OrderStatus })
                  }
                  disabled={mutation.isPending}
                >
                  <SelectTrigger className="w-44 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>

              {/* Datos del cliente */}
              <section>
                <h3 className="font-semibold text-sm mb-2">Datos del cliente</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm bg-muted/30 rounded-lg p-4">
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
                      <span className="text-muted-foreground text-xs">{label}</span>
                      <p className="font-medium">{value}</p>
                    </div>
                  ) : null)}
                  {selected.notas && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground text-xs">Notas</span>
                      <p className="font-medium">{selected.notas}</p>
                    </div>
                  )}
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
                          <img src={item.image_url} alt={item.title}
                            className="w-12 h-12 rounded-md object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.title}</p>
                          {item.sku && (
                            <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {fmt(Number(item.unit_price))} × {item.qty}
                          </p>
                        </div>
                        <span className="font-semibold text-sm">{fmt(Number(item.total))}</span>
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
                <div className="flex justify-between font-semibold text-base pt-1 border-t">
                  <span>Total</span>
                  <span className="font-display">{fmt(Number(selected.total))}</span>
                </div>
              </section>

              {/* Datos Niubiz */}
              {(selected.niubiz_token || selected.niubiz_auth_code) && (
                <section>
                  <h3 className="font-semibold text-sm mb-2">Datos de pago Niubiz</h3>
                  <div className="bg-muted/30 rounded-lg p-4 space-y-1 text-xs font-mono">
                    {selected.niubiz_token && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-28 flex-shrink-0">Token:</span>
                        <span className="truncate">{selected.niubiz_token}</span>
                      </div>
                    )}
                    {selected.niubiz_auth_code && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-28 flex-shrink-0">Auth code:</span>
                        <span>{selected.niubiz_auth_code}</span>
                      </div>
                    )}
                    {selected.niubiz_ref_code && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-28 flex-shrink-0">Ref code:</span>
                        <span>{selected.niubiz_ref_code}</span>
                      </div>
                    )}
                    {selected.paid_at && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-28 flex-shrink-0">Pagado el:</span>
                        <span>{fmtDate(selected.paid_at)}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}