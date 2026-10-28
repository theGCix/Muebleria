// src/components/FleteProvincia.tsx
// "Mis pedidos": estado del flete a provincias y acciones del cliente (aceptar, pagar, consultar por WhatsApp).
// Seguridad: el cliente solo puede aceptar la cotización de SU pedido (función SQL aceptar_flete_provincia);
// los datos de pago salen únicamente de la configuración oficial, nunca de un chat.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PAGO_FLETE_TEXTO } from "@/config";
import {
  destinoTexto, esPedidoProvincia, linkWhatsAppVentas, type OrderEnvio,
} from "@/lib/envioPendiente";

const fmt = (n: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

function BotonWhatsApp({ texto, children, variante = "outline" }: { texto: string; children: React.ReactNode; variante?: "outline" | "default" }) {
  const href = linkWhatsAppVentas(texto);
  if (!href) return null;
  return (
    <Button asChild size="sm" variant={variante} className="rounded-full">
      <a href={href} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5 mr-1.5" />{children}</a>
    </Button>
  );
}

export function FleteProvincia({ order }: { order: OrderEnvio & { id: string } }) {
  const qc = useQueryClient();
  const [aceptando, setAceptando] = useState(false);
  if (!esPedidoProvincia(order)) return null;

  const estado = order.envio_estado ?? "por_confirmar";
  const destino = destinoTexto(order);
  const pedido = order.order_number;
  const monto = order.envio_final != null ? Number(order.envio_final) : null;

  async function aceptar() {
    if (monto == null) return;
    const ok = window.confirm(
      `Vas a aceptar un flete de ${fmt(monto)} para tu pedido ${pedido} (${destino}).\n\n` +
      (order.envio_modo_pago === "destino"
        ? "Lo pagarás en la agencia al recibir tu pedido."
        : "Después te mostraremos cómo pagarlo. Tu pedido no se despacha hasta que el flete esté pagado."),
    );
    if (!ok) return;
    setAceptando(true);
    const { error } = await supabase.rpc("aceptar_flete_provincia" as any, { _order_id: order.id });
    setAceptando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Flete aceptado");
    qc.invalidateQueries({ queryKey: ["mis-pedidos"] });
  }

  const caja = "mx-5 mb-4 rounded-xl border p-4 text-sm space-y-2";

  if (estado === "por_confirmar" || estado === "por_cotizar") {
    const rango = order.envio_estimado_min != null && order.envio_estimado_max != null
      ? `${fmt(Number(order.envio_estimado_min))} – ${fmt(Number(order.envio_estimado_max))}`
      : null;
    return (
      <div className={`${caja} border-amber-200 bg-amber-50 text-amber-950`}>
        <p className="font-semibold flex items-center gap-1.5"><Truck className="h-4 w-4" />Tu envío a {destino} está por confirmar</p>
        <p className="text-xs">
          Tus muebles ya están pagados. El flete {rango ? <>estimado es <strong>{rango}</strong>, pero </> : ""}
          lo fijamos contigo antes de despachar. <strong>No se te cobra nada más hasta que lo aceptes.</strong>
        </p>
        <BotonWhatsApp variante="default" texto={`Hola G&M, soy ${order.nombre ?? "cliente"}. Mi pedido ${pedido} va a ${destino}${order.volumen_total_m3 ? ` (${order.volumen_total_m3} m³)` : ""}. Quiero confirmar el costo del envío.`}>
          Confirmar mi envío por WhatsApp
        </BotonWhatsApp>
      </div>
    );
  }

  if (estado === "cotizado" && monto != null) {
    return (
      <div className={`${caja} border-blue-200 bg-blue-50 text-blue-950`}>
        <p className="font-semibold flex items-center gap-1.5"><Truck className="h-4 w-4" />Flete a {destino}: {fmt(monto)}</p>
        <p className="text-xs">
          {order.envio_modo_pago === "destino"
            ? "Se paga en la agencia al recibir tu pedido (no pagas nada por adelantado)."
            : "Se paga por transferencia/Yape antes del despacho. Te mostramos los datos al aceptar."}
          {" "}Si el monto no te convence, no lo aceptes y escríbenos.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="rounded-full" onClick={aceptar} disabled={aceptando}>
            {aceptando ? "Aceptando…" : `Aceptar flete de ${fmt(monto)}`}
          </Button>
          <BotonWhatsApp texto={`Hola G&M, tengo una consulta sobre el flete de mi pedido ${pedido} (${destino}).`}>Tengo dudas</BotonWhatsApp>
        </div>
      </div>
    );
  }

  if (estado === "aceptado" && monto != null) {
    if (order.envio_modo_pago === "destino") {
      return (
        <div className={`${caja} border-green-200 bg-green-50 text-green-950`}>
          <p className="font-semibold flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />Flete aceptado: {fmt(monto)} a pagar en destino</p>
          <p className="text-xs">Lo pagas directamente en la agencia al recoger tu pedido. Te avisaremos cuando salga.</p>
        </div>
      );
    }
    return (
      <div className={`${caja} border-blue-200 bg-blue-50 text-blue-950`}>
        <p className="font-semibold flex items-center gap-1.5"><Truck className="h-4 w-4" />Falta pagar tu flete: {fmt(monto)}</p>
        {PAGO_FLETE_TEXTO ? (
          <p className="text-xs rounded-lg bg-white/70 p-2 font-medium">{PAGO_FLETE_TEXTO}</p>
        ) : (
          <p className="text-xs">Escríbenos por WhatsApp y te indicamos los datos de pago.</p>
        )}
        <p className="text-xs flex items-start gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Paga solo a los datos que aparecen aquí, a nombre de G&amp;M. Nunca te pediremos claves ni datos de tu tarjeta.
        </p>
        <BotonWhatsApp variante="default" texto={`Hola G&M, ya pagué el flete de ${fmt(monto)} de mi pedido ${pedido}. Te envío mi comprobante.`}>
          Ya pagué: enviar comprobante
        </BotonWhatsApp>
      </div>
    );
  }

  if (estado === "pagado") {
    return (
      <div className={`${caja} border-green-200 bg-green-50 text-green-950`}>
        <p className="font-semibold flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />Flete pagado{monto != null ? `: ${fmt(monto)}` : ""}</p>
        <p className="text-xs">Tu pedido a {destino} podrá despacharse en cuanto esté listo. Te avisaremos.</p>
      </div>
    );
  }
  return null;
}
