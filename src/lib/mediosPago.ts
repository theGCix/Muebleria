// src/lib/mediosPago.ts
// Medios de pago que muestra el checkout (E6). Es SOLO lo que se anuncia al cliente: el cobro real lo hace
// el Botón de Pago Web de Niubiz (VisanetCheckout).
//
// 2026-11-05: el dueño confirmó que Yape y Plin están disponibles en el cobro, así que quedan
// `habilitado: true`. Si dejan de estar contratados, vuelve el flag a false: no anuncies un medio que el
// pago no ofrece (genera reclamos).
// 2026-11-14: PagoEfectivo se quita del checkout. «Efectivo» ahora es pagar en la tienda al recoger o contra
// entrega en Lima (ver src/lib/pagoEfectivo.ts), no un código para pagar en agentes.

export type GrupoMedio = "tarjeta" | "billetera" | "efectivo";

export interface MedioPago {
  id: string;
  nombre: string;
  grupo: GrupoMedio;
  habilitado: boolean;
  /** Logo en /public/pagos/ (ver LEEME.txt). Si el archivo no existe se muestra el nombre como texto. */
  logo: string;
}

export const MEDIOS_PAGO: MedioPago[] = [
  // Tarjetas: las que ya anunciaba el checkout (Visa, Mastercard, Amex)
  { id: "visa", nombre: "Visa", grupo: "tarjeta", habilitado: true, logo: "/pagos/visa.svg" },
  { id: "mastercard", nombre: "Mastercard", grupo: "tarjeta", habilitado: true, logo: "/pagos/mastercard.svg" },
  { id: "amex", nombre: "American Express", grupo: "tarjeta", habilitado: true, logo: "/pagos/amex.svg" },
  // Billeteras: confirmadas por el dueño (2026-11-05)
  { id: "yape", nombre: "Yape", grupo: "billetera", habilitado: true, logo: "/pagos/yape.svg" },
  { id: "plin", nombre: "Plin", grupo: "billetera", habilitado: true, logo: "/pagos/plin.svg" },
];

/** Sello del procesador que se muestra junto al pago. */
export const MEDIO_NIUBIZ = { id: "niubiz", nombre: "Niubiz", logo: "/pagos/niubiz.svg" };