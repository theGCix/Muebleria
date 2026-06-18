// src/routes/_authenticated/clientes.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listClientesUnificados, getCustomerValor, getCustomerSales,
  getCustomerOrders, updateCustomerCrm,searchCustomers
} from "@/lib/pos.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Loader2, Search, Eye,
  ShoppingBag, Package, Phone, Mail, MapPin,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { ClienteUnificado } from "@/lib/pos.functions";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — G&M" }] }),
  component: ClientesPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);
const fmtDate = (d: string | null) =>
  d ? format(new Date(d), "dd/MM/yyyy") : "—";

const SEGMENTO_CONFIG = {
  nuevo:      { label: "Nuevo",      color: "#1e40af", bg: "#dbeafe" },
  recurrente: { label: "Recurrente", color: "#065f46", bg: "#d1fae5" },
  vip:        { label: "VIP",        color: "#78350f", bg: "#fef3c7" },
  inactivo:   { label: "Inactivo",   color: "#6b7280", bg: "#f3f4f6" },
} as const;

type Segmento = keyof typeof SEGMENTO_CONFIG;

// ── Canal badge ──────────────────────────────────────────────
function CanalBadge({ fuente }: { fuente: "pos" | "online" | "ambos" }) {
  if (fuente === "pos")    return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">🏪 Local</span>;
  if (fuente === "online") return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">🌐 Online</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">🔀 Ambos</span>;
}

// ── Detalle 360° del cliente ─────────────────────────────────
function ClienteDetalle({ cliente, onClose }: { cliente: ClienteUnificado; onClose: () => void }) {
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    segmento: (cliente.segmento ?? "nuevo") as Segmento,
    notas: cliente.notas ?? "",
  });

  // Solo consultamos getCustomerValor si el cliente existe en la tabla customers (fuente pos/ambos)
  const isPosClient = cliente.fuente !== "online";

  const { data: cv, isLoading } = useQuery({
    queryKey: ["customer-valor", cliente.id],
    queryFn: () => getCustomerValor({ id: cliente.id }),
    enabled: isPosClient,
  });

  const { data: salesData } = useQuery({
    queryKey: ["customer-sales", cliente.id],
    queryFn: () => getCustomerSales({ customer_id: cliente.id }),
    enabled: isPosClient,
  });

  const { data: ordersData } = useQuery({
    queryKey: ["customer-orders", cliente.email],
    queryFn: () => getCustomerOrders({ email: cliente.email! }),
    enabled: !!cliente.email,
  });

  const saveMut = useMutation({
    mutationFn: () => updateCustomerCrm({ id: cliente.id, ...form }),
    onSuccess: () => {
      toast.success("Cliente actualizado");
      qc.invalidateQueries({ queryKey: ["customer-valor", cliente.id] });
      qc.invalidateQueries({ queryKey: ["customers-unificados"] });
      setEditMode(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Datos del cliente: preferir lo que viene de getCustomerValor si está disponible
  const c = cv?.customer ?? cliente;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            {c.nombre}
            <CanalBadge fuente={cliente.fuente} />
          </DialogTitle>
        </DialogHeader>

        {isLoading && isPosClient ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5 mt-1">

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Valor total</p>
                <p className="font-display text-lg font-semibold">{fmt(cliente.valor_total)}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Compras POS</p>
                <p className="font-display text-lg font-semibold">{cliente.total_compras_pos}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Pedidos online</p>
                <p className="font-display text-lg font-semibold">{cliente.total_pedidos_online}</p>
              </div>
            </div>

            {/* Datos de contacto */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm bg-muted/30 rounded-xl p-4">
              {(c.doc_tipo || c.doc_numero) && (
                <div>
                  <span className="text-muted-foreground text-xs">Documento</span>
                  <p className="font-medium">{c.doc_tipo} {c.doc_numero}</p>
                </div>
              )}
              {c.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground text-xs">Email</span>
                    <p className="font-medium text-sm truncate">{c.email}</p>
                  </div>
                </div>
              )}
              {c.telefono && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground text-xs">Teléfono</span>
                    <p className="font-medium">{c.telefono}</p>
                  </div>
                </div>
              )}
              {c.direccion && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground text-xs">Dirección</span>
                    <p className="font-medium text-sm">{c.direccion}</p>
                  </div>
                </div>
              )}
              <div>
                <span className="text-muted-foreground text-xs">Cliente desde</span>
                <p className="font-medium">{fmtDate(c.created_at)}</p>
              </div>
              {c.ultima_actividad && (
                <div>
                  <span className="text-muted-foreground text-xs">Última actividad</span>
                  <p className="font-medium">{fmtDate(c.ultima_actividad)}</p>
                </div>
              )}
            </div>

            {/* CRM: segmento y notas (solo clientes POS) */}
            {isPosClient ? (
              <div className="border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">CRM</h4>
                  {!editMode ? (
                    <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                      Editar
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>
                        Cancelar
                      </Button>
                      <Button size="sm" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
                        {saveMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                        Guardar
                      </Button>
                    </div>
                  )}
                </div>

                {editMode ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Segmento</Label>
                      <Select
                        value={form.segmento}
                        onValueChange={(v) => setForm((f) => ({ ...f, segmento: v as Segmento }))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(SEGMENTO_CONFIG).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Notas internas</Label>
                      <Textarea
                        className="mt-1 text-sm"
                        rows={3}
                        value={form.notas}
                        onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                        placeholder="Preferencias, historial de contacto, observaciones..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Segmento:</span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          color: SEGMENTO_CONFIG[c.segmento as Segmento]?.color ?? "#6b7280",
                          background: SEGMENTO_CONFIG[c.segmento as Segmento]?.bg ?? "#f3f4f6",
                        }}
                      >
                        {SEGMENTO_CONFIG[c.segmento as Segmento]?.label ?? c.segmento}
                      </span>
                    </div>
                    {c.notas ? (
                      <p className="text-muted-foreground text-xs bg-muted/30 rounded-lg p-3 whitespace-pre-line">
                        {c.notas}
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-xs italic">Sin notas</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="border rounded-xl p-4 text-sm text-muted-foreground">
                <p className="text-xs">Este comprador solo existe en la tienda online. Para asignarle segmento y notas, crea un cliente POS con el mismo email.</p>
              </div>
            )}

            {/* Historial POS */}
            {(salesData?.sales ?? []).length > 0 && (
              <section>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4" /> Compras en tienda
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {salesData!.sales.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between text-sm p-2.5 rounded-lg bg-muted/30">
                      <div>
                        <span className="font-mono text-xs text-muted-foreground">{s.numero}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{fmtDate(s.created_at)}</span>
                      </div>
                      <span className="font-semibold">{fmt(Number(s.total))}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Historial online */}
            {(ordersData?.orders ?? []).length > 0 && (
              <section>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Package className="h-4 w-4" /> Pedidos online
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {ordersData!.orders.map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between text-sm p-2.5 rounded-lg bg-muted/30">
                      <div>
                        <span className="font-mono text-xs text-muted-foreground">{o.order_number}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{fmtDate(o.created_at)}</span>
                      </div>
                      <span className="font-semibold">{fmt(Number(o.total))}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────
function ClientesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [segmentoFilter, setSegmentoFilter] = useState("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customers-list", q],
    queryFn: () => searchCustomers({ data: { q, limit: 100 } }),
  });

  const filtered = useMemo(() => {
    const list = data?.customers ?? [];
    if (segmentoFilter === "todos") return list;
    return list.filter((c: any) => c.segmento === segmentoFilter);
  }, [data, segmentoFilter]);

  // KPIs
  const stats = useMemo(() => {
    const all = data?.customers ?? [];
    return {
      total: all.length,
      vip: all.filter((c: any) => c.segmento === "vip").length,
      recurrente: all.filter((c: any) => c.segmento === "recurrente").length,
      nuevo: all.filter((c: any) => c.segmento === "nuevo").length,
    };
  }, [data]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Clientes</h1>
          <p className="text-muted-foreground mt-0.5">Directorio y CRM</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total clientes", value: stats.total },
          { label: "Nuevos",         value: stats.nuevo },
          { label: "Recurrentes",    value: stats.recurrente },
          { label: "VIP",            value: stats.vip },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-border/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="font-display text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, documento, email o teléfono…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={segmentoFilter} onValueChange={setSegmentoFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los segmentos</SelectItem>
            {Object.entries(SEGMENTO_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 text-muted-foreground text-sm">
            No se encontraron clientes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/40">
                  {["Nombre", "Documento", "Contacto", "Segmento", "Cliente desde", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((c: any) => {
                  const seg = SEGMENTO_CONFIG[c.segmento as Segmento] ?? SEGMENTO_CONFIG.nuevo;
                  return (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.nombre}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                        {c.doc_tipo} {c.doc_numero}
                      </td>
                      <td className="px-4 py-3">
                        {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                        {c.telefono && <p className="text-xs text-muted-foreground">{c.telefono}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: seg.color, background: seg.bg }}
                        >
                          {seg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {fmtDate(c.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedId(c.id)}
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
        )}
      </div>

      {/* Detalle modal */}
      {selectedId && (
        <ClienteDetalle
          customerId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}