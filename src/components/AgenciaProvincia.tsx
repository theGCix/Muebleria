// src/components/AgenciaProvincia.tsx
// "Mis pedidos" (provincia): el cliente elige su agencia de confianza y, cuando el pedido llega,
// ve agencia, dirección, guía y clave de recojo. La elección pasa por la función SQL
// elegir_agencia_cliente (el cliente no tiene permiso de UPDATE sobre orders).
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  AGENCIAS_SUGERIDAS, destinoTexto, esPedidoProvincia, estaEnAgencia, type OrderEnvio,
} from "@/lib/envioPendiente";

const fmtDia = (d: string) =>
  new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "long" }).format(new Date(d));

export function AgenciaProvincia({ order }: { order: OrderEnvio & { id: string } }) {
  const qc = useQueryClient();
  const actual = order.agencia_preferida ?? "";
  const esSugerida = AGENCIAS_SUGERIDAS.slice(0, -1).includes(actual);
  const [sel, setSel] = useState<string>(actual ? (esSugerida ? actual : "Otra") : "");
  const [otra, setOtra] = useState<string>(actual && !esSugerida ? actual : "");
  const [guardando, setGuardando] = useState(false);
  if (!esPedidoProvincia(order)) return null;

  const caja = "mx-5 mb-4 rounded-xl border p-4 text-sm space-y-2";
  const destino = destinoTexto(order);

  // Ya llegó a la agencia: datos de recojo
  if (estaEnAgencia(order)) {
    return (
      <div className={`${caja} border-violet-200 bg-violet-50 text-violet-950`}>
        <p className="font-semibold flex items-center gap-1.5"><Store className="h-4 w-4" />Tu pedido ya está en la agencia</p>
        <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="font-medium">Agencia</dt><dd>{order.agencia_nombre}</dd>
          {order.agencia_direccion && (<><dt className="font-medium">Dirección</dt><dd>{order.agencia_direccion}</dd></>)}
          <dt className="font-medium">N.º de guía</dt><dd className="font-mono">{order.agencia_guia}</dd>
          {order.agencia_clave && (<><dt className="font-medium">Clave de recojo</dt><dd className="font-mono">{order.agencia_clave}</dd></>)}
          <dt className="font-medium">Llegó el</dt><dd>{fmtDia(order.agencia_llegada_at!)}</dd>
        </dl>
        <p className="text-xs">
          Lleva tu DNI para recogerlo{order.envio_modo_pago === "destino" ? " y paga el flete en la agencia" : ""}.
          Las agencias suelen guardar la carga pocos días: no tardes en recogerla.
        </p>
      </div>
    );
  }

  // Aún no sale: puede elegir su agencia. Si ya salió (o llegó), solo se muestra.
  const puedeElegir = !["enviado", "entregado", "cancelado"].includes(order.status ?? "");
  if (!puedeElegir) {
    return actual ? (
      <div className={`${caja} border-border bg-secondary/40`}>
        <p className="text-xs flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Agencia elegida: <strong>{actual}</strong></p>
      </div>
    ) : null;
  }

  const valor = sel === "Otra" ? otra.trim() : sel;
  const sinCambios = valor === actual;

  async function guardar() {
    if (!valor) { toast.error("Elige o escribe tu agencia"); return; }
    setGuardando(true);
    const { error } = await supabase.rpc("elegir_agencia_cliente" as any, { _order_id: order.id, _agencia: valor });
    setGuardando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Agencia guardada");
    qc.invalidateQueries({ queryKey: ["mis-pedidos"] });
  }

  return (
    <div className={`${caja} border-border bg-secondary/40`}>
      <p className="font-semibold flex items-center gap-1.5"><MapPin className="h-4 w-4" />¿Con qué agencia prefieres recibirlo en {destino}?</p>
      <p className="text-xs text-muted-foreground">
        Elige la de tu confianza. Haremos lo posible por despachar con ella; si no tiene cobertura te avisaremos.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Selecciona…</option>
          {AGENCIAS_SUGERIDAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {sel === "Otra" && (
          <Input value={otra} onChange={(e) => setOtra(e.target.value)} maxLength={120} placeholder="Nombre de la agencia (y sucursal)" className="h-9 w-64" />
        )}
        <Button size="sm" className="rounded-full" onClick={guardar} disabled={guardando || sinCambios || !valor}>
          {guardando ? "Guardando…" : actual ? "Cambiar" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
