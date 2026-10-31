import test from "node:test";
import assert from "node:assert/strict";
import { calcularPedido, autorizarNiubiz, precioConOferta, PagoError } from "./pagos.js";

// Supabase de mentira: devuelve tablas fijas
function fakeSupabase({ products = [], combos = [] }) {
  const tabla = (rows) => ({ select: () => ({ in: async (_c, ids) => ({ data: rows.filter((r) => ids.includes(r.id)), error: null }) }) });
  return { from: (t) => tabla(t === "products" ? products : combos) };
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

test("Niubiz: monto autorizado distinto = no aprobado; 5xx lanza error", async () => {
  const m = await autorizarNiubiz({ ...args, fetchFn: resp(200, { order: { status: "Authorized", authorizedAmount: 1 }, dataMap: { ACTION_CODE: "000" } }) });
  assert.equal(m.aprobado, false);
  await assert.rejects(autorizarNiubiz({ ...args, fetchFn: resp(503, {}) }), PagoError);
});
