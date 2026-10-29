// Ejecutar: node --test server/
import { test } from "node:test";
import assert from "node:assert/strict";
import { crearHerramientas, usuarioDeRequest } from "./chat.js";

function fakeSupabase({ orders = [], items = [], getUser } = {}) {
  const log = [];
  const from = (tabla) => {
    const f = [];
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      eq: (c, v) => (f.push(["eq", c, v]), q),
      ilike: (c, v) => (f.push(["ilike", c, v]), q),
      then: (res, rej) => (log.push({ tabla, f }), Promise.resolve({ data: tabla === "orders" ? orders : items, error: null }).then(res, rej)),
    };
    return q;
  };
  return { from, log, auth: { getUser: getUser ?? (async () => ({ data: { user: null }, error: new Error("x") })) } };
}
const pedido = (extra = {}) => ({ id: "o1", order_number: "GM-1", status: "en_produccion", estimated_delivery: "2026-11-10", metodo_entrega: "domicilio", total: 900, created_at: "2026-10-20", ...extra });
const tool = (sb, ctx) => crearHerramientas({ supabaseAdmin: sb }, ctx).find((t) => t.name === "consultar_pedido");

test("con sesión: lista pedidos de la cuenta sin pedir número ni correo", async () => {
  const sb = fakeSupabase({ orders: [pedido()] });
  const ctx = { cartActions: [], usuario: { id: "u-1", email: "a@b.com" } };
  const r = JSON.parse(await tool(sb, ctx).invoke({}));
  assert.equal(r.encontrado, true);
  assert.equal(r.pedidos[0].estado, "En producción");
  const filtros = sb.log.find((l) => l.tabla === "orders").f;
  assert.deepEqual(filtros, [["eq", "user_id", "u-1"]]);
  assert.equal(ctx.hallazgos.pedido, true);
});

test("con sesión: el correo que envíe el modelo se ignora (solo cuenta propia)", async () => {
  const sb = fakeSupabase({ orders: [pedido()] });
  await tool(sb, { cartActions: [], usuario: { id: "u-1" } }).invoke({ order_number: "GM-1", email: "otro@x.com" });
  const filtros = sb.log.find((l) => l.tabla === "orders").f;
  assert.ok(filtros.some((x) => x[1] === "user_id" && x[2] === "u-1"));
  assert.ok(!filtros.some((x) => x[1] === "email"));
});

test("con sesión sin pedidos → encontrado:false", async () => {
  const r = JSON.parse(await tool(fakeSupabase({ orders: [] }), { cartActions: [], usuario: { id: "u-1" } }).invoke({}));
  assert.equal(r.encontrado, false);
});

test("sin sesión y sin datos → pide iniciar sesión, no consulta la BD", async () => {
  const sb = fakeSupabase({ orders: [pedido()] });
  const r = JSON.parse(await tool(sb, { cartActions: [] }).invoke({}));
  assert.equal(r.requiere_sesion, true);
  assert.equal(sb.log.length, 0);
});

test("sin sesión con número y correo → consulta por ambos", async () => {
  const sb = fakeSupabase({ orders: [pedido()] });
  const r = JSON.parse(await tool(sb, { cartActions: [] }).invoke({ order_number: "GM-1", email: "a@b.com" }));
  assert.equal(r.encontrado, true);
  const f = sb.log.find((l) => l.tabla === "orders").f.map((x) => x[1]);
  assert.deepEqual(f, ["order_number", "email"]);
});

test("usuarioDeRequest: sin header o token inválido → null; token válido → id", async () => {
  assert.equal(await usuarioDeRequest({ headers: {} }, fakeSupabase()), null);
  assert.equal(await usuarioDeRequest({ headers: { authorization: "Bearer x" } }, fakeSupabase()), null);
  const ok = fakeSupabase({ getUser: async () => ({ data: { user: { id: "u-9", email: "z@z.com" } }, error: null }) });
  assert.deepEqual(await usuarioDeRequest({ headers: { authorization: "Bearer t" } }, ok), { id: "u-9", email: "z@z.com" });
});
