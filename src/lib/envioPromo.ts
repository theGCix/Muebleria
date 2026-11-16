// src/lib/envioPromo.ts
// Envío promocional de las liquidaciones (decisión del dueño, 2026-11-16). Copia de server/envioPromo.js: las dos deben
// dar lo mismo (lo comprueba server/envio-promo.test.js). El servidor es la única fuente del cobro; esto solo lo muestra.
//
// Fórmula (solo domicilio en Lima; provincia y recojo no cambian):
//   promo = «gratis» si ALGÚN producto suelto del carrito (no pieza de combo) tiene una liquidación vigente con envío gratis
//           si no, «descuento» = el MAYOR descuento en soles entre esas liquidaciones (se resta UNA sola vez)
//           si no, ninguna
//   envioBase = tarifa del distrito                      (como hoy)
//   envioBase' = gratis → 0 · descuento → máx(0, envioBase − monto) · ninguna → envioBase
//   envio = envioBase' + (entrega parcial ? 25 : 0)      (el cargo de entrega parcial no se perdona)
// Una liquidación está vigente mientras su producto tenga un descuento activo (misma regla que el banner del home).

export interface LineaPromo { product_id: string; comboId?: string | null }
export interface LiquidacionEnvio { product_id: string; envio_tipo: string; envio_descuento?: number | string | null }
export type PromoEnvio = { tipo: "gratis"; monto: 0 } | { tipo: "descuento"; monto: number } | null;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function promoEnvio(lineas: LineaPromo[], liquidaciones: LiquidacionEnvio[]): PromoEnvio {
  const ids = new Set(lineas.filter((l) => !l.comboId).map((l) => l.product_id));
  let gratis = false;
  let monto = 0;
  for (const l of liquidaciones) {
    if (!ids.has(l.product_id)) continue;
    if (l.envio_tipo === "gratis") gratis = true;
    else if (l.envio_tipo === "descuento") monto = Math.max(monto, Number(l.envio_descuento) || 0);
  }
  if (gratis) return { tipo: "gratis", monto: 0 };
  return monto > 0 ? { tipo: "descuento", monto: r2(monto) } : null;
}

export function envioConPromo(base: number, promo: PromoEnvio): number {
  if (!promo) return base;
  return promo.tipo === "gratis" ? 0 : Math.max(0, r2(base - promo.monto));
}
