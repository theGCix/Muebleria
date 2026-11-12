// src/lib/fechas.ts
// Formato único de fechas para checkout, confirmación, Mi cuenta y panel: "2 nov 2026" (y "2 nov 2026, 14:30").
// Siempre en hora de Lima y con meses abreviados en español (septiembre = "set", como en es-PE).
const TZ = "America/Lima";
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

type Entrada = Date | string | number | null | undefined;

const partesLima = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, year: "numeric", month: "numeric", day: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** Fecha corta, p. ej. "2 nov 2026". Devuelve "—" si no hay fecha válida. */
export function fmtFecha(d: Entrada): string {
  if (d == null || d === "") return "—";
  // Columnas tipo date ("2026-11-10"): se leen tal cual, sin pasar por la zona horaria.
  if (typeof d === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    if (m) return `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}`;
  }
  const f = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(f.getTime())) return "—";
  const p = Object.fromEntries(partesLima.formatToParts(f).map((x) => [x.type, x.value]));
  return `${Number(p.day)} ${MESES[Number(p.month) - 1]} ${p.year}`;
}

/** Fecha con hora (24 h, Lima), p. ej. "2 nov 2026, 14:30". */
export function fmtFechaHora(d: Entrada): string {
  const dia = fmtFecha(d);
  if (dia === "—") return dia;
  const f = d instanceof Date ? d : new Date(d as string | number);
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return dia;
  const p = Object.fromEntries(partesLima.formatToParts(f).map((x) => [x.type, x.value]));
  return `${dia}, ${p.hour}:${p.minute}`;
}
