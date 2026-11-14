import test from "node:test";
import assert from "node:assert/strict";
import { calcularPedido, validarCarrito, autorizarNiubiz, precioConOferta, PagoError } from "./pagos.js";

// Supabase de mentira: devuelve tablas fijas
function fakeSupabase({ products = [], combos = [], grupos = [] }) {
  const tabla = (rows, clave = "id") => ({ select: () => ({ in: async (_c, ids) => ({ data: rows.filter((r) => ids.includes(r[clave])), error: null }) }) });
  return { from: (t) => (t === "products" ? tabla(products) : t === "producto_opcion_grupos" ? tabla(grupos, "product_id") : tabla(combos)) };
}
const P1 = { id: "p1", precio: 1000, descuento_porcentaje: null, oferta_vence_el: null };
const P2 = { id: "p2", precio: 500, descuento_porcentaje: 10, oferta_vence_el: null };
const order = { metodo_entrega: "domicilio", destino: "lima", distrito: "Los Olivos" };

test("ignora el precio del navegador y usa el de la base + oferta + envío", async () => {
  const r = await calcularPedido({
    supabase: fakeSupabase({ products: [P1, P2] }),
    order,
    items: [{ product_id: "p1", qty: 2, price: 1 }, { product_id: "p2", qty: 1, price: 1 }],
  });
  assert.equal(r.subtotal, 2450); // 2000 + 450
  assert.equal(r.envio, 60);
  assert.equal(r.total, 2510);
});

test("recojo en tienda no cobra envío; cargo parcial suma 25; cupón resta", async () => {
  const sb = fakeSupabase({ products: [P1] });
  const items = [{ product_id: "p1", qty: 1 }];
  assert.equal((await calcularPedido({ supabase: sb, order: { metodo_entrega: "recojo_tienda" }, items })).total, 1000);
  assert.equal((await calcularPedido({ supabase: sb, order: { ...order, modo_entrega: "parcial" }, items })).envio, 85);
  assert.equal((await calcularPedido({ supabase: sb, order, items, descuento: 100 })).total, 960);
});

test("provincia: el flete no entra al total", async () => {
  const r = await calcularPedido({ supabase: fakeSupabase({ products: [P1] }), order: { metodo_entrega: "domicilio", destino: "provincia" }, items: [{ product_id: "p1", qty: 1 }] });
  assert.equal(r.envio, 0);
});

test("combo: reparte el precio del combo igual que el front", async () => {
  const combo = { id: "c1", precio_combo: 1200, activo: true, vence_el: null, combo_items: [
    { cantidad: 1, product_id: "p1", products: { precio: 1000 } },
    { cantidad: 1, product_id: "p2", products: { precio: 500 } },
  ] };
  const r = await calcularPedido({
    supabase: fakeSupabase({ products: [P1, P2], combos: [combo] }),
    order: { metodo_entrega: "recojo_tienda" },
    items: [{ product_id: "p1", qty: 1, comboId: "c1" }, { product_id: "p2", qty: 1, comboId: "c1" }],
  });
  assert.equal(r.subtotal, 1200);
});

test("combo vencido, producto inexistente, distrito sin cobertura y cantidades raras se rechazan", async () => {
  const vencido = { id: "c1", precio_combo: 1, activo: true, vence_el: "2000-01-01", combo_items: [{ cantidad: 1, product_id: "p1", products: { precio: 1000 } }] };
  const sb = fakeSupabase({ products: [P1], combos: [vencido] });
  await assert.rejects(calcularPedido({ supabase: sb, order, items: [{ product_id: "p1", qty: 1, comboId: "c1" }] }), PagoError);
  await assert.rejects(calcularPedido({ supabase: sb, order, items: [{ product_id: "zzz", qty: 1 }] }), PagoError);
  await assert.rejects(calcularPedido({ supabase: sb, order: { ...order, distrito: "Marte" }, items: [{ product_id: "p1", qty: 1 }] }), PagoError);
  await assert.rejects(calcularPedido({ supabase: sb, order, items: [{ product_id: "p1", qty: -3 }] }), PagoError);
  await assert.rejects(calcularPedido({ supabase: sb, order, items: [] }), PagoError);
});

test("oferta vencida no descuenta", () => {
  assert.equal(precioConOferta({ precio: 100, descuento_porcentaje: 50, oferta_vence_el: "2000-01-01" }), 100);
});

const resp = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });
const args = { url: "https://x", securityToken: "t", merchantId: "m", transactionToken: "tok", purchaseNumber: "GM-1", amount: 100 };

test("Niubiz: aprobado solo con ACTION_CODE 000", async () => {
  const ok = await autorizarNiubiz({ ...args, fetchFn: resp(200, { order: { status: "Authorized", authorizedAmount: 100 }, dataMap: { ACTION_CODE: "000", AUTHORIZATION_CODE: "A1" } }) });
  assert.equal(ok.aprobado, true);
  const no = await autorizarNiubiz({ ...args, fetchFn: resp(400, { errorCode: 400, data: { ACTION_CODE: "101", ACTION_DESCRIPTION: "Tarjeta vencida" } }) });
  assert.equal(no.aprobado, false);
  assert.equal(no.actionDesc, "Tarjeta vencida");
});

test("Niubiz: STATUS Not Authorized, 401 y 406 no son aprobados", async () => {
  const st = await autorizarNiubiz({ ...args, fetchFn: resp(200, { dataMap: { ACTION_CODE: "000", STATUS: "Not Authorized" } }) });
  assert.equal(st.aprobado, false);
  assert.equal((await autorizarNiubiz({ ...args, fetchFn: resp(401, {}) })).aprobado, false);
  assert.equal((await autorizarNiubiz({ ...args, fetchFn: resp(406, {}) })).actionCode, "406");
});

test("Niubiz: monto autorizado distinto = no aprobado; 5xx lanza error", async () => {
  const m = await autorizarNiubiz({ ...args, fetchFn: resp(200, { order: { status: "Authorized", authorizedAmount: 1 }, dataMap: { ACTION_CODE: "000" } }) });
  assert.equal(m.aprobado, false);
  await assert.rejects(autorizarNiubiz({ ...args, fetchFn: resp(503, {}) }), PagoError);
});

// ── validarCarrito ─────────────────────────────────────────────
const V = (o) => ({ activo: true, stock: null, ...o });

test("validarCarrito: precio igual = ok; con oferta compara contra el precio con descuento", async () => {
  const sb = fakeSupabase({ products: [V(P1), V(P2)] });
  const r = await validarCarrito({ supabase: sb, items: [
    { product_id: "p1", qty: 1, price: 1000 },
    { product_id: "p2", qty: 1, price: 450 },
  ] });
  assert.deepEqual(r.lineas.map((l) => l.estado), ["ok", "ok"]);
  assert.equal(r.cambios, 0);
});

test("validarCarrito: precio viejo del navegador => precio_cambio con el precio actual", async () => {
  const sb = fakeSupabase({ products: [V(P2)] });
  const r = await validarCarrito({ supabase: sb, items: [{ product_id: "p2", qty: 1, price: 500 }] });
  assert.equal(r.lineas[0].estado, "precio_cambio");
  assert.equal(r.lineas[0].precio_actual, 450);
  assert.equal(r.lineas[0].precio_cliente, 500);
  assert.equal(r.cambios, 1);
});

test("validarCarrito: producto inexistente/inactivo, sin stock y stock insuficiente", async () => {
  const sb = fakeSupabase({ products: [
    V({ ...P1, id: "inactivo", activo: false }),
    V({ ...P1, id: "agotado", stock: 0 }),
    V({ ...P1, id: "poco", stock: 2 }),
  ] });
  const r = await validarCarrito({ supabase: sb, items: [
    { product_id: "zzz", qty: 1, price: 1000 },
    { product_id: "inactivo", qty: 1, price: 1000 },
    { product_id: "agotado", qty: 1, price: 1000 },
    { product_id: "poco", qty: 3, price: 1000 },
  ] });
  assert.deepEqual(r.lineas.map((l) => l.estado), ["no_disponible", "no_disponible", "sin_stock", "stock_insuficiente"]);
});

test("validarCarrito: combo vencido => combo_no_disponible; combo vigente usa el reparto del combo", async () => {
  const mk = (vence_el) => ({ id: "c1", precio_combo: 1200, activo: true, vence_el, combo_items: [
    { cantidad: 1, product_id: "p1", products: { precio: 1000 } },
    { cantidad: 1, product_id: "p2", products: { precio: 500 } },
  ] });
  const items = [{ product_id: "p1", qty: 1, price: 800, comboId: "c1" }];
  const vig = await validarCarrito({ supabase: fakeSupabase({ products: [V(P1), V(P2)], combos: [mk(null)] }), items });
  assert.equal(vig.lineas[0].estado, "ok");      // 1000 * 1200/1500 = 800
  const ven = await validarCarrito({ supabase: fakeSupabase({ products: [V(P1), V(P2)], combos: [mk("2000-01-01")] }), items });
  assert.equal(ven.lineas[0].estado, "combo_no_disponible");
});

test("validarCarrito: lo que avisa coincide con lo que cobra calcularPedido", async () => {
  const sb = fakeSupabase({ products: [V(P1), V(P2)] });
  const items = [{ product_id: "p1", qty: 2, price: 1 }, { product_id: "p2", qty: 3, price: 1 }];
  const v = await validarCarrito({ supabase: sb, items });
  const c = await calcularPedido({ supabase: sb, order: { metodo_entrega: "recojo_tienda" }, items });
  assert.deepEqual(v.lineas.map((l) => l.precio_actual), c.lineas.map((l) => l.unit_price));
});

test("validarCarrito: entradas inválidas lanzan PagoError", async () => {
  const sb = fakeSupabase({ products: [V(P1)] });
  await assert.rejects(validarCarrito({ supabase: sb, items: [] }), PagoError);
  await assert.rejects(validarCarrito({ supabase: sb, items: [{ product_id: "p1", qty: 0, price: 1 }] }), PagoError);
  await assert.rejects(validarCarrito({ supabase: sb, items: [{ qty: 1, price: 1 }] }), PagoError);
});
// ── Opciones por producto (color, tapizado, firmeza, patas) ──
const val = (id, valor, ajuste = 0, extra = {}) => ({ id, valor, material: null, ajuste_precio: ajuste, es_default: false, activo: true, orden: 0, ...extra });
const G1 = [
  { id: "g-tap", product_id: "p1", tipo: "tapizado", etiqueta: "Tapizado", obligatorio: false, orden: 1,
    producto_opcion_valores: [val("v-tela", "Tela", 0, { es_default: true }), val("v-cuero", "Cuero", 300, { material: "Cuero" })] },
  { id: "g-pat", product_id: "p1", tipo: "patas", etiqueta: "Patas", obligatorio: false, orden: 2,
    producto_opcion_valores: [val("v-dor", "Dorado", 0, { es_default: true }), val("v-neg", "Negro", 0), val("v-off", "Madera", 50, { activo: false })] },
];
const P1n = { ...P1, nombre: "Sofá X" };
const sbOp = () => fakeSupabase({ products: [P1n, P2], grupos: G1 });
const recojo = { metodo_entrega: "recojo_tienda" };

test("opciones: el ajuste de precio se suma, la copia queda fija y el title lo arma el servidor", async () => {
  const r = await calcularPedido({ supabase: sbOp(), order: recojo, items: [{ product_id: "p1", qty: 2, opciones: ["v-cuero", "v-neg"], title: "inventado por el navegador" }] });
  assert.equal(r.lineas[0].unit_price, 1300);
  assert.equal(r.total, 2600);
  assert.equal(r.lineas[0].precio_opciones, 300);
  assert.equal(r.lineas[0].title, "Sofá X (Cuero, Negro)");
  assert.deepEqual(r.lineas[0].opciones_snapshot.map((o) => [o.tipo, o.valor, o.ajuste_precio, o.es_default]), [["tapizado", "Cuero", 300, false], ["patas", "Negro", 0, false]]);
});

test("opciones: lo no elegido toma el valor por defecto (preseleccionado)", async () => {
  const r = await calcularPedido({ supabase: sbOp(), order: recojo, items: [{ product_id: "p1", qty: 1, opciones: [] }] });
  assert.equal(r.lineas[0].unit_price, 1000);
  assert.equal(r.lineas[0].title, "Sofá X (Tela, Dorado)");
  assert.ok(r.lineas[0].opciones_snapshot.every((o) => o.es_default));
});

test("opciones: formato antiguo (sin campo opciones) no cambia precio ni title", async () => {
  const r = await calcularPedido({ supabase: sbOp(), order: recojo, items: [{ product_id: "p1", qty: 1, title: "Sofá X (Gris, Firme)" }] });
  assert.equal(r.lineas[0].unit_price, 1000);
  assert.equal(r.lineas[0].title, "Sofá X (Gris, Firme)");
  assert.equal(r.lineas[0].opciones_snapshot, null);
});

test("opciones: valor inactivo, ajeno al producto o repetido en el mismo grupo se rechazan", async () => {
  const sb = sbOp();
  for (const opciones of [["v-off"], ["no-existe"], ["v-tela", "v-cuero"]]) {
    await assert.rejects(calcularPedido({ supabase: sb, order: recojo, items: [{ product_id: "p1", qty: 1, opciones }] }), PagoError);
  }
  await assert.rejects(calcularPedido({ supabase: sb, order: recojo, items: [{ product_id: "p2", qty: 1, opciones: ["v-cuero"] }] }), PagoError);
  await assert.rejects(calcularPedido({ supabase: sb, order: recojo, items: [{ product_id: "p1", qty: 1, opciones: "v-cuero" }] }), PagoError);
});

test("opciones: grupo obligatorio sin valor por defecto exige elegir", async () => {
  const g = [{ id: "g-col", product_id: "p1", tipo: "color", etiqueta: "Color", obligatorio: true, orden: 1, producto_opcion_valores: [val("v-gris", "Gris"), val("v-beige", "Beige")] }];
  const sb = fakeSupabase({ products: [P1n], grupos: g });
  await assert.rejects(calcularPedido({ supabase: sb, order: recojo, items: [{ product_id: "p1", qty: 1, opciones: [] }] }), PagoError);
  const r = await calcularPedido({ supabase: sb, order: recojo, items: [{ product_id: "p1", qty: 1, opciones: ["v-gris"] }] });
  assert.equal(r.lineas[0].title, "Sofá X (Gris)");
});

test("opciones: pieza de combo registra los valores por defecto y NO cambia el precio del combo", async () => {
  const combo = { id: "c1", precio_combo: 1200, activo: true, vence_el: null, combo_items: [
    { cantidad: 1, product_id: "p1", products: { precio: 1000 } }, { cantidad: 1, product_id: "p2", products: { precio: 500 } } ] };
  const r = await calcularPedido({
    supabase: fakeSupabase({ products: [P1n, P2], combos: [combo], grupos: G1 }), order: recojo,
    items: [{ product_id: "p1", qty: 1, comboId: "c1", title: "Combo Sala" }, { product_id: "p2", qty: 1, comboId: "c1", title: "Combo Sala" }],
  });
  assert.equal(r.subtotal, 1200);
  assert.equal(r.lineas[0].title, "Combo Sala");
  assert.deepEqual(r.lineas[0].opciones_snapshot.map((o) => o.valor), ["Tela", "Dorado"]);
  assert.equal(r.lineas[0].precio_opciones, 0);
});

test("validarCarrito: con opciones, el precio avisado coincide con el que cobra calcularPedido", async () => {
  const sb = fakeSupabase({ products: [{ ...V(P1), nombre: "Sofá X" }], grupos: G1 });
  const items = [{ product_id: "p1", qty: 1, price: 1300, opciones: ["v-cuero"] }];
  const v = await validarCarrito({ supabase: sb, items });
  const c = await calcularPedido({ supabase: sb, order: recojo, items });
  assert.equal(v.lineas[0].estado, "ok");
  assert.equal(v.lineas[0].precio_actual, c.lineas[0].unit_price);
  const malo = await validarCarrito({ supabase: sb, items: [{ ...items[0], opciones: ["v-off"] }] });
  assert.equal(malo.lineas[0].estado, "opcion_no_disponible");
});

test("opciones: la oferta vigente también descuenta el ajuste de la opción", async () => {
  // P2: S/ 500 con 10 % de oferta. Opción +S/ 100 → (500 + 100) × 0.9 = 540
  const g = [{ id: "g-m", product_id: "p2", tipo: "tapizado", etiqueta: "Tapizado", obligatorio: false, orden: 1,
    producto_opcion_valores: [val("v-b", "Base", 0, { es_default: true }), val("v-p", "Premium", 100)] }];
  const sb = fakeSupabase({ products: [{ ...P2, nombre: "Sillón Y" }], grupos: g });
  const r = await calcularPedido({ supabase: sb, order: recojo, items: [{ product_id: "p2", qty: 1, opciones: ["v-p"] }] });
  assert.equal(r.lineas[0].unit_price, 540);
  assert.equal(r.lineas[0].precio_opciones, 90); // 540 − 450 (precio con oferta sin opción)
  const v = await validarCarrito({ supabase: fakeSupabase({ products: [V({ ...P2, nombre: "Sillón Y" })], grupos: g }), items: [{ product_id: "p2", qty: 1, price: 540, opciones: ["v-p"] }] });
  assert.equal(v.lineas[0].estado, "ok");
});
// ── Parte 8.4: efectivo ──────────────────────────────────────────────────────
import { modalidadPago, calcularAdelanto, PORCENTAJE_ADELANTO } from "./pagos.js";

test("modalidadPago: tarjeta y Yape/Plin se cobran completos online; sin método = tarjeta", () => {
  for (const m of ["tarjeta", "yape_plin", undefined]) {
    assert.equal(modalidadPago({ metodo_pago: m, metodo_entrega: "domicilio", destino: "lima" }).modalidad, "online_total");
    assert.equal(modalidadPago({ metodo_pago: m, metodo_entrega: "domicilio", destino: "provincia" }).modalidad, "online_total");
    assert.equal(modalidadPago({ metodo_pago: m, metodo_entrega: "recojo_tienda" }).modalidad, "online_total");
  }
});

test("modalidadPago: efectivo solo en recojo (sin cobro online) o delivery Lima (adelanto); provincia se rechaza", () => {
  assert.equal(modalidadPago({ metodo_pago: "efectivo", metodo_entrega: "recojo_tienda" }).modalidad, "efectivo_recojo");
  assert.equal(modalidadPago({ metodo_pago: "efectivo", metodo_entrega: "domicilio", destino: "lima" }).modalidad, "efectivo_adelanto");
  assert.throws(() => modalidadPago({ metodo_pago: "efectivo", metodo_entrega: "domicilio", destino: "provincia" }), PagoError);
  assert.throws(() => modalidadPago({ metodo_pago: "bitcoin", metodo_entrega: "recojo_tienda" }), PagoError);
});

test("calcularAdelanto: 30 % del total, nunca menos que el flete ni más que el total", () => {
  assert.equal(PORCENTAJE_ADELANTO, 0.3);
  assert.equal(calcularAdelanto({ total: 2310, envio: 60 }), 693);   // 30 % de 2310
  assert.equal(calcularAdelanto({ total: 100, envio: 60 }), 60);     // el flete pesa más que el 30 %
  assert.equal(calcularAdelanto({ total: 50, envio: 60 }), 50);      // tope: el total
  assert.equal(calcularAdelanto({ total: 333.33, envio: 25 }), 100); // redondeo a céntimos
});

import { readFileSync } from "node:fs";
test("el % de adelanto que muestra el navegador (src/lib/pagoEfectivo.ts) es el mismo que cobra el servidor", () => {
  const ts = readFileSync(new URL("../src/lib/pagoEfectivo.ts", import.meta.url), "utf-8");
  const m = ts.match(/PORCENTAJE_ADELANTO\s*=\s*([\d.]+)/);
  assert.ok(m, "no se encontró PORCENTAJE_ADELANTO en src/lib/pagoEfectivo.ts");
  assert.equal(Number(m[1]), PORCENTAJE_ADELANTO);
});
