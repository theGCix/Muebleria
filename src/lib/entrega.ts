// src/lib/entrega.ts
// Promesa de entrega: ÚNICA fuente de verdad para la ficha (DeliveryPromise) y la tarjeta (ProductCard).
// Si cambia el plazo, se cambia aquí y se actualizan ambas.

/** Lima Metropolitana: 5–7 días hábiles. */
export const ENTREGA_MIN_DIAS = 5;
export const ENTREGA_MAX_DIAS = 7;

/** Clave de localStorage donde la ficha guarda el distrito que eligió el cliente. */
export const DISTRITO_STORAGE_KEY = "gm_distrito_envio";

export function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d;
}

/** "mar 3 nov" */
export const fmtDia = (d: Date) =>
  new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "numeric", month: "short" }).format(d).replace(".", "");

const fmtMes = (d: Date) =>
  new Intl.DateTimeFormat("es-PE", { month: "short" }).format(d).replace(".", "");

/** Rango corto para espacios chicos: "3–5 nov" o "30 oct–3 nov". */
export function rangoEntregaCorto(hoy: Date = new Date()) {
  const desde = addBusinessDays(hoy, ENTREGA_MIN_DIAS);
  const hasta = addBusinessDays(hoy, ENTREGA_MAX_DIAS);
  return desde.getMonth() === hasta.getMonth()
    ? `${desde.getDate()}–${hasta.getDate()} ${fmtMes(hasta)}`
    : `${desde.getDate()} ${fmtMes(desde)}–${hasta.getDate()} ${fmtMes(hasta)}`;
}

/** Distrito guardado por el cliente (solo navegador). "" si no hay o no hay storage. */
export function leerDistritoGuardado(): string {
  try {
    return localStorage.getItem(DISTRITO_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}