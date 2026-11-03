// server/pagos.js
// Cobro seguro: (1) el total se calcula AQUÍ desde la base de datos, nunca con lo que
// manda el navegador; (2) la tarjeta se autoriza AQUÍ con Niubiz y solo si responde
// "aprobado" se crea el pedido como pagado.

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
// Copia de src/lib/envios.ts (hay una prueba que verifica que estén sincronizados)
const DISTRITOS = JSON.parse(
  readFileSync(path.join(here, "envio-distritos.json"), "utf-8")
).distritos;

/** Mismo valor que CARGO_ENVIO_PARCIAL en src/routes/checkout.tsx */
export const CARGO_ENVIO_PARCIAL = 25;

export class PagoError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const r2 = (n) => Math.round(n * 100) / 100;

export function precioEnvioLima(distrito) {
  if (!distrito) return null;
  const m = DISTRITOS.find(
    (d) => d.destino.localeCompare(distrito, "es", { sensitivity: "base" }) === 0
  );
  return m ? m.precio : null;
}

/** Igual que ofertaInfo() de src/lib/pricing.ts */
export function precioConOferta(p, ahora = Date.now()) {
  const precio = Number(p.precio);
  const desc = Number(p.descuento_porcentaje);
  const vence = p.oferta_vence_el ? new Date(p.oferta_vence_el).getTime() : null;
  const activa = desc > 0 && (vence === null || vence > ahora);
  return activa ? r2(precio - (precio * desc) / 100) : precio;
}

/**
 * Precio unitario vigente de UNA línea (producto suelto o pieza de combo).
 * Única fuente de esta regla: la usan calcularPedido() (cobro) y validarCarrito() (aviso previo),
 * así lo que se avisa y lo que se cobra no pueden divergir.
 * Devuelve { unit } o { error: "combo_no_disponible" | "combo_no_coincide" }.
 */
export function precioUnitarioLinea({ it, prod, combos, ahora = Date.now() }) {
  if (!it.comboId) return { unit: precioConOferta(prod, ahora) };
  const combo = combos.get(it.comboId);
  const vigente = combo && combo.activo && (!combo.vence_el || new Date(combo.vence_el).getTime() > ahora);
  if (!vigente) return { error: "combo_no_disponible" };
  const dentro = combo.combo_items.some((ci) => ci.product_id === it.product_id);
  if (!dentro) return { error: "combo_no_coincide" };
  // Mismo reparto que src/hooks/useAgregarCombo.ts
  const normal = combo.combo_items.reduce((s, ci) => s + Number(ci.products.precio) * ci.cantidad, 0);
  const factor = normal > 0 ? Number(combo.precio_combo) / normal : 1;
  return { unit: r2(Number(prod.precio) * factor) };
}

async function leerCombos(supabase, items) {
  const comboIds = [...new Set(items.map((i) => i.comboId).filter(Boolean))];
  const combos = new Map();
  if (comboIds.length) {
    const { data, error } = await supabase
      .from("combos")
      .select("id, precio_combo, activo, vence_el, combo_items(cantidad, product_id, products(precio))")
      .in("id", comboIds);
    if (error) throw new PagoError(`No se pudieron leer los combos: ${error.message}`, 500);
    for (const c of data ?? []) combos.set(c.id, c);
  }
  return combos;
}

/**
 * Recalcula el pedido completo desde la BD.
 * items: [{ product_id, qty, comboId?, ...lo demás se ignora }]
 * order: { metodo_entrega, modo_entrega, destino, distrito }
 * Devuelve { lineas, subtotal, envio, descuento, total } con precios del servidor.
 */
export async function calcularPedido({ supabase, order, items, descuento = 0, ahora = Date.now() }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new PagoError("El pedido no tiene productos.");
  }
  for (const it of items) {
    if (!it.product_id) throw new PagoError("Hay un producto sin identificar en el pedido.");
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 99) {
      throw new PagoError("Cantidad inválida en el pedido.");
    }
  }

  const productIds = [...new Set(items.map((i) => i.product_id))];
  const { data: prods, error: pErr } = await supabase
    .from("products")
    .select("id, precio, descuento_porcentaje, oferta_vence_el")
    .in("id", productIds);
  if (pErr) throw new PagoError(`No se pudieron leer los precios: ${pErr.message}`, 500);
  const porId = new Map((prods ?? []).map((p) => [p.id, p]));

  const combos = await leerCombos(supabase, items);

  const lineas = items.map((it) => {
    const prod = porId.get(it.product_id);
    if (!prod) throw new PagoError("Un producto del carrito ya no existe. Actualiza tu carrito.", 409);
    const r = precioUnitarioLinea({ it, prod, combos, ahora });
    if (r.error === "combo_no_disponible") throw new PagoError("Un combo del carrito ya no está disponible. Actualiza tu carrito.", 409);
    if (r.error === "combo_no_coincide") throw new PagoError("El carrito no coincide con el combo. Actualiza tu carrito.", 409);
    return { ...it, unit_price: r.unit, line_total: r2(r.unit * it.qty) };
  });

  const subtotal = r2(lineas.reduce((s, l) => s + l.line_total, 0));

  const domicilio = (order.metodo_entrega ?? "domicilio") === "domicilio";
  const provincia = domicilio && order.destino === "provincia";
  let envio = 0;
  if (domicilio && !provincia) {
    const base = precioEnvioLima(order.distrito);
    if (base === null) throw new PagoError("Ese distrito no tiene cobertura de envío registrada.");
    envio = base;
  }
  if (domicilio && order.modo_entrega === "parcial") envio += CARGO_ENVIO_PARCIAL;

  const total = r2(subtotal + envio - descuento);
  if (!(total > 0)) throw new PagoError("El total del pedido no es válido.");
  return { lineas, subtotal, envio, descuento, total };
}

/**
 * Revisa el carrito contra la BD SIN lanzar error por precios/stock: solo informa.
 * items: [{ product_id, qty, price (lo que el navegador muestra), comboId? }]
 * Estados por línea: "ok" | "precio_cambio" | "no_disponible" | "sin_stock" | "stock_insuficiente"
 *   | "combo_no_disponible".
 * stock null = sin dato (no se limita, igual que ProductCard).
 * Devuelve { lineas: [{ product_id, comboId, estado, precio_actual, precio_cliente, stock }], cambios }.
 * Usa precioUnitarioLinea(), la misma regla que calcularPedido(), para que el aviso y el cobro coincidan.
 */
export async function validarCarrito({ supabase, items, ahora = Date.now() }) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    throw new PagoError("Carrito inválido.");
  }
  for (const it of items) {
    if (typeof it?.product_id !== "string" || !it.product_id) throw new PagoError("Hay un producto sin identificar.");
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 99) throw new PagoError("Cantidad inválida.");
  }

  const ids = [...new Set(items.map((i) => i.product_id))];
  const { data: prods, error } = await supabase
    .from("products")
    .select("id, precio, descuento_porcentaje, oferta_vence_el, activo, stock")
    .in("id", ids);
  if (error) throw new PagoError(`No se pudieron leer los precios: ${error.message}`, 500);
  const porId = new Map((prods ?? []).map((p) => [p.id, p]));
  const combos = await leerCombos(supabase, items);

  const lineas = items.map((it) => {
    const base = { product_id: it.product_id, comboId: it.comboId ?? null, precio_cliente: Number(it.price) };
    const prod = porId.get(it.product_id);
    if (!prod || prod.activo === false) return { ...base, estado: "no_disponible", precio_actual: null, stock: null };

    const stock = prod.stock ?? null;
    const r = precioUnitarioLinea({ it, prod, combos, ahora });
    if (r.error) return { ...base, estado: "combo_no_disponible", precio_actual: null, stock };

    let estado = "ok";
    if (stock !== null && stock <= 0) estado = "sin_stock";
    else if (stock !== null && it.qty > stock) estado = "stock_insuficiente";
    else if (!Number.isFinite(base.precio_cliente) || Math.abs(r.unit - base.precio_cliente) > 0.009) estado = "precio_cambio";
    return { ...base, estado, precio_actual: r.unit, stock };
  });
  return { lineas, cambios: lineas.filter((l) => l.estado !== "ok").length };
}

/**
 * Autoriza (cobra) la tarjeta con Niubiz. El monto lo pone el servidor.
 * Devuelve { aprobado, actionCode, actionDesc, authCode, monto }.
 * Solo lanza error si Niubiz no responde (red / 5xx); un rechazo es aprobado:false.
 */
export async function autorizarNiubiz({ url, securityToken, merchantId, transactionToken, purchaseNumber, amount, fetchFn = fetch }) {
  const res = await fetchFn(`${url}/${merchantId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: securityToken },
    body: JSON.stringify({
      channel: "web",
      captureType: "manual",
      countable: true,
      order: {
        tokenId: transactionToken,
        purchaseNumber,
        amount: Number(amount.toFixed(2)),
        currency: "PEN",
      },
    }),
  });

  let data = {};
  try { data = await res.json(); } catch { /* respuesta sin JSON */ }
  if (res.status >= 500) throw new PagoError(`Niubiz no respondió (${res.status}).`, 502);
  if (res.status === 401) {
    return { aprobado: false, actionCode: "401", actionDesc: "Credenciales de Niubiz no válidas para autorizar", httpStatus: 401 };
  }
  if (res.status === 406) {
    return { aprobado: false, actionCode: "406", actionDesc: "Pago duplicado: no repitas la operación, revisa tus pedidos", httpStatus: 406 };
  }

  const map = data.dataMap ?? data.data ?? {};
  const estado = data.order?.status;
  // Niubiz pide evaluar dataMap.STATUS: solo "Authorized" es venta aprobada
  // (Not Authorized y Voided cuentan como rechazo).
  const status = map.STATUS ?? estado;
  const aprobado =
    res.ok && map.ACTION_CODE === "000" && (status === undefined || status === "Authorized");
  const monto = Number(data.order?.authorizedAmount ?? data.order?.amount);

  if (aprobado && Number.isFinite(monto) && Math.abs(monto - amount) > 0.01) {
    console.error(`🚨 Niubiz autorizó ${monto} y se esperaba ${amount} (orden ${purchaseNumber})`);
    return { aprobado: false, actionCode: "MONTO", actionDesc: "El monto autorizado no coincide", authCode: map.AUTHORIZATION_CODE, monto };
  }
  return {
    aprobado,
    actionCode: map.ACTION_CODE ?? data.errorCode,
    actionDesc: map.ACTION_DESCRIPTION ?? data.errorMessage,
    authCode: map.AUTHORIZATION_CODE,
    monto,
    httpStatus: res.status,
    detalle: aprobado ? undefined : JSON.stringify(data).slice(0, 600),
  };
}