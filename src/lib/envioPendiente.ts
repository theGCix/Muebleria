// src/lib/envioPendiente.ts
// Helpers del flete a provincias: estados, enlaces de WhatsApp y regla de despacho.
import { WHATSAPP_NUMBER } from "@/config";

export type EnvioEstado = "confirmado" | "por_confirmar" | "por_cotizar" | "cotizado" | "aceptado" | "pagado";

export interface OrderEnvio {
  order_number: string;
  nombre?: string | null;
  telefono?: string | null;
  metodo_entrega?: string | null;
  departamento?: string | null;
  provincia?: string | null;
  zona_envio?: string | null;
  volumen_total_m3?: number | null;
  envio_estado?: EnvioEstado | null;
  envio_final?: number | null;
  envio_modo_pago?: "transferencia" | "destino" | null;
  envio_estimado_min?: number | null;
  envio_estimado_max?: number | null;
  status?: string | null;
  agencia_preferida?: string | null;
  agencia_nombre?: string | null;
  agencia_direccion?: string | null;
  agencia_guia?: string | null;
  agencia_clave?: string | null;
  agencia_llegada_at?: string | null;
}

/** Pedido a provincia que ya llegó a la agencia (status 'enviado' + llegada registrada). */
export const estaEnAgencia = (o: OrderEnvio) =>
  esPedidoProvincia(o) && o.status === "enviado" && !!o.agencia_llegada_at;

/** Agencias sugeridas al cliente; puede escribir otra. */
export const AGENCIAS_SUGERIDAS = ["Olva Courier", "Shalom", "Marvisur", "Cruz del Sur Cargo", "Otra"];

/** Pedido con entrega a domicilio fuera de Lima/Callao (el único que usa esta lógica). */
export const esPedidoProvincia = (o: OrderEnvio) =>
  !!o.provincia && (o.metodo_entrega ?? "domicilio") === "domicilio";

/** Regla de despacho (la misma que impone el trigger de la base de datos). */
export const fleteListoParaDespacho = (o: OrderEnvio) =>
  !esPedidoProvincia(o) ||
  o.envio_estado === "pagado" ||
  (o.envio_estado === "aceptado" && o.envio_modo_pago === "destino");

export const ETIQUETA_ESTADO: Record<EnvioEstado, string> = {
  confirmado: "Confirmado",
  por_confirmar: "Por confirmar",
  por_cotizar: "Por cotizar",
  cotizado: "Esperando tu aceptación",
  aceptado: "Aceptado",
  pagado: "Flete pagado",
};

/** WhatsApp de ventas (número configurado en VITE_WHATSAPP_NUMBER). null si no está configurado. */
export function linkWhatsAppVentas(texto: string): string | null {
  return WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}` : null;
}

/** WhatsApp al cliente (Perú +51). */
export function linkWhatsAppCliente(telefono: string | null | undefined, texto: string): string | null {
  if (!telefono) return null;
  let n = telefono.replace(/\D/g, "");
  if (n.length === 9) n = "51" + n;
  if (n.length < 10) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

export const destinoTexto = (o: OrderEnvio) => [o.provincia, o.departamento].filter(Boolean).join(", ");
