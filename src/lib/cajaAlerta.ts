// src/lib/cajaAlerta.ts
// Alertas de caja abierta. Solo AVISA: nunca cierra una caja.
//   · «vencida»      → lleva abierta más de 24 horas.
//   · «recordatorio» → la caja sigue abierta pasada la hora de cierre diario (hora de Lima).
// Las horas se leen en America/Lima, sin depender de la zona del navegador.

export const UMBRAL_CAJA_HORAS = 24;
/** Hora (Lima, 0–23) a partir de la cual se recuerda cerrar la caja del día: 21:00. */
export const HORA_RECORDATORIO_CIERRE = 21;

const ZONA = "America/Lima";
const fmtHora = new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", hourCycle: "h23" });
const fmtFecha = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });

export const horaLima = (d: Date) => Number(fmtHora.format(d));
/** yyyy-MM-dd según el reloj de Lima. */
export const fechaLimaStr = (d: Date) => fmtFecha.format(d);

export type NivelCaja = "ok" | "recordatorio" | "vencida";
export interface AlertaCaja {
  nivel: NivelCaja;
  /** Horas transcurridas desde la apertura (0 si no hay caja abierta). */
  horas: number;
  /** Texto corto: «16 días y 18 h», «5 h 20 min», «12 min». */
  antiguedad: string;
}

/** Antigüedad legible entre dos instantes. */
export function antiguedadTexto(desde: Date | string, ahora: Date = new Date()): string {
  const ms = Math.max(0, ahora.getTime() - new Date(desde).getTime());
  const min = Math.floor(ms / 60_000);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d} ${d === 1 ? "día" : "días"}${h % 24 ? ` y ${h % 24} h` : ""}`;
  if (h >= 1) return `${h} h${min % 60 ? ` ${min % 60} min` : ""}`;
  return `${min} min`;
}

/** Evalúa el estado de la caja abierta. Sin caja abierta (null/undefined) → «ok». */
export function evaluarCaja(abiertaAt: string | null | undefined, ahora: Date = new Date()): AlertaCaja {
  if (!abiertaAt) return { nivel: "ok", horas: 0, antiguedad: "" };
  const horas = Math.max(0, (ahora.getTime() - new Date(abiertaAt).getTime()) / 3_600_000);
  const antiguedad = antiguedadTexto(abiertaAt, ahora);
  if (horas > UMBRAL_CAJA_HORAS) return { nivel: "vencida", horas, antiguedad };
  if (horaLima(ahora) >= HORA_RECORDATORIO_CIERRE) return { nivel: "recordatorio", horas, antiguedad };
  return { nivel: "ok", horas, antiguedad };
}
