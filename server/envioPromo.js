// Copia de src/lib/envioPromo.ts (ahí está la fórmula comentada). server/envio-promo.test.js verifica que den lo mismo.
const r2 = (n) => Math.round(n * 100) / 100;

export function promoEnvio(lineas, liquidaciones) {
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

export function envioConPromo(base, promo) {
  if (!promo) return base;
  return promo.tipo === "gratis" ? 0 : Math.max(0, r2(base - promo.monto));
}
