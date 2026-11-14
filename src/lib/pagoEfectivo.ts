// src/lib/pagoEfectivo.ts
// Reglas de pago del checkout (Parte 8.4). Copia de server/pagos.js (modalidadPago / calcularAdelanto):
// el SERVIDOR es quien decide y recalcula todo; esto solo sirve para mostrar el monto correcto al cliente.
// Hay una prueba en server/pagos.test.js que verifica que el porcentaje esté sincronizado.
//
//  · tarjeta / yape_plin → se cobra el total online (Niubiz).
//  · efectivo en recojo en tienda → no se cobra online; ventas confirma y se cobra al recoger.
//  · efectivo en delivery Lima y Callao (contra entrega) → se cobra online un adelanto y el resto al entregar.
//  · efectivo en provincia → no disponible.

export type MetodoPago = "tarjeta" | "yape_plin" | "efectivo";
export type ModalidadPago = "online_total" | "efectivo_recojo" | "efectivo_adelanto";

/** Adelanto del delivery contra entrega: 30 % del total (mínimo, el flete). */
export const PORCENTAJE_ADELANTO = 0.3;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function efectivoDisponible(metodoEntrega: "domicilio" | "recojo_tienda", destino: "lima" | "provincia"): boolean {
  return metodoEntrega === "recojo_tienda" || destino === "lima";
}

export function modalidadPago(
  metodo: MetodoPago,
  metodoEntrega: "domicilio" | "recojo_tienda",
  destino: "lima" | "provincia",
): ModalidadPago {
  if (metodo !== "efectivo" || !efectivoDisponible(metodoEntrega, destino)) return "online_total";
  return metodoEntrega === "recojo_tienda" ? "efectivo_recojo" : "efectivo_adelanto";
}

export function calcularAdelanto(total: number, envio: number): number {
  return Math.min(r2(total), Math.max(r2(total * PORCENTAJE_ADELANTO), r2(envio)));
}

/** Cuánto se paga ahora (online) y cuánto queda para el efectivo. */
export function desglosePago(modalidad: ModalidadPago, total: number, envio: number) {
  const ahora = modalidad === "efectivo_recojo" ? 0 : modalidad === "efectivo_adelanto" ? calcularAdelanto(total, envio) : total;
  return { ahora, saldo: r2(total - ahora) };
}
