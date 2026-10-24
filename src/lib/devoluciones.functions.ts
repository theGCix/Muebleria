// src/lib/devoluciones.functions.ts
// Devoluciones y notas de crédito de ventas del POS
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as browserClient } from "@/integrations/supabase/client";
import { getAuthenticatedClient } from "@/integrations/supabase/auth-middleware";

// Las tablas de devoluciones aún no están en types.ts (se regenera con el CLI de Supabase).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;
async function db(): Promise<Db> {
  const { supabase } = await getAuthenticatedClient();
  return supabase as unknown as Db;
}

const SERVER = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000";

// ── Tipos y etiquetas ──────────────────────────────────────
export type MotivoDev =
  | "producto_defectuoso" | "dano_en_transporte" | "no_conforme"
  | "arrepentimiento" | "error_de_pedido" | "otro";
export type MetodoReembolso = "efectivo" | "tarjeta" | "transferencia" | "yape_plin";
export type NcEstado = "no_aplica" | "pendiente" | "aceptado" | "rechazado" | "error";

export const MOTIVO_LABEL: Record<MotivoDev, string> = {
  producto_defectuoso: "Producto defectuoso",
  dano_en_transporte: "Daño en el transporte",
  no_conforme: "No es lo que pidió / no conforme",
  arrepentimiento: "Cambio de decisión del cliente",
  error_de_pedido: "Error en el pedido",
  otro: "Otro motivo",
};

export const REEMBOLSO_LABEL: Record<MetodoReembolso, string> = {
  efectivo: "Efectivo (sale de la caja)",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  yape_plin: "Yape / Plin",
};

export const NC_LABEL: Record<NcEstado, string> = {
  no_aplica: "Sin nota de crédito",
  pendiente: "NC pendiente de emitir",
  aceptado: "NC aceptada por SUNAT",
  rechazado: "NC rechazada",
  error: "Error al emitir NC",
};

export interface VentaBusqueda {
  id: string; numero: string; tipo: string; total: number; metodo_pago: string;
  created_at: string; cliente: string | null; doc: string | null; devuelto: number;
}

export interface VentaDetalle {
  id: string; numero: string; tipo: string; estado: string; total: number; metodo_pago: string;
  created_at: string; cliente: string | null; nubefact_estado: string | null;
  items: { id: string; title: string; sku: string | null; qty: number; unit_price: number; devuelto: number }[];
}

export interface Devolucion {
  id: string; numero: string; venta_numero: string | null; motivo: MotivoDev; detalle: string | null;
  metodo_reembolso: MetodoReembolso; total: number; estado: "registrada" | "anulada";
  nc_estado: NcEstado; nc_serie: string | null; nc_numero: number | null; nc_enlace: string | null;
  nc_error: string | null; anulado_motivo: string | null; created_at: string;
  devolucion_items: { title: string; qty: number; total: number }[];
}

// ── Consultas ──────────────────────────────────────────────
export async function buscarVentas(q: string): Promise<VentaBusqueda[]> {
  const c = await db();
  const { data, error } = await c.rpc("buscar_ventas_devolucion", { _q: q.trim() || null });
  if (error) throw new Error(error.message);
  return (data ?? []) as VentaBusqueda[];
}

export async function getVentaDevolucion(saleId: string): Promise<VentaDetalle> {
  const c = await db();
  const { data, error } = await c.rpc("get_venta_devolucion", { _sale_id: saleId });
  if (error) throw new Error(error.message);
  return data as VentaDetalle;
}

export async function listDevoluciones(f: { desde?: string; hasta?: string } = {}): Promise<Devolucion[]> {
  const c = await db();
  let q = c.from("devoluciones")
    .select(`id, numero, venta_numero, motivo, detalle, metodo_reembolso, total, estado, nc_estado, nc_serie,
             nc_numero, nc_enlace, nc_error, anulado_motivo, created_at, devolucion_items ( title, qty, total )`)
    .order("created_at", { ascending: false }).limit(500);
  if (f.desde) q = q.gte("created_at", f.desde);
  if (f.hasta) q = q.lt("created_at", f.hasta);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Devolucion[];
}

// ── Escritura ──────────────────────────────────────────────
const registrarSchema = z.object({
  sale_id: z.string().uuid(),
  items: z.array(z.object({ sale_item_id: z.string().uuid(), qty: z.number().positive() })).min(1, "Elige al menos un producto"),
  motivo: z.enum(["producto_defectuoso", "dano_en_transporte", "no_conforme", "arrepentimiento", "error_de_pedido", "otro"]),
  detalle: z.string().trim().max(300).optional(),
  metodo: z.enum(["efectivo", "tarjeta", "transferencia", "yape_plin"]),
});
export type RegistrarDevolucionInput = z.input<typeof registrarSchema>;

export async function registrarDevolucion(input: RegistrarDevolucionInput) {
  const v = registrarSchema.parse(input);
  const c = await db();
  const { data, error } = await c.rpc("registrar_devolucion", {
    _sale_id: v.sale_id, _items: v.items, _motivo: v.motivo, _detalle: v.detalle ?? null, _metodo: v.metodo,
  });
  if (error) throw new Error(error.message);
  return data as { id: string; numero: string; total: number; nc_estado: NcEstado; en_caja: boolean };
}

export async function anularDevolucion(input: { id: string; motivo: string }) {
  const v = z.object({ id: z.string().uuid(), motivo: z.string().trim().min(1, "Indica el motivo").max(200) }).parse(input);
  const c = await db();
  const { error } = await c.rpc("anular_devolucion", { _id: v.id, _motivo: v.motivo });
  if (error) throw new Error(error.message);
}

/** Emite la nota de crédito en Nubefact (el token vive solo en el servidor). */
export async function emitirNotaCredito(devolucionId: string): Promise<{
  aceptado: boolean; enlace_pdf: string | null; descripcion: string; serie: string; numero: number;
}> {
  const { data: { session } } = await browserClient.auth.getSession();
  if (!session?.access_token) throw new Error("No hay sesión activa");
  const res = await fetch(`${SERVER}/api/nubefact/nota-credito`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ devolucion_id: devolucionId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No se pudo emitir la nota de crédito");
  return data;
}

// ── Utilidades ─────────────────────────────────────────────
export function rangoMesLima(mes: string): { desde: string; hasta: string } {
  const [y, m] = mes.split("-").map(Number);
  const sig = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { desde: `${mes}-01T00:00:00-05:00`, hasta: `${sig}-01T00:00:00-05:00` };
}

export const mesActualLima = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima", year: "numeric", month: "2-digit" }).format(new Date());

export const fmtFechaCorta = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(iso));
