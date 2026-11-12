// src/lib/ordenesProduccion.ts
// ─────────────────────────────────────────────────────────────
// Reparto de las órdenes del carpintero en pestañas (Parte 8.3 · F13).
// Lógica pura (sin React ni consultas): así se prueba sola y las
// pantallas nunca comparan estados "a mano".
//
//   Pendientes  = pendiente + rechazado_calidad (hay que rehacerlo)
//   En proceso  = en_proceso + pausado          (sigue siendo trabajo abierto)
//   Terminadas  = terminado
// ─────────────────────────────────────────────────────────────
import { diasRestantes, type MiOrdenRow, type ProduccionStatus } from "@/types/produccion";

export type PestanaProduccion = "pendientes" | "en_proceso" | "terminadas";

/** Orden en que se muestran las pestañas. */
export const PESTANAS_PRODUCCION: { key: PestanaProduccion; label: string }[] = [
  { key: "pendientes", label: "Pendientes" },
  { key: "en_proceso", label: "En proceso" },
  { key: "terminadas", label: "Terminadas" },
];

/** Orden de preferencia para elegir la pestaña inicial. */
const PRIORIDAD_INICIAL: PestanaProduccion[] = ["en_proceso", "pendientes", "terminadas"];

/** Una orden urgente vence en ≤ 2 días (o ya venció). Una orden terminada nunca lo es. */
export const DIAS_URGENTE = 2;

export function pestanaDe(status: ProduccionStatus): PestanaProduccion {
  switch (status) {
    case "en_proceso":
    case "pausado":
      return "en_proceso";
    case "terminado":
      return "terminadas";
    case "pendiente":
    case "rechazado_calidad":
    default:
      // Un estado desconocido nunca debe ocultar una orden: cae en Pendientes.
      return "pendientes";
  }
}

export function esUrgente(o: Pick<MiOrdenRow, "prod_status" | "fecha_fin_estimada">): boolean {
  if (o.prod_status === "terminado") return false;
  const dias = diasRestantes(o.fecha_fin_estimada);
  return dias !== null && dias <= DIAS_URGENTE;
}

export interface GrupoPestana {
  /** Órdenes urgentes (solo en pestañas abiertas); van primero. */
  urgentes: MiOrdenRow[];
  /** El resto, en el orden recibido (en Terminadas: la más reciente primero). */
  resto: MiOrdenRow[];
  /** urgentes + resto: es el contador de la pestaña. */
  total: number;
}

export type OrdenesPorPestana = Record<PestanaProduccion, GrupoPestana>;

const porFinReal = (a: MiOrdenRow, b: MiOrdenRow) =>
  (b.fecha_fin_real ?? "").localeCompare(a.fecha_fin_real ?? "");

/** Reparte cada orden en UNA sola pestaña según su `prod_status`. */
export function agruparPorPestana(ordenes: MiOrdenRow[]): OrdenesPorPestana {
  const grupos: OrdenesPorPestana = {
    pendientes: { urgentes: [], resto: [], total: 0 },
    en_proceso: { urgentes: [], resto: [], total: 0 },
    terminadas: { urgentes: [], resto: [], total: 0 },
  };

  for (const o of ordenes) {
    const g = grupos[pestanaDe(o.prod_status)];
    (esUrgente(o) ? g.urgentes : g.resto).push(o);
  }

  grupos.terminadas.resto.sort(porFinReal);
  for (const k of Object.keys(grupos) as PestanaProduccion[]) {
    grupos[k].total = grupos[k].urgentes.length + grupos[k].resto.length;
  }
  return grupos;
}

/** Primera pestaña con órdenes (En proceso → Pendientes → Terminadas); sin órdenes, En proceso. */
export function pestanaInicial(grupos: OrdenesPorPestana): PestanaProduccion {
  return PRIORIDAD_INICIAL.find((k) => grupos[k].total > 0) ?? "en_proceso";
}

export function esPestanaProduccion(v: unknown): v is PestanaProduccion {
  return v === "pendientes" || v === "en_proceso" || v === "terminadas";
}
