// src/lib/caja.functions.ts
// Caja y gastos del POS (turnos de caja + movimientos)
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedClient } from "@/integrations/supabase/auth-middleware";

// Las tablas caja_* aún no están en types.ts (se regenera con el CLI de Supabase).
// Hasta entonces se usa un cliente sin tipar, solo dentro de este archivo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;
async function db(): Promise<{ db: Db; userId: string }> {
  const { supabase, userId } = await getAuthenticatedClient();
  return { db: supabase as unknown as Db, userId };
}

// ── Tipos ──────────────────────────────────────────────────
export type MetodoPago = "efectivo" | "tarjeta" | "transferencia" | "yape_plin";
export type TipoMov = "gasto" | "ingreso" | "retiro";

export const METODO_LABEL: Record<MetodoPago, string> = {
  efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia", yape_plin: "Yape / Plin",
};

export const TIPO_MOV_LABEL: Record<TipoMov, string> = {
  gasto: "Gasto", ingreso: "Ingreso", retiro: "Retiro",
};

export const GASTO_CATEGORIAS = [
  { value: "transporte", label: "Transporte y fletes" },
  { value: "insumos", label: "Insumos y materiales" },
  { value: "servicios", label: "Servicios (luz, agua, internet)" },
  { value: "sueldos", label: "Sueldos y jornales" },
  { value: "mantenimiento", label: "Mantenimiento y herramientas" },
  { value: "alimentacion", label: "Alimentación" },
  { value: "marketing", label: "Marketing y publicidad" },
  { value: "impuestos", label: "Impuestos y trámites" },
  { value: "otros", label: "Otros" },
] as const;

export const categoriaLabel = (v: string) => GASTO_CATEGORIAS.find((c) => c.value === v)?.label ?? v;

export interface Turno {
  id: string;
  estado: "abierta" | "cerrada";
  abierta_at: string;
  abierto_por: string | null;
  monto_apertura: number;
  notas_apertura: string | null;
  cerrada_at: string | null;
  cerrado_por: string | null;
  efectivo_esperado: number | null;
  efectivo_contado: number | null;
  diferencia: number | null;
  notas_cierre: string | null;
  resumen: ResumenTurno | null;
}

export interface ResumenTurno {
  apertura: number;
  ventas: Partial<Record<MetodoPago, { n: number; total: number }>>;
  ventas_total: number;
  ventas_n: number;
  anuladas_n: number;
  gastos_efectivo: number;
  gastos_otros: number;
  ingresos: number;
  retiros: number;
  esperado: number;
}

export interface Movimiento {
  id: string;
  turno_id: string | null;
  tipo: TipoMov;
  categoria: string;
  metodo: MetodoPago;
  monto: number;
  descripcion: string;
  comprobante: string | null;
  anulado: boolean;
  anulado_motivo: string | null;
  created_by: string | null;
  created_at: string;
}

// ── Consultas ──────────────────────────────────────────────
const TURNO_COLS =
  "id, estado, abierta_at, abierto_por, monto_apertura, notas_apertura, cerrada_at, cerrado_por, efectivo_esperado, efectivo_contado, diferencia, notas_cierre, resumen";
const MOV_COLS =
  "id, turno_id, tipo, categoria, metodo, monto, descripcion, comprobante, anulado, anulado_motivo, created_by, created_at";

/** La caja abierta ahora mismo (o null). */
export async function getTurnoActual(): Promise<Turno | null> {
  const { db: c } = await db();
  const { data, error } = await c.from("caja_turnos").select(TURNO_COLS).eq("estado", "abierta").maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Turno | null) ?? null;
}

export async function getResumenTurno(turnoId: string): Promise<ResumenTurno> {
  const { db: c } = await db();
  const { data, error } = await c.rpc("caja_resumen", { _turno_id: turnoId });
  if (error) throw new Error(error.message);
  return data as ResumenTurno;
}

export async function listTurnosCerrados(limit = 60): Promise<Turno[]> {
  const { db: c } = await db();
  const { data, error } = await c
    .from("caja_turnos").select(TURNO_COLS).eq("estado", "cerrada")
    .order("abierta_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Turno[];
}

export async function listMovimientos(f: {
  turnoId?: string; tipo?: TipoMov; desde?: string; hasta?: string;
}): Promise<Movimiento[]> {
  const { db: c } = await db();
  let q = c.from("caja_movimientos").select(MOV_COLS).order("created_at", { ascending: false }).limit(1000);
  if (f.turnoId) q = q.eq("turno_id", f.turnoId);
  if (f.tipo) q = q.eq("tipo", f.tipo);
  if (f.desde) q = q.gte("created_at", f.desde);
  if (f.hasta) q = q.lt("created_at", f.hasta);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Movimiento[];
}

// ── Escritura ──────────────────────────────────────────────
const montoSchema = z.number({ invalid_type_error: "Ingresa un monto" }).min(0, "El monto no puede ser negativo").max(9_999_999);

export async function abrirCaja(input: { monto: number; notas?: string }): Promise<string> {
  const v = z.object({ monto: montoSchema, notas: z.string().trim().max(300).optional() }).parse(input);
  const { db: c } = await db();
  const { data, error } = await c.rpc("abrir_caja", { _monto: v.monto, _notas: v.notas ?? null });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function cerrarCaja(input: { turnoId: string; contado: number; notas?: string }) {
  const v = z.object({
    turnoId: z.string().uuid(), contado: montoSchema, notas: z.string().trim().max(500).optional(),
  }).parse(input);
  const { db: c } = await db();
  const { data, error } = await c.rpc("cerrar_caja", {
    _turno_id: v.turnoId, _contado: v.contado, _notas: v.notas ?? null,
  });
  if (error) throw new Error(error.message);
  return data as ResumenTurno & { contado: number; diferencia: number };
}

const movSchema = z.object({
  tipo: z.enum(["gasto", "ingreso", "retiro"]),
  categoria: z.string().trim().min(1).max(40).default("otros"),
  metodo: z.enum(["efectivo", "tarjeta", "transferencia", "yape_plin"]).default("efectivo"),
  monto: z.number().positive("El monto debe ser mayor a 0").max(9_999_999),
  descripcion: z.string().trim().min(1, "Describe el movimiento").max(200),
  comprobante: z.string().trim().max(60).optional().nullable(),
});
export type NuevoMovimiento = z.input<typeof movSchema>;

export async function registrarMovimientoCaja(input: NuevoMovimiento) {
  const v = movSchema.parse(input);
  const { db: c, userId } = await db();
  const { error } = await c.from("caja_movimientos").insert({
    tipo: v.tipo,
    categoria: v.tipo === "gasto" ? v.categoria : "otros",
    metodo: v.tipo === "gasto" ? v.metodo : "efectivo", // ingresos y retiros siempre son efectivo
    monto: v.monto,
    descripcion: v.descripcion,
    comprobante: v.comprobante?.trim() || null,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
}

export async function anularMovimientoCaja(input: { id: string; motivo: string }) {
  const v = z.object({ id: z.string().uuid(), motivo: z.string().trim().min(1, "Indica el motivo").max(200) }).parse(input);
  const { db: c } = await db();
  const { error } = await c.rpc("anular_movimiento_caja", { _id: v.id, _motivo: v.motivo });
  if (error) throw new Error(error.message);
}

// ── Utilidades ─────────────────────────────────────────────
/** Rango [desde, hasta) de un mes "YYYY-MM" en hora de Lima (UTC-5, sin horario de verano). */
export function rangoMesLima(mes: string): { desde: string; hasta: string } {
  const [y, m] = mes.split("-").map(Number);
  const sig = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { desde: `${mes}-01T00:00:00-05:00`, hasta: `${sig}-01T00:00:00-05:00` };
}

export function mesActualLima(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima", year: "numeric", month: "2-digit" })
    .format(new Date()); // "2026-10"
}

export const fmtFechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));

export function movimientosACsv(rows: Movimiento[]): string {
  const esc = (s: string | number | null) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const head = ["Fecha", "Tipo", "Categoría", "Descripción", "Método", "Monto", "Comprobante", "Anulado"];
  const body = rows.map((m) => [
    new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" }).format(new Date(m.created_at)),
    TIPO_MOV_LABEL[m.tipo], categoriaLabel(m.categoria), m.descripcion, METODO_LABEL[m.metodo],
    m.monto.toFixed(2), m.comprobante ?? "", m.anulado ? "Sí" : "",
  ].map(esc).join(","));
  return "\uFEFF" + [head.map(esc).join(","), ...body].join("\r\n");
}
