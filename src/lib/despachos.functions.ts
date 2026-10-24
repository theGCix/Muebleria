// src/lib/despachos.functions.ts
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedClient } from "@/integrations/supabase/auth-middleware";

// La tabla `entregas` aún no está en types.ts (se regenera con el CLI de Supabase).
// Hasta entonces se accede con un cliente sin tipar, solo dentro de este archivo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;
async function db(): Promise<{ db: Db; userId: string }> {
  const { supabase, userId } = await getAuthenticatedClient();
  return { db: supabase as unknown as Db, userId };
}

// ── Tipos ──────────────────────────────────────────────────
export type DespachoEstado = "programado" | "en_ruta" | "entregado" | "fallido" | "cancelado";
export type Franja = "manana" | "tarde" | "todo_el_dia";

export const FRANJA_LABEL: Record<Franja, string> = {
  manana: "Mañana", tarde: "Tarde", todo_el_dia: "Todo el día",
};

export interface Despacho {
  id: string;
  order_id: string;
  estado: DespachoEstado;
  fecha_programada: string; // YYYY-MM-DD
  franja: Franja;
  conductor: string | null;
  vehiculo: string | null;
  referencia: string | null;
  costo_flete: number;
  notas: string | null;
  intentos: number;
  motivo_fallo: string | null;
  salida_at: string | null;
  entregado_at: string | null;
  recibido_por: string | null;
  created_at: string;
  orders: {
    order_number: string;
    nombre: string;
    telefono: string | null;
    direccion: string | null;
    distrito: string | null;
    ciudad: string | null;
    total: number;
    status: string;
  } | null;
}

export interface PedidoSinDespacho {
  id: string;
  order_number: string;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  distrito: string | null;
  status: string;
  total: number;
}

// Estados del pedido que ya admiten programar una entrega
const ESTADOS_PROGRAMABLES = ["pagado", "en_produccion", "control_calidad", "listo_despacho", "enviado"];

// ── Esquemas ───────────────────────────────────────────────
const crearSchema = z.object({
  order_id: z.string().uuid(),
  fecha_programada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  franja: z.enum(["manana", "tarde", "todo_el_dia"]),
  conductor: z.string().trim().max(80).optional().nullable(),
  vehiculo: z.string().trim().max(60).optional().nullable(),
  referencia: z.string().trim().max(300).optional().nullable(),
  costo_flete: z.number().min(0).default(0),
  notas: z.string().trim().max(500).optional().nullable(),
});
export type CrearDespachoInput = z.input<typeof crearSchema>;

const editarSchema = crearSchema.omit({ order_id: true }).partial().extend({ id: z.string().uuid() });
export type EditarDespachoInput = z.input<typeof editarSchema>;

const cambioSchema = z.object({
  id: z.string().uuid(),
  nuevo_estado: z.enum(["programado", "en_ruta", "entregado", "fallido", "cancelado"]),
  motivo: z.string().trim().max(300).optional(),
  recibido_por: z.string().trim().max(100).optional(),
  nueva_fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type CambioEstadoInput = z.input<typeof cambioSchema>;

const emptyToNull = (v?: string | null) => (v && v.trim() ? v.trim() : null);

// ── Consultas ──────────────────────────────────────────────
export async function listDespachos(): Promise<Despacho[]> {
  const { db: c } = await db();
  const { data, error } = await c
    .from("entregas")
    .select(`
      id, order_id, estado, fecha_programada, franja, conductor, vehiculo, referencia,
      costo_flete, notas, intentos, motivo_fallo, salida_at, entregado_at, recibido_por, created_at,
      orders ( order_number, nombre, telefono, direccion, distrito, ciudad, total, status )
    `)
    .order("fecha_programada", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Despacho[];
}

/** Pedidos pagados que todavía no tienen una entrega programada. */
export async function listPedidosSinDespacho(): Promise<PedidoSinDespacho[]> {
  const { db: c } = await db();
  const [{ data: orders, error: e1 }, { data: activos, error: e2 }] = await Promise.all([
    c.from("orders")
      .select("id, order_number, nombre, telefono, direccion, distrito, status, total")
      .in("status", ESTADOS_PROGRAMABLES)
      .order("created_at", { ascending: false })
      .limit(300),
    c.from("entregas").select("order_id").in("estado", ["programado", "en_ruta", "fallido"]),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  const ocupados = new Set((activos ?? []).map((d: { order_id: string }) => d.order_id));
  return ((orders ?? []) as PedidoSinDespacho[]).filter((o) => !ocupados.has(o.id));
}

// ── Escritura ──────────────────────────────────────────────
export async function crearDespacho(input: CrearDespachoInput) {
  const v = crearSchema.parse(input);
  const { db: c, userId } = await db();
  const { error } = await c.from("entregas").insert({
    order_id: v.order_id,
    fecha_programada: v.fecha_programada,
    franja: v.franja,
    conductor: emptyToNull(v.conductor),
    vehiculo: emptyToNull(v.vehiculo),
    referencia: emptyToNull(v.referencia),
    costo_flete: v.costo_flete,
    notas: emptyToNull(v.notas),
    creado_por: userId,
  });
  if (error) {
    if (error.code === "23505") throw new Error("Ese pedido ya tiene un despacho activo.");
    throw new Error(error.message);
  }
}

export async function editarDespacho(input: EditarDespachoInput) {
  const { id, ...rest } = editarSchema.parse(input);
  const patch: Record<string, unknown> = {};
  if (rest.fecha_programada !== undefined) patch.fecha_programada = rest.fecha_programada;
  if (rest.franja !== undefined) patch.franja = rest.franja;
  if (rest.conductor !== undefined) patch.conductor = emptyToNull(rest.conductor);
  if (rest.vehiculo !== undefined) patch.vehiculo = emptyToNull(rest.vehiculo);
  if (rest.referencia !== undefined) patch.referencia = emptyToNull(rest.referencia);
  if (rest.costo_flete !== undefined) patch.costo_flete = rest.costo_flete;
  if (rest.notas !== undefined) patch.notas = emptyToNull(rest.notas);
  const { db: c } = await db();
  const { error } = await c.from("entregas").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Devuelve un aviso (string) si el despacho avanzó pero el pedido no pudo moverse. */
export async function cambiarEstadoDespacho(input: CambioEstadoInput): Promise<string | null> {
  const v = cambioSchema.parse(input);
  const { db: c } = await db();
  const { data, error } = await c.rpc("cambiar_estado_entrega", {
    _despacho_id: v.id,
    _nuevo_estado: v.nuevo_estado,
    _motivo: v.motivo ?? null,
    _recibido_por: v.recibido_por ?? null,
    _nueva_fecha: v.nueva_fecha ?? null,
  });
  if (error) throw new Error(error.message);
  return (data as { aviso?: string | null } | null)?.aviso ?? null;
}

// ── Utilidades ─────────────────────────────────────────────
export function hoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Enlace de WhatsApp (Perú, +51) con mensaje listo. */
export function whatsappLink(telefono: string | null | undefined, texto: string): string | null {
  if (!telefono) return null;
  let n = telefono.replace(/\D/g, "");
  if (n.length === 9) n = "51" + n;
  if (n.length < 10) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}
