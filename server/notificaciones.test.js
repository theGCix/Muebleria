// Ejecutar: node --test server/
import { test } from "node:test";
import assert from "node:assert/strict";
import { armarPayloadPedido, notificarPedidoPagado } from "./notificaciones.js";

const order = { id: "o1", order_number: "GM-1", nombre: "Ana Pérez", email: "a@b.com", telefono: "987654321", subtotal: "1100", envio: "150", total: "1250", metodo_entrega: "domicilio", distrito: "Miraflores", paid_at: "2026-10-27T01:16:00Z" };
const items = [{ title: "Sofá London", qty: 1, total: "1100" }];

function fakeSupabase(o = order, it = items) {
  const q = (data) => { const b = { select: () => b, eq: () => b, single: () => Promise.resolve({ data, error: null }), then: (r, j) => Promise.resolve({ data, error: null }).then(r, j) }; return b; };
  return { from: (t) => q(t === "orders" ? o : it) };
}

test("payload: números reales y enlaces", () => {
  const p = armarPayloadPedido(order, items, { siteUrl: "https://tienda.pe/" });
  assert.equal(p.pedido.numero, "GM-1");
  assert.equal(p.pedido.total, 1250);
  assert.equal(p.pedido.requiere_cotizar_flete, false);
  assert.deepEqual(p.items, [{ titulo: "Sofá London", cantidad: 1, total: 1100 }]);
  assert.equal(p.enlaces.cliente_pedidos, "https://tienda.pe/perfil/pedidos");
});

test("payload: provincia por cotizar marca requiere_cotizar_flete", () => {
  assert.equal(armarPayloadPedido({ ...order, envio_estado: "por_cotizar" }, items).pedido.requiere_cotizar_flete, true);
  assert.equal(armarPayloadPedido({ ...order, envio_estado: "cotizado" }, items).pedido.requiere_cotizar_flete, false);
});

test("notifica con secreto y payload; sin URL no llama", async () => {
  let llamada;
  const fetchImpl = async (url, init) => { llamada = { url, init }; return { ok: true, status: 200 }; };
  const env = { N8N_PEDIDO_PAGADO_URL: "https://n8n.x/webhook/gm-pedido-pagado", N8N_WEBHOOK_SECRET: "s3cr3t", FRONTEND_URL: "https://tienda.pe" };
  const r = await notificarPedidoPagado({ supabaseAdmin: fakeSupabase(), orderId: "o1", fetchImpl, env });
  assert.equal(r.ok, true);
  assert.equal(llamada.url, env.N8N_PEDIDO_PAGADO_URL);
  assert.equal(llamada.init.headers["x-webhook-secret"], "s3cr3t");
  assert.equal(JSON.parse(llamada.init.body).pedido.numero, "GM-1");

  llamada = null;
  const sin = await notificarPedidoPagado({ supabaseAdmin: fakeSupabase(), orderId: "o1", fetchImpl, env: {} });
  assert.equal(sin.ok, false);
  assert.equal(llamada, null);
});

test("si n8n falla (red o 500) NO lanza", async () => {
  const env = { N8N_PEDIDO_PAGADO_URL: "https://n8n.x/w" };
  const r1 = await notificarPedidoPagado({ supabaseAdmin: fakeSupabase(), orderId: "o1", env, fetchImpl: async () => { throw new Error("ECONNREFUSED"); } });
  const r2 = await notificarPedidoPagado({ supabaseAdmin: fakeSupabase(), orderId: "o1", env, fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.equal(r1.ok, false);
  assert.equal(r2.ok, false);
});
