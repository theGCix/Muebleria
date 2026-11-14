// src/components/admin/PagoEfectivoAdmin.tsx
// Pedidos con pago en EFECTIVO (Parte 8.4), en el detalle del pedido del panel:
//  · Recojo en tienda: el pedido llega «pendiente» y SIN stock reservado. «Confirmar pedido» reserva el stock
//    (confirmar_pedido_efectivo); el cobro se registra cuando el cliente paga en tienda (registrar_cobro_pedido).
//  · Delivery Lima (contra entrega): ya entró un adelanto online (el pedido nació «pagado»); el saldo se cobra al
//    entregar con «Registrar cobro».
// Las funciones de base de datos validan el rol (admin o vendedor) y que el cobro no pase del saldo.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface PedidoEfectivo {
  id: string;
  status: string;
  total: number | string;
  monto_pagado?: number | string | null;
  metodo_entrega?: string | null;
  confirmado_at?: string | null;
}

const pen = (n: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Saldo que falta cobrar de un pedido en efectivo (0 si está cancelado o ya cobrado). */
export function saldoPorCobrar(o: { status: string; total: number | string; monto_pagado?: number | string | null }) {
  if (o.status === "cancelado") return 0;
  return Math.max(0, r2(Number(o.total) - Number(o.monto_pagado ?? 0)));
}

export function PagoEfectivoAdmin({ order }: { order: PedidoEfectivo }) {
  const qc = useQueryClient();
  const total = Number(order.total);
  const pagado = Number(order.monto_pagado ?? 0);
  const saldo = saldoPorCobrar(order);
  const recojo = order.metodo_entrega === "recojo_tienda";
  const porConfirmar = order.status === "pendiente" && !order.confirmado_at;
  const [monto, setMonto] = useState(saldo.toFixed(2));

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["order-historial", order.id] });
    qc.invalidateQueries({ queryKey: ["order-items", order.id] });
  };

  // Las funciones son nuevas (migración 20261115): se llaman sin tipos generados.
  const confirmar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("confirmar_pedido_efectivo", { _order_id: order.id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { refrescar(); toast.success("Pedido confirmado: stock reservado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cobrar = useMutation({
    mutationFn: async (valor: number) => {
      const { error } = await (supabase as any).rpc("registrar_cobro_pedido", { _order_id: order.id, _monto: valor });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { refrescar(); toast.success("Cobro registrado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const valor = Number(monto);
  const montoValido = Number.isFinite(valor) && valor > 0 && valor <= saldo + 0.001;

  return (
    <section>
      <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
        <Banknote className="h-4 w-4" /> Pago en efectivo · {recojo ? "recojo en tienda" : "contra entrega (Lima)"}
      </h3>
      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <dl className="space-y-1">
          <div className="flex justify-between"><dt className="text-muted-foreground">Total del pedido</dt><dd className="tabular-nums">{pen(total)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">{recojo ? "Cobrado" : "Adelanto / cobrado"}</dt><dd className="tabular-nums">{pen(pagado)}</dd></div>
          <div className="flex justify-between font-semibold">
            <dt>Saldo por cobrar</dt>
            <dd className={`tabular-nums ${saldo > 0 ? "text-amber-700" : "text-emerald-700"}`}>{pen(saldo)}</dd>
          </div>
        </dl>

        {order.status === "cancelado" ? (
          <p className="text-xs text-muted-foreground">Pedido cancelado: no hay nada por cobrar.</p>
        ) : saldo <= 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Pedido cobrado por completo.</p>
        ) : (
          <>
            {porConfirmar && (
              <div className="space-y-2 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
                <p>Pedido por confirmar: <b>todavía no reserva stock</b> ni genera compras al proveedor. Confírmalo con el cliente y luego reserva.</p>
                <Button size="sm" className="gap-1.5" disabled={confirmar.isPending} onClick={() => confirmar.mutate()}>
                  {confirmar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirmar pedido y reservar stock
                </Button>
              </div>
            )}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                {recojo ? "Registra el cobro cuando el cliente pague en la tienda." : "Registra el cobro del saldo cuando entregues el pedido."}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number" inputMode="decimal" min="0.01" step="0.01" max={saldo}
                  value={monto} onChange={(e) => setMonto(e.target.value)}
                  className="h-10 max-w-[9rem]" aria-label="Monto cobrado"
                />
                <Button
                  size="sm" variant="outline" className="h-10 gap-1.5"
                  disabled={!montoValido || cobrar.isPending}
                  onClick={() => cobrar.mutate(valor)}
                >
                  {cobrar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Registrar cobro
                </Button>
              </div>
              {!montoValido && monto !== "" && <p className="text-xs text-destructive">El monto debe ser mayor a 0 y no pasar de {pen(saldo)}.</p>}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
