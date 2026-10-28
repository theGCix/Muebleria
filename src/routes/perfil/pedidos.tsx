// src/routes/perfil/pedidos.tsx
// G&M Mueblería — Mis pedidos (historial y seguimiento)
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag, Package, Truck, CheckCircle2,
  Clock, XCircle, ChevronDown, ChevronUp, Receipt, Store, Star, Camera, Check,
} from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { PagoExitoso, type PagoExitosoDatos } from "@/components/checkout/PagoExitoso";

export const Route = createFileRoute("/perfil/pedidos")({
  head: () => ({ meta: [{ title: "Mis pedidos — G&M Mueblería" }] }),
  component: PedidosPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit", month: "long", year: "numeric",
  }).format(new Date(d));
};

const fmtDateTime = (d: string | null) => {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
};

type OrderStatus =
  | "pendiente" | "pagado" | "en_produccion"
  | "control_calidad" | "listo_despacho"
  | "enviado" | "entregado" | "cancelado";

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pendiente:       { label: "Pendiente",       icon: Clock,        color: "#92400e", bg: "#fef3c7" },
  pagado:          { label: "Pago recibido",   icon: CheckCircle2, color: "#065f46", bg: "#d1fae5" },
  en_produccion:   { label: "En producción",   icon: Package,      color: "#1e40af", bg: "#dbeafe" },
  control_calidad: { label: "Control calidad", icon: Package,      color: "#5b21b6", bg: "#ede9fe" },
  listo_despacho:  { label: "Listo despacho",  icon: Truck,        color: "#0e7490", bg: "#cffafe" },
  enviado:         { label: "En camino",        icon: Truck,        color: "#6d28d9", bg: "#ede9fe" },
  entregado:       { label: "Entregado",        icon: CheckCircle2, color: "#14532d", bg: "#dcfce7" },
  cancelado:       { label: "Cancelado",        icon: XCircle,     color: "#7f1d1d", bg: "#fee2e2" },
};

const STATUS_STEPS: OrderStatus[] = [
  "pagado", "en_produccion", "control_calidad", "listo_despacho", "enviado", "entregado"
];

// Con recojo en tienda no hay despacho: se quita "En camino" y se renombran los últimos pasos
const stepLabel = (step: OrderStatus, recojo: boolean) =>
  recojo && step === "listo_despacho" ? "Listo para recoger"
  : recojo && step === "entregado" ? "Recogido"
  : STATUS_CONFIG[step].label;

// ── Fetch pedidos del usuario ─────────────────────────────────
async function fetchMisPedidos(userId: string) {
  const { data, error } = await supabase
    .from("orders" as any)
    .select(`
      id, order_number, nombre, email, telefono, dni,
      direccion, distrito, ciudad, notas,
      subtotal, envio, total, currency, status, metodo_entrega,
      paid_at, estimated_delivery, created_at
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchItemsDePedido(orderId: string) {
  const { data, error } = await supabase
    .from("order_items" as any)
    .select("id, sku, title, qty, unit_price, total, image_url")
    .eq("order_id", orderId);

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Componente de un pedido ───────────────────────────────────
function PedidoCard({ order }: { order: any }) {
  const [open, setOpen] = useState(false);
  const [verComprobante, setVerComprobante] = useState(false);
  const recojo = order.metodo_entrega === "recojo_tienda";
  const pagado = order.status !== "pendiente" && order.status !== "cancelado";
  const cfg = STATUS_CONFIG[order.status as OrderStatus] ?? STATUS_CONFIG.pendiente;
  const Icon = cfg.icon;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["order-items-perfil", order.id],
    queryFn:  () => fetchItemsDePedido(order.id),
    enabled:  open || verComprobante,
  });

  // Pedido entregado: ¿ya envió su reseña y/o sus fotos?
  const { data: opinion } = useQuery({
    queryKey: ["opinion-pedido", order.id],
    enabled: order.status === "entregado" && !!order.email,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const [pend, conf] = await Promise.all([
        supabase.rpc("get_items_pendientes_resena" as never, { _order_id: order.id, _email: order.email } as never),
        supabase.rpc("get_pedido_conformidad" as never, { _order_id: order.id, _email: order.email } as never),
      ]);
      return {
        // Sin error y sin productos pendientes = ya reseñó todo. Si falla la consulta, mostramos los botones.
        resenaEnviada: !pend.error && ((pend.data ?? []) as unknown[]).length === 0,
        fotosEnviadas: !conf.error && (((conf.data ?? []) as { envios_previos: number }[])[0]?.envios_previos ?? 0) > 0,
      };
    },
  });

  const pasos = recojo ? STATUS_STEPS.filter((st) => st !== "enviado") : STATUS_STEPS;
  const statusEfectivo = (recojo && order.status === "enviado" ? "listo_despacho" : order.status) as OrderStatus;
  const stepIndex = pasos.indexOf(statusEfectivo);

  // Mismos datos que vio el cliente en la pantalla de "Pago aprobado"
  const datosComprobante: PagoExitosoDatos = {
    purchase:      order.order_number,
    date:          new Date(order.paid_at ?? order.created_at).toLocaleString("es-PE"),
    amount:        Number(order.total).toFixed(2),
    currency:      order.currency ?? "PEN",
    nombre:        order.nombre,
    email:         order.email,
    direccion:     order.direccion,
    distrito:      order.distrito,
    metodoEntrega: recojo ? "recojo_tienda" : "domicilio",
    estado:        order.status,
    subtotal:      Number(order.subtotal),
    envio:         Number(order.envio),
    items: items.map((it: any) => ({
      id: it.id, title: it.title, image: it.image_url ?? null, qty: it.qty, price: Number(it.unit_price),
    })),
  };

  return (
    <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
      {/* Header del pedido */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left p-5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-sm font-semibold">{order.order_number}</span>
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{ color: cfg.color, background: cfg.bg }}
              >
                <Icon className="h-3 w-3" />
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Comprado el {fmtDateTime(order.paid_at ?? order.created_at)}
            </p>
            {order.estimated_delivery && (
              <p className="text-xs text-muted-foreground">
                Entrega estimada: <span className="font-medium text-foreground">{fmtDate(order.estimated_delivery)}</span>
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-display font-semibold text-lg">{fmt(Number(order.total))}</p>
            <p className="text-xs text-muted-foreground">{order.currency}</p>
          </div>
          <div className="self-center text-muted-foreground">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {/* Barra de progreso */}
        {order.status !== "cancelado" && order.status !== "pendiente" && (
          <div className="mt-4">
            <div className="flex items-center gap-0">
              {pasos.map((step, i) => {
                const done   = i <= stepIndex;
                const active = i === stepIndex;
                return (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        background: done ? "#1a2e5a" : "#e5e7eb",
                        boxShadow:  active ? "0 0 0 3px #dbeafe" : "none",
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" style={{ color: done ? "white" : "#9ca3af" }} />
                    </div>
                    {i < pasos.length - 1 && (
                      <div
                        className="h-0.5 flex-1 mx-1 transition-all"
                        style={{ background: i < stepIndex ? "#1a2e5a" : "#e5e7eb" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              {pasos.map((step) => (
                <p key={step} className="text-[10px] text-muted-foreground text-center" style={{ flex: step === "entregado" ? "none" : 1 }}>
                  {stepLabel(step, recojo)}
                </p>
              ))}
            </div>
          </div>
        )}
      </button>

      {/* Comprobante de pago: reabre la pantalla de "Pago aprobado" */}
      {pagado && (
        <div className="flex justify-end px-5 pb-4">
          <button
            type="button"
            onClick={() => setVerComprobante(true)}
            disabled={verComprobante && isLoading}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60"
          >
            <Receipt className="h-3.5 w-3.5" />
            {verComprobante && isLoading ? "Abriendo…" : "Ver comprobante de pago"}
          </button>
        </div>
      )}
      {verComprobante && !isLoading && createPortal(
        <PagoExitoso modo="comprobante" datos={datosComprobante} onCerrar={() => setVerComprobante(false)} />,
        document.body,
      )}

      {/* Pedido entregado: invitar a reseñar y subir fotos */}
      {order.status === "entregado" && (
        <div className="mx-5 mb-4 rounded-xl border border-border bg-secondary/40 p-4">
          <p className="text-sm font-medium">
            {opinion?.resenaEnviada ? "¡Gracias por contarnos tu experiencia!" : "¿Qué tal tu mueble?"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {opinion?.resenaEnviada
              ? "Revisamos cada opinión antes de publicarla en la tienda."
              : "Cuéntanos qué te pareció y, si quieres, muéstranos cómo quedó en tu casa."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {opinion?.resenaEnviada ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-800">
                <Check className="h-3.5 w-3.5" /> Tu reseña ya fue enviada
              </span>
            ) : (
              <Link
                to="/resena/$orderId"
                params={{ orderId: order.id }}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Star className="h-3.5 w-3.5" /> Calificar mi compra
              </Link>
            )}
            {opinion?.fotosEnviadas ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-800">
                <Check className="h-3.5 w-3.5" /> Tus fotos ya fueron enviadas
              </span>
            ) : (
              <Link
                to="/conformidad/$orderId"
                params={{ orderId: order.id }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-xs font-medium transition-colors hover:bg-muted"
              >
                <Camera className="h-3.5 w-3.5" /> Subir fotos
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Detalle expandible */}
      {open && (
        <div className="border-t border-border/50 p-5 space-y-5">
          {/* Productos */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Productos</h4>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item: any) => (
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
                      {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                      <p className="text-xs text-muted-foreground">
                        {fmt(Number(item.unit_price))} × {item.qty}
                      </p>
                    </div>
                    <span className="font-semibold text-sm flex-shrink-0">{fmt(Number(item.total))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totales */}
          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span>{fmt(Number(order.subtotal))}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{recojo ? "Recojo en tienda" : "Envío"}</span>
              <span>{Number(order.envio) === 0 ? "Gratis" : fmt(Number(order.envio))}</span>
            </div>
            <div className="flex justify-between font-semibold text-base pt-1 border-t">
              <span>Total</span>
              <span className="font-display">{fmt(Number(order.total))}</span>
            </div>
          </div>

          {/* Datos de entrega */}
          <div className="border-t pt-3">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">{recojo && <Store className="h-3.5 w-3.5" />}{recojo ? "Datos del recojo (en tienda)" : "Datos de entrega"}</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm bg-muted/30 rounded-lg p-3">
              {[
                ["Nombre",    order.nombre],
                ["Email",     order.email],
                ["Teléfono",  order.telefono],
                ["DNI/RUC",   order.dni],
                ...(recojo ? [] : [
                  ["Dirección", order.direccion],
                  ["Distrito",  order.distrito],
                  ["Ciudad",    order.ciudad],
                ]),
              ].map(([label, value]) => value ? (
                <div key={label}>
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <p className="font-medium text-xs">{value}</p>
                </div>
              ) : null)}
              {order.notas && (
                <div className="col-span-2">
                  <span className="text-xs text-muted-foreground">Notas</span>
                  <p className="font-medium text-xs">{order.notas}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────
function PedidosPage() {
  const { user } = useAuth();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["mis-pedidos", user?.id],
    queryFn:  () => fetchMisPedidos(user!.id),
    enabled:  !!user,
  });

  return (
    <section>
      <h2 className="font-display text-xl font-semibold mb-4">Mis pedidos</h2>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground bg-muted/20 rounded-xl">
          <ShoppingBag className="h-10 w-10" />
          <p className="text-sm">Aún no tienes pedidos</p>
          <Button asChild size="sm" variant="outline">
            <Link to="/">Ver productos</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => (
            <PedidoCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </section>
  );
}