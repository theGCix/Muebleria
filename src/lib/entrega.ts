// src/lib/entrega.ts
// Promesa de entrega: ÚNICA fuente de verdad para la ficha (DeliveryPromise, pestaña «Entrega y pagos») y la tarjeta (ProductCard).
// Si cambia el plazo, se cambia aquí y se actualizan todas.

/** Lima Metropolitana: 5–7 días hábiles. */
export const ENTREGA_MIN_DIAS = 5;
export const ENTREGA_MAX_DIAS = 7;

/** Provincias: 10–15 días hábiles. */
export const ENTREGA_PROV_MIN_DIAS = 10;
export const ENTREGA_PROV_MAX_DIAS = 15;

/** «5–7 días hábiles» */
export const textoPlazoLima = () => `${ENTREGA_MIN_DIAS}–${ENTREGA_MAX_DIAS} días hábiles`;
/** «10–15 días hábiles» */
export const textoPlazoProvincias = () => `${ENTREGA_PROV_MIN_DIAS}–${ENTREGA_PROV_MAX_DIAS} días hábiles`;

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

/** Evento que avisa, en esta pestaña, que cambió el distrito guardado (el evento "storage" solo salta en otras pestañas). */
export const DISTRITO_EVENT = "gm:distrito-envio";

/** Guarda el distrito elegido (ficha, tarjeta o checkout) y avisa a quien lo esté mostrando. */
export function guardarDistrito(distrito: string): void {
  try {
    localStorage.setItem(DISTRITO_STORAGE_KEY, distrito);
  } catch {
    /* sin storage: solo se pierde la memoria entre páginas */
  }
  window.dispatchEvent(new Event(DISTRITO_EVENT));
}