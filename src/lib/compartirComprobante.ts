// src/lib/compartirComprobante.ts
// Mensaje y enlaces para compartir una boleta/factura por WhatsApp o correo.
// Funciones puras (sin window): usan SOLO los datos del comprobante que ya cargó el panel (RLS ya filtró quién lo ve).
// No se crea ningún enlace público propio: el único enlace que se incluye es el de Nubefact, y solo si SUNAT ya aceptó el comprobante.
import { format } from "date-fns";

export const EMISOR_NOMBRE = "G&M Mueblería";

const TIPO_TEXTO: Record<string, string> = {
  boleta: "boleta de venta electrónica",
  factura: "factura electrónica",
  nota: "nota de crédito electrónica",
};

export interface ComprobanteCompartible {
  numero: string;
  tipo: string;
  created_at: string;
  total: number | string;
  estado?: string | null;
  nubefact_estado?: string | null;
  nubefact_enlace?: string | null;
  customers?: { nombre?: string | null; telefono?: string | null; email?: string | null } | null;
}

export interface MensajeComprobante {
  asunto: string;
  texto: string;
  /** Teléfono ya normalizado (solo dígitos, con código de país) o null si no es válido. */
  telefono: string | null;
  email: string | null;
  /** Enlace oficial de Nubefact incluido en el texto, si corresponde. */
  enlace: string | null;
}

/** Solo se comparte el enlace de Nubefact de un comprobante aceptado por SUNAT y no anulado; debe ser https. */
export function enlaceCompartible(c: ComprobanteCompartible): string | null {
  const anulado = c.estado === "anulada" || c.nubefact_estado === "anulado";
  if (anulado || c.nubefact_estado !== "aceptado" || !c.nubefact_enlace) return null;
  try {
    const u = new URL(c.nubefact_enlace);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Teléfono peruano de 9 dígitos (9…) o con 51; con «+» acepta otros países. Devuelve solo dígitos o null. */
export function normalizarTelefono(t: string | null | undefined): string | null {
  if (!t) return null;
  const crudo = t.trim();
  const digitos = crudo.replace(/\D/g, "").replace(/^00/, "");
  if (crudo.startsWith("+") && !digitos.startsWith("51")) {
    return digitos.length >= 8 && digitos.length <= 15 ? digitos : null;
  }
  if (digitos.length === 9 && digitos.startsWith("9")) return "51" + digitos;
  if (digitos.length === 11 && digitos.startsWith("519")) return digitos;
  return null;
}

export const emailValido = (e: string | null | undefined) =>
  !!e && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export function armarMensajeComprobante(c: ComprobanteCompartible): MensajeComprobante {
  const tipo = TIPO_TEXTO[c.tipo] ?? "comprobante";
  const total = Number(c.total);
  const anulado = c.estado === "anulada" || c.nubefact_estado === "anulado";
  const nombre = (c.customers?.nombre ?? "").trim();
  const saludo = nombre && !/^consumidor final$/i.test(nombre) ? `Hola ${nombre},` : "Hola,";
  const enlace = enlaceCompartible(c);

  const lineas = [
    `${saludo} te compartimos tu ${tipo} *${c.numero}* de ${EMISOR_NOMBRE}.`,
    `Fecha: ${format(new Date(c.created_at), "dd/MM/yyyy")}`,
    `Total: S/ ${Number.isFinite(total) ? total.toFixed(2) : "0.00"}`,
  ];
  if (anulado) lineas.push("Estado: ANULADO");
  if (enlace) lineas.push(`Consulta o descarga tu comprobante aquí: ${enlace}`);
  lineas.push("¡Gracias por tu compra!");

  return {
    asunto: `${c.tipo === "factura" ? "Factura" : c.tipo === "nota" ? "Nota de crédito" : "Boleta"} ${c.numero} — ${EMISOR_NOMBRE}`,
    texto: lineas.join("\n"),
    telefono: normalizarTelefono(c.customers?.telefono),
    email: emailValido(c.customers?.email) ? c.customers!.email!.trim() : null,
    enlace,
  };
}

export const urlWhatsApp = (telefono: string, texto: string) =>
  `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`;

export const urlCorreo = (email: string, asunto: string, texto: string) =>
  `mailto:${email.trim()}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto.replace(/\*/g, "") + `\n\nSaludos,\n${EMISOR_NOMBRE}`)}`;
