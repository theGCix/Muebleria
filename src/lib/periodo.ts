// src/lib/periodo.ts
// Lógica del filtro de periodo del panel admin: Día / Semana / Mes (+ Todo).
// "offset" cuenta hacia atrás: 0 = actual (hoy / esta semana / este mes), 1 = el anterior (ayer / semana pasada / mes pasado), 2 = el anterior a ese, etc.
import {
  endOfDay, endOfMonth, endOfWeek, format,
  startOfDay, startOfMonth, startOfWeek, subDays, subMonths, subWeeks,
} from "date-fns";
import { es } from "date-fns/locale";

export type Granularidad = "dia" | "semana" | "mes" | "todo";

export interface PeriodoValor {
  granularidad: Granularidad;
  offset: number;
}

export interface RangoPeriodo {
  granularidad: Granularidad;
  desde: Date | null;
  hasta: Date | null;
  /** Para filtros de Supabase: .gte("columna", desdeISO).lte("columna", hastaISO). Son null con "todo". */
  desdeISO: string | null;
  hastaISO: string | null;
  /** Texto corto del periodo elegido ("Hoy", "Semana pasada", "Septiembre 2026"…). */
  etiqueta: string;
  /** Para filtrar listas en el navegador. Con "todo" siempre devuelve true. */
  enRango: (fecha: string | Date | null | undefined) => boolean;
}

// Cuántos periodos hacia atrás se ofrecen en el selector, por defecto.
export const LIMITES_POR_DEFECTO = { dia: 60, semana: 52, mes: 36 } as const;

const SEMANA = { weekStartsOn: 1 as const }; // la semana empieza el lunes

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function fechaBase(v: PeriodoValor, ahora: Date): Date {
  if (v.granularidad === "dia") return subDays(ahora, v.offset);
  if (v.granularidad === "semana") return subWeeks(ahora, v.offset);
  return subMonths(ahora, v.offset);
}

/** Texto principal y detalle de un periodo. Ej.: { principal: "Hoy", detalle: "jueves 29 oct" }. */
export function etiquetaPeriodo(
  v: PeriodoValor,
  ahora: Date = new Date(),
): { principal: string; detalle: string } {
  const { granularidad: g, offset: n } = v;
  if (g === "todo") return { principal: "Todo el historial", detalle: "" };

  const base = fechaBase(v, ahora);
  const otroAnio = base.getFullYear() !== ahora.getFullYear();

  if (g === "dia") {
    const largo = cap(format(base, otroAnio ? "EEEE d 'de' MMMM yyyy" : "EEEE d 'de' MMMM", { locale: es }));
    if (n === 0) return { principal: "Hoy", detalle: format(base, "EEEE d MMM", { locale: es }) };
    if (n === 1) return { principal: "Ayer", detalle: format(base, "EEEE d MMM", { locale: es }) };
    return { principal: largo, detalle: "" };
  }

  if (g === "semana") {
    const d = startOfWeek(base, SEMANA);
    const h = endOfWeek(base, SEMANA);
    const texto = `${format(d, "d MMM", { locale: es })} – ${format(h, otroAnio ? "d MMM yyyy" : "d MMM", { locale: es })}`;
    if (n === 0) return { principal: "Esta semana", detalle: texto };
    if (n === 1) return { principal: "Semana pasada", detalle: texto };
    return { principal: texto, detalle: "" };
  }

  const mes = cap(format(base, "MMMM yyyy", { locale: es }));
  if (n === 0) return { principal: "Este mes", detalle: mes };
  if (n === 1) return { principal: "Mes pasado", detalle: mes };
  return { principal: mes, detalle: "" };
}

/** Texto completo para el selector: "Hoy · jueves 29 oct". */
export function etiquetaCompleta(v: PeriodoValor, ahora: Date = new Date()): string {
  const { principal, detalle } = etiquetaPeriodo(v, ahora);
  return detalle ? `${principal} · ${detalle}` : principal;
}

export function calcularRango(v: PeriodoValor, ahora: Date = new Date()): RangoPeriodo {
  let desde: Date | null = null;
  let hasta: Date | null = null;

  if (v.granularidad !== "todo") {
    const base = fechaBase(v, ahora);
    if (v.granularidad === "dia") {
      desde = startOfDay(base);
      hasta = endOfDay(base);
    } else if (v.granularidad === "semana") {
      desde = startOfWeek(base, SEMANA);
      hasta = endOfWeek(base, SEMANA);
    } else {
      desde = startOfMonth(base);
      hasta = endOfMonth(base);
    }
  }

  const ini = desde?.getTime() ?? null;
  const fin = hasta?.getTime() ?? null;

  return {
    granularidad: v.granularidad,
    desde,
    hasta,
    desdeISO: desde ? desde.toISOString() : null,
    hastaISO: hasta ? hasta.toISOString() : null,
    etiqueta: etiquetaPeriodo(v, ahora).principal,
    enRango: (fecha) => {
      if (ini === null || fin === null) return true;
      if (!fecha) return false;
      const t = new Date(fecha).getTime();
      return !Number.isNaN(t) && t >= ini && t <= fin;
    },
  };
}