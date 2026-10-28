// src/components/admin/FleteProvinciaAdmin.tsx
// Admin → Pedidos: cotizar el flete a provincias, avisar al cliente por WhatsApp y marcar el pago.
// El despacho ('enviado'/'entregado') queda bloqueado por un trigger en la BD hasta que el flete
// esté pagado, o aceptado con pago en destino.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { PAGO_FLETE_TEXTO } from "@/config";
import {
  destinoTexto, esPedidoProvincia, fleteListoParaDespacho, linkWhatsAppCliente, type OrderEnvio,
} from "@/lib/envioPendiente";

const fmt = (n: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

const ESTADOS: Record<string, string> = {
  por_confirmar: "Por confirmar", por_cotizar: "Por cotizar (sin estimado)", cotizado: "Cotizado — esperando que el cliente acepte",
  aceptado: "Aceptado por el cliente", pagado: "Flete pagado", confirmado: "Confirmado",
};

export function FleteProvinciaAdmin({ order }: { order: OrderEnvio & { id: string } }) {
  const qc = useQueryClient();
  const [monto, setMonto] = useState<string>(
    order.envio_final != null ? String(order.envio_final)
      : order.envio_estimado_min != null && order.envio_estimado_max != null
        ? String(Math.round((Number(order.envio_estimado_min) + Number(order.envio_estimado_max)) / 2 / 10) * 10)
        : "",
  );
  const [modo, setModo] = useState<"transferencia" | "destino">(order.envio_modo_pago ?? "destino");
  const [guardando, setGuardando] = useState(false);
  if (!esPedidoProvincia(order)) return null;

  const estado = order.envio_estado ?? "por_confirmar";
  const destino = destinoTexto(order);
  const listo = fleteListoParaDespacho(order);
  const valor = parseFloat(monto);
  const fueraDeRango =
    order.envio_estimado_min != null && order.envio_estimado_max != null && valor > 0 &&
    (valor < Number(order.envio_estimado_min) * 0.5 || valor > Number(order.envio_estimado_max) * 1.5);

  async function actualizar(cambios: Record<string, unknown>, ok: string) {
    setGuardando(true);
    const { error } = await (supabase.from("orders") as any).update(cambios).eq("id", order.id);
    setGuardando(false);
    if (error) { toast.error(error.message); return false; }
    toast.success(ok);
    qc.invalidateQueries({ queryKey: ["orders"] });
    return true;
  }

  async function cotizar() {
    if (!(valor > 0)) { toast.error("Ingresa un monto de flete mayor a 0"); return; }
    if (fueraDeRango && !window.confirm("El monto está muy lejos del estimado. ¿Seguro que es correcto?")) return;
    await actualizar({
      envio_final: valor, envio_modo_pago: modo, envio_estado: "cotizado",
      envio_cotizado_at: new Date().toISOString(), envio_aceptado_at: null,
    }, "Cotización guardada. Avisa al cliente por WhatsApp.");
  }

  async function marcarPagado() {
    if (!window.confirm("¿Confirmas que YA verificaste el depósito del flete en tu cuenta/Yape?")) return;
    await actualizar({ envio_estado: "pagado", envio_pagado_at: new Date().toISOString() }, "Flete marcado como pagado");
  }

  const textoAviso =
    `Hola ${order.nombre ?? ""}, te escribimos de G&M Mueblería por tu pedido ${order.order_number} a ${destino}. ` +
    `El flete es de ${fmt(Number.isFinite(valor) ? valor : 0)} ` +
    (modo === "destino" ? "y se paga en la agencia al recibir tu pedido. " : "y se paga por transferencia/Yape antes del despacho. ") +
    `Entra a Mis pedidos en nuestra web para aceptarlo` +
    (modo === "transferencia" && PAGO_FLETE_TEXTO ? " y ver los datos de pago oficiales." : ".") +
    ` Si tienes dudas, respóndenos por aquí.`;
  const linkAviso = linkWhatsAppCliente(order.telefono, textoAviso);
  const bloqueado = estado === "pagado" || (estado === "aceptado" && modo === "destino" && order.envio_modo_pago === "destino");

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm">Flete a provincia — {destino}{order.zona_envio ? ` (zona ${order.zona_envio})` : ""}</h3>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${listo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {listo ? "Listo para despachar" : "NO despachar aún"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Estado: <strong>{ESTADOS[estado] ?? estado}</strong>
        {order.volumen_total_m3 ? ` · ${order.volumen_total_m3} m³` : " · sin volumen registrado"}
        {order.envio_estimado_min != null && ` · estimado ${fmt(Number(order.envio_estimado_min))}–${fmt(Number(order.envio_estimado_max))}`}
        {" "}(el estimado es referencial: cotiza con el transportista)
      </p>

      {!bloqueado && estado !== "pagado" && (
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div>
            <Label htmlFor={`flete-${order.id}`} className="text-xs">Flete final acordado (S/)</Label>
            <Input id={`flete-${order.id}`} type="number" min="0" step="1" value={monto} onChange={(e) => setMonto(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">¿Cómo lo paga el cliente?</Label>
            <select value={modo} onChange={(e) => setModo(e.target.value as any)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="destino">Por pagar en la agencia (destino)</option>
              <option value="transferencia">Transferencia / Yape antes de despachar</option>
            </select>
          </div>
          <Button size="sm" onClick={cotizar} disabled={guardando}>{estado === "cotizado" || estado === "aceptado" ? "Actualizar cotización" : "Guardar cotización"}</Button>
        </div>
      )}
      {fueraDeRango && <p className="text-xs text-amber-700">⚠ El monto se aleja mucho del estimado: revisa que sea correcto.</p>}
      {modo === "transferencia" && !PAGO_FLETE_TEXTO && (
        <p className="text-xs text-amber-700">⚠ Falta definir VITE_PAGO_FLETE_TEXTO: el cliente no verá tus datos de pago oficiales.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {(estado === "cotizado" || estado === "aceptado") && linkAviso && (
          <Button asChild size="sm" variant="outline">
            <a href={linkAviso} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5 mr-1.5" />Avisar al cliente por WhatsApp</a>
          </Button>
        )}
        {estado === "aceptado" && order.envio_modo_pago === "transferencia" && (
          <Button size="sm" onClick={marcarPagado} disabled={guardando}>Marcar flete como pagado</Button>
        )}
      </div>
    </section>
  );
}
