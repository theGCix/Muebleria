// src/components/admin/AgenciaProvinciaAdmin.tsx
// Admin → Pedidos (provincia): muestra la agencia que prefiere el cliente y, cuando el pedido está
// "En camino", registra la llegada a la agencia (agencia, dirección, guía, clave) y avisa por WhatsApp.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  destinoTexto, esPedidoProvincia, estaEnAgencia, linkWhatsAppCliente, type OrderEnvio,
} from "@/lib/envioPendiente";

export function AgenciaProvinciaAdmin({ order }: { order: OrderEnvio & { id: string } }) {
  const qc = useQueryClient();
  const [agencia, setAgencia] = useState(order.agencia_nombre ?? order.agencia_preferida ?? "");
  const [direccion, setDireccion] = useState(order.agencia_direccion ?? "");
  const [guia, setGuia] = useState(order.agencia_guia ?? "");
  const [clave, setClave] = useState(order.agencia_clave ?? "");
  const [guardando, setGuardando] = useState(false);
  if (!esPedidoProvincia(order)) return null;

  const enAgencia = estaEnAgencia(order);
  const enCamino = order.status === "enviado";
  const destino = destinoTexto(order);

  async function registrar() {
    if (!agencia.trim() || !guia.trim()) { toast.error("Indica la agencia y el número de guía"); return; }
    setGuardando(true);
    const { error } = await supabase.rpc("marcar_en_agencia" as any, {
      _order_id: order.id, _agencia: agencia, _direccion: direccion, _guia: guia, _clave: clave || null,
    });
    setGuardando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Llegada a agencia registrada. Avisa al cliente por WhatsApp.");
    qc.invalidateQueries({ queryKey: ["orders"] });
  }

  const aviso =
    `Hola ${order.nombre ?? ""}, tu pedido ${order.order_number} ya llegó a la agencia ${agencia}` +
    (direccion ? ` (${direccion})` : "") + ` en ${destino}. ` +
    `N.º de guía: ${guia}` + (clave ? ` · Clave de recojo: ${clave}` : "") + `. ` +
    `Lleva tu DNI para recogerlo` + (order.envio_modo_pago === "destino" ? " y paga el flete en la agencia." : ".") +
    ` Cualquier duda, respóndenos por aquí.`;
  const linkAviso = enAgencia ? linkWhatsAppCliente(order.telefono, aviso) : null;

  return (
    <section className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm">Agencia en {destino}</h3>
        {enAgencia && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">En agencia</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        Agencia elegida por el cliente: <strong>{order.agencia_preferida || "no indicó"}</strong>
      </p>

      {!enCamino && !enAgencia && (
        <p className="text-xs text-muted-foreground">Podrás registrar la llegada a la agencia cuando el pedido esté "En camino".</p>
      )}

      {enCamino && (
        <div className="grid sm:grid-cols-2 gap-2">
          <div><Label className="text-xs">Agencia *</Label><Input value={agencia} onChange={(e) => setAgencia(e.target.value)} className="h-9" maxLength={120} /></div>
          <div><Label className="text-xs">N.º de guía *</Label><Input value={guia} onChange={(e) => setGuia(e.target.value)} className="h-9" maxLength={60} /></div>
          <div><Label className="text-xs">Dirección de la agencia</Label><Input value={direccion} onChange={(e) => setDireccion(e.target.value)} className="h-9" maxLength={200} /></div>
          <div><Label className="text-xs">Clave de recojo (si aplica)</Label><Input value={clave} onChange={(e) => setClave(e.target.value)} className="h-9" maxLength={40} /></div>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={registrar} disabled={guardando}>{enAgencia ? "Actualizar datos" : "Registrar llegada a agencia"}</Button>
            {linkAviso && (
              <Button asChild size="sm" variant="outline">
                <a href={linkAviso} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5 mr-1.5" />Avisar al cliente por WhatsApp</a>
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
