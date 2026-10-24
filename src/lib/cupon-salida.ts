// src/lib/cupon-salida.ts
// Estado local del cupón de salida (qué cupón tiene el visitante y cuándo se le mostró el modal).
const KEY_CUPON = "gm_cupon_salida";
const KEY_VISTO = "gm_cupon_salida_visto"; // localStorage: ms epoch de la última vez que se mostró
const KEY_SESION = "gm_cupon_salida_sesion"; // sessionStorage: ya se mostró en esta visita
const KEY_PASTILLA = "gm_cupon_salida_pastilla_oculta"; // sessionStorage

/** Si el visitante cierra el modal sin pedir el cupón, no se lo volvemos a mostrar por 3 días */
const REPOSO_MS = 3 * 24 * 3600 * 1000;

export interface CuponSalida {
  codigo: string;
  vence_el: string; // ISO
  porcentaje: number;
  minimo: number;
}

export function leerCuponSalida(): CuponSalida | null {
  try {
    const raw = localStorage.getItem(KEY_CUPON);
    if (!raw) return null;
    const c = JSON.parse(raw) as CuponSalida;
    if (!c?.codigo || !c?.vence_el || new Date(c.vence_el).getTime() <= Date.now()) {
      localStorage.removeItem(KEY_CUPON);
      return null;
    }
    return c;
  } catch {
    return null;
  }
}

export function guardarCuponSalida(c: CuponSalida) {
  try {
    localStorage.setItem(KEY_CUPON, JSON.stringify(c));
  } catch {
    /* modo privado / storage lleno: el cupón igual se muestra en el modal */
  }
}

export function borrarCuponSalida() {
  try {
    localStorage.removeItem(KEY_CUPON);
  } catch {
    /* noop */
  }
}

/** Con cupón vigente o ya mostrado en esta visita o en reposo → no mostrar el modal */
export function puedeMostrarModal(): boolean {
  try {
    if (leerCuponSalida()) return false;
    if (sessionStorage.getItem(KEY_SESION)) return false;
    const visto = Number(localStorage.getItem(KEY_VISTO) ?? 0);
    return !(visto && Date.now() - visto < REPOSO_MS);
  } catch {
    return true;
  }
}

export function marcarModalMostrado() {
  try {
    sessionStorage.setItem(KEY_SESION, "1");
    localStorage.setItem(KEY_VISTO, String(Date.now()));
  } catch {
    /* noop */
  }
}

export function pastillaOculta(): boolean {
  try {
    return sessionStorage.getItem(KEY_PASTILLA) === "1";
  } catch {
    return false;
  }
}

export function ocultarPastilla() {
  try {
    sessionStorage.setItem(KEY_PASTILLA, "1");
  } catch {
    /* noop */
  }
}
